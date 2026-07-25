# Tutorial 1: Getting Started with ARGUS

In this tutorial, you'll deploy the ARGUS Control Plane and instrument your first AI agent.

## Step 1: Deploy the Control Plane

```bash
git clone https://github.com/argus-ai/argus.git
cd argus

# Start the full stack:
# ClickHouse (telemetry storage)
# OpenTelemetry Collector (trace ingestion)
# ARGUS Query Service (backend API)
# ARGUS Frontend (dashboard)
docker compose -f demo/docker-compose.demo.yaml up -d
```

Verify all services are running:

```bash
docker compose -f demo/docker-compose.demo.yaml ps
```

Check the health endpoint:

```bash
curl http://localhost:8080/api/v1/health
# Expected: {"status": "ok"}
```

## Step 2: Open the Dashboard

Open [http://localhost:3301](http://localhost:3301) in your browser.

You should see the ARGUS Mission Control dashboard showing real-time agent status.

## Step 3: Install the SDK

```bash
pip install argus-sdk[openai]
```

## Step 4: Instrument an Agent

Create a file called `demo_agent.py`:

```python
from argus_sdk import init
from openai import OpenAI

# One line enables full governance
init(agent_id="my-first-agent")

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Hello, world!"}],
)

print(response.choices[0].message.content)
```

Run your agent:

```bash
export OPENAI_API_KEY=sk-...
python demo_agent.py
```

## Step 5: Verify Telemetry

The dashboard will show:
- Your agent appearing in the Live Agents view
- Token usage and cost metrics
- Execution traces in the Agent DNA view

## What's Next?

- [Tutorial 2: Cost Firewall](cost_firewall.md)
- [Tutorial 3: Self-Healing](self_healing.md)
- [API Reference](../API_REFERENCE.md)
- [SDK Reference](../SDK_REFERENCE.md)
