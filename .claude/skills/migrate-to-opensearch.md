---
name: migrate-to-opensearch
description: Migrate the vector search layer from PostgreSQL/pgvector to OpenSearch. Replaces the chunks table and PostgreSQLRetriever with OpenSearch k-NN index and OpenSearchRetriever.
---

Migrate AiRAG's vector search from PostgreSQL/pgvector to OpenSearch k-NN.

## Overview

| Layer | Current (PostgreSQL) | Target (OpenSearch) |
|-------|---------------------|---------------------|
| Storage | `chunks` table with `vector(1536)` column | `rag-chunks` index with `knn_vector` field |
| Indexing | IVFFlat (`lists=100`) | HNSW (`ef_construction=512, m=16`) |
| Search | `embedding <=> $1::vector` cosine distance | `knn` query with `cosinesimil` space |
| Write path | `document_service.py` → asyncpg INSERT | `document_service.py` → async_bulk |
| Read path | `data.py` PostgreSQLRetriever | `data.py` OpenSearchRetriever |

## Migration Steps (in order)

### Step 1 — Add OpenSearch settings to config.py
Read `backend/app/core/config.py`, then append:
```python
OPENSEARCH_URL: str = "http://localhost:9200"
OPENSEARCH_INDEX_CHUNKS: str = "rag-chunks"
```

### Step 2 — Create the OpenSearch client module
Create `backend/app/core/opensearch.py`:
```python
from opensearchpy import AsyncOpenSearch
from typing import Optional
import logging
from app.core.config import get_settings

logger = logging.getLogger(__name__)
_client: Optional[AsyncOpenSearch] = None

RAG_CHUNKS_INDEX = "rag-chunks"

def rag_chunks_mapping() -> dict:
    return {
        "settings": {
            "index": {"knn": True, "knn.algo_param.ef_search": 512,
                      "number_of_shards": 1, "number_of_replicas": 0}
        },
        "mappings": {
            "properties": {
                "id":            {"type": "keyword"},
                "document_id":   {"type": "keyword"},
                "document_name": {"type": "keyword"},
                "content":       {"type": "text", "analyzer": "english"},
                "embedding": {
                    "type": "knn_vector", "dimension": 1536,
                    "method": {"name": "hnsw", "space_type": "cosinesimil",
                               "engine": "nmslib",
                               "parameters": {"ef_construction": 512, "m": 16}}
                },
                "chunk_index": {"type": "integer"},
                "metadata":    {"type": "object", "dynamic": True},
                "created_at":  {"type": "date"}
            }
        }
    }

async def init_os_client() -> None:
    global _client
    _client = AsyncOpenSearch(hosts=[get_settings().OPENSEARCH_URL],
                              use_ssl=False, verify_certs=False)
    logger.info("OpenSearch client created.")

async def close_os_client() -> None:
    global _client
    if _client:
        await _client.close(); _client = None
        logger.info("OpenSearch client closed.")

def get_os_client() -> AsyncOpenSearch:
    if _client is None:
        raise RuntimeError("OpenSearch client not initialised.")
    return _client

async def ensure_index(index_name: str, mapping: dict) -> None:
    client = get_os_client()
    if not await client.indices.exists(index=index_name):
        await client.indices.create(index=index_name, body=mapping)
        logger.info("Created index: %s", index_name)
```

### Step 3 — Update main.py lifespan
Read `backend/app/main.py`, then add to the lifespan:
```python
from app.core.opensearch import (
    init_os_client, close_os_client, ensure_index,
    RAG_CHUNKS_INDEX, rag_chunks_mapping,
)

# In lifespan, after init_pool():
await init_os_client()
await ensure_index(RAG_CHUNKS_INDEX, rag_chunks_mapping())

# In lifespan, after yield (before close_pool()):
await close_os_client()
```

### Step 4 — Update document_service.py write path
Read `backend/app/services/document_service.py`.
Replace the asyncpg chunk INSERT block with OpenSearch bulk indexing:
```python
from opensearchpy.helpers import async_bulk
from app.core.opensearch import RAG_CHUNKS_INDEX, get_os_client

# Replace: await conn.executemany("INSERT INTO chunks ...", chunk_rows)
# With:
actions = [
    {
        "_index": RAG_CHUNKS_INDEX,
        "_id": str(uuid.uuid4()),
        "_source": {
            "id": str(uuid.uuid4()),
            "document_id": document_id,
            "document_name": document_name,
            "content": chunk.text,
            "embedding": embedding,
            "chunk_index": i,
            "metadata": {"filename": document_name, "char_count": len(chunk.text)},
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    }
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
]
await async_bulk(get_os_client(), actions)
```

### Step 5 — Swap retriever in data.py
Read `backend/app/services/data.py`.
Comment out `PostgreSQLRetriever` class entirely, add `OpenSearchRetriever`:
```python
# MIGRATION: PostgreSQLRetriever replaced by OpenSearchRetriever
# class PostgreSQLRetriever(CustomSimpleQueryEngine):
#     ...  (keep full old code commented)

class OpenSearchRetriever(CustomSimpleQueryEngine):
    async def _aretrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        settings = get_settings()
        embedding = await embed_query(query_bundle.query_str)
        response = await get_os_client().search(
            index=RAG_CHUNKS_INDEX,
            body={
                "size": settings.TOP_K,
                "query": {"knn": {"embedding": {"vector": embedding, "k": settings.TOP_K}}},
                "min_score": settings.SIMILARITY_THRESHOLD,
            }
        )
        nodes = []
        for hit in response["hits"]["hits"]:
            src = hit["_source"]
            node = TextNode(
                text=src["content"],
                metadata={
                    "document_id": src["document_id"],
                    "document_name": src["document_name"],
                    "chunk_index": src["chunk_index"],
                    "similarity": hit["_score"],
                }
            )
            nodes.append(NodeWithScore(node=node, score=hit["_score"]))
        return nodes
```

Update any reference to `PostgreSQLRetriever()` → `OpenSearchRetriever()` in the same file.

### Step 6 — Update docker-compose.yml
Read `docker-compose.yml`, then add the OpenSearch service:
```yaml
  opensearch:
    image: opensearchproject/opensearch:2.13.0
    container_name: airag_opensearch
    restart: unless-stopped
    environment:
      - discovery.type=single-node
      - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
      - DISABLE_SECURITY_PLUGIN=true
    ports:
      - "9200:9200"
    volumes:
      - opensearch_data:/usr/share/opensearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:9200/_cluster/health || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 5
```
Add `opensearch_data:` under the `volumes:` section.
Add `opensearch: condition: service_healthy` to the backend `depends_on`.

### Step 7 — Update requirements.txt
Append to `backend/requirements.txt`:
```
opensearch-py>=2.4.0
```

### Step 8 — Update .env
Append to `.env`:
```
OPENSEARCH_URL=http://localhost:9200
```

## Verification

After implementation:
```bash
# Rebuild and restart
docker compose down -v
docker compose up --build

# Check OpenSearch is up
curl http://localhost:9200/_cluster/health?pretty

# Upload a document via the UI or API, then check the index
curl http://localhost:9200/rag-chunks/_count?pretty

# Send a chat query and confirm response uses OpenSearch
curl -X POST http://127.0.0.1:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What is in the uploaded document?"}'
```
