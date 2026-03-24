import uuid
from typing import Any, Dict, List, Optional

from app.core.db import ensure_pool as get_pool


async def create_chat(title: Optional[str] = None) -> Dict[str, Any]:
    chat_id = str(uuid.uuid4())
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO chats (id, title)
               VALUES ($1, $2)
               RETURNING id, title, created_at, updated_at""",
            chat_id, title or "New Chat",
        )
    return dict(row)


async def get_chat(chat_id: str) -> Optional[Dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, title, created_at, updated_at FROM chats WHERE id = $1",
            chat_id,
        )
    return dict(row) if row else None


async def list_chats(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT c.id, c.title, c.created_at, c.updated_at,
                      COUNT(m.id)::integer AS message_count
               FROM chats c
               LEFT JOIN messages m ON m.chat_id = c.id
               GROUP BY c.id
               ORDER BY c.updated_at DESC
               LIMIT $1 OFFSET $2""",
            limit, offset,
        )
    return [dict(r) for r in rows]


async def update_chat_title(chat_id: str, title: str) -> Dict[str, Any]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """UPDATE chats SET title = $1
               WHERE id = $2
               RETURNING id, title, created_at, updated_at""",
            title, chat_id,
        )
    return dict(row) if row else {}


async def delete_chat(chat_id: str) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        # messages deleted via ON DELETE CASCADE
        await conn.execute("DELETE FROM chats WHERE id = $1", chat_id)


async def get_chat_messages(chat_id: str) -> List[Dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, chat_id, role, content, metadata, created_at
               FROM messages
               WHERE chat_id = $1
               ORDER BY created_at ASC""",
            chat_id,
        )
    return [dict(r) for r in rows]


async def save_message(
    chat_id: str,
    role: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    message_id = str(uuid.uuid4())
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO messages (id, chat_id, role, content, metadata)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id, chat_id, role, content, metadata, created_at""",
            message_id, chat_id, role, content, metadata or {},
        )
        # Touch chats.updated_at so ordering stays fresh
        await conn.execute(
            "UPDATE chats SET updated_at = NOW() WHERE id = $1", chat_id
        )
    return dict(row)


async def auto_title_chat(chat_id: str, first_message: str) -> None:
    title = first_message[:80].strip()
    if len(first_message) > 80:
        title += "…"
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE chats SET title = $1 WHERE id = $2", title, chat_id
        )
