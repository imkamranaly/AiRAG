Generate a complete OpenSearch index and migration spec and write it to `.specs/`.

## Usage

```
/spec-opensearch <description>
```

Examples:
```
/spec-opensearch "rag-chunks index to replace pgvector chunks table"
/spec-opensearch "documents metadata index for full-text search"
/spec-opensearch "reindex rag-chunks with updated HNSW parameters"
```

## What This Command Does

1. Parse the description from $ARGUMENTS.
2. Derive a kebab-case slug from the description.
3. Create the `.specs/` directory if it doesn't exist.
4. Write a complete OpenSearch spec to `.specs/opensearch-<slug>.md`.
5. Report the spec path and next steps.

## Spec File to Generate

Write the file at `.specs/opensearch-<slug>.md` using exactly this structure:

```markdown
# OpenSearch Spec: <Feature Title>

## Status
`draft`

## Summary
What this index stores, why it exists, and what it replaces (if a migration).

## Context

### Current State (PostgreSQL)

Describe the current PostgreSQL table(s) being replaced or augmented:

\```sql
-- existing table schema
\```

Which service functions currently read/write this table:
- `backend/app/services/document_service.py` — describe usage
- `backend/app/services/data.py` — describe usage

### Target State (OpenSearch)

Index name: `<index-name>`
Purpose: replace/augment the PostgreSQL table above

## Index Mapping

\```json
{
  "settings": {
    "index": {
      "knn": true,
      "knn.algo_param.ef_search": 512
    }
  },
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "document_id": { "type": "keyword" },
      "content": { "type": "text", "analyzer": "english" },
      "embedding": {
        "type": "knn_vector",
        "dimension": 1536,
        "method": {
          "name": "hnsw",
          "space_type": "cosinesimil",
          "engine": "nmslib",
          "parameters": { "ef_construction": 512, "m": 16 }
        }
      },
      "chunk_index": { "type": "integer" },
      "metadata": { "type": "object" },
      "created_at": { "type": "date" }
    }
  }
}
\```

## Migration Steps

1. Add `OPENSEARCH_URL` to `backend/app/core/config.py`
2. Create `backend/app/core/opensearch.py` (client + ensure_index)
3. Modify `backend/app/services/document_service.py` — write chunks to OpenSearch
4. Modify `backend/app/services/data.py` — swap `PostgreSQLRetriever` → `OpenSearchRetriever`
5. Add `ensure_index()` call to lifespan in `backend/app/main.py`
6. Add OpenSearch service to `docker-compose.yml`
7. Add `opensearch-py>=2.4.0` to `backend/requirements.txt`

## Service Changes

### `backend/app/core/opensearch.py` (new file)

\```python
async def init_client() -> None: ...
async def close_client() -> None: ...
def get_os_client() -> AsyncOpenSearch: ...
async def ensure_index(index_name: str, mapping: dict) -> None: ...
\```

### `backend/app/services/document_service.py` (modify)

Replace:
\```python
# INSERT INTO chunks (id, document_id, content, embedding, ...) VALUES ...
\```

With:
\```python
# await client.bulk(body=opensearch_bulk_actions)
\```

### `backend/app/services/data.py` (modify)

Replace `PostgreSQLRetriever` class with `OpenSearchRetriever`:
- Keep old class commented out
- New class: same `_aretrieve` signature
- Uses `client.search(index=..., body={"query": {"knn": ...}})` instead of SQL

## Docker Compose Changes

\```yaml
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
\```

## Verification

After implementation:
\```bash
# Check index exists
curl http://localhost:9200/rag-chunks

# Upload a document, verify it appears in OpenSearch
curl http://localhost:9200/rag-chunks/_search?pretty

# Run a chat query, verify retrieval works
curl -X POST http://127.0.0.1:8000/api/v1/chat -d '{"query": "test"}'
\```
```

## After Writing the Spec

Tell the user:
1. The spec path: `.specs/opensearch-<slug>.md`
2. To review the index mapping carefully — HNSW parameters and field types can't be changed after index creation
3. Change `Status` to `approved` when ready
4. Then run `/implement .specs/opensearch-<slug>.md`
