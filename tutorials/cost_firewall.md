# Tutorial 2: Cost Firewall

Protect your budget by creating cost policies that automatically block expensive agent runs.

## Step 1: View Current Costs

```bash
curl http://localhost:8080/api/v1/argus/cost/metrics
```

This returns real-time cost data broken down by model, agent, and user.

## Step 2: Create a Cost Policy

Create a policy that blocks any run costing more than $0.05:

```bash
curl -X POST http://localhost:8080/api/v1/argus/cost/policies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Block Expensive Runs",
    "condition": {
      "dimension": "run_cost",
      "operator": ">",
      "threshold": 0.05
    },
    "action": "BLOCK_EXECUTION",
    "enabled": true
  }'
```

## Step 3: List Active Policies

```bash
curl http://localhost:8080/api/v1/argus/cost/policies
```

## Step 4: Test the Policy

Run an agent that exceeds the limit. The governance engine will block it and emit a violation event visible in the dashboard.

## Available Dimensions

| Dimension | Description |
|-----------|-------------|
| `run_cost` | Cost of a single agent run |
| `daily_budget` | Daily cumulative cost across all agents |
| `model_gpt-4` | Cost attributed to gpt-4 model usage |

## Available Actions

| Action | Description |
|--------|-------------|
| `ALERT_ONLY` | Log violation, allow execution |
| `BLOCK_EXECUTION` | Block the violating request |
| `KILL_AGENT` | Terminate the agent immediately |
