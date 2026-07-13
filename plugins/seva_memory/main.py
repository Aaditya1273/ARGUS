"""
SETU - Seva Memory Plugin

Production-grade LangBot plugin for NGO field memory management.
Provides EventListener components for Slack integration, Tool components for MCP,
and scheduled tasks for weekly summaries.

Dependencies: openai, qdrant-client, slack-sdk, apscheduler
"""
from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import openai
from qdrant_client import AsyncQdrantClient, models as qdrant_models
from slack_sdk.web.async_client import AsyncWebClient

# ---------------------------------------------------------------------------
# Plugin SDK imports - LangBot plugin runtime (separate process architecture)
# ---------------------------------------------------------------------------
# These are the actual LangBot plugin SDK imports. The plugin runs in its own
# process, communicating with LangBot via the plugin runtime protocol.
from langbot_plugin.api.definition.components.event_listener import EventListener
from langbot_plugin.api.definition.components.tool import Tool
from langbot_plugin.api.entities.builtin.platform import (
    events as platform_events,
    message as platform_message,
)
from langbot_plugin.api.entities.events import (
    GroupMessageReceived,
    PersonMessageReceived,
    BaseEventModel,
)
from langbot_plugin.api.entities.context import EventContext
from langbot_plugin.runtime.plugin.base import BasePlugin
from langbot_plugin.runtime.plugin.logger import get_plugin_logger

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
COLLECTION = "setu_memory"
FIELD_OPS_CHANNEL = os.getenv("FIELD_OPS_CHANNEL", "#field-ops")
SUMMARY_CHANNEL = os.getenv("SUMMARY_CHANNEL", FIELD_OPS_CHANNEL)
SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN")
SLACK_USER_TOKEN = os.getenv("SLACK_USER_TOKEN")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
ADMIN_USER_IDS = set(
    uid.strip()
    for uid in os.getenv("ADMIN_USER_IDS", "").split(",")
    if uid.strip()
)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# ---------------------------------------------------------------------------
# Shared clients (lazy-initialized, not at module level)
# ---------------------------------------------------------------------------
_openai_client: openai.AsyncOpenAI | None = None
_slack_client: AsyncWebClient | None = None
_qdrant_client: AsyncQdrantClient | None = None
_logger: logging.Logger | None = None


def _get_logger() -> logging.Logger:
    global _logger
    if _logger is None:
        _logger = get_plugin_logger("seva_memory")
    return _logger


# ---------------------------------------------------------------------------
# SSRF protection: URL validation helpers
# ---------------------------------------------------------------------------
def _validate_media_url(url: str, allowed_protocols: set[str] | None = None) -> str:
    """Validate media URLs to prevent SSRF attacks.

    Rules:
    - Only HTTPS allowed (no http, file, ftp, etc.)
    - No internal IPs (localhost, 10.x, 172.16-31.x, 192.168.x, etc.)
    - No private DNS suffixes (.local, .internal, etc.)

    Returns the validated URL.
    Raises ValueError if URL is invalid or blocked.
    """
    if allowed_protocols is None:
        allowed_protocols = {"https"}

    url = url.strip()
    if not url:
        raise ValueError("URL is empty")

    # Check protocol
    if "://" not in url:
        raise ValueError("URL must include protocol (e.g., https://)")

    protocol = url.split("://")[0].lower()
    if protocol not in allowed_protocols:
        raise ValueError(f"Protocol '{protocol}' not allowed. Only HTTPS is permitted.")

    # Block file:// and data:// explicitly
    if url.startswith("file://") or url.startswith("data:"):
        raise ValueError("file:// and data: protocols are blocked for security")

    # Parse host
    host = url.split("://")[1].split("/")[0].split(":")[0].lower()

    # Block localhost / loopback
    if host in ("localhost", "127.0.0.1", "0.0.0.0", "[::1]", "[::]"):
        raise ValueError(f"Internal address '{host}' is blocked for security")

    # Block private IP ranges
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            raise ValueError(f"Private IP '{host}' is blocked for security")
    except ValueError:
        # Not an IP address, likely a hostname — allow it
        # Block internal DNS suffixes
        blocked_suffixes = (".local", ".internal", ".lan", ".home", ".corp", ".private")
        for suffix in blocked_suffixes:
            if host.endswith(suffix):
                raise ValueError(f"Internal hostname '{host}' is blocked for security")
        pass

    return url


