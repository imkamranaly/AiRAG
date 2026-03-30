Scaffold OpenSearch index creation code: mapping, client setup, and service stubs.

## Usage

```
/scaffold-opensearch-index <index-name> [description]
```

Examples:
```
/scaffold-opensearch-index rag-chunks "k-NN vector index for document chunks"
/scaffold-opensearch-index rag-documents "metadata index for document full-text search"
```

## What This Command Does

1. Parse `<index-name>` and optional `[description]` from $ARGUMENTS.
2. Derive:
   - `python_name` = index name with hyphens replaced by underscores (e.g. `rag-chunks` → `rag_chunks`)
   - `const_name` = uppercase with underscores (e.g. `RAG_CHUNKS`)
3. Read `backend/app/core/config.py` before modifying it.
4. Create `backend/app/core/opensearch.py` (or append if it already exists).
5. Create `backend/app/services/opensearch_service.py` (or append if it already exists).
6. Append settings to `backend/app/core/config.py`.
7. Print instructions for `main.py`, `docker-compose.yml`, and `requirements.txt`.

## Files to Generate

### `backend/app/core/opensearch.py`

```python
"""
Async OpenSearch client (opensearch-py).

Usage:
    # In app lifespan:
    await init_os_client()
    await ensure_index(INDEX_<CONST_NAME>, <python_name>_mapping())
    ...
    await close_os_client()

    # In service functions:
    client = get_os_client()
    response = await client.search(index=INDEX_<CONST_NAME>, body={...})
"""

import logging
from typing import Optional

from opensearchpy import AsyncOpenSearch

from app.core.config import get_settings

logger = logging.getLogger(__name__)
_client: Optional[AsyncOpenSearch] = None

INDEX_<CONST_NAME> = "<index-name>"


def <python_name>_mapping() -> dict:
    """Index mapping for <index-name>."""
    return {
        "settings": {
            "index": {
                "knn": True,
                "knn.algo_param.ef_search": 512,
                "number_of_shards": 1,
                "number_of_replicas": 0,
            }
        },
        "mappings": {
            "properties": {
                "id": {"type": "keyword"},
                "document_id": {"type": "keyword"},
                "content": {"type": "text", "analyzer": "english"},
                "embedding": {
                    "type": "knn_vector",
                    "dimension": 1536,
                    "method": {
                        "name": "hnsw",
                        "space_type": "cosinesimil",
                        "engine": "nmslib",
                        "parameters": {"ef_construction": 512, "m": 16},
                    },
                },
                "chunk_index": {"type": "integer"},
                "metadata": {"type": "object", "dynamic": True},
                "created_at": {"type": "date"},
            }
        },
    }


async def init_os_client() -> None:
    """Create the global OpenSearch client. Call once at app startup."""
    global _client
    settings = get_settings()
    _client = AsyncOpenSearch(
        hosts=[settings.OPENSEARCH_URL],
        use_ssl=False,
        verify_certs=False,
        ssl_assert_hostname=False,
        ssl_show_warn=False,
    )
    logger.info("OpenSearch client created → %s", settings.OPENSEARCH_URL)


async def close_os_client() -> None:
    """Close the global client. Call once at app shutdown."""
    global _client
    if _client:
        await _client.close()
        _client = None
        logger.info("OpenSearch client closed.")


def get_os_client() -> AsyncOpenSearch:
    """Return the active client, raising a clear error if uninitialised."""
    if _client is None:
        raise RuntimeError(
            "OpenSearch client is not initialised. Ensure init_os_client() was called."
        )
    return _client


async def ensure_index(index_name: str, mapping: dict) -> None:
    """Create the index if it doesn't already exist."""
    client = get_os_client()
    exists = await client.indices.exists(index=index_name)
    if not exists:
        await client.indices.create(index=index_name, body=mapping)
        logger.info("Created OpenSearch index: %s", index_name)
    else:
        logger.info("OpenSearch index already exists: %s", index_name)
```

### `backend/app/services/opensearch_service.py`

```python
"""
OpenSearch CRUD + k-NN search operations for the <index-name> index.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from opensearchpy.helpers import async_bulk

from app.core.opensearch import INDEX_<CONST_NAME>, get_os_client


async def index_chunks(chunks: list[dict[str, Any]]) -> None:
    """Bulk-index a list of chunks into OpenSearch."""
    client = get_os_client()
    actions = [
        {
            "_index": INDEX_<CONST_NAME>,
            "_id": chunk["id"],
            "_source": {
                "id": chunk["id"],
                "document_id": chunk["document_id"],
                "content": chunk["content"],
                "embedding": chunk["embedding"],
                "chunk_index": chunk["chunk_index"],
                "metadata": chunk.get("metadata", {}),
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        }
        for chunk in chunks
    ]
    await async_bulk(client, actions)


async def knn_search(
    embedding: list[float],
    k: int = 5,
    min_score: float = 0.5,
    document_filter: str | None = None,
) -> list[dict[str, Any]]:
    """Run a k-NN vector search and return raw hit sources."""
    client = get_os_client()
    query: dict[str, Any] = {
        "size": k,
        "query": {
            "knn": {
                "embedding": {
                    "vector": embedding,
                    "k": k,
                }
            }
        },
        "min_score": min_score,
    }
    if document_filter:
        query["post_filter"] = {"term": {"document_id": document_filter}}

    response = await client.search(index=INDEX_<CONST_NAME>, body=query)
    return [hit["_source"] | {"_score": hit["_score"]} for hit in response["hits"]["hits"]]


async def delete_by_document(document_id: str) -> int:
    """Delete all chunks belonging to a document. Returns deleted count."""
    client = get_os_client()
    response = await client.delete_by_query(
        index=INDEX_<CONST_NAME>,
        body={"query": {"term": {"document_id": document_id}}},
    )
    return response.get("deleted", 0)
```

### Settings to append to `backend/app/core/config.py`

```python
# OpenSearch
OPENSEARCH_URL: str = "http://localhost:9200"
OPENSEARCH_INDEX_<CONST_NAME>: str = "<index-name>"
```

## After Scaffolding

Print this message to the user:

```
Scaffolded: <index-name>

Created:
  backend/app/core/opensearch.py
  backend/app/services/opensearch_service.py

Modified:
  backend/app/core/config.py  (appended OpenSearch settings)

Manual steps required:

1. Add to backend/app/main.py lifespan:

   from app.core.opensearch import (
       init_os_client, close_os_client, ensure_index,
       INDEX_<CONST_NAME>, <python_name>_mapping,
   )

   # Inside lifespan, before yield:
   await init_os_client()
   await ensure_index(INDEX_<CONST_NAME>, <python_name>_mapping())

   # Inside lifespan, after yield:
   await close_os_client()

2. Add to docker-compose.yml services:

   opensearch:
     image: opensearchproject/opensearch:2.13.0
     environment:
       - discovery.type=single-node
       - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
       - DISABLE_SECURITY_PLUGIN=true
     ports:
       - "9200:9200"
     volumes:
       - opensearch_data:/usr/share/opensearch/data

   Add to volumes: section:
     opensearch_data:

3. Add to backend/requirements.txt:
   opensearch-py>=2.4.0

4. Add to .env:
   OPENSEARCH_URL=http://localhost:9200
```
