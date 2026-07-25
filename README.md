# ARGUS — Autonomous Runtime Governance for AI Agents

**AI agents are unpredictable. ARGUS makes them observable, governable, and healable.**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?logo=go)](https://go.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![SigNoz Hackathon 2026](https://img.shields.io/badge/SigNoz-Hackathon_2026-FF6B35)](https://signoz.io)

Built for the **Agents of SigNoz Hackathon 2026** — ARGUS extends [SigNoz](https://signoz.io/) with dynamic governance, cost enforcement, behavioral fingerprinting, and automated self-healing for LLM-powered agents.

> "If you can't observe your AI agents, you don't own them."

---

## Mission Control

| Real-time agent monitoring | Cost firewall | Governance rules |
|---|---|---|
| WebSocket-powered live dashboard. Track every running agent's cost, latency, tokens, and current tool. Pause or kill agents mid-flight. | Per-agent, per-model cost tracking with budget enforcement. OTel metrics auto-emitted to SigNoz. | 9 governance plugins detect infinite loops, token explosions, retry storms, budget violations, and more. |

---

## Architecture

```mermaid
graph TB
    subgraph "Agent Runtime"
        A1[AI Agent - LangChain / OpenAI / Custom]
    end
    subgraph "Instrumentation"
        SDK[ARGUS Python SDK\nOne-line init: argus.init()]
    end
    subgraph "Telemetry Pipeline"
        OTel[OpenTelemetry Collector]
    end
    subgraph "SigNoz Platform"
        CH[(ClickHouse)]
        AM[AlertManager]
        QB[Query Builder + Dashboards]
    end
    subgraph "ARGUS Intelligence Layer"
        Gov[Governance Engine\n9 plugins]
        Heal[Self-Healing Engine\n8 recovery actions]
        Cost[Cost Firewall + Policy Engine]
        DNA[Agent DNA Profiler\nZ-score Anomaly Detection]
        Replay[Prompt Replay Engine]
    end
    subgraph "Visualization"
        MC[Mission Control UI\nReact Dashboard]
    end
    A1 --> SDK
    SDK --> OTel
    OTel --> CH
    OTel --> AM
    Gov --> QB
    Cost --> CH
    DNA --> CH
    Replay --> CH
    Gov --> Heal
    Heal --> AM
    Heal --> SDK
```

---

## Quickstart

```bash
git clone https://github.com/SigNoz/signoz.git
cd signoz/demo
docker compose -f docker-compose.demo.yaml --profile demo up -d
open http://localhost:3301
```

That starts the full stack: ClickHouse, OTel Collector, query service, React dashboard, demo agent, and seeds SigNoz dashboards + alerts.

---

## Screenshots

> Run `python demo/screenshot.py --url http://localhost:3301` to capture live screenshots from your running demo.

| Page | Preview |
|------|---------|
| **Mission Control** — live agent cards with Real-time pause/kill | ![Mission Control](docs/screenshots/mission-control.png) |
| **Cost Firewall** — per-agent burn rate, budget progress, enforcement history | ![Cost Firewall](docs/screenshots/cost-firewall.png) |
| **Agent DNA** — behavioral fingerprinting with anomaly Z-scores | ![Agent DNA](docs/screenshots/agent-dna.png) |
| **Governance** — rule configuration and violation timeline | ![Governance](docs/screenshots/governance.png) |
| **Prompt Replay** — trace reconstruction with semantic diff | ![Prompt Replay](docs/screenshots/prompt-replay.png) |

---

## Features

| Engine | What it does |
|--------|-------------|
| **Governance** | 9 plugins: `InfiniteLoop`, `TokenExplosion`, `BudgetExceeded`, `RetryStorm`, `AgentStuck`, `ToolTimeout`, `LatencySpike`, `RepeatedPrompt`, `PromptRecursion` |
| **Self-Healing** | 8 recovery actions: `KillAgent`, `Retry`, `FallbackModel`, `ReduceContext`, `SwitchPrompt`, `CircuitBreaker`, `DisableTool`, `EscalateHuman` |
| **Cost Firewall** | Per-agent/per-model cost tracking, budget enforcement, OTel metric emission (`argus.cost.total`) |
| **Agent DNA** | Execution fingerprinting with Z-score anomaly detection, behavioral baselines |
| **Prompt Replay** | Trace reconstruction, prompt modification, cost/latency diff comparison |
| **SigNoz Integration** | All governance violations emit span events, cost metrics use OTel counters, dashboards are native SigNoz v4 |

---

## How it works

1. **Instrument** your agent with one line: `argus.init(agent_id="my-agent")`
2. **Observe** — the SDK auto-instruments OpenAI/LangChain/Anthropic calls as OTel spans
3. **Govern** — the ARGUS engine evaluates every execution against cost policies and behavioral baselines
4. **Heal** — when a violation is detected, ARGUS executes recovery actions (Kill, Fallback, Circuit Break, etc.)
5. **Learn** — Agent DNA profiles evolve over time, improving anomaly detection accuracy

---

## Built on SigNoz

| Component | Role |
|-----------|------|
| **SigNoz** | OpenTelemetry-native observability backend |
| **ClickHouse** | Columnar storage for traces, metrics, and logs |
| **OpenTelemetry** | GenAI semantic conventions on all spans |
| **AlertManager** | Governance violation alerts routed to Slack/Webhook |
| **Dashboards** | Native SigNoz dashboards with Query Builder v5 |

---

## Documentation

| Resource | Link |
|----------|------|
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md) |
| API Reference | [API_REFERENCE.md](API_REFERENCE.md) |
| SDK Reference | [SDK_REFERENCE.md](SDK_REFERENCE.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Product Hunt Launch | [PITCH.md](docs/PITCH.md) |
| Demo Script | [DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) |

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
