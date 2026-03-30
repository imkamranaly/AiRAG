Implement code from a spec file. Read the spec, then write all described files.

## Usage

```
/implement <spec-file-path>
```

Examples:
```
/implement .specs/backend-document-tagging.md
/implement .specs/frontend-copy-button.md
/implement .specs/opensearch-rag-chunks.md
```

## What This Command Does

1. Read the spec file at the path given in $ARGUMENTS.
2. Check the `## Status` field — warn the user if it is already `implemented`.
3. Identify every file to create or modify from the spec sections.
4. Read each existing file that will be modified before touching it.
5. Implement all files following the spec and codebase conventions.
6. Update the spec's `## Status` line from `draft`/`approved` to `implemented`.
7. Print a summary of all files written/modified.

---

## Implementation Rules

### Always Read Before Editing

Before writing any code, read every file the spec says will be modified:

- `backend/app/models/schemas.py` → read, then append new classes at the end
- `backend/app/main.py` → read the lifespan and router list, then add to both
- `backend/app/core/config.py` → read the Settings class, then append new fields
- `frontend/lib/api.ts` → read, append new functions at the bottom
- `frontend/store/chatStore.ts` → read the interface and create() call, add to both
- `frontend/types/index.ts` → read, append new types at the bottom

### Never Break Existing Code

- Preserve all existing functions, imports, and exports when modifying a file.
- Use surgical edits — append or add to specific sections, never overwrite the whole file.
- If removing code is necessary, comment it out with `# MIGRATION:` or `// MIGRATION:`.

---

## Backend Implementation Order

For backend feature specs, implement in this exact order:

1. **`backend/app/core/config.py`** — add any new Settings fields with defaults
2. **`backend/app/models/schemas.py`** — add new Pydantic v2 request + response models
3. **`backend/app/services/<name>_service.py`** — business logic (new file or modify existing)
4. **`backend/app/routes/<name>.py`** — HTTP layer (new file or modify existing)
5. **`backend/app/main.py`** — add `app.include_router(<name>.router, prefix="/api/v1", tags=["..."])`
6. **`backend/tests/test_<name>.py`** — tests (patch service layer, not DB)

### Backend Code Conventions

```python
# Service function pattern
from app.core.db import get_pool, ensure_pool  # get_pool in routes, ensure_pool in bg tasks

async def list_items(limit: int = 20, offset: int = 0) -> dict:
    async with get_pool().acquire() as conn:
        rows = await conn.fetch("SELECT ... LIMIT $1 OFFSET $2", limit, offset)
        total = await conn.fetchval("SELECT COUNT(*) FROM ...")
    return {"items": [dict(r) for r in rows], "total": total}

# Route function pattern
@router.get("/items", response_model=ItemListResponse)
async def list_items_route(limit: int = 20, offset: int = 0):
    """List items with pagination."""
    return await items_service.list_items(limit=limit, offset=offset)
```

---

## Frontend Implementation Order

For frontend feature specs, implement in this exact order:

1. **`frontend/types/index.ts`** — append new TypeScript interfaces/types
2. **`frontend/lib/api.ts`** — append new API functions using `apiFetch` helper
3. **`frontend/store/chatStore.ts`** — add new state + actions if shared state is needed
4. **`frontend/components/<feature>/<Name>.tsx`** — implement component(s)
5. **Parent component** — integrate new component (read parent file first)
6. **`frontend/components/<feature>/__tests__/<Name>.test.tsx`** — tests

### Frontend Code Conventions

```tsx
// Component pattern
"use client";
import { memo } from "react";
import clsx from "clsx";
import type { MyType } from "@/types";

interface Props {
  value: MyType;
  className?: string;
}

export const MyComponent = memo(function MyComponent({ value, className }: Props) {
  return <div className={clsx("...", className)}>{/* ... */}</div>;
});

// API function pattern (append to lib/api.ts)
export async function fetchItems(): Promise<ItemListResponse> {
  return apiFetch<ItemListResponse>("/api/v1/items");
}
```

---

## OpenSearch Implementation Order

For OpenSearch specs, implement in this exact order:

1. **`backend/app/core/config.py`** — add `OPENSEARCH_URL`, index name settings
2. **`backend/app/core/opensearch.py`** — async client singleton + `ensure_index()`
3. **`backend/app/services/opensearch_service.py`** — index/search/delete operations
4. **`backend/app/services/document_service.py`** — replace PostgreSQL chunk insert with OpenSearch bulk index
5. **`backend/app/services/data.py`** — add `OpenSearchRetriever` class (keep `PostgreSQLRetriever` commented)
6. **`backend/app/main.py`** — add `await ensure_index(...)` call inside lifespan
7. **`docker-compose.yml`** — add OpenSearch service + volume
8. **`backend/requirements.txt`** — add `opensearch-py>=2.4.0`

### OpenSearch Code Conventions

```python
# backend/app/core/opensearch.py — singleton pattern (mirrors db.py)
from opensearchpy import AsyncOpenSearch

_client: Optional[AsyncOpenSearch] = None

async def init_client() -> None:
    global _client
    settings = get_settings()
    _client = AsyncOpenSearch(hosts=[settings.OPENSEARCH_URL])

def get_os_client() -> AsyncOpenSearch:
    if _client is None:
        raise RuntimeError("OpenSearch client not initialised.")
    return _client

async def ensure_index(index_name: str, mapping: dict) -> None:
    client = get_os_client()
    if not await client.indices.exists(index=index_name):
        await client.indices.create(index=index_name, body=mapping)

# OpenSearchRetriever — keep same signature as PostgreSQLRetriever
class OpenSearchRetriever(CustomSimpleQueryEngine):
    async def _aretrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        embedding = await embed_query(query_bundle.query_str)
        response = await get_os_client().search(
            index=settings.OPENSEARCH_INDEX_CHUNKS,
            body={"size": settings.TOP_K, "query": {"knn": {"embedding": {"vector": embedding, "k": settings.TOP_K}}}}
        )
        return [NodeWithScore(node=TextNode(text=h["_source"]["content"], metadata=h["_source"]["metadata"]), score=h["_score"]) for h in response["hits"]["hits"]]
```

---

## After Implementation

1. Update the spec file's `## Status` from `draft`/`approved` → `implemented`
2. Print a summary:
   ```
   Implemented: .specs/<name>.md
   Files created: <list>
   Files modified: <list>
   Next: run tests with `pytest` / `npm test`
   ```
