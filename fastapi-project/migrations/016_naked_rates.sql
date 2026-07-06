-- Migration 016: Naked rates (parallel cost basis)
--
-- Adds a second, "naked" set of cost rates alongside the existing "current"
-- rates for aircraft that have them (currently 6 MSNs). Naked figures are only
-- ever exposed to users with cost access; the API gates them server-side.
--
-- Storage model:
--   * aircraft_rates gains nullable naked_* columns (one row per aircraft still).
--   * epr_matrix_rows gains a rate_type discriminator ('current' | 'naked') so an
--     aircraft can hold two independent interpolation tables. The uniqueness key
--     becomes (aircraft_id, rate_type, cycle_ratio).
--   * has_naked_rates flags which aircraft expose a naked basis (drives the
--     Current/Naked toggle + naked section visibility on the frontend).

-- --- aircraft_rates: naked columns ---
ALTER TABLE aircraft_rates
    ADD COLUMN IF NOT EXISTS has_naked_rates          BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS naked_lease_rent_usd      NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS naked_six_year_check_usd  NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS naked_twelve_year_check_usd NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS naked_ldg_usd             NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS naked_apu_rate_usd        NUMERIC(10,4),
    ADD COLUMN IF NOT EXISTS naked_llp1_rate_usd       NUMERIC(10,4),
    ADD COLUMN IF NOT EXISTS naked_llp2_rate_usd       NUMERIC(10,4),
    ADD COLUMN IF NOT EXISTS naked_epr_escalation      NUMERIC(6,4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS naked_llp_escalation      NUMERIC(6,4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS naked_af_apu_escalation   NUMERIC(6,4) DEFAULT 0;

-- --- epr_matrix_rows: rate_type discriminator ---
ALTER TABLE epr_matrix_rows
    ADD COLUMN IF NOT EXISTS rate_type TEXT NOT NULL DEFAULT 'current';

-- Swap the uniqueness key to include rate_type so current + naked tables coexist.
ALTER TABLE epr_matrix_rows DROP CONSTRAINT IF EXISTS epr_matrix_rows_aircraft_id_cycle_ratio_key;
ALTER TABLE epr_matrix_rows DROP CONSTRAINT IF EXISTS epr_matrix_rows_aircraft_id_rate_type_cycle_ratio_key;
ALTER TABLE epr_matrix_rows
    ADD CONSTRAINT epr_matrix_rows_aircraft_id_rate_type_cycle_ratio_key
    UNIQUE (aircraft_id, rate_type, cycle_ratio);

CREATE INDEX IF NOT EXISTS idx_epr_matrix_aircraft_type
    ON epr_matrix_rows(aircraft_id, rate_type, cycle_ratio);
