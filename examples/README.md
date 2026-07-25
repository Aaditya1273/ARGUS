# ARGUS Examples

This directory contains examples demonstrating how to use the ARGUS Python SDK to instrument AI agents with runtime governance, cost tracking, and self-healing.

## Prerequisites

1. Install the SDK:
   ```bash
   pip install argus-sdk[all]
   ```

2. Start the ARGUS Control Plane:
   ```bash
   cd ../demo
   docker compose -f docker-compose.demo.yaml up
   ```

3. Set your API keys:
   ```bash
   export OPENAI_API_KEY=sk-...
   export ANTHROPIC_API_KEY=sk-ant-...  # (optional, for Anthropic examples)
   ```

## Examples

| Example | Description | Framework |
|---------|-------------|-----------|
| [basic_openai.py](basic_openai.py) | Basic OpenAI chat completion with ARGUS instrumentation | OpenAI |
| [langchain_agent.py](langchain_agent.py) | LangChain agent with tools and ARGUS governance | LangChain |
| [custom_rules.py](custom_rules.py) | Custom `@enforce` decorator with token/cost limits | OpenAI |
| [streaming.py](streaming.py) | Streaming response handling with ARGUS | OpenAI |

## Running

```bash
# Basic OpenAI
python examples/basic_openai.py

# LangChain agent
python examples/langchain_agent.py

# Custom rules
python examples/custom_rules.py

# Streaming
python examples/streaming.py
```

## Expected Output

Each example will:
1. Connect to the ARGUS Control Plane via WebSocket
2. Execute the AI agent logic
3. Emit OpenTelemetry traces to the ARGUS pipeline
4. Display the agent's response
5. Confirm governance evaluation
