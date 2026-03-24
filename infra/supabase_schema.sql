-- ============================================================
-- RAG App — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Documents ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(500)  NOT NULL,
    file_type   VARCHAR(100)  NOT NULL,
    file_size   INTEGER       NOT NULL,          -- bytes
    status      VARCHAR(50)   NOT NULL DEFAULT 'processing',
    -- status: processing | ready | failed
    metadata    JSONB         NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Chunks (with pgvector embeddings) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chunks (
    id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content      TEXT    NOT NULL,
    embedding    vector(1536),            -- OpenAI text-embedding-3-small
    chunk_index  INTEGER NOT NULL,
    metadata     JSONB   NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IVFFlat index for fast approximate nearest-neighbour search.
-- Tune `lists` based on total row count: lists ≈ sqrt(N).
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
    ON chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);

-- ── Chats ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chats (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER chats_updated_at
    BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Messages ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id     UUID        NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content     TEXT        NOT NULL,
    metadata    JSONB       NOT NULL DEFAULT '{}',   -- stores sources, tokens used, etc.
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON messages(chat_id);

-- ── Vector similarity search function ────────────────────────────────────────
-- Used by the backend's rag_service.py via supabase.rpc('match_chunks', {...})

CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding  vector(1536),
    match_threshold  FLOAT          DEFAULT 0.5,
    match_count      INT            DEFAULT 5
)
RETURNS TABLE (
    id             UUID,
    document_id    UUID,
    document_name  VARCHAR(500),
    content        TEXT,
    metadata       JSONB,
    chunk_index    INTEGER,
    similarity     FLOAT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        c.id,
        c.document_id,
        d.name       AS document_name,
        c.content,
        c.metadata,
        c.chunk_index,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE
        d.status = 'ready'
        AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- ── Row Level Security (enable for production) ────────────────────────────────
-- Uncomment and configure for multi-tenant / auth-gated deployments.

-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chunks    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chats     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages  ENABLE ROW LEVEL SECURITY;

-- ── Sample seed data (optional) ───────────────────────────────────────────────
-- INSERT INTO chats (title) VALUES ('Getting started');
