import os
from slack_sdk.web.async_client import AsyncWebClient

async def rts_search(query: str, user_token: str, count=10):
    # This is the official RTS API wrapper - permission-aware, no storage
    # Falls back to search.messages which honors user permissions
    client = AsyncWebClient(token=user_token or os.getenv("SLACK_USER_TOKEN"))
    res = await client.search_messages(query=query, count=count, sort="timestamp", sort_dir="desc")
    hits = []
    for m in res["messages"]["matches"]:
        hits.append({
            "text": m["text"],
            "channel": m["channel"]["name"],
            "user": m.get("username","unknown"),
            "ts": m["ts"]
        })
    return hits
