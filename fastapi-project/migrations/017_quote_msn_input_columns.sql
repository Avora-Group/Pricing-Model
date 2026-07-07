-- Migration 017: Surface the main MSN inputs as first-class columns on
-- quote_msn_snapshots. These already live inside the msn_input JSONB blob; the
-- columns make them directly queryable/visible in the database. Populated on
-- save/update by the quotes repository (extracted from msn_input).

ALTER TABLE quote_msn_snapshots
    ADD COLUMN IF NOT EXISTS mgh          NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS acmi_rate    NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS cycle_ratio  NUMERIC(8,4),
    ADD COLUMN IF NOT EXISTS environment  TEXT,
    ADD COLUMN IF NOT EXISTS crew_sets    NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS lease_type   TEXT,
    ADD COLUMN IF NOT EXISTS rate_currency TEXT,
    ADD COLUMN IF NOT EXISTS mgh_mode     TEXT;
