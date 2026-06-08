-- Migration 012: Backfill projects from existing quotes
-- Quotes saved before the project link existed have project_id = NULL, so the
-- dashboard shows nothing. Create one pricing_project per client (grouped by
-- client_code) and link that client's quotes to it. No recalculation: the
-- dashboard reads financials straight from each quote's existing snapshots.
-- Run: psql $DATABASE_URL -f fastapi-project/migrations/012_backfill_projects_from_quotes.sql
--
-- Status is derived from the client's quotes: any active -> active,
-- else any signed/accepted -> signed, else potential. status_source='automatic'.
-- Re-runnable: once quotes are linked the loop body matches zero rows.

DO $$
DECLARE
  c RECORD;
  new_id INTEGER;
BEGIN
  FOR c IN
    SELECT client_code,
           MIN(created_by) AS created_by,
           (ARRAY_AGG(client_name ORDER BY created_at DESC))[1] AS client_name,
           CASE
             WHEN bool_or(status = 'active') THEN 'active'
             WHEN bool_or(status IN ('signed', 'accepted')) THEN 'signed'
             ELSE 'potential'
           END AS status,
           MIN(created_at) FILTER (
             WHERE status IN ('signed', 'active', 'accepted')
           ) AS signed_at
    FROM quotes
    WHERE project_id IS NULL
    GROUP BY client_code
  LOOP
    INSERT INTO pricing_projects (name, created_by, status, status_source, signed_at)
    VALUES (c.client_name, c.created_by, c.status, 'automatic', c.signed_at)
    RETURNING id INTO new_id;

    UPDATE quotes
       SET project_id = new_id
     WHERE project_id IS NULL
       AND client_code = c.client_code;
  END LOOP;
END $$;
