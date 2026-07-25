# Tutorial 5: Prompt Replay

Safely experiment with prompt changes using ARGUS's trace reconstruction and semantic diffing.

## Step 1: Get a Trace

```bash
curl http://localhost:8080/api/v1/argus/replay/trace-xyz
```

## Step 2: Execute a Replay

Send a modified prompt to see how it changes the outcome:

```bash
curl -X POST http://localhost:8080/api/v1/argus/replay/execute \
  -H "Content-Type: application/json" \
  -d '{
    "TraceID": "trace-xyz",
    "NewPrompt": "You are a concise assistant.",
    "NewModel": "gpt-3.5-turbo",
    "NewTemperature": 0.3
  }'
```

## Step 3: Compare Results

The response includes a semantic diff:

```json
{
  "PromptDiff": "Original vs modified prompt comparison...",
  "CostDelta": -0.015,
  "LatencyDelta": -1200,
  "TokenDelta": -300
}
```

## When to Use Replay

- **Before deploying prompt changes** — Test in production context
- **Debugging failures** — Reconstruct the exact state that led to a failure
- **A/B testing prompts** — Compare cost, latency, and output quality
- **Training data generation** — Generate before/after pairs for fine-tuning
