# 💻 ARGUS Technical Demo Script

**Target Audience**: Hackathon Judges / Technical Evaluators
**Goal**: Demonstrate the end-to-end flow from telemetry capture to automated self-healing.

---

## Step 1: The Setup (1 minute)

**Action**: Show the simple Python script using `argus-sdk`.
**Script**:
> "To get started, we only need one line of code. We import `init_argus` into our standard LangChain or OpenAI script. ARGUS uses OpenTelemetry to auto-instrument the entire stack invisibly."

**Action**: Run the Python script in the terminal.
**Script**:
> "I'm running a standard 'Sales Bot' agent. It's supposed to search the web and summarize a topic."

---

## Step 2: The Infinite Loop & Self-Healing (1.5 minutes)

**Action**: Trigger an intentional failure in the Python script (e.g., the agent gets stuck failing to parse a tool response and loops). Switch to the ARGUS Dashboard.
**Script**:
> "But watch what happens. The agent got confused by the web search format. It's calling the tool over and over again, burning tokens. 
> 
> Let's look at the ARGUS Control Plane. The **Governance Engine** has detected the `InfiniteToolLoop` violation. Instantly, the **Self-Healing Engine** intercepts the trace. 
> 
> You can see the timeline here: it recognized the loop, executed the `ReduceContext` strategy, and when that failed, it executed `KillAgent` to stop the bleed."

---

## Step 3: Cost Firewall (1 minute)

**Action**: Navigate to the Cost Firewall tab.
**Script**:
> "Because we caught it early, the financial impact was minimized. 
> 
> Here in the Cost Firewall, we track real-time burn down to the cent per model and per agent. We have a strict policy set here: if any single run exceeds $5, we block execution. ARGUS evaluated this policy in milliseconds."

---

## Step 4: Agent DNA (1 minute)

**Action**: Navigate to the Agent DNA tab.
**Script**:
> "Finally, how do we know if an agent is slowly drifting? We use Agent DNA.
> 
> ARGUS generates a deterministic structural hash of this execution. Look at this radar chart. We can see a massive Z-score spike in Latency, and an alert here that the agent tried to execute an 'unapproved_tool'. ARGUS caught the anomaly against the healthy baseline."

---

## Conclusion (30 seconds)
**Action**: Pull up the `argus-cli` in the terminal.
**Script**:
> "And for developers, we built the Prompt Replay CLI. You can take any failed trace ID, tweak the prompt, and simulate the run locally to fix the bug.
> 
> ARGUS. Observe, Understand, Detect, Action. Thank you."
