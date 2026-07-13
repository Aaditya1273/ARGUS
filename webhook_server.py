"""
SETU Webhook Server — WhatsApp → LangBot Bridge + Slack Events API + Admin API

Production FastAPI server handling:
- WhatsApp Business API webhooks (text & voice notes)
- Slack Events API (reaction_added, file_shared, message.channels)
- Knowledge CRUD (search, list, get, delete Qdrant entries)
- Analytics/metrics API
- Weekly summary trigger (manual + scheduled)
- Detailed health checks with external service status
- Rate limiting, HMAC auth, structured logging

Usage:
    uvicorn webhook_server:app --host 0.0.0.0 --port 9090

See .env.example for all required environment variables.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import time
from typing import Any

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request, Response, Depends
from fastapi.responses import JSONResponse, PlainTextResponse

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
LANGBOT_BOT_UUID = os.getenv("LANGBOT_BOT_UUID", "")
LANGBOT_API_URL = os.getenv("LANGBOT_API_URL", "http://localhost:5300").rstrip("/")
LANGBOT_API_KEY = os.getenv("LANGBOT_API_KEY", "")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
SLACK_VERIFICATION_TOKEN = os.getenv("SLACK_VERIFICATION_TOKEN", "")
WEBHOOK_SERVER_PORT = int(os.getenv("WEBHOOK_SERVER_PORT", "9090"))
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("setu-webhook")

# ---------------------------------------------------------------------------
# Import service layer + auth
# ---------------------------------------------------------------------------
from plugins.seva_memory.setu_auth import (
    EndpointScope,
    require_api_key,
    redact_error,
    sanitize_query,
)
from plugins.seva_memory.setu_schema import (
    COLLECTIONS,
    collection_stats,
    ensure_all_collections,
)
from plugins.seva_memory.setu_schema import _qdrant as get_qdrant
from plugins.seva_memory.setu_service import (
    AnalyticsService,
    AuditService,
    ImageAltTextService,
    SlackEventService,
    SummaryService,
    TaskService,
    VerifiedMemoryService,
    WeeklyReportService,
)

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
class RateLimiter:
    """In-memory sliding window rate limiter per IP."""

    def __init__(self, max_per_minute: int = 120):
        self.max_per_minute = max_per_minute
        self._windows: dict[str, list[float]] = {}

    def check(self, ip: str) -> bool:
        now = time.time()
        window = self._windows.setdefault(ip, [])
        cutoff = now - 60
        self._windows[ip] = [t for t in window if t > cutoff]
        if len(self._windows[ip]) >= self.max_per_minute:
            return False
        self._windows[ip].append(now)
        return True


rate_limiter = RateLimiter(RATE_LIMIT_PER_MINUTE)

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SETU API Server",
    description=(
        "WhatsApp → LangBot bridge + Slack Events API handler + "
        "Knowledge management + Analytics for SETU Field Memory"
    ),
    version="2.0.0",
)


# ===================================================================
# Middleware
# ===================================================================

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every request with method, path, status, and duration."""
    start = time.time()
    body = None
    try:
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000
        status = response.status_code
        level = logging.WARNING if status >= 400 else logging.INFO
        logger.log(level, "%s %s -> %d (%.1fms)", request.method, request.url.path, status, duration_ms)
        return response
    except HTTPException:
        raise
    except Exception as exc:
        duration_ms = (time.time() - start) * 1000
        logger.error("%s %s -> ERROR %s (%.1fms)", request.method, request.url.path, exc, duration_ms)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})





@app.middleware("http")
async def verify_signature(request: Request, call_next):
    """Optional HMAC verification for incoming webhooks."""
    if not WEBHOOK_SECRET:
        return await call_next(request)

    if request.method == "GET":
        return await call_next(request)

    # Skip HMAC for Slack events (they have their own verification via verify_slack_signature)
    if request.url.path.startswith("/api/v1/webhooks/slack"):
        return await call_next(request)

    body = await request.body()
    signature = request.headers.get("X-Setu-Signature", "")
    expected = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        logger.warning("Invalid webhook signature for %s", request.url.path)
        return JSONResponse(status_code=401, content={"error": "Invalid signature"})

    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Add security headers to every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.middleware("http")