def _validate_audio_url(url: str) -> str:
    """Validate audio URLs. Only HTTPS media links allowed."""
    return _validate_media_url(url, allowed_protocols={"https"})


def _validate_image_url(url: str) -> str:
    """Validate image URLs. Only HTTPS media links allowed."""
    return _validate_media_url(url, allowed_protocols={"https"})


def _get_openai() -> openai.AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY environment variable is required")
        _openai_client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


def _get_slack() -> AsyncWebClient:
    global _slack_client
    if _slack_client is None:
        if not SLACK_BOT_TOKEN:
            raise RuntimeError("SLACK_BOT_TOKEN environment variable is required")
        _slack_client = AsyncWebClient(token=SLACK_BOT_TOKEN)
    return _slack_client


def _get_qdrant() -> AsyncQdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = AsyncQdrantClient(url=QDRANT_URL)
    return _qdrant_client


# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------
def _load_prompt(name: str) -> str:
    """Load a prompt template from the prompts/ directory bundled with this plugin."""
    base = os.path.join(os.path.dirname(__file__), "prompts")
    path = os.path.join(base, name)
    try:
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        _get_logger().warning("Prompt file %s not found, using fallback", path)
        return ""


INTENT_SYSTEM_PROMPT = _load_prompt("intent.txt") or (
    "You are Setu intent parser. Extract JSON: "
    '{"intent":"create_task|query|done","project":"barmer_edu|health|vendor|general",'
    '"due_date":"YYYY-MM-DD or null","task_text":"cleaned text"}\n'
    "Today is {today}. Convert relative dates like Thursday, next Friday.\n"
    "Project detection: if text has school, books, teacher -> barmer_edu. vendor, bill -> vendor. health, clinic -> health."
)

ALT_TEXT_PROMPT = _load_prompt("alt_text.txt") or (
    "Generate alt-text for accessibility. Be concise, describe people, "
    "text in image, and action. Start with 'Alt:'"
)

TRANSCRIBE_PROMPT = _load_prompt("transcribe.txt") or (
    "You are translating field worker voice notes from Hindi to English. "
    "Please provide a clear and concise transcription."
)

# ---------------------------------------------------------------------------
# Qdrant helpers
# ---------------------------------------------------------------------------

async def _ensure_collection() -> None:
    """Create the Qdrant collection if it doesn't exist."""
    qdrant = _get_qdrant()
    try:
        await qdrant.get_collection(COLLECTION)
    except Exception:
        _get_logger().info("Creating Qdrant collection '%s'", COLLECTION)
        await qdrant.create_collection(
            COLLECTION,
            vectors_config=qdrant_models.VectorParams(
                size=1536, distance=qdrant_models.Distance.COSINE
            ),
        )


async def _embed_and_store(text: str, payload: dict[str, Any]) -> None:
    """Embed text via OpenAI and store the vector + payload in Qdrant.

    Args:
        text: The text content to embed and store.
        payload: Additional metadata to store alongside the vector.

    Raises:
        openai.APIError: If the embedding API call fails.
    """
    client = _get_openai()
    qdrant = _get_qdrant()
    emb = (
        await client.embeddings.create(
            model="text-embedding-3-small", input=text
        )
    ).data[0].embedding

    point_id = uuid.uuid5(uuid.NAMESPACE_DNS, text).int % 10_000_000
    await qdrant.upsert(
        COLLECTION,
        points=[
            qdrant_models.PointStruct(
                id=point_id,
                vector=emb,
                payload=payload | {"text": text, "stored_at": datetime.now(timezone.utc).isoformat()},
            )
        ],
    )


async def _download_slack_image(file_obj: dict[str, Any]) -> bytes:
    """Download a Slack image file using the bot token for authentication.

    Args:
        file_obj: Slack file object containing url_private and other metadata.

    Returns:
        Raw bytes of the image.

    Raises:
        ValueError: If the file cannot be downloaded.
    """
    slack = _get_slack()
    url = file_obj.get("url_private")
    if not url:
        raise ValueError("File has no url_private")
    response = await slack.client.get(url)
    if response.status_code != 200:
        raise ValueError(
            f"Failed to download image from Slack: HTTP {response.status_code}"
        )
    return response.content


# ===================================================================
# Event Listener: Handles incoming messages from LangBot pipeline
# ===================================================================

