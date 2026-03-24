"""
Core RAG service.

Pipeline:
  query → LlamaIndex (SupabaseRetriever + OpenAI LLM) → SSE stream

Delegates retrieval and LLM streaming to data.py (LlamaIndex engine).
This module owns only SSE formatting and the public stream_rag_response interface.
"""

import json
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

from app.services.data import astream_rag_response

logger = logging.getLogger(__name__)


async def stream_rag_response(
    query: str,
    chat_id: str,
    conversation_history: Optional[List[Dict[str, str]]] = None,
) -> AsyncGenerator[str, None]:
    """
    Full RAG pipeline with streaming, wrapped as Server-Sent Events.

    SSE event format:
        data: {"type": "sources", "data": [...]}   ← retrieved source chunks
        data: {"type": "token",   "data": "..."}   ← streamed LLM tokens
        data: {"type": "done",    "data": ""}      ← stream complete
        data: {"type": "error",   "data": "..."}   ← on error

    Delegates retrieval + LLM streaming to astream_rag_response() in data.py.
    """
    async for event in astream_rag_response(
        query=query,
        conversation_history=conversation_history,
    ):
        yield f"data: {json.dumps(event)}\n\n"
