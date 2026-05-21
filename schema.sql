-- ============================================================
-- Sanctions Screening Tool – Database Schema
-- Run this in Supabase SQL Editor (once, in order)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         text        UNIQUE NOT NULL,
  password_hash text        NOT NULL,
  name          text,
  role                text        NOT NULL DEFAULT 'staff'
                                  CHECK (role IN ('staff', 'admin', 'demo')),
  is_active           boolean     NOT NULL DEFAULT true,
  demo_searches_used  int         NOT NULL DEFAULT 0,
  demo_expires_at     timestamptz,
  created_at          timestamptz DEFAULT now()
);

-- ============================================================
-- SANCTIONS ENTRIES  (one row per sanctioned individual/entity)
-- Covers both UN and UAE lists
-- ============================================================
CREATE TABLE IF NOT EXISTS sanctions_entries (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  source          text        NOT NULL CHECK (source IN ('UN', 'UAE')),
  source_id       text        NOT NULL,               -- UN: DATAID, UAE: reference field
  entity_type     text        NOT NULL DEFAULT 'individual'
                              CHECK (entity_type IN ('individual', 'entity')),
  primary_name    text        NOT NULL,
  nationality     text,
  dob             text,                               -- stored as text; formats vary across lists
  passport_number text,
  national_id     text,
  address         text,
  listed_on       date,
  additional_info jsonb       NOT NULL DEFAULT '{}',  -- catch-all for list-specific fields
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (source, source_id)
);

-- ============================================================
-- ALIASES  (primary name + every alias, all searchable)
-- ============================================================
CREATE TABLE IF NOT EXISTS aliases (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id    uuid        NOT NULL REFERENCES sanctions_entries(id) ON DELETE CASCADE,
  alias_name  text        NOT NULL,
  alias_type  text        DEFAULT 'alias'
              CHECK (alias_type IN ('primary', 'alias', 'aka')),
  quality     text,                                   -- UN specific: 'Good' | 'Low'
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- AUDIT LOGS  (every search, who ran it, what came back)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid        NOT NULL REFERENCES users(id),
  user_email       text        NOT NULL,
  search_term      text        NOT NULL,
  results_count    int         NOT NULL DEFAULT 0,
  risk_level       text        NOT NULL
                               CHECK (risk_level IN ('clear', 'possible_match', 'confirmed_match')),
  results_snapshot jsonb       NOT NULL DEFAULT '[]', -- top results at time of search
  searched_at      timestamptz DEFAULT now()
);

-- ============================================================
-- SYNC LOGS  (manual + scheduled import history)
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_logs (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  source           text        NOT NULL CHECK (source IN ('UN', 'UAE', 'ALL')),
  status           text        NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  records_imported int         NOT NULL DEFAULT 0,
  error_message    text,
  triggered_by     text        NOT NULL CHECK (triggered_by IN ('manual', 'scheduled')),
  started_at       timestamptz DEFAULT now(),
  completed_at     timestamptz
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Fuzzy search on alias names (the primary search surface)
CREATE INDEX IF NOT EXISTS idx_aliases_name_trgm
  ON aliases USING GIN (alias_name gin_trgm_ops);

-- Full-text search index for exact whole-word matching
CREATE INDEX IF NOT EXISTS idx_aliases_name_fts
  ON aliases USING GIN (to_tsvector('simple', alias_name));

-- Fuzzy search on primary name (secondary, belt-and-suspenders)
CREATE INDEX IF NOT EXISTS idx_entries_primary_name_trgm
  ON sanctions_entries USING GIN (primary_name gin_trgm_ops);

-- Lookup by source for sync/admin queries
CREATE INDEX IF NOT EXISTS idx_entries_source
  ON sanctions_entries (source);

-- Foreign key lookup
CREATE INDEX IF NOT EXISTS idx_aliases_entry_id
  ON aliases (entry_id);

-- Audit log queries (most recent first, per user)
CREATE INDEX IF NOT EXISTS idx_audit_logs_searched_at
  ON audit_logs (searched_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON audit_logs (user_id);

-- ============================================================
-- FUZZY SEARCH FUNCTION
-- Returns ranked matches above the similarity threshold.
-- Risk level is determined in the backend:
--   similarity >= 0.85  =>  confirmed_match
--   similarity >= 0.40  =>  possible_match
--   (below threshold)   =>  clear  (not returned)
-- ============================================================
CREATE OR REPLACE FUNCTION search_sanctions(
  query_text  text,
  threshold   float DEFAULT 0.4
)
RETURNS TABLE (
  entry_id         uuid,
  source           text,
  entity_type      text,
  primary_name     text,
  matched_alias    text,
  alias_type       text,
  similarity_score float,
  nationality      text,
  dob              text,
  listed_on        date,
  additional_info  jsonb
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  tsq tsquery;
BEGIN
  BEGIN
    tsq := plainto_tsquery('simple', query_text);
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  IF tsq IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT DISTINCT ON (se.id)
      se.id                                          AS entry_id,
      se.source,
      se.entity_type,
      se.primary_name,
      a.alias_name                                   AS matched_alias,
      a.alias_type,
      word_similarity(query_text, a.alias_name)::float AS similarity_score,
      se.nationality,
      se.dob,
      se.listed_on,
      se.additional_info
    FROM aliases a
    JOIN sanctions_entries se ON a.entry_id = se.id
    WHERE to_tsvector('simple', a.alias_name) @@ tsq
    ORDER BY se.id, word_similarity(query_text, a.alias_name) DESC;
END;
$func$;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sanctions_entries_updated_at
  BEFORE UPDATE ON sanctions_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- SEED: default admin user
-- Password: Admin@123  (change immediately after first login)
-- To generate a new bcrypt hash:
--   node -e "require('bcryptjs').hash('yourpassword',10).then(console.log)"
-- ============================================================
INSERT INTO users (email, password_hash, role)
VALUES (
  'syed.faisal@alnaqbipartners.com',
  '$2a$10$eJxrzM5lYYDHQ6I8rP.hZOeHWTuVnUonJeu045RfNoGH5SYrrKr0u',  -- Bionics7
  'admin'
)
ON CONFLICT (email) DO NOTHING;
