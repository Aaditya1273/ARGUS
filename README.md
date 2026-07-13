# SETU — Field Memory Bridge for Slack
### The NGO that never forgets. WhatsApp field notes → Slack tribal knowledge.

![Slack](https://img.shields.io/badge/Slack-RTS%20API%20%2B%20MCP-4A154B)
![Track](https://img.shields.io/badge/Track-Agent%20for%20Good%20%7C%20Best%20UX-blue)
![Stack](https://img.shields.io/badge/Stack-LangBot%20%7C%20Qdrant%20%7C%20GPT--4o-green)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

**Tagline:** Frontline workers speak on WhatsApp. HQ decides on Slack. SETU remembers everything in between.

**Demo:** [YouTube Link 3 min] | **Live Sandbox:** `setu-demo.slack.com` (invited: slackhack@salesforce.com, testing@devpost.com) | **Architecture:** See Mermaid below

---

## 0. Quick Start — One-Command Deployment

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) (Desktop or Engine) · 5 GB free disk · Internet connection

```bash
# 1. Clone and deploy
bash setup.sh

# Or manually:
#   cp .env.example .env
#   docker compose up -d
#   docker compose logs -f
```

That's it. The script will:
1. Check for Docker + Docker Compose
2. Create `.env` from `.env.example` (edit with your credentials)
3. Build the webhook server image
4. Start Qdrant, webhook server, LangBot, and plugin runtime
5. Wait for all health checks to pass
6. Print service URLs

**Non-interactive (CI/CD):**
```bash
bash setup.sh --non-interactive
```

### Required Credentials (edit `.env` before use)

| Variable | Where to Get It |
|---|---|
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `SLACK_BOT_TOKEN` | [api.slack.com/apps](https://api.slack.com/apps) → OAuth & Permissions |
| `SLACK_USER_TOKEN` | Same Slack app → User Token Scopes (`search:read`) |
| `LANGBOT_BOT_UUID` | LangBot admin panel → Bots → Create bot |

### Services (after deploy)

| Service | URL | Purpose |
|---|---|---|
| Webhook API | `http://localhost:9090` | FastAPI: WhatsApp, Slack events, Knowledge CRUD, Metrics |
| LangBot | `http://localhost:5300` | Admin panel, pipeline, MCP tools |
| Qdrant Dashboard | `http://localhost:6334` | Vector store UI |
| Health Check | `http://localhost:9090/health/detailed` | Service status |

---

## 1. Introduction

SETU means bridge in Sanskrit.

In India, 90% of grassroots NGO work happens on WhatsApp voice notes in Hindi, Marwari, and dialects. Office teams coordinate on Slack. When a volunteer leaves, 14 months of field learnings - which vendor is reliable in Barmer, how we solved book delivery in Jaisalmer, what alt-text to use for donor reports - disappears.

Salesforce built Agentforce and Techforce Agent for 28,000 employees inside Slack. SETU brings that same memory layer to the 10,000 volunteers who will never get a Salesforce license.

SETU is a production-grade Slack agent that:
1. Ingests WhatsApp field notes, transcribes Hindi audio via Whisper, infers intent and due dates
2. Searches live Slack history via Slack's new **Real-Time Search (RTS) API** without bulk export, fully permission-aware
3. Answers questions with cited sources from tribal knowledge
4. Generates accessible alt-text for every image for visually impaired staff
5. Self-learns when an admin reacts with :white_check_mark:, snapshotting verified knowledge into Qdrant
6. Compounds knowledge weekly into GBrain-style project summaries

Core engine is based on LangBot production IM platform (MIT), heavily extended with original RTS adapter and Seva Memory plugin.

## 2. The Problem

**Problem 1: The WhatsApp to Slack Black Hole**
Field ops: "Barmer school needs 50 books by Thursday" sent as voice note. HQ never sees it, or sees it 3 days later. No task, no owner.

**Problem 2: Tribal Knowledge Death**
A senior asks "anyone solved school books before?" The answer lives in a thread from May 2025 in #logistics that is now buried. New hires ask the same question 40 times a month. Gartner says 40% of agentic projects fail due to messy governance and no ROI because they can't find their own history.

**Problem 3: Accessibility Debt**
73% of images posted in NGO Slack have no alt-text. Donor reports, field receipts, and school photos are inaccessible to visually impaired staff and fail WCAG compliance required for CSR funding.

**Problem 4: No Memory**
Most bots are stateless. They answer once and forget. NGOs need a bot that learns from corrections and gets smarter every week without manual retraining.

## 3. The Solution: SETU

SETU sits as a native Slack agent in #field-ops.

**For Field Worker:** Sends WhatsApp voice note in Hindi -> SETU transcribes -> creates task in Slack with project auto-detected (barmer_edu, health, vendor) and due date parsed -> confirms.

**For HQ Staff:** Types "Setu, how did we handle books in Jaisalmer?" -> SETU calls RTS API, searches 14 months of live Slack with permission checks, returns answer: "We used Vendor X, contact Y, cost Rs 120/book. Sources: [#logistics thread May 2, #field-ops Jun 12]" -> Staff reacts :white_check_mark: -> SETU snapshots that thread as verified FAQ into Qdrant with skip-existing logic.

**For Accessibility:** Any image posted -> SETU calls GPT-4o Vision -> posts thread: "Alt: Two children holding books in classroom..." -> searchable and screen-reader ready.

**For Leadership:** Every Sunday 8pm, SETU runs weekly enrichment: queries last 7 days of tasks, distills into project summary, posts to Canvas: "Barmer Edu: 3 schools served, 2 pending, 1 vendor blocked".

## 4. Uniqueness - Why Not Another Helpdesk Bot

Most hackathon bots = `slack create agent` template + OpenAI wrapper. SETU is different:

1. **Real Self-Learning Loop, Not Fake RAG:** We implemented `Answer with Knowledge Base | Snapshot new knowledge | Search on Web` pattern from enterprise IT bots. Most bots retrieve. We learn. Verified answers become permanent memory.

2. **WhatsApp to Slack is Native, Not Zapier:** Via Matrix bridge support built into LangBot, plus our FastAPI `/webhooks/whatsapp` forwarder. One codebase for Discord, Telegram, Slack, LINE, QQ, WeChat, WeCom, Lark, DingTalk, and via Matrix, Signal, WhatsApp, Messenger. This is production multi-channel, not a demo.

3. **RTS API First, Not Vector DB First:** Others bulk export Slack history to Pinecone and violate enterprise security. We use Slack's new Real-Time Search API for secure, query-based access without external storage, always honouring permissions. Qdrant is only for verified snapshots, not for copying private history.

4. **Accessibility as Core Feature, Not Afterthought:** Alt-text generation is not a slash command. It is automatic on every image, with human-in-the-loop verification.

5. **Production-Grade Engine:** Access control, rate limiting, sensitive word filtering, comprehensive monitoring, Web Management Panel, plugin ecosystem with hundreds of plugins, MCP protocol support. Built to run for 10,000 users, not 10.

## 5. Why This Fits Slack Agent Builder Challenge Perfectly

**Requirement: Use at least 1 of 3 techs. We use all 3.**

*   **Slack AI Capabilities:** Block Kit messages, Canvas for weekly summaries, Workflows trigger on :white_check_mark:, Thread replies with sources.
*   **MCP Server Integration:** SETU exposes 4 MCP tools via LangBot's built-in MCP server at `/mcp`: `transcribe_audio`, `generate_alt_text`, `search_tribal_knowledge`, `snapshot_knowledge`. Any other agent like Claude or Cursor can call SETU tools.
*   **Real-Time Search API:** Our `rts_adapter.py` implements permission-aware `search_messages` via user token. No external storage, no bulk export. This is exactly what Slack announced on Feb 17, 2026.

**Track Fit:**

*   **Primary: Slack Agent for Good:** Solves accessibility, education, public health, nonprofit operations. Quantifiable impact for Dreamforce ESG story.
*   **Secondary: Best UX & Best Technological Implementation:** Web Panel + Canvas dashboard + Block Kit threads = Best UX. Production monitoring + rate limiting + hybrid RAG = Best Tech.
*   **Optional: Slack Agent for Organizations:** Multi-workspace ready. Can get 5 active installs in 1 hour via Docker, satisfying Marketplace requirement of production workspace, not developer sandbox.

## 6. Why This Wins 1st Place

**Judging Criteria Mapping:**

*   **Technological Implementation (25%):** Not a wrapper. We wired RTS + MCP + Qdrant + Whisper + Vision into a single event loop with real async code. Quality code, not `pass` functions. Handles 4 Python versions, Docker deploy.
*   **Design (25%):** Not plain text. Block Kit sections, context blocks, Canvas weekly reports, thread replies, reaction triggers. Web Management Panel for admins.
*   **Potential Impact (25%):** 200M+ frontline workers in India alone use WhatsApp for work. NGOs lose 40% knowledge yearly due to volunteer churn. If SETU saves 10 hours per NGO per month, across 10k NGOs = 1.2M hours reclaimed. This is a Dreamforce keynote slide.
*   **Quality of Idea (25%):** Idea exists as fragments. No one has combined WhatsApp field ingestion + RTS live search + self-learning snapshot + accessibility auto-alt-text into one production agent for nonprofits.

**Competition Moat:** Other teams will show a leave bot. We will show a live Hindi voice note from a field phone appearing in Slack, answered with a citation from 14 months ago, verified and saved forever. Judges have never seen that.

## 7. Architecture

```mermaid
graph TD
    subgraph Field
        WA[WhatsApp Voice / Text - Hindi]
        WA_BRIDGE[Matrix Bridge / FastAPI Webhook /webhooks/whatsapp]
    end

    subgraph Slack Workspace - Permission Aware
        SLACK_EVT[Slack Events API - message.channels, file_shared, reaction_added]
        RTS_API[Real-Time Search API - search.messages with user_token - No External Storage]
        CANVAS[Slack Canvas - Weekly Memory]
    end

    subgraph SETU Core - Production Engine
        LB[LangBot Engine - Event Bus, Rate Limit, Monitoring]
        ADAPTER[Slack RTS Adapter - pkg/adapter/slack_rts_adapter.py]
        SEVA[Seva Memory Plugin - plugins/seva_memory/main.py]
        MCP_SERVER[MCP Server - /mcp - transcribe, alt_text, search, snapshot]
    end

    subgraph Intelligence & Memory
        WHISPER[OpenAI Whisper - Hindi Transcription]
        VISION[GPT-4o Vision - Alt-text]
        LLM[GPT-4o-mini - Intent, Project Detection, Date Parsing]
        QDRANT[(Qdrant Vector DB - Verified FAQs - 1536 dim, COSINE, skip-existing)]
    end

    WA --> WA_BRIDGE --> LB
    SLACK_EVT --> LB
    LB --> ADAPTER --> RTS_API
    LB --> SEVA
    SEVA --> WHISPER
    SEVA --> VISION
    SEVA --> LLM
    SEVA --> QDRANT
    SEVA --> MCP_SERVER
    SEVA --> CANVAS
    MCP_SERVER --> SLACK_EVT

    style RTS_API fill:#4A154B,stroke:#fff,color:#fff
    style SEVA fill:#2EB67D,stroke:#fff,color:#fff



    sequenceDiagram
    participant Field as Field Worker (WhatsApp)
    participant WA as Webhook Server
    participant SETU as SETU Core
    participant RTS as Slack RTS API
    participant Q as Qdrant
    participant SL as Slack #field-ops
    participant Admin as NGO Admin

    Note over Field, Admin: Flow 1: Field Note Ingestion
    Field->>WA: Voice note "Barmer school needs 50 books Thursday"
    WA->>SETU: POST /webhooks/whatsapp {text}
    SETU->>SETU: Whisper transcribe + LLM intent parse -> {project:barmer_edu, due:2026-07-17}
    SETU->>Q: embed_and_store task
    SETU->>SL: chat.postMessage Block Kit task card

    Note over Field, Admin: Flow 2: Tribal Knowledge Query
    Admin->>SL: "Setu, anyone solved books in Jaisalmer before?"
    SL->>SETU: on_event message
    SETU->>RTS: search_messages query="books Jaisalmer" permission-aware
    RTS-->>SETU: 10 matches with channel/user/ts
    SETU->>SETU: GPT-4o answer with citations
    SETU->>SL: thread reply with sources

    Note over Field, Admin: Flow 3: Self-Learning Snapshot
    Admin->>SL: React :white_check_mark: on bot answer
    SL->>SETU: reaction_added event
    SETU->>SL: conversations.replies fetch full thread
    SETU->>Q: upsert verified_faq with skip-existing
    SETU->>SL: "Snapshot saved to Setu memory"

    Note over Field, Admin: Flow 4: Accessibility Auto Alt-text
    Admin->>SL: Uploads image receipt.jpg
    SL->>SETU: file_shared event
    SETU->>SETU: GPT-4o Vision generate alt-text
    SETU->>SL: thread reply "Alt: Receipt showing..."

    Note over Field, Admin: Flow 5: Weekly Enrichment
    SETU->>SETU: APScheduler Cron Sun 20:00
    SETU->>Q: scroll last 7 days
    SETU->>SETU: GPT-4o-mini distill per project
    SETU->>SL: Canvas post "Weekly Memory: barmer_edu - 3 schools served"


## 9. Tech Stack
Agent Framework: LangBot 3.x - Production IM platform, Universal adapters, Plugin ecosystem, Built-in MCP
Slack: Bolt Async, RTS API, Block Kit, Canvas API, Socket Mode
AI: OpenAI GPT-4o, GPT-4o-mini, Whisper large-v3, text-embedding-3-small, Vision
Memory: Qdrant (vector), Slack Canvas (human readable)
Infra: Docker Compose, Python 3.11, FastAPI webhook, APScheduler, Fly.io
Bridge: Matrix protocol for WhatsApp, Slack SDK WebClient with user_token for permission-aware search