async def rate_limit_middleware_forwarded(request: Request, call_next):
    """Rate limiting using X-Forwarded-For header (not just direct IP)."""
    # Use X-Forwarded-For if behind proxy
    forwarded = request.headers.get("X-Forwarded-For", "")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    if not rate_limiter.check(ip):
        logger.warning("Rate limit exceeded for %s", ip)
        return JSONResponse(
            status_code=429,
            content={"error": "Too many requests. Try again later."},
            headers={"Retry-After": "60"},
        )
    return await call_next(request)


# ===================================================================
# Health & Monitoring
# ===================================================================

@app.get("/health")
async def health():
    """Simple health check."""
    return {"status": "ok", "timestamp": time.time(), "service": "setu-webhook"}


@app.get("/health/detailed")
@app.get("/api/v1/health")
async def health_detailed(auth_user: str = Depends(require_api_key(EndpointScope.READ))):
    """Detailed health check — tests all external service connectivity."""
    checks: dict[str, Any] = {
        "server": {"status": "ok", "uptime": time.time()},
        "services": {},
    }

    # OpenAI
    try:
        from openai import AsyncOpenAI
        key = os.getenv("OPENAI_API_KEY", "")
        if key:
            client = AsyncOpenAI(api_key=key)
            await client.models.list()
            checks["services"]["openai"] = {"status": "ok"}
        else:
            checks["services"]["openai"] = {"status": "not_configured"}
    except Exception as exc:
        checks["services"]["openai"] = {"status": "error", "error": redact_error(exc)}

    # Qdrant
    try:
        from qdrant_client import AsyncQdrantClient
        qdrant = AsyncQdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))
        await qdrant.get_collections()
        checks["services"]["qdrant"] = {"status": "ok"}
    except Exception as exc:
        checks["services"]["qdrant"] = {"status": "error", "error": redact_error(exc)}

    # Slack
    try:
        from slack_sdk.web.async_client import AsyncWebClient
        bot_token = os.getenv("SLACK_BOT_TOKEN", "")
        if bot_token:
            client = AsyncWebClient(token=bot_token)
            auth = await client.auth_test()
            checks["services"]["slack"] = {
                "status": "ok",
                "team": auth.get("team", ""),
                "user": auth.get("user", ""),
            }
        else:
            checks["services"]["slack"] = {"status": "not_configured"}
    except Exception as exc:
        checks["services"]["slack"] = {"status": "error", "error": redact_error(exc)}

    # LangBot
    if LANGBOT_API_URL:
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                resp = await c.get(f"{LANGBOT_API_URL}/health")
                checks["services"]["langbot"] = {
                    "status": "ok" if resp.status_code < 500 else "error",
                    "status_code": resp.status_code,
                }
        except Exception as exc:
            checks["services"]["langbot"] = {"status": "error", "error": redact_error(exc)}

    # Overall status
    all_ok = all(
        s.get("status") == "ok" or s.get("status") == "not_configured"
        for s in checks["services"].values()
    )
    checks["overall"] = "healthy" if all_ok else "degraded"

    return checks


# ===================================================================
# WhatsApp Webhook
# ===================================================================

@app.get("/webhooks/whatsapp")
async def verify_whatsapp_webhook(
    hub_mode: str | None = None,
    hub_verify_token: str | None = None,
    hub_challenge: str | None = None,
):
    """WhatsApp Business API webhook verification (GET)."""
    if not WHATSAPP_VERIFY_TOKEN:
        raise HTTPException(status_code=501, detail="Webhook verification not configured")
    if hub_mode == "subscribe" and hub_verify_token == WHATSAPP_VERIFY_TOKEN:
        logger.info("WhatsApp webhook verified")
        return Response(content=hub_challenge or "", media_type="text/plain")
    logger.warning("WhatsApp verification failed: mode=%s", hub_mode)
    raise HTTPException(status_code=403, detail="Verification failed")


