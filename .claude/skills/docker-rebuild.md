---
name: docker-rebuild
description: Rebuild and restart Docker services cleanly. Use when code changes need to be reflected in running containers, or when containers are in a bad state.
---

Rebuild and restart the AiRAG Docker services.

## Usage

Argument (optional): which service to rebuild — `all`, `backend`, `frontend`, or `postgres`.
Defaults to `all` if no argument given.

## Steps

### Rebuild all services (default)
```bash
cd /home/kamran/AI-RAG/AiRAG

# Stop and remove containers (keep volumes to preserve DB data)
docker compose down

# Rebuild images and start
docker compose up --build -d

# Show live logs
docker compose logs -f
```

### Rebuild backend only (fastest — no DB data loss)
```bash
cd /home/kamran/AI-RAG/AiRAG
docker compose up --build -d backend
docker compose logs -f backend
```

### Rebuild frontend only
```bash
cd /home/kamran/AI-RAG/AiRAG
docker compose up --build -d frontend
docker compose logs -f frontend
```

### Full reset (destroys all data — use only when schema changed)
```bash
cd /home/kamran/AI-RAG/AiRAG
docker compose down -v          # -v removes named volumes (postgres_data, opensearch_data)
docker compose up --build -d
docker compose logs -f
```

## Health Checks

After rebuild, verify each service:

```bash
# PostgreSQL
docker exec airag_postgres psql -U raguser -d ragdb -c "\dt"

# Backend API
curl http://127.0.0.1:8000/health

# OpenSearch (if running)
curl http://localhost:9200/_cluster/health?pretty

# Frontend
curl -I http://localhost:3000
```

## Decision Tree

```
Code change in backend/app/ ?
  → docker compose up --build -d backend   (fast, ~30s)

Code change in frontend/ ?
  → docker compose up --build -d frontend  (slow due to Next.js build, ~2-3min)

Added new package to requirements.txt or package.json ?
  → docker compose up --build -d <service> (rebuilds the image layer)

Changed infra/schema.sql ?
  → docker compose down -v && docker compose up --build -d  (must wipe DB volume)

Changed docker-compose.yml (new service, new env var) ?
  → docker compose down && docker compose up --build -d

Containers in error loop or bad state ?
  → docker compose down && docker compose up --build -d
```

## Common Issues

| Symptom | Fix |
|---------|-----|
| `relation "chats" does not exist` | Schema not applied — run `docker compose down -v` then up |
| `OpenSearch client not initialised` | OpenSearch not healthy yet — check `docker compose logs opensearch` |
| Frontend exits with code 0 | Next.js build failed — check `docker compose logs frontend` for build errors |
| Backend `OPENAI_API_KEY` invalid | Update `.env`, then `docker compose up -d backend` (no rebuild needed) |
| Port already in use | `docker compose down` to stop old containers |
