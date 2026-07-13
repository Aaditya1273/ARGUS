"""
SETU Schema & Migration — multi-collection Qdrant persistence layer.

Collections:
┌────────────────────┬──────────┬─────────────────────────────────────────────────────────┐
│ Collection         │ Vector   │ Payload fields                                         │
├────────────────────┼──────────┼─────────────────────────────────────────────────────────┤
│ setu_tasks         │ 1536 COS │ task_text, project, due_date, status, source_channel,  │
│                    │          │ source_user_id, created_at, updated_at                  │
├────────────────────┼──────────┼─────────────────────────────────────────────────────────┤
│ setu_verified_memo │ 1536 COS │ thread_text, project, source_channel, source_ts,        │
│                    │          │ verified_by, verified_at, answer_summary, tags,          │
│                    │          │ content_hash                                           │
├────────────────────┼──────────┼─────────────────────────────────────────────────────────┤
│ setu_image_alt_txt │ 1536 COS │ alt_text, file_id, mime_type, channel_id, original_name│
│                    │          │ generated_by, generated_at, verified, verified_by        │
├────────────────────┼──────────┼─────────────────────────────────────────────────────────┤
│ setu_weekly_rpts   │ 1536 COS │ project, report_text, period_start, period_end,         │
│                    │          │ entries_count, canvas_url, generated_at                │
├────────────────────┼──────────┼─────────────────────────────────────────────────────────┤
│ setu_audit_logs    │ 1536 COS │ action, actor_id, resource_type, resource_id, details, │
│                    │          │ timestamp, ip_address                                   │
└────────────────────┴──────────┴─────────────────────────────────────────────────────────┘

Duplicate prevention: content_hash (SHA-256 of text) stored in payload + checked on write.
Payload indexes: project, status, verified, timestamp, action, content_hash.
"""
from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from qdrant_client import AsyncQdrantClient, models as qdrant_models

logger = logging.getLogger("setu-schema")

# ===================================================================
# Environment / Client
# ===================================================================
_qdrant_client: AsyncQdrantClient | None = None


def _qdrant() -> AsyncQdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = AsyncQdrantClient(
            url=os.getenv("QDRANT_URL", "http://localhost:6333")
        )
    return _qdrant_client


# ===================================================================
# Content hashing (duplicate prevention)
# ===================================================================
def content_hash(text: str) -> str:
    """SHA-256 digest of normalized text. Used as dedup key."""
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


# ===================================================================
# Common vector config
# ===================================================================
VECTOR_SIZE = 1536
VECTOR_CONFIG = qdrant_models.VectorParams(
    size=VECTOR_SIZE,
    distance=qdrant_models.Distance.COSINE,
)

DUMMY_VECTOR = [0.0] * VECTOR_SIZE  # for non-searchable collections


# ===================================================================
# Collection definitions
# ===================================================================
@dataclass
class CollectionDef:
    """Descriptor for a Qdrant collection."""
    name: str
    description: str
    has_vector: bool = True
    payload_schema: dict[str, str] = field(default_factory=dict)
    index_fields: list[tuple[str, qdrant_models.PayloadSchemaType]] = field(default_factory=list)


# Helper to create index entries: (field_name, schema_type)
def idx_keyword(field: str) -> tuple[str, qdrant_models.PayloadSchemaType]:
    return (field, qdrant_models.PayloadSchemaType(keyword=field))


def idx_datetime(field: str) -> tuple[str, qdrant_models.PayloadSchemaType]:
    return (field, qdrant_models.PayloadSchemaType(datetime=field))


