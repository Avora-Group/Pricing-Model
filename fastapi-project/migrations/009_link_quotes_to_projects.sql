-- Migration 009: Link quotes to projects via nullable FK
-- Phase 6: Project Schema Foundation (foundation for PROJ-03; wiring lands in Phase 7)
-- Run: psql $DATABASE_URL -f fastapi-project/migrations/009_link_quotes_to_projects.sql
--
-- project_id is NULLABLE -- existing quotes stay NULL (valid); standalone quotes remain
-- possible. ON DELETE defaults to NO ACTION so a linked quote blocks silent project
-- deletion. The wiring that populates project_id through the save flow is Phase 7 (PROJ-03);
-- this migration only lands the column so that wiring has something to write to.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES pricing_projects(id);

CREATE INDEX IF NOT EXISTS idx_quotes_project ON quotes(project_id);
