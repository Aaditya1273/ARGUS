# pkg/pipeline/rag.py
import os
from ..adapter.slack_rts_adapter import RTSKnowledgeSource

class RAGRegistry:
    sources = []

    @classmethod
    def register(cls, source):
        cls.sources.append(source)

# Mock instantiation for demo purposes
user_token = os.environ.get("SETU_SLACK_USER_TOKEN", "xoxp-mock")
rts_source = RTSKnowledgeSource(bot_token="xoxb-mock", user_token=user_token)

# Registering RTSKnowledgeSource alongside existing ones (Dify, Coze)
RAGRegistry.register(rts_source)