@app.post("/webhooks/whatsapp")
async def whatsapp_webhook(request: Request):
    """Receive WhatsApp Business API webhook events (POST).

    Authentication: WhatsApp verify token (via GET handler) + optional HMAC signature.
    Not a Bearer API key — WhatsApp callback servers don't send custom auth headers.
    """
    client_ip = request.client.host if request.client else "unknown"

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    try:
        entry = data.get("entry", [])
        if not entry:
            return {"status": "ok"}

        changes = entry[0].get("changes", [])
        if not changes:
            return {"status": "ok"}

        value = changes[0].get("value", {})
        messages = value.get("messages", [])
        if not messages:
            statuses = value.get("statuses", [])
            logger.debug("Status updates: %d", len(statuses))
            return {"status": "ok"}

        msg = messages[0]
        msg_type = msg.get("type", "")
        from_number = msg.get("from", "unknown")

        logger.info("WhatsApp from %s: type=%s", from_number, msg_type)

        text = ""
        if msg_type == "text":
            text = msg.get("text", {}).get("body", "")
        elif msg_type == "voice":
            audio_id = msg.get("audio", {}).get("id", "")
            text = f"[Voice note from {from_number}, media_id={audio_id}]" if audio_id else f"[Voice note from {from_number}]"
            logger.info("Voice note received (media_id=%s)", audio_id)
        else:
            logger.debug("Unhandled type: %s", msg_type)
            return {"status": "ok"}

        if not text:
            return {"status": "ok"}

    except (KeyError, IndexError, TypeError) as exc:
        logger.warning("Malformed WhatsApp payload from %s: %s", client_ip, exc)
        raise HTTPException(status_code=400, detail="Malformed WhatsApp payload")

    try:
        await _forward_to_langbot(text, from_number)
    except Exception as exc:
        logger.error("Forward to LangBot failed: %s", exc)
        return {"status": "ok", "warning": "Message received but forwarding failed"}

    await AnalyticsService.increment("whatsapp_messages")
    return {"status": "ok"}


async def _forward_to_langbot(text: str, from_number: str) -> None:
    """Forward message to LangBot as Slack Events API payload."""
    if not LANGBOT_BOT_UUID:
        raise RuntimeError("LANGBOT_BOT_UUID not set")

    webhook_url = f"{LANGBOT_API_URL}/bots/{LANGBOT_BOT_UUID}"
    payload: dict[str, object] = {
        "type": "event_callback",
        "token": "",
        "team_id": "setu_bridge",
        "api_app_id": "setu_app",
        "event": {
            "type": "message",
            "channel_type": "im",
            "user": f"whatsapp_{from_number}",
            "text": text,
            "channel": "DM",
            "ts": str(time.time()),
            "event_ts": str(time.time()),
        },
        "event_id": f"evt_setu_{int(time.time() * 1000)}",
        "event_time": int(time.time()),
    }

    headers = {"Content-Type": "application/json"}
    if LANGBOT_API_KEY:
        headers["Authorization"] = f"Bearer {LANGBOT_API_KEY}"

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(webhook_url, json=payload, headers=headers)
        response.raise_for_status()
        logger.info("Forwarded to LangBot: %.80s", text)


# ===================================================================
# Slack Events API — handles reaction_added, file_shared, message.channels
# ===================================================================
# LangBot's built-in Slack adapter doesn't handle reaction_added or file_shared
# events. This endpoint fills that gap by processing them directly.