class MessageListener(EventListener):
    """Listens for messages and dispatches to the appropriate handler.

    Triggers:
        - GroupMessageReceived: Messages from Slack channels
        - PersonMessageReceived: Direct messages
    """

    priority: int = 10

    async def on_event(
        self, event: BaseEventModel, ctx: EventContext
    ) -> None:
        """Entry point called by the plugin runtime for each received event."""
        handler = SevaHandler()
        await handler.handle(event, ctx)


# ===================================================================
# Tool: Exposes MCP tools that other agents (Claude, Cursor, etc.) can call
# ===================================================================

class SearchTribalKnowledge(Tool):
    """Search the SETU knowledge base (Qdrant) for relevant tribal knowledge."""

    name: str = "search_tribal_knowledge"
    description: str = (
        "Search SETU's memory store for verified NGO field knowledge. "
        "Returns relevant entries with source information."
    )
    parameters: dict[str, Any] = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query in natural language",
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of results (default 5, max 20)",
                "default": 5,
            },
        },
        "required": ["query"],
    }

    async def execute(self, query: str, limit: int = 5) -> str:
        limit = min(max(limit, 1), 20)
        try:
            client = _get_openai()
            qdrant = _get_qdrant()
            emb = (await client.embeddings.create(model="text-embedding-3-small", input=query)).data[0].embedding
            results = await qdrant.search(
                COLLECTION,
                query_vector=emb,
                limit=limit,
                with_payload=True,
            )
            if not results:
                return "No matching knowledge found."
            lines = []
            for r in results:
                payload = r.payload or {}
                lines.append(f"- {payload.get('text', '')[:200]} (score: {r.score:.3f})")
            return "\n".join(lines)
        except Exception as exc:
            _get_logger().error("search_tribal_knowledge failed: %s", exc)
            return f"Search failed: {exc}"


class SnapshotKnowledge(Tool):
    """Store a verified piece of knowledge into SETU's permanent memory."""

    name: str = "snapshot_knowledge"
    description: str = (
        "Store verified knowledge into SETU's Qdrant memory store. "
        "The content will be embedded and searchable by future queries."
    )
    parameters: dict[str, Any] = {
        "type": "object",
        "properties": {
            "text": {
                "type": "string",
                "description": "The knowledge text to store",
            },
            "source_channel": {
                "type": "string",
                "description": "Optional Slack channel source",
            },
            "project": {
                "type": "string",
                "description": "Project tag (barmer_edu, health, vendor, general)",
                "default": "general",
            },
        },
        "required": ["text"],
    }

    async def execute(self, text: str, source_channel: str = "", project: str = "general") -> str:
        try:
            await _embed_and_store(text, {
                "type": "mcp_snapshot",
                "project": project,
                "source_channel": source_channel,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            return f"Knowledge stored successfully under project '{project}'."
        except Exception as exc:
            _get_logger().error("snapshot_knowledge failed: %s", exc)
            return f"Failed to store knowledge: {exc}"


class TranscribeAudio(Tool):
    """Transcribe a Hindi/English voice note using OpenAI Whisper."""

    name: str = "transcribe_audio"
    description: str = (
        "Transcribe an audio file from a field worker's voice note. "
        "Supports Hindi, Marwari, and English. Returns transcribed text."
    )
    parameters: dict[str, Any] = {
        "type": "object",
        "properties": {
            "audio_url": {
                "type": "string",
                "description": "URL of the audio file to transcribe",
            },
        },
        "required": ["audio_url"],
    }

    async def execute(self, audio_url: str) -> str:
        # SECURITY: SSRF protection — only allow HTTPS URLs, block internal networks
        try:
            audio_url = _validate_audio_url(audio_url)
        except ValueError as exc:
            _get_logger().warning("transcribe_audio blocked: %s", exc)
            return f"Invalid audio URL: {exc}"

        try:
            client = _get_openai()
            # Download the audio file via Slack's WebClient (authenticated)
            import httpx
            async with httpx.AsyncClient(timeout=30) as http:
                resp = await http.get(audio_url)
                resp.raise_for_status()
                audio_bytes = resp.content

            # Transcribe via Whisper
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            try:
                with open(tmp_path, "rb") as audio_file:
                    transcript = await client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="text",
                    )
                return transcript or "[No speech detected]"
            finally:
                os.unlink(tmp_path)
        except Exception as exc:
            _get_logger().error("transcribe_audio failed: %s", exc)
            return f"Transcription failed. Please try again later."


class GenerateAltText(Tool):
    """Generate accessible alt-text for an image using GPT-4o Vision."""

    name: str = "generate_alt_text"
    description: str = (
        "Generate descriptive alt-text for an image. "
        "Describes people, text, and actions for accessibility."
    )
    parameters: dict[str, Any] = {
        "type": "object",
        "properties": {
            "image_url": {
                "type": "string",
                "description": "URL of the image to describe",
            },
        },
        "required": ["image_url"],
    }

    async def execute(self, image_url: str) -> str:
        # SECURITY: SSRF protection — only allow HTTPS URLs
        try:
            image_url = _validate_image_url(image_url)
        except ValueError as exc:
            _get_logger().warning("generate_alt_text blocked: %s", exc)
            return f"Invalid image URL: {exc}"

        try:
            client = _get_openai()
            resp = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": ALT_TEXT_PROMPT},
                            {"type": "image_url", "image_url": {"url": image_url}},
                        ],
                    }
                ],
                max_tokens=300,
            )
            return resp.choices[0].message.content or "[No description generated]"
        except Exception as exc:
            _get_logger().error("generate_alt_text failed: %s", exc)
            return "Alt-text generation failed. Please try again later."


