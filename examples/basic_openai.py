#!/usr/bin/env python3
"""
Example: Basic OpenAI Agent with ARGUS Governance

This example demonstrates how to instrument a simple OpenAI agent
with ARGUS for cost tracking, governance, and self-healing.

Prerequisites:
    pip install argus-sdk[openai]
    export OPENAI_API_KEY=sk-...

Usage:
    python examples/basic_openai.py

    Ensure the ARGUS Control Plane is running:
    cd demo && docker compose -f docker-compose.demo.yaml up
"""

import os

from openai import OpenAI

from argus_sdk import init

# Initialize ARGUS - one line enables governance
init(
    agent_id="demo-agent-v1",
    control_plane_url=os.getenv(
        "ARGUS_CONTROL_PLANE_URL",
        "ws://localhost:8080/api/v1/argus/agent-ws",
    ),
)

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"},
    ],
    max_tokens=100,
)

print(f"Response: {response.choices[0].message.content}")
print(f"Tokens used: {response.usage.total_tokens}")
print(f"Trace emitted to ARGUS Control Plane ✓")
