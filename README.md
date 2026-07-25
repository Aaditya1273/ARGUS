# 👁️ ARGUS: Autonomous Reliability Guardian for AI Agents

[![Go Report Card](https://goreportcard.com/badge/github.com/argus/argus)](https://goreportcard.com/report/github.com/argus/argus)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Docker Pulls](https://img.shields.io/docker/pulls/argus/query-service)](https://hub.docker.com/r/argus/query-service)

> **ARGUS is an enterprise-grade AI Runtime Control Plane.** It moves beyond passive observability, providing dynamic governance, cost enforcement, behavioral fingerprinting, and automated self-healing for LLM-powered Autonomous Agents.

![ARGUS Dashboard](docs/assets/dashboard_placeholder.png)
*(Screenshot Placeholder: ARGUS Global Dashboard showing real-time cost burn and anomaly rates)*

---

## 🧠 The Philosophy: Observe → Understand → Detect → Take Action

Modern AI Agents (LangChain, AutoGPT, custom loops) are unpredictable. They enter infinite tool loops, burn through tokens, hallucinate, and fail silently. ARGUS is the immune system for your AI runtime.

1. **Observe**: One-line Python SDK drops into any LangChain/OpenAI stack and auto-instruments full OpenTelemetry traces.
2. **Understand**: Reconstructs memory state, tool usage, prompt sequences, and token metrics.
3. **Detect**: Evaluates executions against strict Cost Policies and Behavioral DNA Baselines.
4. **Take Action**: Automatically executes Self-Healing routines (Kill, Fallback, Switch Prompt, Circuit Breaker).

---

## ⚡ Core Engines

### 1. 🛡️ Governance & Self-Healing Engine
Detects runtime violations (`InfiniteToolLoop`, `TokenExplosion`, `AgentStuck`) and automatically triggers recovery sequences (`FallbackModel`, `ReduceContext`, `EscalateHuman`). Every decision is fully traced.

### 2. 💸 Cost Firewall
Stops budget overruns before they happen. Track cost per User, Team, Agent, and Model. Write dynamic policies to `BLOCK_EXECUTION` if an agent burns more than $5 on a single run.

### 3. 🧬 Agent DNA Profiler
Generates a deterministic structural hash of an agent's execution path. Statistically compares latency, cost, and tool usage against healthy historical baselines to detect deep anomalies.

### 4. ⏪ Prompt Replay CLI
Select any historical trace, tweak the system prompt, and simulate a new run instantly. Generates semantic diffs and cost/latency deltas to safely test prompt engineering in production.

---

## 🚀 Quickstart

### 1. Start the Control Plane
Deploy the backend, datastore, and React dashboard via Docker Compose.
```bash
git clone https://github.com/argus/argus.git
cd argus/deploy/docker
docker-compose up -d
```

### 2. Instrument your Agent
Install the SDK and initialize ARGUS in one line.
```python
pip install argus-sdk

from argus_sdk import init_argus
from openai import OpenAI

# One line to enable full governance!
init_argus(agent_id="sales-bot-v1")

client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Sell me a pen."}]
)
```

---

## 📚 Documentation
- [System Architecture](ARCHITECTURE.md)
- [REST APIs](API_DOCS.md)
- [Enterprise Integrations (Terraform, Slack, K8s)](deploy/README.md)

## 🤝 Contributing
Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## 📄 License
This project is licensed under the Apache 2.0 License.
