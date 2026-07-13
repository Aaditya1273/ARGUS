"""
SETU Auth — API Key Authentication & Authorization

Provides:
- API key validation (Bearer token in Authorization header)
- Endpoint-scoped keys (read-only vs admin vs webhook)
- Slack signing secret verification
- IP allowlist for admin endpoints
- Request identity tracking for audit logs

Usage:
    from setu_auth import require_api_key, require_admin_key, EndpointScope

    @app.get("/api/v1/knowledge/memory")
    @require_api_key(EndpointScope.READ)
    async def list_memory(user_id: str = Depends(get_current_user)):
        ...

Env vars:
    SETU_API_KEY         — Full-access API key (admin)
    SETU_READ_API_KEY    — Read-only API key (search, list, stats)
    SETU_WEBHOOK_API_KEY — Webhook-only API key (WhatsApp, Slack events)
    ADMIN_IP_RANGES      — Optional comma-separated CIDR ranges for admin endpoints
"""
from __future__ import annotations

import ipaddress
import logging
import os
import re
from enum import Enum
from typing import Any, Callable

from fastapi import HTTPException, Request, status

logger = logging.getLogger("setu-auth")

# ===================================================================
# Scopes
# ===================================================================
class EndpointScope(str, Enum):
    """Permission levels for API endpoints.

    Hierarchy (low to high):
        WEBHOOK(-1) — Reserved for incoming webhook servers (not used by API key system
                      since Slack/Meta don't send Bearer tokens; webhooks use platform-native auth).
        READ(0)     — Search, list, stats — safe read operations.
        WRITE(1)    — Store, create, update.
        METRICS(2)  — View usage metrics only.
        TRIGGER(3)  — Trigger actions (summaries).
        ADMIN(4)    — Delete, reset, config changes.
    """
    WEBHOOK = "webhook"
    READ = "read"
    WRITE = "write"
    METRICS = "metrics"
    TRIGGER = "trigger"
    ADMIN = "admin"


# ===================================================================
# Configuration
# ===================================================================
_ADMIN_API_KEY = os.getenv("SETU_API_KEY", "")
_READ_API_KEY = os.getenv("SETU_READ_API_KEY", "")
_WEBHOOK_API_KEY = os.getenv("SETU_WEBHOOK_API_KEY", "")
_ADMIN_IP_RANGES = [
    cidr.strip()
    for cidr in os.getenv("ADMIN_IP_RANGES", "").split(",")
    if cidr.strip()
]
_BYPASS_ENDPOINTS = {
    "/health",
    "/health/detailed",
    "/api/v1/health",
}


# ===================================================================
# Key → Scope mapping
# ===================================================================
_KEY_SCOPES: dict[str, EndpointScope] = {}

if _ADMIN_API_KEY:
    _KEY_SCOPES[_ADMIN_API_KEY] = EndpointScope.ADMIN
if _READ_API_KEY:
    _KEY_SCOPES[_READ_API_KEY] = EndpointScope.READ
if _WEBHOOK_API_KEY:
    _KEY_SCOPES[_WEBHOOK_API_KEY] = EndpointScope.WEBHOOK

# Fallback: if no SETU_API_KEY is configured, all endpoints are open
_HAS_API_KEYS = bool(_KEY_SCOPES)


