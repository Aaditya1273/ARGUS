#!/usr/bin/env python3
"""ARGUS Demo Agent — generates real AI agent traces for the demo environment.

This agent runs a simulated sales/customer-support workflow using LangChain,
emitting real OpenTelemetry traces that flow through the ARGUS control plane.

Usage:
    python agent.py                          # Run default demo
    python agent.py --mode loop              # Run in infinite loop (generates violations)
    python agent.py --mode violation         # Generate specific governance violations
"""

from __future__ import annotations

import argparse
import logging
import os
import random
import sys
import time
import uuid
from typing import Optional

import argus
from argus.state import AgentStatus, TerminatedException, PausedException

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("argus-demo-agent")


class DemoAgent:
    """Demo agent that simulates AI agent workflows with real telemetry."""

    def __init__(
        self,
        agent_id: str = "demo-sales-agent",
        mode: str = "normal",
        violation_type: Optional[str] = None,
    ):
        self.agent_id = agent_id
        self.mode = mode
        self.violation_type = violation_type
        self.session_id = str(uuid.uuid4())[:8]
        self.tool_call_count = 0
        self.current_tool = None

        # Initialize ARGUS SDK
        argus.init(
            agent_id=agent_id,
            telemetry_endpoint=os.environ.get("ARGUS_OTLP_ENDPOINT", "http://localhost:4318"),
            control_plane_url=f"ws://{os.environ.get('ARGUS_WS_HOST', 'localhost:8080')}/api/v1/argus/agent-ws",
        )

        logger.info(f"Demo Agent '{agent_id}' initialized (session: {self.session_id})")

    def run_normal(self) -> None:
        """Run a normal sales workflow — no violations expected."""
        logger.info("Starting normal demo workflow...")

        steps = [
            ("llm", "Understand customer requirements", 0.5),
            ("tool", "search_knowledge_base", 1.2),
            ("llm", "Analyze search results", 0.8),
            ("tool", "calculate_pricing", 0.3),
            ("llm", "Generate proposal", 1.0),
            ("tool", "send_proposal_email", 0.5),
            ("llm", "Confirm completion", 0.3),
        ]

        for kind, name, duration in steps:
            self._execute_step(kind, name, duration)
            time.sleep(0.5)

        logger.info("Normal workflow completed successfully.")

    def run_violation(self) -> None:
        """Run a workflow that triggers specific governance violations."""
        logger.info(f"Starting violation demo: {self.violation_type}")

        if self.violation_type == "infinite_loop":
            self._run_infinite_loop()
        elif self.violation_type == "token_explosion":
            self._run_token_explosion()
        elif self.violation_type == "budget_exceeded":
            self._run_budget_exceeded()
        elif self.violation_type == "latency_spike":
            self._run_latency_spike()
        else:
            logger.warning(f"Unknown violation type: {self.violation_type}")
            self.run_normal()

    def _run_infinite_loop(self) -> None:
        """Simulate an infinite tool loop by calling the same tool repeatedly."""
        logger.info("Generating infinite tool loop violation...")
        for i in range(12):
            step_name = "search_product_catalog"
            self._execute_step("tool", step_name, 0.2 + random.random() * 0.3)
            logger.info(f"  Loop iteration {i+1}: {step_name}")
            time.sleep(0.1)

    def _run_token_explosion(self) -> None:
        """Simulate token explosion by generating large LLM contexts."""
        logger.info("Generating token explosion violation...")
        for i in range(5):
            # Use large token counts to trigger the detector
            self._emit_llm_span(
                prompt=f"Very long prompt with many tokens... (iteration {i})" * 100,
                response="Long response... " * 100,
                input_tokens=5000 + i * 2000,
                output_tokens=3000 + i * 1000,
                duration=2.0 + random.random(),
            )
            time.sleep(0.5)

    def _run_budget_exceeded(self) -> None:
        """Simulate budget exceeded by using expensive models."""
        logger.info("Generating budget exceeded violation...")
        for i in range(3):
            self._execute_step("llm", f"expensive-llm-call-{i}", 1.0)
            time.sleep(0.3)

    def _run_latency_spike(self) -> None:
        """Simulate a latency spike by blocking on a slow tool call."""
        logger.info("Generating latency spike violation...")
        self._execute_step("tool", "slow_database_query", 8.0)

    def _execute_step(self, kind: str, name: str, duration: float) -> None:
        """Execute a single agent step with telemetry."""
        self.current_tool = name
        self.tool_call_count += 1

        step_id = f"{kind}-{self.tool_call_count}"

        logger.info(f"  [{step_id}] {kind.upper()}: {name} ({duration:.1f}s)")

        if kind == "tool":
            input_tokens = random.randint(200, 800)
            output_tokens = random.randint(100, 600)
            self._emit_tool_span(name, duration, input_tokens, output_tokens)
        else:
            input_tokens = random.randint(500, 2000)
            output_tokens = random.randint(200, 1500)
            self._emit_llm_span(
                prompt=f"Agent prompt for {name}",
                response=f"Agent response for {name}",
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                duration=duration,
            )

        time.sleep(duration * 0.5)

    def _emit_tool_span(self, tool_name: str, duration: float, input_tokens: int, output_tokens: int) -> None:
        """Emit a tool span via OpenTelemetry."""
        from opentelemetry import trace

        tracer = trace.get_tracer(__name__)
        with tracer.start_as_current_span(
            f"tool.{tool_name}",
            attributes={
                "gen_ai.system": "demo-agent",
                "gen_ai.tool.name": tool_name,
                "gen_ai.tool.type": "function",
                "gen_ai.usage.input_tokens": input_tokens,
                "gen_ai.usage.output_tokens": output_tokens,
                "argus.agent_id": self.agent_id,
                "argus.session_id": self.session_id,
                "argus.step_number": self.tool_call_count,
                "argus.tool_name": tool_name,
            },
        ) as span:
            time.sleep(duration)

    def _emit_llm_span(
        self,
        prompt: str,
        response: str,
        input_tokens: int,
        output_tokens: int,
        duration: float,
    ) -> None:
        """Emit an LLM span via OpenTelemetry."""
        from opentelemetry import trace

        tracer = trace.get_tracer(__name__)
        with tracer.start_as_current_span(
            f"llm.{self.current_tool or 'chat'}",
            attributes={
                "gen_ai.system": "openai" if os.environ.get("OPENAI_API_KEY", "").startswith("sk-") else "demo-agent",
                "gen_ai.request.model": os.environ.get("OPENAI_MODEL", "gpt-3.5-turbo"),
                "gen_ai.request.max_tokens": 4096,
                "gen_ai.request.temperature": 0.7,
                "gen_ai.response.id": f"demo-{uuid.uuid4().hex[:12]}",
                "gen_ai.usage.prompt_tokens": input_tokens,
                "gen_ai.usage.completion_tokens": output_tokens,
                "gen_ai.usage.total_tokens": input_tokens + output_tokens,
                "argus.agent_id": self.agent_id,
                "argus.session_id": self.session_id,
                "argus.step_number": self.tool_call_count,
                "argus.budget_burn": (input_tokens + output_tokens) * 0.00003,
            },
        ) as span:
            if duration > 5.0:
                span.set_attribute("argus.violation", "latency_spike")
                span.set_attribute("argus.severity", "high")
            time.sleep(duration * 0.5)


def main():
    parser = argparse.ArgumentParser(description="ARGUS Demo Agent")
    parser.add_argument("--mode", choices=["normal", "loop", "violation"], default="normal")
    parser.add_argument("--violation", choices=["infinite_loop", "token_explosion", "budget_exceeded", "latency_spike"])
    parser.add_argument("--agent-id", default="demo-sales-agent")
    parser.add_argument("--iterations", type=int, default=1)
    args = parser.parse_args()

    agent = DemoAgent(agent_id=args.agent_id, mode=args.mode, violation_type=args.violation)

    if args.mode == "violation" and args.violation:
        agent.run_violation()
    elif args.mode == "loop":
        for i in range(args.iterations):
            logger.info(f"--- Loop iteration {i+1}/{args.iterations} ---")
            try:
                agent.run_violation() if args.violation else agent.run_normal()
            except Exception as e:
                logger.error(f"Iteration failed: {e}")
            time.sleep(2)
    else:
        agent.run_normal()

    logger.info("Demo agent run complete.")


if __name__ == "__main__":
    main()
