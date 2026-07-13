#!/usr/bin/env bash
# =============================================================================
# wait-for.sh — Wait for a service to become available
# =============================================================================
# Usage:
#   ./scripts/wait-for.sh http://localhost:9090/health --timeout=60
#   ./scripts/wait-for.sh tcp://localhost:6333 --timeout=30 -- echo "Qdrant is ready"
#
# Examples:
#   # Wait for Qdrant
#   ./scripts/wait-for.sh http://qdrant:6333/healthz --timeout=60
#
#   # Wait for TCP port
#   ./scripts/wait-for.sh tcp://setu-webhook:9090 --timeout=30
#
#   # Wait then run command
#   ./scripts/wait-for.sh http://localhost:6333 --timeout=30 -- uv run webhook_server.py
# =============================================================================

set -euo pipefail

# ── Parse args ──────────────────────────────────────────────────────────────
TARGET=""
TIMEOUT=30
INTERVAL=2
VERBOSE=false
CMD=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --timeout=*)
            TIMEOUT="${1#*=}"
            shift
            ;;
        --interval=*)
            INTERVAL="${1#*=}"
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --)
            shift
            CMD=("$@")
            break
            ;;
        -*)
            echo "Unknown option: $1"
            exit 1
            ;;
        *)
            if [ -z "$TARGET" ]; then
                TARGET="$1"
            else
                CMD=("$@")
                break
            fi
            shift
            ;;
    esac
done

if [ -z "$TARGET" ]; then
    echo "Usage: $0 <url|tcp://host:port> [--timeout=N] [--interval=N] [--] <command...>"
    exit 1
fi

# ── Parse target ────────────────────────────────────────────────────────────
if [[ "$TARGET" == tcp://* ]]; then
    HOST_PORT="${TARGET#tcp://}"
    PROTO="tcp"
elif [[ "$TARGET" == http://* ]] || [[ "$TARGET" == https://* ]]; then
    URL="$TARGET"
    PROTO="http"
else
    echo "Unsupported target: $TARGET (use http://... or tcp://host:port)"
    exit 1
fi

# ── Wait loop ───────────────────────────────────────────────────────────────
START_TIME=$(date +%s)
END_TIME=$((START_TIME + TIMEOUT))

echo "⏳ Waiting for $TARGET (timeout=${TIMEOUT}s, interval=${INTERVAL}s)..."

while true; do
    NOW=$(date +%s)
    if [ "$NOW" -ge "$END_TIME" ]; then
        echo "❌ Timed out after ${TIMEOUT}s waiting for $TARGET"
        exit 1
    fi

    SUCCESS=false
    case "$PROTO" in
        tcp)
            HOST="${HOST_PORT%:*}"
            PORT="${HOST_PORT##*:}"
            if command -v nc >/dev/null 2>&1; then
                nc -z "$HOST" "$PORT" 2>/dev/null && SUCCESS=true
            else
                # Bash built-in TCP check via /dev/tcp (virtual, always try it)
                timeout 2 bash -c "echo >/dev/tcp/$HOST/$PORT" 2>/dev/null && SUCCESS=true || {
                    # Fallback: try HTTP endpoint
                    timeout 2 curl -sf "http://$HOST:$PORT/health" >/dev/null 2>&1 && SUCCESS=true || true
                }
            fi
            ;;
        http)
            if command -v curl >/dev/null 2>&1; then
                curl -sf -o /dev/null "$URL" 2>/dev/null && SUCCESS=true
            else
                # Fallback: wget
                wget -q -O /dev/null "$URL" 2>/dev/null && SUCCESS=true || true
            fi
            ;;
    esac

    if $SUCCESS; then
        ELAPSED=$((NOW - START_TIME))
        echo "✅ $TARGET is available (${ELAPSED}s)"
        break
    fi

    $VERBOSE && echo "  Still waiting... ($((NOW - START_TIME))s)"
    sleep "$INTERVAL"
done

# ── Run command if provided ─────────────────────────────────────────────────
if [ ${#CMD[@]} -gt 0 ]; then
    exec "${CMD[@]}"
fi
