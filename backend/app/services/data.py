"""
LlamaIndex RAG engine for the AI-RAG backend.

Provides a full LlamaIndex pipeline:
  - OpenSearchRetriever  — custom BaseRetriever backed by OpenSearch k-NN search
  - configure_llama_settings() — wires OpenAI embed model + LLM into LlamaIndex globals
  - build_query_engine()       — one-shot (non-streaming) RetrieverQueryEngine
  - astream_rag_response()     — async generator for streaming RAG responses

The rag_service module calls astream_rag_response() and wraps events in SSE format.
"""

import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

from llama_index.core import PromptTemplate, Settings
from llama_index.core.base.base_retriever import BaseRetriever
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.response_synthesizers import ResponseMode, get_response_synthesizer
from llama_index.core.schema import NodeWithScore, QueryBundle, TextNode
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI

from app.core.config import get_settings
from app.core.db import ensure_pool
from app.core.opensearch import get_os_client
from app.services.embedding_service import embed_query

logger = logging.getLogger(__name__)
_settings = get_settings()


# ── LlamaIndex global settings ────────────────────────────────────────────────

def configure_llama_settings() -> None:
    """Wire OpenAI embedding model and LLM into LlamaIndex global Settings."""
    Settings.embed_model = OpenAIEmbedding(
        model=_settings.EMBEDDING_MODEL,
        api_key=_settings.OPENAI_API_KEY,
        dimensions=_settings.EMBEDDING_DIMENSIONS,
    )
    Settings.llm = OpenAI(
        model=_settings.LLM_MODEL,
        api_key=_settings.OPENAI_API_KEY,
        temperature=0.2,
        max_tokens=2048,
    )


# ── OpenSearch Retriever ──────────────────────────────────────────────────────

class OpenSearchRetriever(BaseRetriever):
    """
    LlamaIndex BaseRetriever backed by OpenSearch k-NN vector search.

    Queries the rag-chunks index with cosinesimil HNSW and filters
    to documents whose status = 'ready' (resolved via PostgreSQL).
    """

    def __init__(self, top_k: int, threshold: float) -> None:
        self._top_k = top_k
        self._threshold = threshold
        super().__init__()

    def _retrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        raise NotImplementedError("Use async retrieval via _aretrieve.")

    async def _aretrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        embedding = await embed_query(query_bundle.query_str)

        # Resolve ready document IDs from PostgreSQL
        pool = await ensure_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT id FROM documents WHERE status = 'ready'")
        ready_doc_ids = [str(r["id"]) for r in rows]

        if not ready_doc_ids:
            logger.info("OpenSearchRetriever: no ready documents found.")
            return []

        client = get_os_client()
        # OpenSearch nmslib cosinesimil scores are in [0, 1]:
        #   score = (1 + cosine_similarity) / 2
        # so min_score threshold = (1 + threshold) / 2
        # NMSLIB does not support inline knn filters — use post-filter via bool query
        min_score = (1.0 + self._threshold) / 2.0
        response = await client.search(
            index=_settings.OPENSEARCH_INDEX_CHUNKS,
            body={
                "size": self._top_k,
                "min_score": min_score,
                "query": {
                    "bool": {
                        "must": [
                            {
                                "knn": {
                                    "embedding": {
                                        "vector": embedding,
                                        "k": self._top_k,
                                    }
                                }
                            }
                        ],
                        "filter": [{"terms": {"document_id": ready_doc_ids}}],
                    }
                },
            },
        )

        hits = response["hits"]["hits"]
        logger.info("OpenSearchRetriever: retrieved %d chunk(s)", len(hits))

        nodes: List[NodeWithScore] = []
        for hit in hits:
            src = hit["_source"]
            text_node = TextNode(
                text=src["content"],
                id_=src["id"],
                metadata={
                    "document_id": src["document_id"],
                    "document_name": src["document_name"],
                    "chunk_index": src["chunk_index"],
                },
            )
            # Normalise back to [-1, 1] cosine similarity
            similarity = 2.0 * float(hit["_score"]) - 1.0
            nodes.append(NodeWithScore(node=text_node, score=similarity))

        return nodes


# ── QA prompt template ────────────────────────────────────────────────────────

_QA_PROMPT = PromptTemplate(
    "You are a helpful AI assistant. Answer the user's question based ONLY on the provided context.\n"
    "If the context doesn't contain enough information to answer, say so clearly.\n"
    "Always be concise, accurate, and cite relevant parts of the context when useful.\n\n"
    "Context information:\n"
    "---------------------\n"
    "{context_str}\n"
    "---------------------\n\n"
    "Query: {query_str}\n"
    "Answer: "
)


# ── One-shot query engine ─────────────────────────────────────────────────────

def build_query_engine(
    top_k: Optional[int] = None,
    threshold: Optional[float] = None,
) -> RetrieverQueryEngine:
    """
    Build a LlamaIndex RetrieverQueryEngine backed by OpenSearchRetriever.

    Suitable for one-shot (non-streaming) Q&A.
    For streaming chat, use astream_rag_response() instead.
    """
    configure_llama_settings()

    retriever = OpenSearchRetriever(
        top_k=top_k or _settings.TOP_K,
        threshold=threshold or _settings.SIMILARITY_THRESHOLD,
    )
    synthesizer = get_response_synthesizer(response_mode=ResponseMode.COMPACT)
    synthesizer.update_prompts({"text_qa_template": _QA_PROMPT})

    return RetrieverQueryEngine(retriever=retriever, response_synthesizer=synthesizer)


