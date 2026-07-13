"""
SETU Service Layer — multi-collection persistence with typed schemas.

Services use the collections defined in ``setu_schema.py`` and enforce
payload schemas, duplicate prevention (content_hash), and audit logging.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

import httpx
import openai
from qdrant_client import AsyncQdrantClient, exceptions as qdrant_exceptions
from qdrant_client import models as qdrant_models
from slack_sdk.web.async_client import AsyncWebClient

from .setu_schema import (
    DUMMY_VECTOR,
    COLLECTIONS,
    content_hash,
    ensure_all_collections,
)

logger = logging.getLogger("setu-service")

# ---------------------------------------------------------------------------
# Lazy client helpers
# ---------------------------------------------------------------------------
_openai_client: openai.AsyncOpenAI | None = None
_slack_client: AsyncWebClient | None = None
_qdrant_client: AsyncQdrantClient | None = None


def _get_openai() -> openai.AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise RuntimeError("OPENAI_API_KEY is required")
        _openai_client = openai.AsyncOpenAI(api_key=key)
    return _openai_client


def _get_slack() -> AsyncWebClient:
    global _slack_client
    if _slack_client is None:
        token = os.getenv("SLACK_BOT_TOKEN")
        if not token:
            raise RuntimeError("SLACK_BOT_TOKEN is required")
        _slack_client = AsyncWebClient(token=token)
    return _slack_client


def _get_qdrant() -> AsyncQdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = AsyncQdrantClient(
            url=os.getenv("QDRANT_URL", "http://localhost:6333"),
            api_key=os.getenv("QDRANT_API_KEY"),
        )
    return _qdrant_client


# ---------------------------------------------------------------------------
# Retry decorator
# ---------------------------------------------------------------------------
_RETRYABLE = (httpx.RequestError, httpx.HTTPStatusError, openai.APIError,
              qdrant_exceptions.QdrantException, OSError, ConnectionError)


def with_retry(max_retries: int = 3, base_delay: float = 1.0, backoff: float = 2.0,
               exceptions: tuple = _RETRYABLE) -> Callable:
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exc: Exception | None = None
            for attempt in range(1, max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as exc:
                    last_exc = exc
                    if attempt < max_retries:
                        delay = base_delay * (backoff ** (attempt - 1))
                        logger.warning("%s attempt %d/%d failed: %s. Retrying in %.1fs...",
                                       func.__name__, attempt, max_retries, exc, delay)
                        await asyncio.sleep(delay)
                    else:
                        logger.error("%s failed after %d attempts: %s",
                                     func.__name__, max_retries, exc)
            raise last_exc
        return wrapper
    return decorator


# ===================================================================
# Embedding helper
# ===================================================================
async def _embed(text: str) -> list[float]:
    """Generate embedding vector for text."""
    client = _get_openai()
    return (await client.embeddings.create(model="text-embedding-3-small", input=text)).data[0].embedding


# ===================================================================
# Task Service — setu_tasks
# ===================================================================
class TaskService:
    """Field tasks extracted from WhatsApp/Slack notes."""

    COLLECTION = COLLECTIONS["tasks"].name

    @staticmethod
    @with_retry()
    async def create(
        task_text: str,
        project: str = "general",
        due_date: str | None = None,
        source_channel: str = "",
        source_user_id: str = "",
    ) -> int:
        valid_projects = ("barmer_edu", "health", "vendor", "general")
        if project not in valid_projects:
            logger.warning("Unknown project '%s', defaulting to 'general'", project)
            project = "general"
        text = task_text.strip()
        if not text:
            raise ValueError("task_text cannot be empty")

        c_hash = content_hash(text)
        qdrant = _get_qdrant()
        now = datetime.now(timezone.utc).isoformat()

        # Duplicate check
        existing = await qdrant.scroll(
            TaskService.COLLECTION,
            limit=1,
            with_payload=False,
            filter=qdrant_models.Filter(
                must=[qdrant_models.FieldCondition(key="content_hash", match=qdrant_models.MatchValue(value=c_hash))]
            ),
        )
        if existing[0]:
            existing_id = existing[0][0].id
            logger.info("Duplicate task skipped (hash=%s, existing_id=%s)", c_hash[:12], existing_id)
            return int(existing_id) % 10_000_000

        vector = await _embed(text)
        point_id = uuid.uuid5(uuid.NAMESPACE_DNS, text).int % 10_000_000
        await qdrant.upsert(TaskService.COLLECTION, points=[qdrant_models.PointStruct(
            id=point_id, vector=vector,
            payload={
                "task_text": text[:2000],
                "project": project,
                "due_date": due_date or "",
                "status": "open",
                "source_channel": source_channel[:200],
                "source_user_id": source_user_id[:200],
                "content_hash": c_hash,
                "created_at": now,
                "updated_at": now,
            },
        )])
        await AuditService.log("task_create", source_user_id or "system", "tasks", str(point_id),
                               {"project": project, "text_preview": text[:80]})
        logger.info("Task created id=%d: %.80s", point_id, text)
        return point_id

    @staticmethod
    @with_retry()
    async def search(query: str, limit: int = 10, project: str | None = None) -> list[dict[str, Any]]:
        limit = min(max(limit, 1), 50)
        qdrant = _get_qdrant()
        qf = None
        if project:
            qf = qdrant_models.Filter(must=[qdrant_models.FieldCondition(key="project", match=qdrant_models.MatchValue(value=project))])
        vector = await _embed(query)
        results = await qdrant.search(TaskService.COLLECTION, query_vector=vector, limit=limit, query_filter=qf, with_payload=True)
        return [{"id": r.id, **r.payload, "score": round(r.score, 4)} for r in results] if results else []


# ===================================================================
# Verified Memory Service — setu_verified_memory
# ===================================================================
class VerifiedMemoryService:
    """Admin-verified knowledge snapshots from Slack threads."""

    COLLECTION = COLLECTIONS["verified_memory"].name

    @staticmethod
    @with_retry()
    async def store(
        thread_text: str,
        project: str = "general",
        source_channel: str = "",
        source_ts: str = "",
        verified_by: str = "",
        answer_summary: str = "",
        tags: list[str] | None = None,
    ) -> int:
        text = thread_text.strip()
        if not text:
            raise ValueError("thread_text cannot be empty")

        c_hash = content_hash(text)
        qdrant = _get_qdrant()
        now = datetime.now(timezone.utc).isoformat()

        # Duplicate check
        existing = await qdrant.scroll(
            VerifiedMemoryService.COLLECTION,
            limit=1, with_payload=False,
            filter=qdrant_models.Filter(must=[qdrant_models.FieldCondition(key="content_hash", match=qdrant_models.MatchValue(value=c_hash))]),
        )
        if existing[0]:
            existing_id = existing[0][0].id
            logger.info("Duplicate verified_memory skipped (hash=%s, existing_id=%s)", c_hash[:12], existing_id)
            return int(existing_id) % 10_000_000

        vector = await _embed(text)
        point_id = uuid.uuid5(uuid.NAMESPACE_DNS, text).int % 10_000_000
        await qdrant.upsert(VerifiedMemoryService.COLLECTION, points=[qdrant_models.PointStruct(
            id=point_id, vector=vector,
            payload={
                "thread_text": text[:5000],
                "project": project,
                "source_channel": source_channel[:200],
                "source_ts": source_ts[:100],
                "verified_by": verified_by[:200],
                "verified_at": now,
                "answer_summary": answer_summary[:1000],
                "tags": json.dumps(tags or [], default=str),
                "content_hash": c_hash,
                "stored_at": now,
            },
        )])
        await AuditService.log("snapshot", verified_by or "system", "verified_memory", str(point_id),
                               {"project": project, "source_channel": source_channel})
        logger.info("Verified memory id=%d by %s: %.80s", point_id, verified_by, text[:80])
        return point_id

    @staticmethod
    @with_retry()
    async def search(query: str, limit: int = 10, project: str | None = None) -> list[dict[str, Any]]:
        limit = min(max(limit, 1), 50)
        qdrant = _get_qdrant()
        qf = None
        if project:
            qf = qdrant_models.Filter(must=[qdrant_models.FieldCondition(key="project", match=qdrant_models.MatchValue(value=project))])
        vector = await _embed(query)
        results = await qdrant.search(VerifiedMemoryService.COLLECTION, query_vector=vector, limit=limit, query_filter=qf, with_payload=True)
        return [{"id": r.id, **r.payload, "score": round(r.score, 4)} for r in results] if results else []

    @staticmethod
    @with_retry()
    async def list(limit: int = 50, offset: int = 0, project: str | None = None) -> tuple[list[dict[str, Any]], int]:
        limit = min(max(limit, 1), 100)
        qdrant = _get_qdrant()
        qf = None
        if project:
            qf = qdrant_models.Filter(must=[qdrant_models.FieldCondition(key="project", match=qdrant_models.MatchValue(value=project))])
        hits, next_offset = await qdrant.scroll(VerifiedMemoryService.COLLECTION, limit=limit, offset=offset, with_payload=True, filter=qf)
        entries = [{"id": h.id, **h.payload} for h in hits]
        return entries, next_offset or 0

    @staticmethod
    @with_retry()
    async def delete(point_id: int) -> bool:
        qdrant = _get_qdrant()
        await qdrant.delete(VerifiedMemoryService.COLLECTION, points_selector=qdrant_models.PointIdsList(ids=[point_id]))
        logger.info("Deleted verified_memory id=%d", point_id)
        return True


# ===================================================================
# Image Alt-Text Service — setu_image_alt_text
# ===================================================================
class ImageAltTextService:
    """Alt-text generated for images by GPT-4o Vision."""

    COLLECTION = COLLECTIONS["image_alt_text"].name

    @staticmethod
    @with_retry()
    async def store(
        alt_text: str,
        file_id: str = "",
        original_name: str = "",
        mime_type: str = "",
        channel_id: str = "",
        generated_by: str = "gpt-4o",
    ) -> int:
        text = alt_text.strip()
        if not text:
            raise ValueError("alt_text cannot be empty")

        c_hash = content_hash(text)
        qdrant = _get_qdrant()
        now = datetime.now(timezone.utc).isoformat()

        existing = await qdrant.scroll(
            ImageAltTextService.COLLECTION,
            limit=1, with_payload=False,
            filter=qdrant_models.Filter(must=[qdrant_models.FieldCondition(key="content_hash", match=qdrant_models.MatchValue(value=c_hash))]),
        )
        if existing[0]:
            existing_id = existing[0][0].id
            logger.info("Duplicate alt_text skipped (hash=%s, existing_id=%s)", c_hash[:12], existing_id)
            return int(existing_id) % 10_000_000

        vector = await _embed(text)
        point_id = uuid.uuid5(uuid.NAMESPACE_DNS, text).int % 10_000_000
        await qdrant.upsert(ImageAltTextService.COLLECTION, points=[qdrant_models.PointStruct(
            id=point_id, vector=vector,
            payload={
                "alt_text": text[:2000],
                "file_id": file_id[:200],
                "original_name": original_name[:200],
                "mime_type": mime_type[:50],
                "channel_id": channel_id[:200],
                "generated_by": generated_by[:50],
                "generated_at": now,
                "verified": False,
                "verified_by": "",
                "content_hash": c_hash,
            },
        )])
        await AuditService.log("alt_text", "system", "image_alt_text", str(point_id),
                               {"file_id": file_id, "generated_by": generated_by})
        logger.info("Alt-text id=%d for file %s: %.80s", point_id, file_id, text[:80])
        return point_id


# ===================================================================
# Weekly Report Service — setu_weekly_reports
# ===================================================================
class WeeklyReportService:
    """Weekly summary reports (dummy vector, not semantically searched)."""

    COLLECTION = COLLECTIONS["weekly_reports"].name

    @staticmethod
    @with_retry()
    async def store(
        project: str,
        report_text: str,
        period_start: str,
        period_end: str,
        entries_count: int = 0,
        canvas_url: str = "",
        channel_posted_to: str = "",
    ) -> int:
        point_id = int(time.time() * 1000) % 10_000_000
        qdrant = _get_qdrant()
        await qdrant.upsert(WeeklyReportService.COLLECTION, points=[qdrant_models.PointStruct(
            id=point_id, vector=DUMMY_VECTOR,
            payload={
                "project": project[:100],
                "report_text": report_text[:5000],
                "period_start": period_start,
                "period_end": period_end,
                "entries_count": entries_count,
                "canvas_url": canvas_url[:500],
                "channel_posted_to": channel_posted_to[:200],
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
        )])
        await AuditService.log("summary", "system", "weekly_reports", str(point_id),
                               {"project": project, "period": f"{period_start}..{period_end}"})
        logger.info("Weekly report id=%d for %s (%s..%s)", point_id, project, period_start, period_end)
        return point_id


# ===================================================================
# Audit Log Service — setu_audit_logs
# ===================================================================
class AuditService:
    """Immutable audit trail. Logs are never deleted or updated."""

    COLLECTION = COLLECTIONS["audit_logs"].name

    @staticmethod
    @with_retry()
    async def log(
        action: str,
        actor_id: str,
        resource_type: str,
        resource_id: str = "",
        details: dict[str, Any] | None = None,
        ip_address: str = "",
    ) -> int:
        point_id = int(time.time() * 1_000_000) % 10_000_000
        qdrant = _get_qdrant()
        await qdrant.upsert(AuditService.COLLECTION, points=[qdrant_models.PointStruct(
            id=point_id, vector=DUMMY_VECTOR,
            payload={
                "action": action[:100],
                "actor_id": actor_id[:200],
                "resource_type": resource_type[:100],
                "resource_id": resource_id[:200],
                "details": json.dumps(details or {}, default=str)[:2000],
                "ip_address": ip_address[:50],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )])
        return point_id

    @staticmethod
    @with_retry()
    async def search(
        action: str | None = None,
        actor_id: str | None = None,
        resource_type: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        limit = min(max(limit, 1), 200)
        qdrant = _get_qdrant()
        must_conditions: list[qdrant_models.Condition] = []
        if action:
            must_conditions.append(qdrant_models.FieldCondition(key="action", match=qdrant_models.MatchValue(value=action)))
        if actor_id:
            must_conditions.append(qdrant_models.FieldCondition(key="actor_id", match=qdrant_models.MatchValue(value=actor_id)))
        if resource_type:
            must_conditions.append(qdrant_models.FieldCondition(key="resource_type", match=qdrant_models.MatchValue(value=resource_type)))

        qf = qdrant_models.Filter(must=must_conditions) if must_conditions else None
        qdrant_c = _get_qdrant()
        hits, _ = await qdrant_c.scroll(AuditService.COLLECTION, limit=limit, with_payload=True, filter=qf)
        return [{"id": h.id, **h.payload} for h in hits]


# ===================================================================
# Analytics Service — in-memory usage tracking
# ===================================================================
@dataclass
class AnalyticsSnapshot:
    total_queries: int = 0
    total_tasks: int = 0
    total_snapshots: int = 0
    total_alt_texts: int = 0
    total_transcriptions: int = 0
    rts_api_calls: int = 0
    qdrant_writes: int = 0
    qdrant_reads: int = 0
    openai_calls: int = 0
    errors: int = 0
    start_time: float = 0.0
    end_time: float = 0.0


class AnalyticsService:
    _counters: dict[str, int] = defaultdict(int)
    _lock = asyncio.Lock()

    @classmethod
    async def increment(cls, metric: str, count: int = 1) -> None:
        async with cls._lock:
            cls._counters[metric] += count

    @classmethod
    async def get_snapshot(cls) -> AnalyticsSnapshot:
        async with cls._lock:
            now = time.time()
            s = AnalyticsSnapshot(
                total_queries=cls._counters.get("queries", 0),
                total_tasks=cls._counters.get("tasks", 0),
                total_snapshots=cls._counters.get("snapshots", 0),
                total_alt_texts=cls._counters.get("alt_texts", 0),
                total_transcriptions=cls._counters.get("transcriptions", 0),
                rts_api_calls=cls._counters.get("rts_api_calls", 0),
                qdrant_writes=cls._counters.get("qdrant_writes", 0),
                qdrant_reads=cls._counters.get("qdrant_reads", 0),
                openai_calls=cls._counters.get("openai_calls", 0),
                errors=cls._counters.get("errors", 0),
                start_time=cls._counters.get("_start_time", now),
                end_time=now,
            )
            if "_start_time" not in cls._counters:
                cls._counters["_start_time"] = now
            return s

    @classmethod
    async def reset(cls) -> None:
        async with cls._lock:
            cls._counters.clear()


# ===================================================================
# Slack Event Service — handle reaction_added / file_shared / message.channels
# ===================================================================
class SlackEventService:
    """Process Slack Events API events that LangBot's adapter doesn't handle."""

    @staticmethod
    async def handle_reaction_added(event: dict[str, Any]) -> dict[str, Any]:
        reaction = event.get("reaction", "")
        user = event.get("user", "")
        item = event.get("item", {})
        channel = item.get("channel", "")
        ts = item.get("ts", "")
        logger.info("Reaction: %s by user %s on %s/%s", reaction, user, channel, ts)

        if reaction != "white_check_mark":
            return {"status": "ignored", "reason": f"unhandled_reaction:{reaction}"}

        admin_ids = set(u.strip() for u in os.getenv("ADMIN_USER_IDS", "").split(",") if u.strip())
        if user not in admin_ids:
            logger.info("Non-admin %s tried snapshot, ignoring", user)
            return {"status": "ignored", "reason": "not_admin"}

        slack = _get_slack()
        try:
            thread = await slack.conversations_replies(channel=channel, ts=ts)
        except Exception as exc:
            logger.error("Failed to fetch thread %s/%s: %s", channel, ts, exc)
            return {"status": "error", "reason": str(exc)}

        messages = thread.get("messages", [])
        full_text = "\n".join(m.get("text", "") for m in messages if m.get("text"))
        if not full_text:
            logger.warning("Empty thread for snapshot %s/%s", channel, ts)
            return {"status": "ignored", "reason": "empty_thread"}

        try:
            point_id = await VerifiedMemoryService.store(
                thread_text=full_text,
                source_channel=channel,
                source_ts=ts,
                verified_by=user,
            )
            await AnalyticsService.increment("snapshots")
        except Exception as exc:
            logger.error("Failed to store snapshot: %s", exc)
            return {"status": "error", "reason": str(exc)}

        try:
            await slack.chat_postMessage(
                channel=channel, thread_ts=ts,
                text=":white_check_mark: Snapshot saved to Setu memory. Future queries will reference this.",
            )
        except Exception as exc:
            logger.warning("Failed to post confirmation: %s", exc)

        logger.info("Snapshot saved from %s/%s by %s", channel, ts, user)
        return {"status": "ok", "point_id": point_id, "entries": len(messages)}

    @staticmethod
    async def handle_file_shared(event: dict[str, Any]) -> dict[str, Any]:
        file_id = event.get("file_id", "")
        user = event.get("user_id", "")
        logger.info("File shared: %s by user %s", file_id, user)

        slack = _get_slack()
        try:
            file_info = await slack.files_info(file=file_id)
            file_data = file_info.get("file", {})
        except Exception as exc:
            logger.error("Failed to get file info %s: %s", file_id, exc)
            return {"status": "error", "reason": str(exc)}

        mime_type = file_data.get("mimetype", "")
        if not mime_type.startswith("image/"):
            logger.debug("Non-image file %s (%s), ignoring", file_id, mime_type)
            return {"status": "ignored", "reason": "not_image"}

        url_private = file_data.get("url_private")
        if not url_private:
            logger.warning("File %s has no url_private", file_id)
            return {"status": "error", "reason": "no_url_private"}

        channel = file_data.get("channels", [None])[0] if file_data.get("channels") else None
        if not channel:
            channel = event.get("channel_id", "")

        try:
            resp = await slack.client.get(url_private)
            resp.raise_for_status()
            image_bytes = resp.content
        except Exception as exc:
            logger.error("Failed to download image %s: %s", file_id, exc)
            return {"status": "error", "reason": f"download_failed:{exc}"}

        client = _get_openai()
        try:
            b64 = base64.b64encode(image_bytes).decode()
            data_uri = f"data:{mime_type};base64,{b64}"
            alt_text_resp = await client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": "Generate alt-text for accessibility. Be concise, describe people, text in image, and action. Start with 'Alt:'"},
                    {"type": "image_url", "image_url": {"url": data_uri}},
                ]}],
                max_tokens=300,
            )
            alt_text = alt_text_resp.choices[0].message.content or "[No description]"
        except Exception as exc:
            logger.error("Alt-text generation failed for %s: %s", file_id, exc)
            alt_text = f"[Alt-text generation failed: {exc}]"

        try:
            channel_to_post = channel or event.get("channel_id", "")
            await slack.chat_postMessage(
                channel=channel_to_post,
                text=f":eye: *Accessible Alt-text generated:*\n{alt_text}\n\nReact with :white_check_mark: if accurate to save to knowledge base.",
            )
            await AnalyticsService.increment("alt_texts")
        except Exception as exc:
            logger.error("Failed to post alt-text: %s", exc)

        try:
            await ImageAltTextService.store(
                alt_text=alt_text,
                file_id=file_id,
                original_name=file_data.get("name", ""),
                mime_type=mime_type,
                channel_id=channel or "",
            )
        except Exception as exc:
            logger.warning("Failed to store alt-text in Qdrant: %s", exc)

        return {"status": "ok", "alt_text": alt_text}

    @staticmethod
    async def handle_message(event: dict[str, Any]) -> dict[str, Any]:
        text = event.get("text", "").strip()
        channel = event.get("channel", "")
        ts = event.get("ts", "")
        if not text:
            return {"status": "ignored", "reason": "empty"}

        field_ops_channel = os.getenv("FIELD_OPS_CHANNEL", "#field-ops")
        field_ops_channel_id = os.getenv("FIELD_OPS_CHANNEL_ID", "")
        is_field_ops = channel in (field_ops_channel, field_ops_channel_id)

        lower = text.lower()
        is_query = ("?" in text or lower.startswith("setu") or "anyone solved" in lower or "how did we" in lower)
        if not is_query and not is_field_ops:
            return {"status": "ignored", "reason": "not_field_ops_or_query"}

        await AnalyticsService.increment("queries")

        # Search verified memory first, then tasks
        mem_entries: list[dict[str, Any]] = []
        try:
            mem_entries = await VerifiedMemoryService.search(query=text, limit=5)
            await AnalyticsService.increment("qdrant_reads")
        except Exception as exc:
            logger.warning("Verified memory search failed: %s", exc)

        task_entries: list[dict[str, Any]] = []
        try:
            task_entries = await TaskService.search(query=text, limit=3)
        except Exception:
            pass

        # Search Slack RTS
        slack_hits: list[dict[str, Any]] = []
        user_token = os.getenv("SLACK_USER_TOKEN")
        if user_token:
            try:
                from .rts_adapter import rts_search  # type: ignore[import-untyped]
                slack_hits = await rts_search(text, user_token=user_token, count=5)
                await AnalyticsService.increment("rts_api_calls")
            except Exception as exc:
                logger.warning("RTS search failed: %s", exc)

        # Build context
        context_parts: list[str] = []
        if mem_entries:
            context_parts.append("=== Verified Knowledge ===")
            for e in mem_entries:
                t = (e.get("thread_text") or e.get("answer_summary") or "")[:300]
                context_parts.append(f"- {t} (project: {e.get('project', '?')})")
        if task_entries:
            context_parts.append("\n=== Previous Tasks ===")
            for e in task_entries:
                context_parts.append(f"- {e.get('task_text', '')[:200]} (project: {e.get('project', '?')})")
        if slack_hits:
            context_parts.append("\n=== Slack History ===")
            for h in slack_hits:
                context_parts.append(f"- {h.get('text', '')[:200]} (from #{h.get('channel', '?')})")

        if not context_parts:
            return {"status": "ok", "reply": None, "reason": "no_context"}

        client = _get_openai()
        try:
            answer = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are Setu, an NGO field memory assistant. Answer using ONLY the context provided. Cite sources like [Verified Knowledge], [Previous Tasks], or [#channel]. If the context doesn't contain the answer, say so."},
                    {"role": "user", "content": f"Context:\n{''.join(context_parts)}\n\nQuestion: {text}"},
                ],
                max_tokens=1024,
            )
            reply = answer.choices[0].message.content or "I couldn't find an answer."
            reply += f"\n\n_Sources: {len(mem_entries) + len(task_entries) + len(slack_hits)} items searched_"
        except Exception as exc:
            logger.error("Answer generation failed: %s", exc)
            reply = "Sorry, I encountered an error while searching."

        slack = _get_slack()
        try:
            await slack.chat_postMessage(channel=channel, thread_ts=ts, text=reply)
        except Exception as exc:
            logger.error("Failed to post reply: %s", exc)

        await AnalyticsService.increment("openai_calls")
        return {"status": "ok", "reply": reply[:100]}


# ===================================================================
# Summary Service — Canvas-based weekly summaries
# ===================================================================
class SummaryService:
    """Generate weekly summaries from verified_memory + tasks, post to Canvas."""

    CANVAS_CHANNEL = os.getenv("SUMMARY_CHANNEL", "#field-ops")

    @staticmethod
    @with_retry(max_retries=2)
    async def generate_weekly(days: int = 7) -> list[dict[str, Any]]:
        slack = _get_slack()
        client = _get_openai()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        # Gather recent verified memory and tasks
        mem_entries, _ = await VerifiedMemoryService.list(limit=100)
        task_entries, _ = await TaskService.search(query="", limit=50)  # fallback: recent tasks

        grouped: dict[str, list[str]] = {}
        for e in mem_entries:
            stored = e.get("stored_at") or e.get("verified_at") or ""
            if stored and stored < cutoff:
                continue
            proj = e.get("project", "general")
            text = e.get("thread_text") or e.get("answer_summary") or ""
            if text:
                grouped.setdefault(proj, []).append(text[:300])

        for e in task_entries:
            created = e.get("created_at", "")
            if created and created < cutoff:
                continue
            proj = e.get("project", "general")
            text = e.get("task_text", "")
            if text:
                grouped.setdefault(proj, []).append(f"[Task] {text[:200]}")

        if not grouped:
            logger.info("No recent entries for weekly summary")
            return []

        results: list[dict[str, Any]] = []
        for proj, texts in grouped.items():
            try:
                summary = (await client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": f"Summarize the last {days} days of progress for project '{proj}' for an NGO field operations team. Be concise, highlight achievements, flag issues, and suggest next steps:\n\n" + "\n".join(texts[:20])}],
                    max_tokens=512,
                )).choices[0].message.content or "[No summary generated]"
            except Exception as exc:
                logger.error("Summary failed for %s: %s", proj, exc)
                summary = f"[Summary generation failed: {exc}]"

            await AnalyticsService.increment("openai_calls")

            canvas_url: str | None = None
            conv_id = SummaryService.CANVAS_CHANNEL
            try:
                if conv_id.startswith("#"):
                    response = await slack.conversations_list(types="public_channel,private_channel")
                    for ch in response.get("channels", []):
                        if ch["name"] == conv_id.lstrip("#"):
                            conv_id = ch["id"]
                            break

                canvas_resp = await slack.conversations_canvases_create(
                    channel_id=conv_id,
                    content={"title": f"Weekly Memory: {proj}", "text": f"*SETU Weekly Memory — {proj}*\n*Period:* Last {days} days\n*Entries:* {len(texts)}\n\n{summary}\n\n_Auto-generated by SETU Field Memory Bridge_"},
                )
                if canvas_resp.get("ok"):
                    canvas_url = canvas_resp.get("canvas", {}).get("url", "")
                else:
                    msg = await slack.chat_postMessage(channel=conv_id, text=f"*Weekly Memory: {proj}*\n{summary}")
                    canvas_url = msg.get("ts", "")
            except Exception as exc:
                logger.warning("Canvas API failed for %s, falling back: %s", proj, exc)
                try:
                    msg = await slack.chat_postMessage(channel=SummaryService.CANVAS_CHANNEL, text=f"*Weekly Memory: {proj}*\n{summary}")
                    canvas_url = msg.get("ts", "")
                except Exception as msg_exc:
                    logger.error("Fallback message also failed: %s", msg_exc)

            # Store report
            period_end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            period_start = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
            try:
                await WeeklyReportService.store(
                    project=proj,
                    report_text=summary,
                    period_start=period_start,
                    period_end=period_end,
                    entries_count=len(texts),
                    canvas_url=canvas_url or "",
                    channel_posted_to=str(conv_id),
                )
            except Exception as exc:
                logger.warning("Failed to store weekly report: %s", exc)

            results.append({"project": proj, "summary": summary[:200], "canvas_url": canvas_url or "", "entries_count": len(texts)})

        return results

    @staticmethod
    async def trigger(days: int = 7) -> dict[str, Any]:
        logger.info("Manual weekly summary triggered (days=%d)", days)
        results = await SummaryService.generate_weekly(days=days)
        return {"status": "ok" if results else "no_data", "projects": len(results), "results": results}
