-- Migration 019: fleet on/off switch per aircraft, and saved company-default
-- crew / cost assumptions.
--
-- aircraft.is_active: switched-off aircraft stay in the database (existing
-- quotes still reference them) but cannot be picked in the pricing workspace
-- and are hidden from the dashboard fleet board.
--
-- assumption_sets: one JSONB document per kind ('crew' | 'costs') holding the
-- Crew / Costs page tables. These are the company defaults new quotes start
-- from; each saved quote keeps its own snapshot. No row = the app's built-in
-- defaults.

ALTER TABLE aircraft
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS assumption_sets (
    kind        TEXT PRIMARY KEY CHECK (kind IN ('crew', 'costs')),
    data        JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
);