# ── Streaming RAG pipeline ────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "You are a helpful AI assistant. Answer the user's question based ONLY on the provided context.\n"
    "If the context doesn't contain enough information to answer the question, say so clearly.\n"
    "Always be concise, accurate, and cite relevant parts of the context when useful."
)

_CHITCHAT_SYSTEM_PROMPT = (
    "You are a helpful AI assistant for a document Q&A application. "
    "Respond naturally to greetings and general conversation. "
    "You can let the user know you're here to help answer questions about their uploaded documents."
)

_CHITCHAT_PATTERNS = {
    "hello", "hi", "hey", "hiya", "howdy", "greetings",
    "good morning", "good afternoon", "good evening", "good night",
    "how are you", "how's it going", "what's up", "sup",
    "thanks", "thank you", "bye", "goodbye", "see you",
    "ok", "okay", "sure", "great", "nice", "cool",
    "who are you", "what are you", "what can you do",
}


def _is_chitchat(query: str) -> bool:
    """Return True if the query is a greeting or simple conversational message."""
    normalized = query.strip().lower().rstrip("!?.,'\"")
    return normalized in _CHITCHAT_PATTERNS


def _build_context(nodes: List[NodeWithScore]) -> str:
    sections = []
    for i, nws in enumerate(nodes, 1):
        doc_name = nws.node.metadata.get("document_name", "Unknown")
        score = nws.score or 0.0
        sections.append(
            f"[Source {i} — {doc_name} (relevance: {score:.0%})]\n"
            f"{nws.node.get_content()}"
        )
    return "\n\n---\n\n".join(sections)


async def astream_rag_response(
    query: str,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    top_k: Optional[int] = None,
    threshold: Optional[float] = None,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Full streaming RAG pipeline using LlamaIndex + PostgreSQL.

    Yields structured event dicts (the caller wraps these in SSE format):
        {"type": "sources", "data": [<source>, ...]}
        {"type": "token",   "data": "<text fragment>"}
        {"type": "done",    "data": ""}
        {"type": "error",   "data": "<error message>"}
    """
    configure_llama_settings()

    # ── Step 0: Bypass RAG for conversational/chitchat queries ───────────────
    if _is_chitchat(query):
        yield {"type": "sources", "data": []}
        llm: OpenAI = Settings.llm  # type: ignore[assignment]
        messages: List[ChatMessage] = [
            ChatMessage(role=MessageRole.SYSTEM, content=_CHITCHAT_SYSTEM_PROMPT),
        ]
        for turn in (conversation_history or [])[-6:]:
            role = MessageRole.USER if turn["role"] == "user" else MessageRole.ASSISTANT
            messages.append(ChatMessage(role=role, content=turn["content"]))
        messages.append(ChatMessage(role=MessageRole.USER, content=query))
        try:
            response_gen = await llm.astream_chat(messages)
            async for token in response_gen:
                if token.delta:
                    yield {"type": "token", "data": token.delta}
        except Exception as exc:
            logger.error("LLM chitchat error: %s", exc)
            yield {"type": "error", "data": str(exc)}
        yield {"type": "done", "data": ""}
        return

    # ── Step 1: Retrieve relevant chunks ─────────────────────────────────────
    retriever = OpenSearchRetriever(
        top_k=top_k or _settings.TOP_K,
        threshold=threshold or _settings.SIMILARITY_THRESHOLD,
    )
    try:
        nodes = await retriever._aretrieve(QueryBundle(query_str=query))
    except Exception as exc:
        logger.error("Retrieval failed: %s", exc)
        yield {"type": "error", "data": f"Database error: {exc}"}
        return

    # ── Step 2: Emit source metadata ─────────────────────────────────────────
    sources = [
        {
            "document_id": nws.node.metadata.get("document_id", ""),
            "document_name": nws.node.metadata.get("document_name", ""),
            "content": (
                nws.node.get_content()[:300]
                + ("…" if len(nws.node.get_content()) > 300 else "")
            ),
            "similarity": round(nws.score or 0.0, 4),
            "chunk_index": nws.node.metadata.get("chunk_index", 0),
        }
        for nws in nodes
    ]
    yield {"type": "sources", "data": sources}

    # ── Step 3: Build context (empty string if no chunks found) ──────────────
    context = _build_context(nodes) if nodes else ""

    # ── Step 4: Build LlamaIndex ChatMessage list ─────────────────────────────
    if nodes:
        system_content = f"{_SYSTEM_PROMPT}\n\nContext:\n{context}"
    else:
        system_content = (
            "You are a helpful AI assistant for a document Q&A application. "
            "No relevant document chunks were found for this query. "
            "Answer general knowledge questions as best you can. "
            "If the question seems document-specific, let the user know they may need to upload relevant documents."
        )

    rag_messages: List[ChatMessage] = [
        ChatMessage(
            role=MessageRole.SYSTEM,
            content=system_content,
        )
    ]

    for turn in (conversation_history or [])[-6:]:
        role = MessageRole.USER if turn["role"] == "user" else MessageRole.ASSISTANT
        rag_messages.append(ChatMessage(role=role, content=turn["content"]))

    rag_messages.append(ChatMessage(role=MessageRole.USER, content=query))

    # ── Step 5: Stream LLM response via LlamaIndex OpenAI LLM ────────────────
    llm: OpenAI = Settings.llm  # type: ignore[assignment]

    try:
        response_gen = await llm.astream_chat(rag_messages)
        async for token in response_gen:
            if token.delta:
                yield {"type": "token", "data": token.delta}
    except Exception as exc:
        logger.error("LlamaIndex LLM streaming error: %s", exc)
        yield {"type": "error", "data": str(exc)}
        return

    yield {"type": "done", "data": ""}
