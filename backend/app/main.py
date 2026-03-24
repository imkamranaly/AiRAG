import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.db import close_pool, init_pool
from app.routes import chat, history, upload

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("RAG API starting up — env=%s", settings.APP_ENV)
    try:
        await init_pool()
    except Exception as exc:
        logger.error("PostgreSQL connection failed at startup: %s", exc)
        logger.warning("Server will start, but DB-dependent endpoints will return 503 until PostgreSQL is reachable.")
    yield
    await close_pool()
    logger.info("RAG API shutting down.")


app = FastAPI(
    title="RAG API",
    description="Production-ready Retrieval-Augmented Generation API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/v1", tags=["Documents"])
app.include_router(chat.router, prefix="/api/v1", tags=["Chat"])
app.include_router(history.router, prefix="/api/v1", tags=["History"])


@app.get("/health", tags=["Meta"])
async def health_check():
    from app.core.db import get_pool
    db_status = "unreachable"
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        db_status = "ok"
    except Exception as exc:
        db_status = str(exc)
    return {"status": "ok", "version": "1.0.0", "env": settings.APP_ENV, "db": db_status}
