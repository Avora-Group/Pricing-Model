-- Migration 011: Quote lifecycle becomes draft -> sent -> signed -> active (or rejected)
-- 'accepted' is renamed to 'signed' (matches how the sales team talks about deals);
-- 'active' marks a signed deal currently in operation.
-- Run: psql $DATABASE_URL -f fastapi-project/migrations/011_quote_status_signed_active.sql
--
-- The CHECK from migration 004 was inline on the status column, auto-named
-- quotes_status_check. Drop, migrate data, re-add. Re-runnable: the UPDATE
-- matches zero rows on a second pass.

ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_status_check;

UPDATE quotes SET status = 'signed' WHERE status = 'accepted';

ALTER TABLE quotes
  ADD CONSTRAINT quotes_status_check
    CHECK (status IN ('draft', 'sent', 'signed', 'active', 'rejected'));
