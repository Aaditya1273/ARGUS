# pkg/adapter/slack_rts_adapter.py
from slack_sdk import WebClient

class RTSKnowledgeSource:
    def __init__(self, bot_token, user_token):
        self.client = WebClient(token=user_token) # RTS requires user token for permission-aware search
        
    def search_tribal_knowledge(self, query: str, channel_filter="#field-ops"):
        # This is the GA tech they want to see
        result = self.client.search_messages(
            query=f"{query} in:{channel_filter}",
            sort="timestamp",
            count=20
        )
        # No external storage, permission-respecting, real-time
        return self._to_faq_format(result.get("messages", {}).get("matches", []))

    def _to_faq_format(self, matches):
        return [{"text": m.get("text", ""), "link": m.get("permalink", "")} for m in matches]
