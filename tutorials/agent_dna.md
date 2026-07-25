# Tutorial 4: Agent DNA Profiler

Learn how ARGUS fingerprints agent executions to detect anomalies.

## Step 1: View the Agent DNA Report

```bash
curl http://localhost:8080/api/v1/argus/agent_dna
```

This returns:
- **Fingerprint**: A deterministic structural hash of the agent's execution path
- **Report**: Anomaly detection results using Z-score analysis

## Understanding the Report

```json
{
  "fingerprint": {
    "AgentID": "sales-bot",
    "SequenceHash": "4f9b2a1e8c7d",
    "ToolSequence": ["search", "calculator"],
    "TotalCost": 0.09,
    "TotalLatencyMs": 2500
  },
  "report": {
    "IsAnomalous": true,
    "NumericalAnomalies": ["Cost Spike (Z=14.00)"],
    "StructuralAnomalies": ["Unknown tool in sequence: unapproved_tool"]
  }
}
```

A Z-score > 3 indicates a statistically significant anomaly.

## Baselines

For accurate anomaly detection, ARGUS compares executions against a healthy baseline. Baselines are automatically built from historical execution data.

## What to Look For

- **Cost spikes**: Agent suddenly becoming expensive
- **New tools**: Agent using unfamiliar tools
- **Latency increases**: Degraded performance
- **Structural changes**: Different execution paths than normal