@app.post("/api/v1/webhooks/slack")
async def slack_events_webhook(request: Request):
    """Receive Slack Events API events.

    Authentication: Slack signing secret (X-Slack-Signature header).
    Not a Bearer API key — Slack's Events API doesn't send custom auth headers.

    Routes to the correct handler:
    - ``reaction_added`` → snapshot logic
    - ``file_shared`` → alt-text generation
    - ``message.channels`` → query answering (field ops channel)

    Slack API docs: https://api.slack.com/apis/connections/events-api
    """
    # Verify signature
    body = await request.body()
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")
    signing_secret = os.getenv("SLACK_SIGNING_SECRET", "")

    if signing_secret:
        # Slack uses HMAC-SHA256 with versioned signatures
        sig_basestring = f"v0:{timestamp}:{body.decode()}"
        my_sig = "v0=" + hmac.new(
            signing_secret.encode(),
            sig_basestring.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(my_sig, signature):
            logger.warning("Invalid Slack signature")
            raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Slack URL verification
    if data.get("type") == "url_verification":
        logger.info("Slack URL verification challenge")
        return PlainTextResponse(content=data.get("challenge", ""))

    # Acknowledge immediately (Slack expects 200 within 3 seconds)
    # Processing happens in background
    event = data.get("event", {})
    event_type = event.get("type", "")

    logger.info("Slack event: type=%s", event_type)

    # Process events in background tasks to avoid Slack timeout
    def _log_task_error(task: asyncio.Task) -> None:
        try:
            exc = task.exception()
            if exc:
                logger.error("Background Slack event task failed: %s", exc)
        except asyncio.CancelledError:
            pass

    if event_type == "reaction_added":
        task = asyncio.create_task(SlackEventService.handle_reaction_added(event))
        task.add_done_callback(_log_task_error)

    elif event_type == "file_shared":
        task = asyncio.create_task(SlackEventService.handle_file_shared(event))
        task.add_done_callback(_log_task_error)

    elif event_type in ("message", "message.channels", "message.im", "message.groups"):
        subtype = event.get("subtype", "")
        if not subtype and event.get("text", "").strip():
            task = asyncio.create_task(SlackEventService.handle_message(event))
            task.add_done_callback(_log_task_error)

    else:
        logger.debug("Unhandled Slack event type: %s", event_type)

    return {"status": "ok"}


# ===================================================================
# Multi-Collection API: unified knowledge browsing
# ===================================================================

@app.get("/api/v1/knowledge/stats")
async def knowledge_stats(auth_user: str = Depends(require_api_key(EndpointScope.READ))):
    """Get statistics for all collections."""
    try:
        stats = await collection_stats()
        return {
            "collections": stats,
            "schema_version": 2,
        }
    except Exception as exc:
        logger.error("Failed to get stats: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/v1/knowledge/memory")
async def list_verified_memory(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    project: str | None = Query(None),
    auth_user: str = Depends(require_api_key(EndpointScope.READ)),
):
    """List verified memory entries."""
    try:
        entries, total = await VerifiedMemoryService.list(limit=limit, offset=offset, project=project)
        return {"entries": entries, "total": total, "limit": limit, "offset": offset}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/v1/knowledge/memory/search")
async def search_verified_memory(body: dict[str, Any], auth_user: str = Depends(require_api_key(EndpointScope.READ))):
    """Search verified memory semantically."""
    query = body.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=422, detail="'query' is required")
    # Sanitize query to prevent prompt injection / embedding abuse
    query = sanitize_query(query, max_length=2000)
    limit = min(max(body.get("limit", 10), 1), 50)
    try:
        entries = await VerifiedMemoryService.search(query=query, limit=limit, project=body.get("project"))
        return {"query": query, "results": entries, "total": len(entries)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=redact_error(exc))


@app.delete("/api/v1/knowledge/memory/{point_id}")
async def delete_verified_memory(point_id: int, auth_user: str = Depends(require_api_key(EndpointScope.ADMIN))):
    """Delete a verified memory entry. Requires admin API key."""
    try:
        await VerifiedMemoryService.delete(point_id)
        await AuditService.log("delete_memory", auth_user, "verified_memory", str(point_id))
        return {"status": "ok", "deleted_id": point_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=redact_error(exc))


@app.get("/api/v1/knowledge/tasks")
async def search_tasks(
    q: str = Query("", description="Search query"),
    project: str | None = Query(None),
    limit: int = Query(20, ge=1, le=50),
    auth_user: str = Depends(require_api_key(EndpointScope.READ)),
):
    """Search field tasks."""
    try:
        query = sanitize_query(q, max_length=2000) if q else ""
        if query:
            entries = await TaskService.search(query=query, limit=limit, project=project)
        else:
            entries = []
        return {"query": q, "results": entries, "total": len(entries)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=redact_error(exc))


@app.get("/api/v1/knowledge/alt_text")
async def list_alt_text(
    file_id: str | None = Query(None),
    limit: int = Query(20, ge=1, le=50),
    auth_user: str = Depends(require_api_key(EndpointScope.READ)),
):
    """List alt-text entries."""
    try:
        # Alt-text is not paginated by default — just list recent
        from plugins.seva_memory.setu_schema import COLLECTIONS
        from qdrant_client import models as qdrant_models
        qdrant = get_qdrant()
        qf = None
        if file_id:
            qf = qdrant_models.Filter(must=[qdrant_models.FieldCondition(key="file_id", match=qdrant_models.MatchValue(value=file_id))])
        hits, _ = await qdrant.scroll(COLLECTIONS["image_alt_text"].name, limit=limit, with_payload=True, filter=qf)
        return {"entries": [{"id": h.id, **h.payload} for h in hits]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=redact_error(exc))


