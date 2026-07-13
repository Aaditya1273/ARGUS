#!/usr/bin/env bash
# =============================================================================
# SETU — One-Command Deployment
# =============================================================================
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/your-org/setu/main/setup.sh | bash
#   # or:
#   bash setup.sh
#
# What this does:
#   1. Checks prerequisites (docker, docker compose, git)
#   2. Clones repo if not already cloned
#   3. Copies .env.example → .env (does not overwrite existing)
#   4. Creates data directories
#   5. Builds webhook server image
#   6. Starts all containers
#   7. Waits for all health checks to pass
#   8. Shows service URLs
# =============================================================================

set -euo pipefail

# ── Flags ────────────────────────────────────────────────────────────────────
NON_INTERACTIVE=false
for arg in "$@"; do
    case "$arg" in
        --non-interactive|-n|--ci) NON_INTERACTIVE=true ;;
    esac
done

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}➜${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; exit 1; }

# ── 1. Prerequisites ────────────────────────────────────────────────────────
info "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || fail "Docker is required. Install from https://docs.docker.com/get-docker/"
ok "Docker: $(docker --version)"

# Check for compose plugin or standalone
if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
    ok "Docker Compose: $(docker compose version)"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
    ok "Docker Compose: $(docker-compose --version)"
else
    fail "Docker Compose is required. Install from https://docs.docker.com/compose/install/"
fi

command -v curl >/dev/null 2>&1 || warn "curl not found — health checks will be limited"
command -v git >/dev/null 2>&1 || warn "git not found (not needed if already cloned)"

# ── 2. Clone or enter repo ──────────────────────────────────────────────────
REPO_DIR="${1:-${PWD}}"

if [ ! -f "${REPO_DIR}/setup.sh" ]; then
    info "Cloning SETU repository..."
    REPO_URL="https://github.com/Aaditya1273/Subnet-ZK-Compose.git"
    git clone "${REPO_URL}" setu
    cd setu
    ok "Cloned into ./setu"
else
    cd "${REPO_DIR}"
    ok "Already in SETU repository: ${REPO_DIR}"
fi

# ── 3. Environment file ──────────────────────────────────────────────────────
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        info ".env created from .env.example"
        echo ""
        echo -e "  ${YELLOW}You MUST edit .env with your credentials before the services will work:${NC}"
        echo -e "  ${YELLOW}OPENAI_API_KEY${NC}=sk-...     (REQUIRED — get from https://platform.openai.com)"
        echo -e "  ${YELLOW}SLACK_BOT_TOKEN${NC}=xoxb-...  (REQUIRED — create at https://api.slack.com/apps)"
        echo -e "  ${YELLOW}SLACK_USER_TOKEN${NC}=xoxp-... (REQUIRED for RTS search)"
        echo -e "  ${YELLOW}LANGBOT_BOT_UUID${NC}=...      (REQUIRED — UUID of your LangBot bot)"
        echo ""
        if [ "$NON_INTERACTIVE" = false ]; then
            warn "Opening .env for editing..."
            # Try common editors; fall through if none available
            ${EDITOR:-${VISUAL:-nano}} .env 2>/dev/null || \
                ( echo "Open .env in your editor:"; echo "  nano .env"; echo "  vim .env"; echo "  code .env" )
            warn "Containers may fail until .env is filled. Press Enter to continue anyway..."
            read -r
        else
            info "Non-interactive mode: .env created with placeholder values. Edit it before starting."
        fi
        ok ".env created"
    else
        fail ".env.example not found — cannot create .env"
    fi
else
    ok ".env already exists (not overwritten)"
fi

# ── 4. Create data directories ───────────────────────────────────────────────
mkdir -p data/box data/plugins
ok "Data directories created"

# ── 5. Build images ──────────────────────────────────────────────────────────
info "Building SETU webhook server image..."
$COMPOSE build setu-webhook
ok "Webhook server image built"

# ── 6. Start containers ──────────────────────────────────────────────────────
info "Starting all services..."
$COMPOSE up -d
ok "All containers started"

# ── 7. Wait for health ────────────────────────────────────────────────────────
echo ""
info "Waiting for services to become healthy (this may take 1-2 minutes)..."

wait_for_healthy() {
    local service="$1"
    local max_attempts="$2"
    local attempt=0
    local container
    container=$($COMPOSE ps -q "$service" 2>/dev/null || true)

    while [ $attempt -lt "$max_attempts" ]; do
        if [ -n "$container" ]; then
            status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "starting")
            if [ "$status" = "healthy" ]; then
                ok "$service is healthy"
                return 0
            fi
        fi
        printf "."
        sleep 3
        attempt=$((attempt + 1))
        # Re-check container ID (may have been recreated)
        container=$($COMPOSE ps -q "$service" 2>/dev/null || true)
    done
    warn "$service health check timed out — check logs with: $COMPOSE logs $service"
    return 1
}

wait_for_healthy qdrant 20
wait_for_healthy setu-webhook 30
wait_for_healthy langbot-core 40
wait_for_healthy langbot-plugin 30

echo ""

# ── 8. Show status ──────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  SETU is running!                                         ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Services:"
echo "    Webhook API:     http://localhost:${WEBHOOK_SERVER_PORT:-9090}"
echo "    Health check:    http://localhost:${WEBHOOK_SERVER_PORT:-9090}/health/detailed"
echo "    LangBot Admin:   http://localhost:5300"
echo "    Qdrant Dashboard: http://localhost:6334"
echo ""
echo "  Endpoints:"
echo "    WhatsApp webhook: POST http://localhost:${WEBHOOK_SERVER_PORT:-9090}/webhooks/whatsapp"
echo "    Slack events:     POST http://localhost:${WEBHOOK_SERVER_PORT:-9090}/api/v1/webhooks/slack"
echo "    Knowledge API:    GET  http://localhost:${WEBHOOK_SERVER_PORT:-9090}/api/v1/knowledge/memory"
echo "    Metrics:          GET  http://localhost:${WEBHOOK_SERVER_PORT:-9090}/api/v1/metrics"
echo ""
echo "  Logs:"
echo "    $COMPOSE logs -f setu-webhook    # Webhook server"
echo "    $COMPOSE logs -f langbot-core    # LangBot engine"
echo "    $COMPOSE logs -f qdrant          # Vector store"
echo ""
echo "  Stop:"
echo "    $COMPOSE down"
echo ""

# ── 9. Quick smoke test ─────────────────────────────────────────────────────
info "Running quick smoke test..."
HEALTH_URL="http://localhost:${WEBHOOK_SERVER_PORT:-9090}/health"
if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    ok "Webhook server responds: $(curl -s "$HEALTH_URL")"
else
    warn "Health check not yet available — check logs: $COMPOSE logs setu-webhook"
fi
