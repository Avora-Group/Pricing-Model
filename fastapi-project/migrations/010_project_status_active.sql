-- Migration 010: Allow 'active' as a project status
-- Dashboard & Project Pipeline: projects are 'potential' (pipeline), 'signed' (won),
-- or 'active' (currently in operation).
-- Run: psql $DATABASE_URL -f fastapi-project/migrations/010_project_status_active.sql
--
-- Migration 008 added status with an inline CHECK (status IN ('potential', 'signed')),
-- which Postgres auto-names pricing_projects_status_check. Drop and re-add with the
-- expanded value set. DROP IF EXISTS + ADD keeps the file re-runnable.

ALTER TABLE pricing_projects
  DROP CONSTRAINT IF EXISTS pricing_projects_status_check;

ALTER TABLE pricing_projects
  ADD CONSTRAINT pricing_projects_status_check
    CHECK (status IN ('potential', 'signed', 'active'));
