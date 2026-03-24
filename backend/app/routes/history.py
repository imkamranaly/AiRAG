from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    ChatDetailResponse,
    ChatListResponse,
    ChatResponse,
    CreateChatRequest,
    MessageResponse,
    UpdateChatRequest,
)
from app.services import history_service

router = APIRouter()


@router.get("/history", response_model=ChatListResponse)
async def list_chats(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ChatListResponse:
    chats = await history_service.list_chats(limit=limit, offset=offset)
    return ChatListResponse(
        chats=[
            ChatResponse(
                id=c["id"],
                title=c.get("title"),
                created_at=c["created_at"],
                updated_at=c["updated_at"],
                message_count=c.get("message_count", 0),
            )
            for c in chats
        ],
        total=len(chats),
    )


@router.post("/history", response_model=ChatResponse, status_code=201)
async def create_chat(body: CreateChatRequest) -> ChatResponse:
    chat = await history_service.create_chat(title=body.title)
    return ChatResponse(
        id=chat["id"],
        title=chat.get("title"),
        created_at=chat["created_at"],
        updated_at=chat["updated_at"],
    )


@router.get("/history/{chat_id}", response_model=ChatDetailResponse)
async def get_chat(chat_id: UUID) -> ChatDetailResponse:
    chat = await history_service.get_chat(str(chat_id))
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found.")

    messages = await history_service.get_chat_messages(str(chat_id))
    return ChatDetailResponse(
        chat=ChatResponse(
            id=chat["id"],
            title=chat.get("title"),
            created_at=chat["created_at"],
            updated_at=chat["updated_at"],
        ),
        messages=[
            MessageResponse(
                id=m["id"],
                chat_id=m["chat_id"],
                role=m["role"],
                content=m["content"],
                metadata=m.get("metadata") or {},
                created_at=m["created_at"],
            )
            for m in messages
        ],
    )


@router.patch("/history/{chat_id}", response_model=ChatResponse)
async def update_chat(chat_id: UUID, body: UpdateChatRequest) -> ChatResponse:
    chat = await history_service.update_chat_title(str(chat_id), body.title)
    return ChatResponse(
        id=chat["id"],
        title=chat.get("title"),
        created_at=chat["created_at"],
        updated_at=chat["updated_at"],
    )


@router.delete("/history/{chat_id}", status_code=204)
async def delete_chat(chat_id: UUID) -> None:
    chat = await history_service.get_chat(str(chat_id))
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found.")
    await history_service.delete_chat(str(chat_id))
