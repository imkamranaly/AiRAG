"""
Async PostgreSQL connection pool (asyncpg).

Usage:
    # In app lifespan:
    await init_pool()
    ...
    await close_pool()

    # In service functions:
    async with get_pool().acquire() as conn:
        row = await conn.fetchrow("SELECT ...")
"""

import json
import logging
from typing import Optional

import asyncpg
from asyncpg.pool import Pool

from app.core.config import get_settings

logger = logging.getLogger(__name__)
_pool: Optional[Pool] = None


async def _init_connection(conn: asyncpg.Connection) -> None:
    """Per-connection setup: register JSON codec so JSONB columns auto-parse."""
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )
    await conn.set_type_codec(
        "json",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


async def init_pool() -> None:
    """Create the global async connection pool. Call once at app startup."""
    global _pool
    settings = get_settings()
    _pool = await asyncpg.create_pool(
        settings.DATABASE_URL,
        min_size=2,
        max_size=10,
        init=_init_connection,
        ssl=False,
    )
    logger.info("PostgreSQL connection pool created.")


async def close_pool() -> None:
    """Close the global connection pool. Call once at app shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL connection pool closed.")


def get_pool() -> Pool:
    """Return the active connection pool, raising a clear 503-friendly error if unavailable."""
    if _pool is None:
        raise RuntimeError(
            "PostgreSQL is not reachable. Please ensure the database is running."
        )
    return _pool


async def ensure_pool() -> Pool:
    """
    Return the pool, creating it on the fly if startup failed (e.g. DB was not
    yet ready). Subsequent calls are instant once the pool is healthy.
    """
    global _pool
    if _pool is None:
        await init_pool()
    return _pool
