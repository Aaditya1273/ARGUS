# 👁️ ARGUS: Autonomous Reliability Guardian for AI Agents

[![Go Report Card](https://goreportcard.com/badge/github.com/SigNoz/signoz)](https://goreportcard.com/report/github.com/SigNoz/signoz)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/SigNoz/signoz/actions/workflows/ci.yml/badge.svg)](https://github.com/SigNoz/signoz/actions/workflows/ci.yml)
[![Go Version](https://img.shields.io/github/go-mod/go-version/SigNoz/signoz)](https://go.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/SigNoz/signoz/badge)](https://securityscorecards.dev/viewer/?uri=github.com/SigNoz/signoz)

> **Built for the Agents of SigNoz Hackathon 2026 — Best Use of SigNoz category**
>
> **ARGUS is an AI Runtime Intelligence Layer** — built on [SigNoz](https://signoz.io/) + OpenTelemetry.
> ARGUS extends SigNoz with dynamic governance, cost enforcement, behavioral fingerprinting,
> and automated self-healing for LLM-powered Autonomous Agents.
>
> _"If you can't observe your AI agents, you don't own them."_ — SigNoz

---

## 🧠 The Philosophy

Modern AI Agents (LangChain, AutoGPT, custom loops) are unpredictable. They enter infinite tool loops, burn through tokens, hallucinate, and fail silently. ARGUS is the immune system for your AI runtime.

1. **Observe** — One-line Python SDK auto-instruments full OpenTelemetry traces
2. **Detect** — Evaluates executions against cost policies and behavioral baselines
3. **Govern** — Enforces runtime policies with automatic recovery actions
4. **Heal** — Executes self-healing routines (Kill, Fallback, Switch Prompt)
5. **Learn** — Profiles agent DNA for anomaly detection

---

## ⚡ Core Engines

| Engine | Description | Status |
|--------|-------------|--------|
| 🛡️ **Governance & Self-Healing** | Detects runtime violations, triggers recovery sequences | ✅ v0.1 |
| 💸 **Cost Firewall** | Per-user, per-agent, per-model cost tracking with policy enforcement | ✅ v0.1 |
| 🧬 **Agent DNA Profiler** | Execution fingerprinting with Z-score anomaly detection | ✅ v0.1 |
| ⏪ **Prompt Replay** | Trace reconstruction, prompt modification, semantic diff | ✅ v0.1 |
| 🔌 **Python SDK** | One-line OTel auto-instrumentation for OpenAI, LangChain, Anthropic | ✅ v0.1 |
| 📊 **Dashboard** | Real-time agent status, cost metrics, DNA reports | ✅ v0.1 |

---

## 🚀 Quickstart

### 1. Start the Control Plane

```bash
git clone https://github.com/SigNoz/signoz.git
cd signoz/demo
docker compose -f docker-compose.demo.yaml up -d
```

### 2. Instrument your Agent

```bash
pip install argus-sdk[openai]
```

```python
from argus_sdk import init
from openai import OpenAI

# One line to enable full governance
init(agent_id="my-agent")

client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello, world!"}],
)
print(response.choices[0].message.content)
```

### 3. Open the Dashboard

Navigate to [http://localhost:3301](http://localhost:3301) to see your agent in Mission Control.

---

## 📚 Documentation

| Resource | Description |
|----------|-------------|
| [Architecture](ARCHITECTURE.md) | System design, data flow, component interactions |
| [API Reference](API_REFERENCE.md) | Complete REST API documentation |
| [SDK Reference](SDK_REFERENCE.md) | Python SDK API reference |
| [Roadmap](ROADMAP.md) | Development plans and milestones |
| [Changelog](CHANGELOG.md) | Release history |

### Tutorials

| Tutorial | Description |
|----------|-------------|
| [Getting Started](tutorials/getting_started.md) | Deploy ARGUS and run your first agent |
| [Cost Firewall](tutorials/cost_firewall.md) | Create cost policies to protect your budget |
| [Self-Healing](tutorials/self_healing.md) | Automatic recovery from agent failures |
| [Agent DNA](tutorials/agent_dna.md) | Detect anomalous agent behavior |
| [Prompt Replay](tutorials/prompt_replay.md) | Debug and optimize prompts safely |

### Examples

| Example | Description |
|---------|-------------|
| [Basic OpenAI](examples/basic_openai.py) | Simple chat completion with instrumentation |
| [LangChain Agent](examples/langchain_agent.py) | LangChain agent with governance |
| [Custom Rules](examples/custom_rules.py) | Using the `@enforce` decorator |
| [Streaming](examples/streaming.py) | Streaming response handling |

---

## 🏗️ Built On

ARGUS is built on top of **SigNoz**, the open-source observability platform:

| Component | Role |
|-----------|------|
| [SigNoz](https://signoz.io/) | OpenTelemetry-native observability backend |
| [ClickHouse](https://clickhouse.com/) | Columnar storage for telemetry data |
| [OpenTelemetry](https://opentelemetry.io/) | Open standard for traces, metrics, logs |
| [React](https://react.dev/) | Frontend dashboard |

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development environment setup
- Code conventions
- Pull request process
- Community guidelines

## 🛡️ Security

Found a vulnerability? Email **security@signoz.io**. See [SECURITY.md](SECURITY.md) for details.

## 📄 License

This project is licensed under the Apache 2.0 License. See [LICENSE](LICENSE) for details.
