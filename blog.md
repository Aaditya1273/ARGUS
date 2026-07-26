# The Day Our Autonomous Agent Went Rogue (And How We Tamed It With SigNoz)

What happens when you give an autonomous AI agent access to your production API keys, a complex reasoning loop, and zero supervision?

I’ll tell you exactly what happens, because it happened to us during this hackathon: The agent gets stuck in a recursive loop, hallucinates a solution, and burns through $500 of API credits in under ten minutes while you're grabbing a coffee. 

When we returned to our terminal, we didn't just see a massive bill—we saw a terrifying black box. We had no idea *why* the agent made those calls, *what* prompts triggered the loop, or *how* to stop it from happening again without revoking its API access entirely.

That moment of panic was the birth of **ARGUS**. 

We realized that "Agentic AI" is fundamentally broken without Agentic Observability. We needed a way to intercept, monitor, and govern AI agents in real-time. We didn't just need logs; we needed a live cost firewall, semantic trace replays, and anomaly detection. And to build that in a single weekend, we needed an observability backbone that wouldn't get in our way. 

Here is the story of how we built ARGUS—an AI Agent Runtime Governance platform—and how we weaponized SigNoz and OpenTelemetry to tame the chaos of autonomous agents.

---

## The Core Problem: The MCP Black Box

Modern AI agents communicate with the outside world using tools, often standardized via the Model Context Protocol (MCP). When an agent wants to read a file or hit an API, it emits an MCP tool call.

The problem? Most developers just plug the agent directly into the tools. 

```javascript
// The standard, dangerous way
const agent = new ClaudeAgent();
agent.addTool(githubTool);
agent.run("Fix issue #42"); // Cross your fingers and hope!
```

If the agent decides to trigger `githubTool` 10,000 times because it misunderstood a semantic prompt, nothing stops it. 

We needed a middleman. ARGUS acts as a reverse proxy for MCP. Instead of the agent talking to the tools, the agent talks to ARGUS, and ARGUS talks to the tools. This interception layer gave us absolute control, but it also generated a massive firehose of unstructured data: prompts, token counts, latency, monetary costs, and tool responses.

We needed a place to store, query, and alert on this data instantly.

---

## Enter SigNoz: From Chaos to Clarity

We knew we wanted to use OpenTelemetry (OTel) because we refused to be locked into a proprietary SDK. We chose SigNoz because it natively ingests OTLP data and provides both traces and metrics in a single, blazing-fast ClickHouse backend. 

But we didn't just want to hardcode telemetry into our app; we wanted ARGUS to *automatically* instrument any agent connected to it. 

Here is the secret sauce. Instead of relying on manual SDK configuration, we built a dynamic integration module in Golang that injects the SigNoz environment variables directly into the agent's runtime environment the moment ARGUS starts intercepting it:

```go
// pkg/query-service/argus/integration/signoz_config.go

func (c *OTelCollectorConfig) GenerateEnvVars(serviceName string) string {
	return fmt.Sprintf(`# SigNoz OTel Configuration
export OTEL_EXPORTER_OTLP_ENDPOINT="%s"
export OTEL_EXPORTER_OTLP_HEADERS="signoz-ingestion-key=%s"
export OTEL_SERVICE_NAME="%s"
export OTEL_EXPORTER_OTLP_COMPRESSION="gzip"
`, c.Region.Endpoint, c.IngestionKey, serviceName)
}
```

By doing this, every single MCP call the agent made was instantly wrapped in an OTel span. We enriched these spans with custom attributes unique to AI agents:

- `ai.prompt.tokens`
- `ai.completion.tokens`
- `ai.cost.usd`
- `ai.tool.name`

Within minutes of wiring this up, the black box shattered. We opened our SigNoz dashboard and could literally watch the agent "thinking." We could trace a single user request down to the exact LLM prompt, see the token consumption spike, and read the exact JSON payload the tool returned. 

---

## Building the Cost Firewall

Visibility is great, but governance requires action. We didn't just want to *see* the agent burning money; we wanted to physically stop it.

Because every trace passing through ARGUS was enriched with `ai.cost.usd`, we were able to build a real-time Cost Firewall. In our Golang backend, we maintained an in-memory accumulator of the cost for the current session. 

If the agent attempted to execute a tool that pushed its session cost over the user-defined budget limit (e.g., $5.00), ARGUS would intercept the request, block the MCP call, and return a semantic error to the LLM: *"Error: Budget exceeded. You are not authorized to make further API calls."*

But how do the human operators know this happened? 

We mapped ARGUS's internal anomaly detection directly to SigNoz's Alerting engine. Using the SigNoz API, we programmatically generated `AlertRoutingPolicy` rules. Whenever our proxy blocked a request, it emitted a critical metric to SigNoz. SigNoz immediately picked up the anomaly and fired a webhook to our Slack channel. 

The suspense of watching an agent go wild, only to see it hit the ARGUS firewall and instantly receive a SigNoz alert on our phones, was the absolute highlight of the hackathon.

---

## The Ultimate Flex: Giving the Agent Access to SigNoz

As we stared at the beautiful trace data in SigNoz, we had a crazy idea. 

If ARGUS can intercept tools, and SigNoz stores the traces... what if we built an MCP tool that allowed the AI agent to query its *own* traces in SigNoz?

We built two specific MCP handlers:
1. `signoz_query_traces`
2. `signoz_get_services`

When an agent failed a task, we could prompt it: *"You failed to fix the issue. Check your telemetry to see what went wrong."*

The agent would literally call `signoz_query_traces`, read its own past execution spans from the SigNoz backend, analyze the latency and error codes of the tools it tried to use, and respond: *"Ah, I see that my call to the database tool failed with a 500 error and a 4000ms timeout. I will rewrite my query and try again."*

We had achieved AI self-reflection driven by OpenTelemetry. It was mind-blowing.

---

## What We Learned (And What We'd Do Differently)

Building ARGUS taught us that the future of AI isn't just about better models; it's about better infrastructure. 

**What worked:**
- SigNoz's native OTLP support was a lifesaver. We didn't have to waste time wrestling with proprietary agents. We just fired standard OTel spans from our Go proxy, and they appeared in the dashboard instantly.
- Enriching spans with semantic AI data (`ai.cost.usd`) transformed standard APM traces into a literal audit log for AI behavior.

**What we'd do differently:**
- Initially, we tried to stuff the entire LLM prompt payload into a span attribute. We quickly hit attribute size limits in OpenTelemetry. We learned the hard way that you should hash large payloads or store them externally, keeping only the semantic summaries in the trace attributes.
- We spent too much time manually configuring dashboards at the start. Next time, we'd use SigNoz's dashboard as code (JSON imports) to spin up our AI monitoring views instantly.

## Conclusion

If you are building autonomous agents and you aren't wrapping their tool calls in OpenTelemetry, you are flying blind into a storm. 

ARGUS proved that by placing a strict governance proxy between the agent and its tools, and backing it with the immense analytical power of SigNoz, we can finally build AI systems we can trust. We went from a rogue agent burning $500, to a tightly governed, self-reflecting system that alerts us the second something goes wrong.

And the best part? The entire observability pipeline was built over a single weekend. 

*(If you're building with AI, do yourself a favor: instrument your MCP layer today. Your future self—and your credit card bill—will thank you.)*