# ===================================================================
# Handler Logic (core business logic)
# ===================================================================

class SevaHandler:
    """Core business logic for the Seva Memory plugin."""

    async def handle(self, event: BaseEventModel, ctx: EventContext) -> None:
        """Route an incoming event to the correct logic path.

        The event has already been converted by LangBot's platform adapter.
        We receive the LangBot-internal event format (GroupMessageReceived /
        PersonMessageReceived), which wraps the platform-specific event data.
        """
        log = _get_logger()

        # Extract message text from the event
        message_text = self._extract_text(event)
        if not message_text:
            return

        # Check if this is a file event (image) embedded in the message
        if self._has_image(event):
            await self._handle_image_event(event, ctx)
            return

        # Check if this is a query
        if self._is_query(message_text):
            await self._handle_query(message_text, event, ctx)
            return

        # Default: treat as a field note (task creation)
        await self._handle_field_note(message_text, event, ctx)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_text(event: BaseEventModel) -> str:
        """Extract the plain text content from an event."""
        raw = ""
        if hasattr(event, "message_chain") and event.message_chain:
            for part in event.message_chain:
                if isinstance(part, platform_message.Plain):
                    raw += part.text
        return raw.strip()

    @staticmethod
    def _has_image(event: BaseEventModel) -> bool:
        """Check if the event contains an image attachment."""
        if not hasattr(event, "message_chain") or not event.message_chain:
            return False
        return any(
            isinstance(part, platform_message.Image)
            for part in event.message_chain
        )

    @staticmethod
    def _is_query(text: str) -> bool:
        """Heuristic: does the text look like a question/query."""
        lower = text.lower()
        return (
            "?" in text
            or lower.startswith("setu")
            or "anyone solved" in lower
            or "how did we" in lower
            or "what about" in lower
        )

    @staticmethod
    def _get_channel_id(event: BaseEventModel) -> str:
        """Extract the Slack channel ID from the event."""
        if hasattr(event, "sender") and hasattr(event.sender, "group"):
            return event.sender.group.id
        if hasattr(event, "sender"):
            return str(event.sender.id)
        return ""

    # ------------------------------------------------------------------
    # Field Note Handling
    # ------------------------------------------------------------------

    async def _handle_field_note(
        self, text: str, event: BaseEventModel, ctx: EventContext
    ) -> None:
        """Process a field note: parse intent via LLM, post to Slack, store in Qdrant."""
        log = _get_logger()
        client = _get_openai()
        slack = _get_slack()

        try:
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": INTENT_SYSTEM_PROMPT.format(
                            today=datetime.now().isoformat()
                        ),
                    },
                    {"role": "user", "content": text},
                ],
                max_tokens=256,
            )
            data = json.loads(resp.choices[0].message.content)
        except (json.JSONDecodeError, openai.APIError) as exc:
            log.error("Intent parsing failed: %s", exc)
            return

        # Post to Slack
        try:
            await slack.chat_postMessage(
                channel=FIELD_OPS_CHANNEL,
                text=(
                    f":memo: *New field task* [{data.get('project', 'general')}] "
                    f"{data.get('task_text', text[:100])}\n"
                    f"Due: {data.get('due_date', 'Not set')} | "
                    f"From: {getattr(event, 'sender_id', 'field')}"
                ),
                blocks=[
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": (
                                f"*Task:* {data.get('task_text', text[:100])}\n"
                                f"*Project:* `{data.get('project', 'general')}` "
                                f"*Due:* {data.get('due_date', 'Not set')}"
                            ),
                        },
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": f"Source: `{text[:80]}`",
                            }
                        ],
                    },
                ],
            )
        except Exception as exc:
            log.error("Failed to post to Slack: %s", exc)
            return

        # Embed and store immediately
        try:
            await _embed_and_store(
                data.get("task_text", text),
                {
                    "project": data.get("project", "general"),
                    "type": "task",
                    "source": text[:500],
                },
            )
        except Exception as exc:
            log.error("Failed to store in Qdrant: %s", exc)

    # ------------------------------------------------------------------
    # Query Handling
    # ------------------------------------------------------------------

    async def _handle_query(
        self, query_text: str, event: BaseEventModel, ctx: EventContext
    ) -> None:
        """Answer a question by searching Slack history via RTS + Qdrant."""
        log = _get_logger()
        client = _get_openai()
        slack = _get_slack()
        channel_id = self._get_channel_id(event)
        thread_ts = getattr(event, "message_id", None)

        # 1. Search Qdrant first (faster, verified knowledge)
        try:
            qdrant = _get_qdrant()
            emb = (await client.embeddings.create(model="text-embedding-3-small", input=query_text)).data[0].embedding
            qdrant_results = await qdrant.search(
                COLLECTION,
                query_vector=emb,
                limit=5,
                with_payload=True,
            )
        except Exception:
            qdrant_results = []

        # 2. Search Slack RTS (live, permission-aware)
        slack_hits: list[dict[str, str]] = []
        if SLACK_USER_TOKEN:
            try:
                from .rts_adapter import rts_search

                slack_hits = await rts_search(
                    query_text,
                    user_token=SLACK_USER_TOKEN,
                    count=10,
                )
            except Exception as exc:
                log.warning("RTS search failed: %s", exc)

        # 3. Build context and answer
        context_parts = []
        if qdrant_results:
            context_parts.append("=== Verified Memory (Qdrant) ===")
            for r in qdrant_results:
                payload = r.payload or {}
                context_parts.append(
                    f"- {payload.get('text', '')[:300]} "
                    f"(project: {payload.get('project', 'unknown')}, "
                    f"score: {r.score:.2f})"
                )

        if slack_hits:
            context_parts.append("\n=== Slack Search Results ===")
            for h in slack_hits:
                context_parts.append(
                    f"- {h['text'][:300]} "
                    f"(from #{h['channel']} by {h['user']} at {h['ts']})"
                )

        context = "\n".join(context_parts)

        try:
            answer = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are Setu, an NGO field memory assistant. "
                            "Answer using ONLY the context provided. "
                            "Cite sources like [#channel] or [Verified Memory]. "
                            "If the context doesn't contain the answer, say so."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Context:\n{context}\n\nQuestion: {query_text}",
                    },
                ],
                max_tokens=1024,
            )
            reply = answer.choices[0].message.content or "I couldn't find an answer."
            source_count = len(qdrant_results) + len(slack_hits)
            reply += f"\n\n_Sources: {source_count} items searched_"
        except Exception as exc:
            log.error("Answer generation failed: %s", exc)
            reply = "Sorry, I encountered an error while searching for an answer."

        # 4. Post reply
        try:
            await slack.chat_postMessage(
                channel=channel_id,
                thread_ts=thread_ts,
                text=reply,
            )
        except Exception as exc:
            log.error("Failed to post reply to Slack: %s", exc)

    # ------------------------------------------------------------------
    # Image Handling
    # ------------------------------------------------------------------

    async def _handle_image_event(
        self, event: BaseEventModel, ctx: EventContext
    ) -> None:
        """Generate alt-text for images found in messages."""
        log = _get_logger()
        client = _get_openai()
        slack = _get_slack()
        channel_id = self._get_channel_id(event)
        thread_ts = getattr(event, "message_id", None)

        images = [
            part
            for part in (getattr(event, "message_chain", []) or [])
            if isinstance(part, platform_message.Image)
        ]

        for img in images:
            image_url = img.url or ""
            if not image_url and img.base64:
                # Use a data URI if base64 is available
                image_url = img.base64

            if not image_url:
                log.warning("Image has no URL or base64 data, skipping")
                continue

            try:
                resp = await client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": ALT_TEXT_PROMPT},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": image_url},
                                },
                            ],
                        }
                    ],
                    max_tokens=300,
                )
                alt_text = resp.choices[0].message.content or "[No description]"
            except Exception as exc:
                log.error("Alt-text generation failed for image: %s", exc)
                alt_text = f"[Alt-text generation failed: {exc}]"

            try:
                await slack.chat_postMessage(
                    channel=channel_id,
                    thread_ts=thread_ts,
                    text=(
                        f":eye: *Accessible Alt-text generated:*\n{alt_text}\n\n"
                        "React with :white_check_mark: if accurate to save to knowledge base."
                    ),
                )
            except Exception as exc:
                log.error("Failed to post alt-text to Slack: %s", exc)

    # ------------------------------------------------------------------
    # Weekly Summary (called by scheduler)
    # ------------------------------------------------------------------

    async def weekly_summary(self) -> None:
        """Generate and post weekly summaries grouped by project."""
        log = _get_logger()
        qdrant = _get_qdrant()
        slack = _get_slack()
        client = _get_openai()

        try:
            hits, _ = await qdrant.scroll(
                COLLECTION,
                limit=200,
                with_payload=True,
            )
        except Exception as exc:
            log.error("Failed to scroll Qdrant for weekly summary: %s", exc)
            return

        # Group by project
        grouped: dict[str, list[str]] = {}
        for p in hits:
            payload = p.payload or {}
            proj = payload.get("project", "general")
            text = payload.get("text", "")
            if text:
                grouped.setdefault(proj, []).append(text)

        if not grouped:
            log.info("No data for weekly summary")
            return

        for proj, tasks in grouped.items():
            try:
                summary = (
                    await client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {
                                "role": "user",
                                "content": (
                                    f"Summarize this week's progress for {proj}:\n"
                                    + "\n".join(tasks[:20])
                                ),
                            }
                        ],
                        max_tokens=512,
                    )
                ).choices[0].message.content
            except Exception as exc:
                log.error("Summary generation failed for %s: %s", proj, exc)
                summary = f"[Summary generation failed: {exc}]"

            try:
                await slack.chat_postMessage(
                    channel=SUMMARY_CHANNEL,
                    text=f"*Weekly Memory: {proj}*\n{summary}",
                )
            except Exception as exc:
                log.error("Failed to post weekly summary to Slack: %s", exc)


