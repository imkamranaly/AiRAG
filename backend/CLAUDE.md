# Backend — FastAPI Conventions

Root: `backend/`
Entry point: `backend/app/main.py`
Run: `cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
Test: `cd backend && pytest -v`

## Application Architecture

```
app/
  core/
    config.py         Pydantic Settings v2 — single source of truth for all config
    db.py             asyncpg connection pool — init_pool/close_pool/get_pool/ensure_pool
    opensearch.py     OpenSearch async client — init_client/close_client/ensure_index (target)
  models/
    schemas.py        ALL Pydantic v2 request + response models live here
  routes/
    upload.py         POST /api/v1/upload · GET /api/v1/documents · DELETE /api/v1/documents/{id}
    chat.py           POST /api/v1/chat  (SSE streaming)
    history.py        CRUD /api/v1/history
  services/
    data.py           LlamaIndex RAG engine — retriever + streaming pipeline
    rag_service.py    Wraps data.py as SSE async generator
    embedding_service.py  OpenAI async embeddings (singleton client)
    document_service.py   Full upload pipeline: extract → chunk → embed → store
    history_service.py    Chat + message CRUD against PostgreSQL
  main.py             FastAPI app — lifespan, CORS, router registration
```

## Naming Conventions

| Thing | Pattern | Example |
|-------|---------|---------|
| Route file | `<resource>.py` | `tags.py` |
| Service file | `<resource>_service.py` | `tags_service.py` |
| Request schema | `<Resource>Request` | `CreateTagRequest` |
| Response schema | `<Resource>Response` | `TagResponse` |
| List response | `<Resource>ListResponse` | `TagListResponse` |
| Router var | `router` | `router = APIRouter()` |

## Route Pattern (thin router, fat service)

```python
# routes/tags.py
from fastapi import APIRouter, HTTPException
from app.models.schemas import TagResponse, CreateTagRequest, TagListResponse
from app.services import tags_service

router = APIRouter()

@router.get("/tags", response_model=TagListResponse)
async def list_tags():
    """List all tags."""
    return await tags_service.list_tags()

@router.post("/tags", response_model=TagResponse, status_code=201)
async def create_tag(body: CreateTagRequest):
    """Create a new tag."""
    return await tags_service.create_tag(body)
```

## Database Pool Usage

```python
# In route handlers — pool is guaranteed healthy
from app.core.db import get_pool

async with get_pool().acquire() as conn:
    row = await conn.fetchrow("SELECT ...", ...)

# In background tasks — pool might not exist yet at startup
from app.core.db import ensure_pool

pool = await ensure_pool()
async with pool.acquire() as conn:
    await conn.execute("INSERT ...", ...)
```

## OpenSearch Client Usage (target pattern)

```python
# backend/app/core/opensearch.py (to be created)
from app.core.opensearch import get_os_client

client = get_os_client()
response = await client.search(index="rag-chunks", body={...})
```

## Schema Conventions (Pydantic v2)

All models go in `backend/app/models/schemas.py`. Never create separate schema files.

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class CreateTagRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = None

class TagResponse(BaseModel):
    id: uuid.UUID
    name: str
    color: Optional[str]
    created_at: datetime

class TagListResponse(BaseModel):
    tags: list[TagResponse]
    total: int
```

## SSE Streaming Pattern

```python
# routes/chat.py — how streaming responses work
from fastapi.responses import StreamingResponse

@router.post("/chat")
async def chat(body: ChatRequest):
    async def event_stream():
        async for event in rag_service.stream_rag_response(body.query):
            yield f"data: {event}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

## Background Task Pattern

```python
# routes/upload.py — how background processing works
from fastapi import BackgroundTasks

@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile, background_tasks: BackgroundTasks):
    doc = await create_document_record(file)          # immediate DB insert
    background_tasks.add_task(_process_in_background, doc.id, file_bytes)
    return UploadResponse(document_id=doc.id, status="processing")

async def _process_in_background(doc_id, file_bytes):
    pool = await ensure_pool()                        # use ensure_pool not get_pool
    ...
```

## Config Pattern

Always add new settings to `app/core/config.py`:

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="allow")
    # existing ...
    OPENSEARCH_URL: str = "http://localhost:9200"
    OPENSEARCH_INDEX_CHUNKS: str = "rag-chunks"
```

## Testing Conventions

- Use `TestClient` from `starlette.testclient`
- Patch at the **service layer**, not the DB layer
- Test file: `tests/test_<resource>.py`
- Fixture for app: `@pytest.fixture def client(): return TestClient(app)`

```python
# tests/test_tags.py
from unittest.mock import AsyncMock, patch
from starlette.testclient import TestClient
from app.main import app

def test_list_tags():
    with patch("app.routes.tags.tags_service.list_tags", new_callable=AsyncMock) as mock:
        mock.return_value = {"tags": [], "total": 0}
        r = TestClient(app).get("/api/v1/tags")
    assert r.status_code == 200
```

## OpenSearch → PostgreSQL Migration Notes

- `document_service.py` currently writes chunks to PostgreSQL `chunks` table
- Target: write to OpenSearch `rag-chunks` index instead
- `data.py` currently queries PostgreSQL with cosine `<=>` operator
- Target: query OpenSearch k-NN endpoint instead
- Keep old `PostgreSQLRetriever` class commented (not deleted) until migration verified
- New class must be named `OpenSearchRetriever` with identical `_aretrieve` signature
