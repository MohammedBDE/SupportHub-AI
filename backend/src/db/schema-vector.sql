BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE knowledge_base
    ADD COLUMN IF NOT EXISTS embedding vector(1024);

ALTER TABLE knowledge_base
    ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding
    ON knowledge_base USING hnsw (embedding vector_cosine_ops);

COMMIT;