# ===================================================================
# Plugin Entry Point
# ===================================================================

class SevaMemoryPlugin(BasePlugin):
    """SETU Field Memory plugin for LangBot.

    Provides:
    - MessageListener: Processes incoming Slack messages
    - MCP tools: search_tribal_knowledge, snapshot_knowledge, transcribe_audio, generate_alt_text
    - Scheduled weekly summaries
    """

    async def setup(self) -> None:
        """Initialize plugin resources."""
        log = _get_logger()
        log.info("Setting up Seva Memory plugin...")

        # Ensure Qdrant collection exists
        try:
            await _ensure_collection()
        except Exception as exc:
            log.warning("Qdrant initialization failed (may be starting later): %s", exc)

        log.info(
            "Seva Memory plugin initialized. "
            "Admin users: %d, Qdrant: %s, Field ops channel: %s",
            len(ADMIN_USER_IDS),
            QDRANT_URL,
            FIELD_OPS_CHANNEL,
        )

        # Schedule weekly summary
        try:
            self.scheduler.add_job(
                self._run_weekly_summary,
                "cron",
                day_of_week="sun",
                hour=20,
                minute=0,
                id="setu_weekly_summary",
                replace_existing=True,
            )
            log.info("Weekly summary scheduled: Sunday 20:00")
        except Exception as exc:
            log.warning("Failed to schedule weekly summary: %s", exc)

    async def _run_weekly_summary(self) -> None:
        """Wrapper that creates a SevaHandler and runs the weekly summary."""
        handler = SevaHandler()
        await handler.weekly_summary()

    async def shutdown(self) -> None:
        """Clean up plugin resources."""
        log = _get_logger()
        log.info("Shutting down Seva Memory plugin...")
        global _openai_client, _slack_client, _qdrant_client
        if _qdrant_client is not None:
            await _qdrant_client.close()
            _qdrant_client = None
        _openai_client = None
        _slack_client = None
