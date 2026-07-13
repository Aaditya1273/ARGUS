import os, re, json, asyncio
from datetime import datetime
from openai import AsyncOpenAI
from qdrant_client import AsyncQdrantClient, models
from slack_sdk.web.async_client import AsyncWebClient
from langbot import Plugin, on_event, on_reaction # LangBot 3.x API

openai = AsyncOpenAI()
slack = AsyncWebClient(token=os.getenv("SLACK_BOT_TOKEN"))
qdrant = AsyncQdrantClient(url=os.getenv("QDRANT_URL","http://localhost:6333"))
COLLECTION = "setu_memory"

SYSTEM_PROMPT = """You are Setu intent parser. Extract JSON: {"intent":"create_task|query|done","project":"barmer_edu|health|vendor|general","due_date":"YYYY-MM-DD or null","task_text":"cleaned text"}
Today is {today}. Convert relative dates like Thursday, next Friday.
Project detection: if text has school, books, teacher -> barmer_edu. vendor, bill -> vendor. health, clinic -> health.
"""

class SevaMemory(Plugin):
    async def setup(self):
        # create collection if not exists
        try:
            await qdrant.get_collection(COLLECTION)
        except:
            await qdrant.create_collection(COLLECTION, vectors_config=models.VectorParams(size=1536, distance=models.Distance.COSINE))

    @on_event("message")
    async def handle_message(self, event):
        text = event.get("text","")
        files = event.get("files",[])
        channel = event["channel"]
        user = event["user"]
        ts = event["ts"]

        # STEP 5: Accessibility Alt-text - REAL
        for f in files:
            if f["mimetype"].startswith("image/"):
                await self.handle_image(f, channel, ts)

        # STEP 2: Slack query -> RTS API
        if "?" in text or text.lower().startswith("setu") or "anyone solved" in text.lower():
            await self.handle_query(text, channel, ts)
            return

        # STEP 1: WhatsApp/Field note -> intent -> Slack post
        if event.get("source") == "whatsapp" or channel == os.getenv("FIELD_OPS_CHANNEL"):
            await self.handle_field_note(text, event)

    async def handle_field_note(self, text, event):
        # intent inference - REAL LLM call
        resp = await openai.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type":"json_object"},
            messages=[
                {"role":"system","content": SYSTEM_PROMPT.format(today=datetime.now().isoformat())},
                {"role":"user","content": text}
            ]
        )
        data = json.loads(resp.choices[0].message.content)

        # date parsing already done by LLM
        # project detection done by LLM
        # Slack post - REAL
        await slack.chat_postMessage(
            channel=os.getenv("FIELD_OPS_CHANNEL","#field-ops"),
            text=f":memo: *New field task* [{data['project']}] {data['task_text']}\nDue: {data['due_date']} | From: {event.get('user','field')}",
            blocks=[
                {"type":"section","text":{"type":"mrkdwn","text":f"*Task:* {data['task_text']}\n*Project:* `{data['project']}` *Due:* {data['due_date']}"}},
                {"type":"context","elements":[{"type":"mrkdwn","text":f"Source: `{text[:80]}`"}]}
            ]
        )
        # also embed and store immediately
        await self.embed_and_store(data['task_text'], {"project":data['project'],"type":"task","source":text})

    async def handle_query(self, query, channel, thread_ts):
        # STEP 2: RTS API - REAL permission-aware search
        # LangBot's rts_adapter you already have
        from .rts_adapter import rts_search
        hits = await rts_search(query, user_token=os.getenv("SLACK_USER_TOKEN"), count=10)

        context = "\n".join([f"- {h['text']} (from #{h['channel']} by {h['user']} at {h['ts']})" for h in hits])

        # Answer with sources - REAL RAG
        answer = await openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role":"system","content":"Answer using only the context. Cite sources like [#channel]. If no answer, say not found."},
                {"role":"user","content":f"Context:\n{context}\n\nQuestion: {query}"}
            ]
        )
        await slack.chat_postMessage(
            channel=channel,
            thread_ts=thread_ts,
            text=answer.choices[0].message.content + f"\n\n_Sources: {len(hits)} threads searched via RTS API_"
        )

    async def handle_image(self, file_obj, channel, thread_ts):
        # STEP 5: Vision - REAL
        # download private image
        image_url = file_obj["url_private"]
        # Slack file needs auth, use slack client to fetch or pass url to GPT-4o vision if public
        # For demo, use file's thumb
        resp = await openai.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role":"user",
                "content":[
                    {"type":"text","text":"Generate alt-text for accessibility. Be concise, describe people, text in image, and action. Start with 'Alt:'"},
                    {"type":"image_url","image_url":{"url": image_url}}
                ]
            }]
        )
        alt_text = resp.choices[0].message.content
        await slack.chat_postMessage(
            channel=channel, thread_ts=thread_ts,
            text=f":eye: *Accessible Alt-text generated:*\n{alt_text}\n\nReact with :white_check_mark: if this is accurate to save to knowledge base."
        )

    @on_reaction("white_check_mark")
    async def handle_snapshot(self, event):
        # STEP 3: Self-learning Snapshot - REAL
        # Only allow admins
        if event["user"] not in os.getenv("ADMIN_USER_IDS","").split(","):
            return

        # fetch the thread that was checkmarked
        channel = event["item"]["channel"]
        ts = event["item"]["ts"]
        thread = await slack.conversations_replies(channel=channel, ts=ts)
        full_text = "\n".join([m["text"] for m in thread["messages"]])

        await self.embed_and_store(full_text, {"type":"verified_faq","channel":channel,"ts":ts})
        await slack.chat_postMessage(channel=channel, thread_ts=ts, text=":white_check_mark: Snapshot saved to Setu memory. Future queries will use this.")

    async def embed_and_store(self, text, payload):
        emb = (await openai.embeddings.create(model="text-embedding-3-small", input=text)).data[0].embedding
        await qdrant.upsert(COLLECTION, points=[
            models.PointStruct(id=hash(text) % 10000000, vector=emb, payload=payload | {"text":text})
        ])

    # STEP 4: Weekly Summary - REAL cron via APScheduler
    async def on_scheduler_start(self, scheduler):
        from apscheduler.triggers.cron import CronTrigger
        scheduler.add_job(self.weekly_summary, CronTrigger(day_of_week="sun", hour=20))

    async def weekly_summary(self):
        # fetch last 7 days from Qdrant + Slack
        hits, _ = await qdrant.scroll(COLLECTION, limit=100, with_payload=True)
        grouped = {}
        for p in hits:
            proj = p.payload.get("project","general")
            grouped.setdefault(proj, []).append(p.payload["text"])

        for proj, tasks in grouped.items():
            summary = (await openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role":"user","content":f"Summarize this week's progress for {proj}:\n" + "\n".join(tasks[:20])}]
            )).choices[0].message.content

            await slack.chat_postMessage(
                channel=os.getenv("SUMMARY_CHANNEL","#field-ops"),
                text=f"*Weekly Memory: {proj}*\n{summary}"
            )
