from typing import List, Optional

from openai import AsyncOpenAI

from app.core.config import get_settings

settings = get_settings()
_client: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


async def embed_texts(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts. Batches requests for efficiency."""
    if not texts:
        return []

    client = _get_client()
    # OpenAI supports up to 2048 texts per request
    batch_size = 512
    all_embeddings: List[List[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        # Strip newlines — recommended by OpenAI
        batch = [t.replace("\n", " ") for t in batch]

        response = await client.embeddings.create(
            model=settings.EMBEDDING_MODEL,
            input=batch,
            dimensions=settings.EMBEDDING_DIMENSIONS,
        )
        all_embeddings.extend([item.embedding for item in response.data])

    return all_embeddings


async def embed_query(query: str) -> List[float]:
    """Generate embedding for a single query string."""
    embeddings = await embed_texts([query])
    return embeddings[0]
