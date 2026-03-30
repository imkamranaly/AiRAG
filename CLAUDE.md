# AiRAG — Project-Wide Claude Instructions

## Project Overview

Full-stack Retrieval-Augmented Generation (RAG) chatbot. Users upload documents (PDF, DOCX, TXT, MD) and ask questions; answers are grounded in the uploaded content via GPT-4o-mini.

**Active DB migration**: pgvector/PostgreSQL (current) → OpenSearch k-NN (target) for vector and document search. PostgreSQL stays for relational data (chats, messages).

## Stack

| Layer       | Technology                                                  |
|-------------|-------------------------------------------------------------|
| Backend     | FastAPI 0.111+, Python 3.11, asyncpg, uvicorn               |
| Frontend    | Next.js 14 App Router, TypeScript (strict), React 18, Zustand |
| Vector DB   | OpenSearch 2.x (target) — `opensearch-py` async client      |
| Relational  | PostgreSQL 16 + pgvector (current) — chats & messages stay here |
| LLM         | OpenAI GPT-4o-mini via LlamaIndex                           |
| Embeddings  | OpenAI text-embedding-3-small (1536 dims)                   |
| Parsing     | pypdf, python-docx, LlamaIndex SentenceSplitter             |
| Infra       | Docker Compose, Makefile                                    |

## Repository Layout

```
AiRAG/
├── backend/
│   ├── app/
│   │   ├── core/          config.py · db.py (asyncpg pool) · opensearch.py (target)
│   │   ├── models/        schemas.py — all Pydantic v2 models
│   │   ├── routes/        upload.py · chat.py · history.py
│   │   ├── services/      data.py · rag_service.py · embedding_service.py
│   │   │                  document_service.py · history_service.py
│   │   └── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── tests/
├── frontend/
│   ├── app/               page.tsx · layout.tsx
│   ├── components/        chat/ · sidebar/ · upload/
│   ├── lib/               api.ts — all API calls live here
│   ├── store/             chatStore.ts — Zustand global state
│   └── types/             index.ts — all TypeScript types
├── infra/
│   ├── schema.sql          PostgreSQL schema (documents, chunks, chats, messages)
│   └── supabase_schema.sql
├── .specs/                 ← spec files live here (git-tracked)
├── docker-compose.yml
├── Makefile
└── CLAUDE.md  ← you are here
```

## Running the Project

```bash
# Full stack via Docker
docker compose up --build

# Local dev (separate terminals)
cd backend && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev

# Useful make targets
make dev        # frontend + backend in parallel
make docker-up  # docker compose up -d
make test       # pytest + jest
make lint       # ruff + eslint
```

## Environment Variables

All vars are in `.env` at the repo root (loaded by Docker Compose automatically).

| Variable | Where used |
|----------|-----------|
| `DATABASE_URL` | backend asyncpg pool |
| `OPENAI_API_KEY` | embeddings + LLM |
| `OPENSEARCH_URL` | backend OpenSearch client (target) |
| `APP_ENV` | backend config |
| `CORS_ORIGINS` | FastAPI CORS middleware |
| `NEXT_PUBLIC_API_URL` | frontend fetch base URL (baked at build time) |

## Spec-Driven Development Workflow

Before writing any non-trivial code, generate a spec first:

```
/spec-backend  "description"  → .specs/backend-<name>.md
/spec-frontend "description"  → .specs/frontend-<name>.md
/spec-opensearch "description" → .specs/opensearch-<name>.md
```

Review the spec, set `Status: approved`, then:

```
/implement .specs/<name>.md   → writes all code, marks spec implemented
```

Fast-path scaffolding (skips spec):
```
/scaffold-route <resource>
/scaffold-component <ComponentName> [folder]
/scaffold-opensearch-index <index-name>
```

## Global Conventions

- **Never break existing code.** Read files before editing. Append; don't overwrite.
- **No inline types** on the frontend — all types go in `frontend/types/index.ts`.
- **No raw fetch in components** — all API calls go through `frontend/lib/api.ts`.
- **No `.venv` or `node_modules`** in context — ignore those paths completely.
- **Async throughout** — `async def` on all backend service functions; `asyncpg`/`opensearch-py` async clients only.
