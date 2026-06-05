-- Migration 008: Add project lifecycle status + provenance to pricing_projects
-- Phase 6: Project Schema Foundation (PROJ-01, PROJ-05)
-- Run: psql $DATABASE_URL -f fastapi-project/migrations/008_add_project_status.sql
--
-- status:        'potential' (default) or 'signed' -- the project lifecycle state.
-- status_source: 'manual' (default) or 'automatic' -- who set the current status.
--                Phase 7's auto-sign guard relies on this (WHERE status_source <> 'manual').
-- signed_at:     NULL while potential, set to the timestamp the project first transitions
--                to 'signed', and not overwritten on subsequent signs (enforcement is
--                Phase 7/9). Stays NULL for potential rows -- no DEFAULT.
--
-- The column DEFAULTs backfill every existing row at ALTER time; no separate UPDATE needed.

ALTER TABLE pricing_projects
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'potential'
    CHECK (status IN ('potential', 'signed'));

ALTER TABLE pricing_projects
  ADD COLUMN IF NOT EXISTS status_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (status_source IN ('automatic', 'manual'));

ALTER TABLE pricing_projects
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pricing_projects_status
  ON pricing_projects(status);
