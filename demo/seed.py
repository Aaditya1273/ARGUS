#!/usr/bin/env python3
"""ARGUS Demo Seed — seeds the ARGUS environment with initial data.

Creates:
- Default cost policies
- Agent DNA baselines
- Sample governance rules
- Demo dashboards
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import urllib.request
import urllib.parse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("argus-seed")

API_URL = os.environ.get("ARGUS_API_URL", "http://localhost:8080")


def _api_post(path: str, data: dict, retries: int = 5) -> dict:
    """POST to the ARGUS API with retry logic."""
    url = f"{API_URL}{path}"
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(data).encode(),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            if attempt < retries - 1:
                wait = (attempt + 1) * 2
                logger.info(f"  Retry {attempt+1}/{retries} in {wait}s: {e.code}")
                time.sleep(wait)
            else:
                logger.warning(f"  API error: {e.code} {e.reason} on POST {path}")
                return {"error": str(e)}
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2)
            else:
                logger.warning(f"  Request failed: {e}")
                return {"error": str(e)}
    return {"error": "Max retries exceeded"}


def wait_for_api():
    """Wait until the ARGUS API is available."""
    logger.info("Waiting for ARGUS API...")
    for i in range(30):
        try:
            req = urllib.request.Request(f"{API_URL}/api/v1/health")
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    logger.info("ARGUS API is ready!")
                    return True
        except Exception:
            pass
        time.sleep(2)
    logger.error("ARGUS API did not become available in time")
    return False


def seed_cost_policies():
    """Create default cost policies."""
    logger.info("Seeding cost policies...")

    policies = [
        {
            "name": "Run Cost Limit",
            "condition": {"dimension": "run_cost", "operator": ">", "threshold": 5.0},
            "action": "KILL_RUN",
            "enabled": True,
        },
        {
            "name": "Daily Budget Enforcer",
            "condition": {"dimension": "daily_budget", "operator": ">", "threshold": 50.0},
            "action": "BLOCK_EXECUTION",
            "enabled": True,
        },
        {
            "name": "GPT-4 Cost Fallback",
            "condition": {"dimension": "model_gpt-4", "operator": ">", "threshold": 100.0},
            "action": "FALLBACK_MODEL",
            "enabled": True,
        },
        {
            "name": "Latency SLA",
            "condition": {"dimension": "latency_ms", "operator": ">", "threshold": 5000.0},
            "action": "ALERT",
            "enabled": True,
        },
        {
            "name": "Tool Call Limit",
            "condition": {"dimension": "tool_calls", "operator": ">", "threshold": 50.0},
            "action": "REDUCE_CONTEXT",
            "enabled": True,
        },
    ]

    for policy in policies:
        result = _api_post("/api/v1/argus/cost/policies", policy)
        if "error" in result:
            logger.warning(f"  Failed to create policy '{policy['name']}': {result['error']}")
        else:
            logger.info(f"  Created policy: {policy['name']}")


def seed_agent_baselines():
    """Create agent DNA baselines."""
    logger.info("Seeding agent DNA baselines...")

    baseline = {
        "agent_id": "demo-sales-agent",
        "mean_latency_ms": 1500.0,
        "latency_std_dev": 500.0,
        "mean_cost": 0.05,
        "cost_std_dev": 0.02,
        "mean_tokens": 800.0,
        "tokens_std_dev": 300.0,
        "expected_tools": [
            "search_knowledge_base",
            "calculate_pricing",
            "send_proposal_email",
            "search_product_catalog",
            "slow_database_query",
        ],
        "frequent_sequences": [
            "search_knowledge_base->calculate_pricing",
            "search_product_catalog->calculate_pricing",
        ],
    }

    result = _api_post("/api/v1/argus/agent_dna/baselines", baseline)
    if "error" in result:
        logger.warning(f"  Failed to seed baselines: {result['error']}")
    else:
        logger.info("  Created DNA baselines for demo-sales-agent")


def seed_governance_rules():
    """Create governance rules."""
    logger.info("Seeding governance rules...")

    rules = [
        {
            "name": "Infinite Tool Loop Detection",
            "plugin": "infinite_loop",
            "config": {"max_consecutive_tools": 5},
            "severity": "CRITICAL",
            "action": "KILL_RUN",
            "enabled": True,
        },
        {
            "name": "Token Explosion Prevention",
            "plugin": "token_explosion",
            "config": {"max_total_tokens": 50000},
            "severity": "CRITICAL",
            "action": "KILL_RUN",
            "enabled": True,
        },
        {
            "name": "Budget Exceeded",
            "plugin": "budget_exceeded",
            "config": {"budget_limit": 5.0},
            "severity": "CRITICAL",
            "action": "KILL_RUN",
            "enabled": True,
        },
        {
            "name": "Latency Spike Detection",
            "plugin": "latency_spike",
            "config": {"max_duration_seconds": 5},
            "severity": "HIGH",
            "action": "TRIGGER_FALLBACK",
            "enabled": True,
        },
        {
            "name": "Tool Timeout",
            "plugin": "tool_timeout",
            "config": {"max_timeout_seconds": 10},
            "severity": "HIGH",
            "action": "ALERT",
            "enabled": True,
        },
    ]

    for rule in rules:
        result = _api_post("/api/v1/argus/governance/rules", rule)
        if "error" in result:
            logger.warning(f"  Failed to create rule '{rule['name']}': {result['error']}")
        else:
            logger.info(f"  Created rule: {rule['name']}")


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def seed_signoz_dashboards():
    """Import SigNoz-native dashboards via the SigNoz REST API."""
    logger.info("Seeding SigNoz dashboards...")
    dashboards_dir = os.path.join(SCRIPT_DIR, "signoz-dashboards")
    for fname in sorted(os.listdir(dashboards_dir)):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(dashboards_dir, fname)
        with open(fpath) as f:
            dashboard = json.load(f)
        result = _api_post("/api/v1/dashboards", dashboard)
        if "error" in result:
            logger.warning(f"  Failed to import dashboard '{fname}': {result['error']}")
        else:
            logger.info(f"  Imported dashboard: {fname}")


def seed_signoz_alerts():
    """Import SigNoz alert rules via the SigNoz REST API."""
    logger.info("Seeding SigNoz alert rules...")
    alerts_dir = os.path.join(SCRIPT_DIR, "signoz-alerts")
    for fname in sorted(os.listdir(alerts_dir)):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(alerts_dir, fname)
        with open(fpath) as f:
            rule = json.load(f)
        result = _api_post("/api/v1/rules", rule)
        if "error" in result:
            logger.warning(f"  Failed to import alert '{fname}': {result['error']}")
        else:
            logger.info(f"  Imported alert: {fname}")


def main():
    logger.info("=" * 60)
    logger.info("ARGUS Demo Seed")
    logger.info(f"API URL: {API_URL}")
    logger.info("=" * 60)

    if not wait_for_api():
        sys.exit(1)

    logger.info("")
    seed_cost_policies()
    logger.info("")
    seed_agent_baselines()
    logger.info("")
    seed_governance_rules()
    logger.info("")
    seed_signoz_dashboards()
    logger.info("")
    seed_signoz_alerts()
    logger.info("")
    logger.info("Seeding complete!")


if __name__ == "__main__":
    main()
