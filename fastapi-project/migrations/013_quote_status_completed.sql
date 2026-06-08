-- Migration 013: Add 'completed' quote status for finished deals
-- Lifecycle: draft -> sent -> signed -> active -> completed (or rejected).
-- Run: psql $DATABASE_URL -f fastapi-project/migrations/013_quote_status_completed.sql
-- Re-runnable: DROP IF EXISTS + ADD.

ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_status_check;

ALTER TABLE quotes
  ADD CONSTRAINT quotes_status_check
    CHECK (status IN ('draft', 'sent', 'signed', 'active', 'completed', 'rejected'));
