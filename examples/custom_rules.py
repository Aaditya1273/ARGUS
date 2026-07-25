#!/usr/bin/env python3
"""
Example: Custom Governance Enforcement with ARGUS

Shows how to use ARGUS's @enforce decorator to set custom rules
on token usage, cost limits, and tool access per function.

Prerequisites:
    pip install argus-sdk
    export OPENAI_API_KEY=sk-...

Usage:
    python examples/custom_rules.py
"""

import os

from openai import OpenAI

from argus_sdk import enforce, init

init(
    agent_id="custom-rules-agent",
    control_plane_url=os.getenv(
        "ARGUS_CONTROL_PLANE_URL",
        "ws://localhost:8080/api/v1/argus/agent-ws",
    ),
)

client = OpenAI()


@enforce(max_tokens=500, max_cost=0.02, allowed_tools=["search", "calculator"])
def safe_chat_completion(user_message: str) -> str:
    """Run a chat completion with governance enforcement.

    ARGUS will:
    - Track token usage and cost
    - Block execution if limits are exceeded
    - Report violations to the control plane
    """
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": user_message},
        ],
        max_tokens=200,
    )
    return response.choices[0].message.content


@enforce(max_tokens=2000, max_cost=0.10)
def expensive_chat_completion(user_message: str) -> str:
    """This function allows higher limits for more complex tasks."""
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are an expert analyst."},
            {"role": "user", "content": user_message},
        ],
        max_tokens=1000,
    )
    return response.choices[0].message.content


if __name__ == "__main__":
    print("=== Safe Chat (gpt-3.5-turbo, low limits) ===")
    result = safe_chat_completion("Explain what ARGUS does in one sentence.")
    print(f"Result: {result}\n")

    print("=== Expensive Chat (gpt-4, higher limits) ===")
    result = expensive_chat_completion(
        "Analyze the pros and cons of microservices architecture."
    )
    print(f"Result: {result}\n")

    print("ARGUS governance rules enforced ✓")
