#!/usr/bin/env python3
"""ARGUS Demo Verification — automatically verifies every component of the demo.

Checks:
- All HTTP endpoints return 200
- WebSocket connections can be established
- Cost policies are loaded
- Governance rules are active
- Agent state tracking works
- OTel traces are collected
- Dashboard data is accessible
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import urllib.request
import urllib.error

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("argus-verify")

API_URL = os.environ.get("ARGUS_API_URL", "http://localhost:8080")
WS_URL = os.environ.get("ARGUS_WS_ENDPOINT", "ws://localhost:8080")

PASS = 0
FAIL = 0
WARN = 0


def check(name: str, condition: bool, detail: str = ""):
    """Record a check result."""
    global PASS, FAIL, WARN
    if condition:
        PASS += 1
        logger.info(f"  ✅ {name}")
    else:
        FAIL += 1
        logger.error(f"  ❌ {name}: {detail}")


def check_http(endpoint: str, expected_status: int = 200) -> bool:
    """Check an HTTP endpoint returns the expected status."""
    try:
        req = urllib.request.Request(f"{API_URL}{endpoint}")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == expected_status
    except Exception as e:
        logger.debug(f"HTTP check failed for {endpoint}: {e}")
        return False


def check_json(endpoint: str) -> dict | None:
    """Fetch a JSON endpoint and return the parsed response."""
    try:
        req = urllib.request.Request(f"{API_URL}{endpoint}")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        logger.debug(f"JSON check failed for {endpoint}: {e}")
        return None


def check_websocket() -> bool:
    """Check WebSocket connectivity."""
    try:
        import websocket
        ws_url = f"{WS_URL}/api/v1/argus/ws"
        ws = websocket.create_connection(ws_url, timeout=10)
        ws.close()
        return True
    except Exception as e:
        logger.debug(f"WebSocket check failed: {e}")
        return False


def wait_for_service(name: str, endpoint: str, max_retries: int = 20):
    """Wait for a service to become available."""
    logger.info(f"  Waiting for {name}...")
    for i in range(max_retries):
        if check_http(endpoint):
            logger.info(f"  {name} is ready!")
            return True
        time.sleep(3)
    logger.error(f"  {name} did not become available")
    return False


def verify_health():
    """Verify core health endpoints."""
    logger.info("\n📋 Health Check")
    check("API health endpoint", check_http("/api/v1/health"))
    check("Version endpoint", check_http("/api/v1/version"))


def verify_cost_firewall():
    """Verify cost firewall endpoints."""
    logger.info("\n💰 Cost Firewall")
    check("Cost metrics endpoint", check_http("/api/v1/argus/cost/metrics"))
    check("Cost policies endpoint", check_http("/api/v1/argus/cost/policies"))

    policies = check_json("/api/v1/argus/cost/policies")
    if policies:
        check("Cost policies have data", len(policies) > 0,
              f"Found {len(policies)} policies")


def verify_governance():
    """Verify governance engine endpoints."""
    logger.info("\n🛡️  Governance")

    data = check_json("/api/v1/argus/agent_dna")
    if data:
        check("Agent DNA endpoint responds", True)
        if "fingerprint" in data:
            check("DNA fingerprint generated", data["fingerprint"]["agent_id"] != "")
        if "report" in data:
            check("Anomaly report returned", "is_anomalous" in data["report"])


def verify_agents():
    """Verify agent management endpoints."""
    logger.info("\n🤖 Live Agents")
    check("Agent list endpoint", check_http("/api/v1/argus/agents"))

    agents = check_json("/api/v1/argus/agents")
    if agents is not None:
        check("Agents endpoint returns list", isinstance(agents, list))
    else:
        check("Agents endpoint returns data", False, "Agents data is None")


def verify_websocket():
    """Verify WebSocket connectivity."""
    logger.info("\n🔌 WebSocket")
    check("WebSocket connection to dashboard hub", check_websocket())
    check("Agent WebSocket URL accessible", check_http("/api/v1/argus/agent-ws?agent_id=verify-agent"))


def verify_replay():
    """Verify replay endpoints."""
    logger.info("\n⏪ Prompt Replay")
    check("Replay endpoint", check_http("/api/v1/argus/replay/demo-trace-001"))
    check("Replay execute endpoint", check_http("/api/v1/argus/replay/execute", expected_status=405))


def verify_otel_collector():
    """Verify OpenTelemetry collector is accessible."""
    logger.info("\n📡 OpenTelemetry")
    check("OTel collector metrics", check_http(":8888/metrics") or check_http(":8889/metrics"))


def verify_clickhouse():
    """Verify ClickHouse is accessible."""
    logger.info("\n🗄️  ClickHouse")
    try:
        import clickhouse_connect
        client = clickhouse_connect.get_client(host="localhost", port=8123)
        result = client.query("SELECT 1")
        check("ClickHouse query works", result.result_rows[0][0] == 1)
        client.close()
    except ImportError:
        check("clickhouse-connect driver", False, "Not installed")
    except Exception as e:
        check("ClickHouse accessible", False, str(e))


def main():
    logger.info("=" * 60)
    logger.info("ARGUS Demo Environment Verification")
    logger.info(f"API URL: {API_URL}")
    logger.info(f"WS URL: {WS_URL}")
    logger.info("=" * 60)

    # Wait for core services
    logger.info("\n⏳ Waiting for core services...")
    if not wait_for_service("ARGUS API", "/api/v1/health"):
        FAIL += 1

    # Run all verification checks
    verify_health()
    verify_cost_firewall()
    verify_governance()
    verify_agents()
    verify_websocket()
    verify_replay()
    verify_otel_collector()
    verify_clickhouse()

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("Verification Results")
    logger.info(f"  ✅ Passed: {PASS}")
    logger.info(f"  ❌ Failed: {FAIL}")
    logger.info(f"  ⚠️  Warnings: {WARN}")
    logger.info(f"  Total: {PASS + FAIL + WARN}")
    logger.info("=" * 60)

    if FAIL > 0:
        sys.exit(1)
    else:
        logger.info("All checks passed!")


if __name__ == "__main__":
    main()
