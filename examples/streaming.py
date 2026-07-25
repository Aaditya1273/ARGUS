#!/usr/bin/env python3
"""
Example: Streaming Response with ARGUS Governance

Demonstrates how ARGUS handles streaming completions, tracking
tokens and cost in real time.

Prerequisites:
    pip install argus-sdk[openai]
    export OPENAI_API_KEY=sk-...

Usage:
    python examples/streaming.py
"""

import os
import sys

from openai import OpenAI

from argus_sdk import init

init(
    agent_id="streaming-demo",
    control_plane_url=os.getenv(
        "ARGUS_CONTROL_PLANE_URL",
        "ws://localhost:8080/api/v1/argus/agent-ws",
    ),
)

client = OpenAI()

stream = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "system", "content": "You are a poet."},
        {
            "role": "user",
            "content": "Write a short poem about artificial intelligence.",
        },
    ],
    stream=True,
    max_tokens=200,
)

print("Generating poem...")
for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
        sys.stdout.flush()

print("\n\nARGUS tracked streaming tokens in real time ✓")
