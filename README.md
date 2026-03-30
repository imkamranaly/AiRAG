# RAG App

A production-ready Retrieval-Augmented Generation application.
**Stack:** Next.js 14 · FastAPI · Supabase (pgvector) · LlamaIndex · OpenAI

---

## Architecture

```
rag-app/
├── frontend/              # Next.js 14 (App Router) + TypeScript + Tailwind
├── backend/               # FastAPI + LlamaIndex + OpenAI
├── infra/
│   ├── docker-compose.yml
│   └── supabase_schema.sql
├── .env.example
└── Makefile
```

### RAG Flow

```
Upload  →  Extract text  →  Chunk (SentenceSplitter)
        →  Embed (OpenAI text-embedding-3-small)
        →  Store in Supabase chunks table (pgvector)

Query   →  Embed query
        →  match_chunks() RPC (cosine similarity)
        →  Build context from top-k chunks
        →  Stream GPT response (SSE)
        →  Save messages to Supabase
```

---

## Quick Start

### 1. Prerequisites

- Python 3.11+
- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- An [OpenAI](https://platform.openai.com) API key

### 2. Clone & configure

```bash
git clone <repo> && cd rag-app
cp .env.example .env
# Edit .env with your Supabase + OpenAI credentials
```

### 3. Set up Supabase schema

1. Go to **Supabase Dashboard → SQL Editor**
2. Paste and run the contents of `infra/supabase_schema.sql`

This creates:
- `documents` — uploaded file metadata
- `chunks` — text chunks with `vector(1536)` embeddings
- `chats` — chat sessions
- `messages` — conversation history
- `match_chunks()` — pgvector similarity search RPC

### 4. Install dependencies

```bash
make install
```

### 5. Run locally

```bash
make dev
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://127.0.0.1:8000
- **API Docs:** http://127.0.0.1:8000/docs

---

## Docker

```bash
make docker-up    # start all services
make docker-logs  # tail logs
make docker-down  # stop
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/upload` | Upload a document (background processing) |
| `GET` | `/api/v1/documents` | List uploaded documents |
| `DELETE` | `/api/v1/documents/{id}` | Delete a document + its chunks |
| `POST` | `/api/v1/chat` | Stream a RAG response (SSE) |
| `GET` | `/api/v1/history` | List all chat sessions |
| `POST` | `/api/v1/history` | Create a new chat session |
| `GET` | `/api/v1/history/{id}` | Get chat + messages |
| `PATCH` | `/api/v1/history/{id}` | Rename a chat |
| `DELETE` | `/api/v1/history/{id}` | Delete a chat |

### Streaming Chat — SSE Event Format

```
data: {"type": "sources", "data": [{document_name, content, similarity, ...}]}
data: {"type": "token",   "data": "Hello"}
data: {"type": "token",   "data": " world"}
data: {"type": "done",    "data": {"chat_id": "uuid"}}
data: {"type": "error",   "data": "Error message"}
```

---

## Configuration

All config is via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | Required |
| `SUPABASE_URL` | — | Required |
| `SUPABASE_SERVICE_KEY` | — | Required (service role) |
| `LLM_MODEL` | `gpt-4o-mini` | OpenAI chat model |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model |
| `CHUNK_SIZE` | `1024` | Tokens per chunk |
| `CHUNK_OVERLAP` | `128` | Overlap between chunks |
| `TOP_K` | `5` | Retrieved chunks per query |
| `SIMILARITY_THRESHOLD` | `0.5` | Minimum cosine similarity |
| `MAX_FILE_SIZE_MB` | `50` | Max upload size |

---

## Testing

```bash
make test-backend   # pytest
make test-frontend  # jest
```

---

## Extending to Production

1. **Auth** — Add Supabase Auth + RLS policies to scope documents/chats per user
2. **Rate limiting** — Add `slowapi` middleware to FastAPI
3. **Observability** — Add structured logging + Sentry
4. **Hybrid search** — Add full-text search (`tsvector`) alongside vector search
5. **Reranking** — Add a cross-encoder reranker (e.g. Cohere rerank) after retrieval
6. **Multi-tenancy** — Partition `documents` + `chunks` by `user_id`
7. **CDN** — Serve Next.js from Vercel; deploy FastAPI to Railway/Fly.io
