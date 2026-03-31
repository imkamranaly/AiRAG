# AiRAG — Document Q&A with RAG

A full-stack Retrieval-Augmented Generation chatbot. Upload documents and ask questions — answers are grounded in your content, streamed in real time.

![Stack](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat&logo=fastapi)
![Stack](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)
![Stack](https://img.shields.io/badge/OpenSearch-2.13-003BFF?style=flat&logo=opensearch)
![Stack](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=flat&logo=openai)
![Stack](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker)

---

## Features

- Upload **PDF, DOCX, TXT, MD** files — processed in the background
- Semantic search via **OpenSearch k-NN** (HNSW vector index)
- Streaming responses with **Server-Sent Events**
- Full **chat history** with rename/delete
- Conversational queries handled naturally (greetings, general questions)
- One-command setup with **Docker Compose**

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router · TypeScript · Zustand · Tailwind CSS |
| Backend | FastAPI 0.111 · Python 3.11 · asyncpg · LlamaIndex |
| Vector DB | OpenSearch 2.13 — HNSW k-NN (nmslib, cosinesimil) |
| Relational DB | PostgreSQL 16 — documents, chats, messages |
| LLM | OpenAI GPT-4o-mini |
| Embeddings | OpenAI text-embedding-3-small (1536 dims) |
| Infra | Docker Compose |

---

## Architecture

```
AiRAG/
├── backend/
│   ├── app/
│   │   ├── core/          # config · db (asyncpg) · opensearch client
│   │   ├── models/        # Pydantic v2 schemas
│   │   ├── routes/        # upload · chat · history
│   │   └── services/      # document · rag · embedding · history
│   └── Dockerfile
├── frontend/
│   ├── app/               # Next.js App Router pages
│   ├── components/        # Chat · Sidebar · Upload
│   ├── lib/api.ts         # All API calls
│   └── store/             # Zustand global state
├── infra/
│   └── schema.sql         # PostgreSQL schema
├── docker-compose.yml
└── Makefile
```

---

## RAG Pipeline

**Injection (Upload)**
```
Upload file
  → Extract text (pypdf / python-docx / plain text)
  → Chunk with LlamaIndex SentenceSplitter (1024 tokens, 128 overlap)
  → Embed with text-embedding-3-small (batch)
  → Bulk index into OpenSearch rag-chunks
  → Mark document ready in PostgreSQL
```

**Retrieval (Chat)**
```
User query
  → Embed query
  → k-NN search in OpenSearch (top-5, cosine similarity ≥ 0.2)
  → Filter to ready documents via PostgreSQL metadata
  → Inject top chunks as context into GPT-4o-mini
  → Stream response tokens via SSE
```

---

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose)
- OpenAI API key

### 1. Clone & configure

```bash
git clone https://github.com/imkamranaly/AiRAG.git
cd AiRAG
```

Create `backend/.env`:
```env
DATABASE_URL=postgresql://raguser:ragpassword@postgres:5432/ragdb
OPENSEARCH_URL=http://opensearch:9200
OPENAI_API_KEY=sk-...
APP_ENV=production
CORS_ORIGINS=["*"]
```

Create `frontend/.env`:
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### 2. Run with Docker

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| OpenSearch | http://localhost:9200 |

### 3. Run locally (without Docker)

```bash
# Terminal 1 — Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

> PostgreSQL and OpenSearch still need to be running (via Docker or locally).

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/upload` | Upload a document |
| `GET` | `/api/v1/documents` | List uploaded documents |
| `DELETE` | `/api/v1/documents/{id}` | Delete a document |
| `POST` | `/api/v1/chat` | Stream RAG response (SSE) |
| `GET` | `/api/v1/history` | List chat sessions |
| `POST` | `/api/v1/history` | Create chat session |
| `GET` | `/api/v1/history/{id}` | Get chat + messages |
| `PATCH` | `/api/v1/history/{id}` | Rename chat |
| `DELETE` | `/api/v1/history/{id}` | Delete chat |

### SSE Stream Format

```
data: {"type": "sources", "data": [{"document_name": "...", "content": "...", "similarity": 0.82}]}
data: {"type": "token",   "data": "Hello"}
data: {"type": "token",   "data": " world"}
data: {"type": "done",    "data": ""}
data: {"type": "error",   "data": "..."}
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | Required |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `OPENSEARCH_URL` | `http://localhost:9200` | OpenSearch endpoint |
| `LLM_MODEL` | `gpt-4o-mini` | OpenAI chat model |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model |
| `CHUNK_SIZE` | `1024` | Tokens per chunk |
| `CHUNK_OVERLAP` | `128` | Overlap between chunks |
| `TOP_K` | `5` | Chunks retrieved per query |
| `SIMILARITY_THRESHOLD` | `0.2` | Minimum cosine similarity |
| `MAX_FILE_SIZE_MB` | `50` | Max upload size |

---

## Makefile Commands

```bash
make dev          # Run frontend + backend in parallel
make docker-up    # docker compose up -d
make docker-down  # docker compose down
make test         # pytest + jest
make lint         # ruff + eslint
```

---

## Built With

- [FastAPI](https://fastapi.tiangolo.com/)
- [LlamaIndex](https://www.llamaindex.ai/)
- [OpenSearch](https://opensearch.org/)
- [Next.js](https://nextjs.org/)
- [OpenAI](https://platform.openai.com/)
