Scaffold a new FastAPI route file with matching service stub and schema entries.

## Usage

```
/scaffold-route <resource-name> [methods]
```

Examples:
```
/scaffold-route tags
/scaffold-route feedback post,get,delete
/scaffold-route export get
```

Default methods if not specified: `get, post, delete`

## What This Command Does

1. Parse `<resource-name>` (e.g. `tags`) and optional `[methods]` from $ARGUMENTS.
2. Derive names:
   - singular = remove trailing `s` if present (e.g. `tags` → `tag`)
   - plural = resource name as-is (e.g. `tags`)
   - title = capitalize first letter (e.g. `Tag`)
   - module = lowercase (e.g. `tags`)
3. Read `backend/app/models/schemas.py` to understand existing patterns.
4. Create `backend/app/routes/<resource>.py`.
5. Create `backend/app/services/<resource>_service.py`.
6. Append schema stubs to `backend/app/models/schemas.py`.
7. Print the `include_router` line for the user to add to `main.py`.

## Files to Generate

### `backend/app/routes/<resource>.py`

```python
from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    <Title>Response,
    <Title>ListResponse,
    Create<Title>Request,
    Update<Title>Request,
)
from app.services import <resource>_service

router = APIRouter()


@router.get("/<resource>", response_model=<Title>ListResponse)
async def list_<resource>():
    """List all <resource>."""
    return await <resource>_service.list_<resource>()


@router.post("/<resource>", response_model=<Title>Response, status_code=201)
async def create_<singular>(body: Create<Title>Request):
    """Create a new <singular>."""
    return await <resource>_service.create_<singular>(body)


@router.get("/<resource>/{<singular>_id}", response_model=<Title>Response)
async def get_<singular>(<singular>_id: str):
    """Get a <singular> by ID."""
    item = await <resource>_service.get_<singular>(<singular>_id)
    if item is None:
        raise HTTPException(status_code=404, detail="<Title> not found")
    return item


@router.delete("/<resource>/{<singular>_id}", status_code=204)
async def delete_<singular>(<singular>_id: str):
    """Delete a <singular> by ID."""
    deleted = await <resource>_service.delete_<singular>(<singular>_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="<Title> not found")
```

### `backend/app/services/<resource>_service.py`

```python
import uuid
from app.core.db import get_pool


async def list_<resource>() -> dict:
    async with get_pool().acquire() as conn:
        rows = await conn.fetch("SELECT * FROM <resource> ORDER BY created_at DESC")
        total = await conn.fetchval("SELECT COUNT(*) FROM <resource>")
    return {"<resource>": [dict(r) for r in rows], "total": total}


async def create_<singular>(body) -> dict:
    async with get_pool().acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO <resource> (id, ...) VALUES ($1, ...) RETURNING *",
            str(uuid.uuid4()),
            # body fields...
        )
    return dict(row)


async def get_<singular>(<singular>_id: str) -> dict | None:
    async with get_pool().acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM <resource> WHERE id = $1", <singular>_id
        )
    return dict(row) if row else None


async def delete_<singular>(<singular>_id: str) -> bool:
    async with get_pool().acquire() as conn:
        result = await conn.execute(
            "DELETE FROM <resource> WHERE id = $1", <singular>_id
        )
    return result == "DELETE 1"
```

### Schema stubs to append to `backend/app/models/schemas.py`

```python
# ── <Title> ──────────────────────────────────────────────────────────────────

class Create<Title>Request(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class Update<Title>Request(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)


class <Title>Response(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime


class <Title>ListResponse(BaseModel):
    <resource>: list[<Title>Response]
    total: int
```

## After Scaffolding

Print this message to the user:

```
Scaffolded: <resource>

Created:
  backend/app/routes/<resource>.py
  backend/app/services/<resource>_service.py

Modified:
  backend/app/models/schemas.py  (appended <Title> schemas)

Add to backend/app/main.py:
  from app.routes import <resource>
  app.include_router(<resource>.router, prefix="/api/v1", tags=["<Title>"])

Next steps:
  1. Add the SQL table/migration to infra/schema.sql
  2. Fill in the SQL queries in <resource>_service.py
  3. Register the router in main.py (line above)
```
