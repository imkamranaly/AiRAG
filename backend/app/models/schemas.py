from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Document schemas ──────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: UUID
    name: str
    file_type: str
    file_size: int
    status: str
    metadata: Dict[str, Any] = {}
    created_at: datetime
    chunk_count: Optional[int] = None


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int


class UploadResponse(BaseModel):
    document_id: UUID
    name: str
    status: str
    message: str


# ── Chat schemas ───────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4096)
    chat_id: Optional[UUID] = None


class MessageResponse(BaseModel):
    id: UUID
    chat_id: UUID
    role: str
    content: str
    metadata: Dict[str, Any] = {}
    created_at: datetime


class ChatResponse(BaseModel):
    id: UUID
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    message_count: Optional[int] = None


class ChatListResponse(BaseModel):
    chats: List[ChatResponse]
    total: int


class ChatDetailResponse(BaseModel):
    chat: ChatResponse
    messages: List[MessageResponse]


# ── Source chunk schemas ───────────────────────────────────────────────────────

class SourceChunk(BaseModel):
    document_id: UUID
    document_name: str
    content: str
    similarity: float
    chunk_index: int


# ── Streaming event schemas ────────────────────────────────────────────────────

class StreamEvent(BaseModel):
    type: str  # "token" | "sources" | "done" | "error"
    data: Any


# ── History schemas ────────────────────────────────────────────────────────────

class CreateChatRequest(BaseModel):
    title: Optional[str] = None


class UpdateChatRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
