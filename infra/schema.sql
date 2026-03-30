-- ============================================================
-- RAG App — PostgreSQL Schema
-- Chunks are stored in OpenSearch; this schema covers relational data only.
--
-- Run once against your database:
--   psql $DATABASE_URL -f infra/schema.sql
-- ============================================================

-- ── Shared trigger function ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Documents ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(500) NOT NULL,
    file_type   VARCHAR(100) NOT NULL,
    file_size   INTEGER      NOT NULL,
    status      VARCHAR(50)  NOT NULL DEFAULT 'processing', -- processing | ready | failed
    metadata    JSONB        NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Chats ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chats (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(500),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER chats_updated_at
    BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Messages ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id     UUID         NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role        VARCHAR(20)  NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content     TEXT         NOT NULL,
    metadata    JSONB        NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON messages(chat_id);

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