COLLECTIONS: dict[str, CollectionDef] = {
    "tasks": CollectionDef(
        name="setu_tasks",
        description="Field tasks extracted from WhatsApp/Slack notes via LLM intent parsing",
        payload_schema={
            "task_text": "str — extracted task description",
            "project": "str — barmer_edu | health | vendor | general",
            "due_date": "str | null — parsed due date in YYYY-MM-DD",
            "status": "str — open | done | cancelled",
            "source_channel": "str — Slack channel or whatsapp",
            "source_user_id": "str — sender identifier",
            "content_hash": "str — SHA-256 dedup key",
            "created_at": "str — ISO-8601 timestamp",
            "updated_at": "str — ISO-8601 timestamp",
        },
        index_fields=[
            idx_keyword("project"),
            idx_keyword("status"),
            idx_keyword("content_hash"),
            idx_datetime("created_at"),
        ],
    ),
    "verified_memory": CollectionDef(
        name="setu_verified_memory",
        description="Admin-verified knowledge snapshots from Slack threads",
        payload_schema={
            "thread_text": "str — full thread text",
            "project": "str — project tag",
            "source_channel": "str — Slack channel ID",
            "source_ts": "str — Slack message timestamp",
            "verified_by": "str — Slack user ID of admin",
            "verified_at": "str — ISO-8601 timestamp",
            "answer_summary": "str — LLM-generated summary",
            "tags": "str — JSON array of tags",
            "content_hash": "str — SHA-256 dedup key",
            "stored_at": "str — ISO-8601 timestamp",
        },
        index_fields=[
            idx_keyword("project"),
            idx_keyword("verified_by"),
            idx_keyword("content_hash"),
            idx_datetime("verified_at"),
        ],
    ),
    "image_alt_text": CollectionDef(
        name="setu_image_alt_text",
        description="Alt-text generated for images by GPT-4o Vision",
        payload_schema={
            "alt_text": "str — generated alt-text",
            "file_id": "str — Slack file ID",
            "original_name": "str — original file name",
            "mime_type": "str — image MIME type",
            "channel_id": "str — Slack channel ID",
            "generated_by": "str — 'gpt-4o' | 'mcp_tool'",
            "generated_at": "str — ISO-8601 timestamp",
            "verified": "bool — whether admin approved",
            "verified_by": "str | null — admin user ID",
            "content_hash": "str — SHA-256 dedup key",
        },
        index_fields=[
            idx_keyword("file_id"),
            idx_keyword("channel_id"),
            idx_keyword("content_hash"),
            idx_keyword("verified"),
        ],
    ),
    "weekly_reports": CollectionDef(
        name="setu_weekly_reports",
        description="Weekly summary reports posted to Slack Canvas",
        has_vector=False,
        payload_schema={
            "project": "str — project tag",
            "report_text": "str — LLM-generated summary",
            "period_start": "str — ISO-8601 date",
            "period_end": "str — ISO-8601 date",
            "entries_count": "int — number of source entries",
            "canvas_url": "str | null — Slack Canvas URL",
            "channel_posted_to": "str — Slack channel",
            "generated_at": "str — ISO-8601 timestamp",
        },
        index_fields=[
            idx_keyword("project"),
            idx_datetime("period_start"),
            idx_datetime("period_end"),
        ],
    ),
    "audit_logs": CollectionDef(
        name="setu_audit_logs",
        description="Immutable audit trail of all significant actions",
        has_vector=False,
        payload_schema={
            "action": "str — action name (snapshot, task_create, alt_text, query, summary, error)",
            "actor_id": "str — Slack user ID or system",
            "resource_type": "str — tasks | verified_memory | image_alt_text | weekly_reports | config",
            "resource_id": "str | null — Qdrant point ID or reference",
            "details": "str — JSON-encoded action details",
            "ip_address": "str | null — request IP",
            "timestamp": "str — ISO-8601 timestamp",
        },
        index_fields=[
            idx_keyword("action"),
            idx_keyword("actor_id"),
            idx_keyword("resource_type"),
            idx_datetime("timestamp"),
        ],
    ),
}


# ===================================================================
# Migration — create / upgrade collections
# ===================================================================
async def ensure_all_collections() -> dict[str, str]:
    """Create or verify all SETU Qdrant collections.

    Returns:
        Dict mapping collection names to status strings.
    """
    qdrant = _qdrant()
    results: dict[str, str] = {}

    for key, col in COLLECTIONS.items():
        try:
            existing = await qdrant.get_collection(col.name)
            results[col.name] = f"exists ({existing.points_count} points)"
            logger.info("Collection '%s' already exists: %s", col.name, results[col.name])
        except Exception:
            logger.info("Creating collection '%s'...", col.name)
            if col.has_vector:
                await qdrant.create_collection(
                    col.name,
                    vectors_config=VECTOR_CONFIG,
                )
            else:
                # Non-searchable collections still need a vector config in Qdrant.
                # Use a dummy vector of the same size for API compatibility.
                await qdrant.create_collection(
                    col.name,
                    vectors_config=VECTOR_CONFIG,
                )
            results[col.name] = "created"

        # Create payload indexes
        for field_name, field_schema in col.index_fields:
            try:
                await qdrant.create_payload_index(
                    col.name,
                    field_name=field_name,
                    field_schema=field_schema,
                    wait=True,
                )
            except Exception as exc:
                logger.debug("Index on %s.%s: %s", col.name, field_name, exc)

    return results


async def drop_collections(collections: list[str] | None = None) -> dict[str, str]:
    """Drop collections. Use with extreme caution — data loss!"""
    qdrant = _qdrant()
    results: dict[str, str] = {}
    targets = collections or list(COLLECTIONS.keys())
    for key in targets:
        col = COLLECTIONS.get(key)
        if col:
            await qdrant.delete_collection(col.name)
            results[col.name] = "deleted"
            logger.warning("Dropped collection '%s'", col.name)
    return results


async def collection_stats() -> dict[str, dict[str, Any]]:
    """Get stats for all SETU collections."""
    qdrant = _qdrant()
    stats: dict[str, dict[str, Any]] = {}
    for key, col in COLLECTIONS.items():
        try:
            info = await qdrant.get_collection(col.name)
            stats[col.name] = {
                "points_count": info.points_count,
                "status": info.status,
                "vector_size": VECTOR_SIZE,
            }
        except Exception as exc:
            stats[col.name] = {"error": str(exc)}
    return stats
