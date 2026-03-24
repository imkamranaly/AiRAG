import json
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatRequest
from app.services import history_service, rag_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    """
    Stream a RAG-powered chat response as Server-Sent Events.

    SSE event format:
        data: {"type": "sources", "data": [...]}  ← retrieved source chunks
        data: {"type": "token", "data": "..."}    ← streamed LLM tokens
        data: {"type": "done", "data": ""}        ← stream complete
        data: {"type": "error", "data": "..."}    ← on error

    If chat_id is omitted, a new chat session is created automatically.
    """
    # ── Resolve / create chat session ────────────────────────────────────────
    if request.chat_id:
        chat_record = await history_service.get_chat(str(request.chat_id))
        if not chat_record:
            raise HTTPException(status_code=404, detail="Chat session not found.")
        chat_id = str(request.chat_id)
    else:
        chat_record = await history_service.create_chat()
        chat_id = chat_record["id"]

    # ── Auto-title on first message ───────────────────────────────────────────
    messages_so_far = await history_service.get_chat_messages(chat_id)
    if not messages_so_far:
        await history_service.auto_title_chat(chat_id, request.query)

    # ── Persist the user's message ────────────────────────────────────────────
    await history_service.save_message(chat_id, "user", request.query)

    # ── Build conversation history for context ────────────────────────────────
    history = [
        {"role": m["role"], "content": m["content"]}
        for m in messages_so_far
    ]

    # ── Stream generator that also saves the assistant reply ─────────────────
    async def event_stream():
        full_response = []
        sources_data = []

        async for event in rag_service.stream_rag_response(
            query=request.query,
            chat_id=chat_id,
            conversation_history=history,
        ):
            # Peek at event to extract assistant content for persistence
            try:
                payload = json.loads(event.removeprefix("data: ").strip())
                if payload["type"] == "token":
                    full_response.append(payload["data"])
                elif payload["type"] == "sources":
                    sources_data = payload["data"]
                elif payload["type"] == "done":
                    # Persist completed assistant message
                    if full_response:
                        await history_service.save_message(
                            chat_id,
                            "assistant",
                            "".join(full_response),
                            metadata={"sources": sources_data},
                        )
                    # Inject chat_id into done event so frontend can track session
                    done_event = json.dumps({"type": "done", "data": {"chat_id": chat_id}})
                    yield f"data: {done_event}\n\n"
                    return
            except Exception:
                pass

            yield event

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        },
    )
