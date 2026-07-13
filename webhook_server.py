from fastapi import FastAPI, Request
import httpx, os
app = FastAPI()

@app.post("/webhooks/whatsapp")
async def wa_hook(req: Request):
    data = await req.json()
    text = data["entry"][0]["changes"][0]["value"]["messages"][0]["text"]["body"]
    # forward to LangBot internal event bus
    async with httpx.AsyncClient() as c:
        await c.post("http://localhost:5300/api/v1/events", json={
            "type":"message","source":"whatsapp","text":text,"user":"field_worker"
        })
    return {"ok":True}
