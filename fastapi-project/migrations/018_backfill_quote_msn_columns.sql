-- Migration 018: Backfill the MSN-input columns added in 017 for quotes saved
-- before those columns existed. Values are extracted from the msn_input JSONB
-- (camelCase keys). For seasonal MSNs the per-month figures (mgh/acmi/cycle)
-- fall back to the summer season. Numeric casts are regex-guarded so a stray
-- non-numeric value can never fail the migration. Only unpopulated rows change.

UPDATE quote_msn_snapshots SET
    mgh = (
        SELECT CASE WHEN v ~ '^-?[0-9]+(\.[0-9]+)?$' THEN v::numeric END
        FROM (SELECT COALESCE(NULLIF(msn_input->>'mgh',''), NULLIF(msn_input->'summer'->>'mgh','')) AS v) s
    ),
    acmi_rate = (
        SELECT CASE WHEN v ~ '^-?[0-9]+(\.[0-9]+)?$' THEN v::numeric END
        FROM (SELECT COALESCE(NULLIF(msn_input->>'acmiRate',''), NULLIF(msn_input->'summer'->>'acmiRate','')) AS v) s
    ),
    cycle_ratio = (
        SELECT CASE WHEN v ~ '^-?[0-9]+(\.[0-9]+)?$' THEN v::numeric END
        FROM (SELECT COALESCE(NULLIF(msn_input->>'cycleRatio',''), NULLIF(msn_input->'summer'->>'cycleRatio','')) AS v) s
    ),
    crew_sets = (
        SELECT CASE WHEN v ~ '^-?[0-9]+(\.[0-9]+)?$' THEN v::numeric END
        FROM (SELECT NULLIF(msn_input->>'crewSets','') AS v) s
    ),
    environment = msn_input->>'environment',
    lease_type = msn_input->>'leaseType',
    rate_currency = msn_input->>'rateCurrency',
    mgh_mode = msn_input->>'mghMode'
WHERE mgh IS NULL;