# ===================================================================
# Extract bearer token from request
# ===================================================================
def _extract_token(request: Request) -> str:
    """Extract Bearer token from Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return ""
    return auth[7:].strip()


def _check_ip_allowlist(request: Request) -> bool:
    """Check if request IP is in the admin allowlist."""
    if not _ADMIN_IP_RANGES:
        return True  # No restriction
    ip_str = request.client.host if request.client else ""
    if not ip_str:
        return False
    try:
        ip = ipaddress.ip_address(ip_str)
        return any(ip in ipaddress.ip_network(cidr) for cidr in _ADMIN_IP_RANGES)
    except ValueError:
        return False


# ===================================================================
# Dependency: require API key with minimum scope
# ===================================================================
async def require_scope(request: Request, minimum_scope: EndpointScope) -> str:
    """FastAPI dependency: extract and validate API key for given scope.

    Returns the resolved user/role identifier for audit logging.
    """
    # Health endpoints are always public
    if request.url.path in _BYPASS_ENDPOINTS:
        return "anonymous"

    # If no API keys configured, allow access (backward compat)
    if not _HAS_API_KEYS:
        logger.warning("No API keys configured — endpoint %s is OPEN", request.url.path)
        return "unauthenticated"

    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Use: Bearer <api-key>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    scope = _KEY_SCOPES.get(token)
    if scope is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )

    # Check scope hierarchy
    # WEBHOOK is isolated at -1 so it can ONLY access explicitly WEBHOOK-scoped endpoints.
    # The hierarchy: READ(0) < WRITE(1) < METRICS(2) < TRIGGER(3) < ADMIN(4).
    scope_rank = {
        EndpointScope.WEBHOOK: -1,
        EndpointScope.READ: 0,
        EndpointScope.WRITE: 1,
        EndpointScope.METRICS: 2,
        EndpointScope.TRIGGER: 3,
        EndpointScope.ADMIN: 4,
    }

    if scope_rank.get(scope, -2) < scope_rank.get(minimum_scope, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"API key does not have '{minimum_scope.value}' permission. "
                   f"Required: {minimum_scope.value}, got: {scope.value}",
        )

    # For admin scope, also check IP allowlist
    if minimum_scope == EndpointScope.ADMIN and not _check_ip_allowlist(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access not allowed from this IP address",
        )

    return f"apikey:{scope.value}"


# ===================================================================
# Decorator-style helpers for routes
# ===================================================================
def require_api_key(minimum_scope: EndpointScope) -> Callable:
    """Decorator-like helper: returns a FastAPI dependency."""
    async def dependency(request: Request) -> str:
        return await require_scope(request, minimum_scope)
    return dependency


# ===================================================================
# Input sanitization helpers
# ===================================================================
def sanitize_url(url: str, allowed_protocols: set[str] | None = None) -> str:
    """Validate and sanitize URLs to prevent SSRF.

    Args:
        url: The URL to validate.
        allowed_protocols: Set of allowed protocols (default: {'https'}).

    Raises:
        ValueError: If the URL is invalid or uses a disallowed protocol.
    """
    if allowed_protocols is None:
        allowed_protocols = {"https"}

    url = url.strip()
    if not url:
        raise ValueError("URL cannot be empty")

    protocol = url.split("://")[0].lower() if "://" in url else ""
    if not protocol:
        raise ValueError(f"URL must include protocol (e.g., https://). Got: {url[:50]}")

    if protocol not in allowed_protocols:
        raise ValueError(
            f"Protocol '{protocol}' is not allowed. Allowed: {', '.join(sorted(allowed_protocols))}"
        )

    # Block internal IPs / localhost (SSRF protection)
    from urllib.parse import urlparse
    parsed = urlparse(url)
    host = parsed.hostname or ""
    blocked_patterns = [
        "localhost", "127.0.0.1", "0.0.0.0",
        "169.254.",  # link-local
        "10.", "172.16.", "172.17.", "172.18.", "172.19.",
        "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
        "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
        "172.30.", "172.31.", "192.168.",
        "[::1]", "[::]", "[fc00:", "[fe80:",
    ]
    for pattern in blocked_patterns:
        if host.startswith(pattern):
            raise ValueError(f"URL targets internal network ({host[:50]}), blocked for security")

    # Block file:// protocol
    if url.startswith("file://"):
        raise ValueError("file:// protocol is not allowed (SSRF protection)")

    return url


def sanitize_query(query: str, max_length: int = 2000) -> str:
    """Sanitize and truncate search queries."""
    if not query or not query.strip():
        raise ValueError("Query cannot be empty")
    # Strip control characters
    cleaned = "".join(c for c in query.strip() if c.isprintable() or c in (" ", "\n"))
    return cleaned[:max_length]


def redact_error(error: Exception) -> str:
    """Redact sensitive information from error messages before returning to client."""
    msg = str(error)
    # Redact API keys, tokens, secrets in error messages
    import re
    msg = re.sub(r'(sk-[a-zA-Z0-9]{20,})', 'sk-***REDACTED***', msg)
    msg = re.sub(r'(xox[baprs]-[a-zA-Z0-9]{10,})', 'xox*-***REDACTED***', msg)
    msg = re.sub(r'(ghp_[a-zA-Z0-9]{36})', 'ghp_***REDACTED***', msg)
    msg = re.sub(r'(Bearer\s+)[a-zA-Z0-9\-_]{8,}', r'\1***REDACTED***', msg, flags=re.IGNORECASE)
    return msg