@app.get("/api/v1/audit")
async def list_audit_logs(
    action: str | None = Query(None),
    actor_id: str | None = Query(None),
    resource_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    auth_user: str = Depends(require_api_key(EndpointScope.ADMIN)),
):
    """Search audit logs. Requires admin API key."""
    try:
        entries = await AuditService.search(action=action, actor_id=actor_id, resource_type=resource_type, limit=limit)
        return {"entries": entries, "total": len(entries)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=redact_error(exc))


# ===================================================================
# Analytics / Metrics API
# ===================================================================

@app.get("/api/v1/metrics")
async def get_metrics(auth_user: str = Depends(require_api_key(EndpointScope.METRICS))):
    """Get current usage metrics."""
    try:
        snapshot = await AnalyticsService.get_snapshot()
        return {
            "total_queries": snapshot.total_queries,
            "total_tasks": snapshot.total_tasks,
            "total_snapshots": snapshot.total_snapshots,
            "total_alt_texts": snapshot.total_alt_texts,
            "total_transcriptions": snapshot.total_transcriptions,
            "rts_api_calls": snapshot.rts_api_calls,
            "qdrant_writes": snapshot.qdrant_writes,
            "qdrant_reads": snapshot.qdrant_reads,
            "openai_calls": snapshot.openai_calls,
            "errors": snapshot.errors,
            "period_start": snapshot.start_time,
            "period_end": snapshot.end_time,
        }
    except Exception as exc:
        logger.error("Failed to get metrics: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/v1/metrics/reset")
async def reset_metrics(auth_user: str = Depends(require_api_key(EndpointScope.ADMIN))):
    """Reset all usage counters. Requires admin API key."""
    logger.info("Metrics reset by %s", auth_user)
    await AnalyticsService.reset()
    return {"status": "ok"}


# ===================================================================
# Summary API
# ===================================================================

@app.post("/api/v1/summaries/trigger")
async def trigger_summary(
    body: dict[str, Any] | None = None,
    auth_user: str = Depends(require_api_key(EndpointScope.TRIGGER)),
):
    """Manually trigger a weekly summary.

    Request body (optional):
        days (int): Number of days of history. Default 7.

    Returns:
        Status and summary results per project.
    """
    days = (body or {}).get("days", 7)
    if not 1 <= days <= 90:
        raise HTTPException(status_code=422, detail="'days' must be between 1 and 90")

    try:
        result = await SummaryService.trigger(days=days)
        return result
    except Exception as exc:
        logger.error("Summary trigger failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/v1/summaries/status")
async def summary_status(auth_user: str = Depends(require_api_key(EndpointScope.READ))):
    """Get the status/schedule of the weekly summary."""
    return {
        "scheduled": "Sunday 20:00 (via LangBot plugin scheduler)",
        "manual_trigger": "POST /api/v1/summaries/trigger",
        "canvas_enabled": bool(os.getenv("SLACK_BOT_TOKEN")),
        "collection": "setu_memory",
    }


# ===================================================================
# Entry point
# ===================================================================

if __name__ == "__main__":
    # Ensure all collections exist on startup
    logger.info("Running schema migration (ensure_all_collections)...")
    migration_results = asyncio.run(ensure_all_collections())
    for name, status in migration_results.items():
        logger.info("  %s: %s", name, status)

    logger.info(
        "Starting SETU API Server on port %d. "
        "LangBot: %s/bots/%s, "
        "Slack Events: POST /api/v1/webhooks/slack, "
        "Knowledge API: GET /api/v1/knowledge, "
        "Metrics: GET /api/v1/metrics",
        WEBHOOK_SERVER_PORT,
        LANGBOT_API_URL,
        LANGBOT_BOT_UUID,
    )

    uvicorn.run(
        "webhook_server:app",
        host="0.0.0.0",
        port=WEBHOOK_SERVER_PORT,
        log_level="info",
    )
