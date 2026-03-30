"""
OpenSearch async client — lifecycle management and index bootstrapping.

Usage:
    from app.core.opensearch import get_os_client, init_client, close_client
"""

import logging

from opensearchpy import AsyncOpenSearch

from app.core.config import get_settings

logger = logging.getLogger(__name__)
_client: AsyncOpenSearch | None = None


async def init_client() -> None:
    """Create the global async OpenSearch client and ensure the chunks index exists."""
    global _client
    settings = get_settings()
    _client = AsyncOpenSearch(
        hosts=[settings.OPENSEARCH_URL],
        use_ssl=False,
        verify_certs=False,
        http_compress=True,
    )
    info = await _client.info()
    logger.info(
        "OpenSearch connected — version %s",
        info.get("version", {}).get("number", "unknown"),
    )
    await _ensure_index()


async def close_client() -> None:
    """Close the global async OpenSearch client."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
        logger.info("OpenSearch client closed.")


def get_os_client() -> AsyncOpenSearch:
    """Return the active client; raises if init_client() was never called."""
    if _client is None:
        raise RuntimeError("OpenSearch client not initialized. Call init_client() first.")
    return _client


async def _ensure_index() -> None:
    """Create the knn chunks index if it doesn't exist yet."""
    settings = get_settings()
    client = get_os_client()
    index = settings.OPENSEARCH_INDEX_CHUNKS

    exists = await client.indices.exists(index=index)
    if exists:
        logger.info("OpenSearch index '%s' already exists.", index)
        return

    await client.indices.create(
        index=index,
        body={
            "settings": {
                "index": {
                    "knn": True,
                    "knn.algo_param.ef_search": 100,
                    "number_of_shards": 1,
                    "number_of_replicas": 0,
                }
            },
            "mappings": {
                "properties": {
                    "id": {"type": "keyword"},
                    "document_id": {"type": "keyword"},
                    "document_name": {
                        "type": "text",
                        "fields": {"keyword": {"type": "keyword"}},
                    },
                    "content": {"type": "text"},
                    "embedding": {
                        "type": "knn_vector",
                        "dimension": 1536,
                        "method": {
                            "name": "hnsw",
                            "engine": "nmslib",
                            "space_type": "cosinesimil",
                            "parameters": {
                                "ef_construction": 128,
                                "m": 16,
                            },
                        },
                    },
                    "chunk_index": {"type": "integer"},
                    "metadata": {"type": "object", "enabled": True},
                }
            },
        },
    )
    logger.info("OpenSearch index '%s' created.", index)
