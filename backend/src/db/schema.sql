BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;


CREATE TABLE users (
    id              BIGSERIAL   PRIMARY KEY,
    email           CITEXT      NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    full_name       TEXT        NOT NULL,
    role            TEXT        NOT NULL DEFAULT 'agent',
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT users_role_valid
        CHECK (role IN ('agent', 'admin')),

    CONSTRAINT users_email_shape
        CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),

    CONSTRAINT users_full_name_not_blank
        CHECK (length(trim(full_name)) > 0)
);


CREATE TABLE tickets (
    id                BIGSERIAL   PRIMARY KEY,
    created_by        BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    assigned_to       BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    customer_name     TEXT        NOT NULL,
    customer_email    CITEXT,
    subject           TEXT        NOT NULL,
    body              TEXT        NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'open',
    priority          TEXT,
    category          TEXT,
    ai_confidence     NUMERIC(4,3),
    ai_classified_at  TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,
    closed_at         TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT tickets_status_valid
        CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),

    CONSTRAINT tickets_priority_valid
        CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'urgent')),

    CONSTRAINT tickets_category_valid
        CHECK (category IS NULL OR category IN ('billing', 'technical', 'account', 'other')),

    CONSTRAINT tickets_ai_confidence_range
        CHECK (ai_confidence IS NULL OR ai_confidence BETWEEN 0 AND 1),

    CONSTRAINT tickets_customer_name_not_blank
        CHECK (length(trim(customer_name)) > 0),

    CONSTRAINT tickets_subject_not_blank
        CHECK (length(trim(subject)) > 0),

    CONSTRAINT tickets_body_not_blank
        CHECK (length(trim(body)) > 0),

    CONSTRAINT tickets_closed_after_created
        CHECK (closed_at IS NULL OR closed_at >= created_at)
);


CREATE TABLE replies (
    id                 BIGSERIAL   PRIMARY KEY,
    ticket_id          BIGINT      NOT NULL
                                   REFERENCES tickets(id) ON DELETE CASCADE,
    author_id          BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    body               TEXT        NOT NULL,
    is_internal_note   BOOLEAN     NOT NULL DEFAULT FALSE,
    was_ai_suggested   BOOLEAN     NOT NULL DEFAULT FALSE,
    ai_suggestion_text TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT replies_body_not_blank
        CHECK (length(trim(body)) > 0),

    CONSTRAINT replies_ai_fields_consistent
        CHECK (
            (was_ai_suggested = FALSE AND ai_suggestion_text IS NULL)
            OR
            (was_ai_suggested = TRUE  AND ai_suggestion_text IS NOT NULL)
        )
);


CREATE TABLE knowledge_base (
    id              BIGSERIAL   PRIMARY KEY,
    created_by      BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    title           TEXT        NOT NULL,
    content         TEXT        NOT NULL,
    category        TEXT,
    tags            TEXT[]      NOT NULL DEFAULT '{}',
    is_published    BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    search_document TSVECTOR    GENERATED ALWAYS AS (
        to_tsvector(
            'english',
            coalesce(title, '') || ' ' || coalesce(content, '')
        )
    ) STORED,

    CONSTRAINT kb_title_not_blank
        CHECK (length(trim(title)) > 0),

    CONSTRAINT kb_content_not_blank
        CHECK (length(trim(content)) > 0),

    CONSTRAINT kb_category_valid
        CHECK (category IS NULL OR category IN ('billing', 'technical', 'account', 'other'))
);


CREATE INDEX idx_replies_ticket_created ON replies (ticket_id, created_at);

CREATE INDEX idx_replies_author ON replies (author_id);

CREATE INDEX idx_tickets_creator_created ON tickets (created_by, created_at DESC);

CREATE INDEX idx_tickets_assignee_created ON tickets (assigned_to, created_at DESC);

CREATE INDEX idx_tickets_created_at ON tickets (created_at DESC);

CREATE INDEX idx_tickets_open_created
    ON tickets (created_at DESC)
    WHERE status IN ('open', 'in_progress');

CREATE INDEX idx_knowledge_base_search
    ON knowledge_base USING GIN (search_document);

COMMIT;
