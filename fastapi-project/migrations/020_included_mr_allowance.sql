-- Migration 020: Included-MR allowance + supplemental rates (MSN 5228)
--
-- Some leases (MSN 5228) charge one fixed monthly MR that covers all variable
-- MRs up to a monthly allowance of flight hours and cycles. Usage above the
-- allowance is charged at supplemental rates:
--   * excess FH  -> supplemental EPR matrix (interpolated on FH:FC), per engine
--   * excess FC  -> standard IAE LLP catalogue price per cycle, per engine
--
-- Storage:
--   * aircraft_rates.included_fh / included_fc: monthly allowance (NULL = the
--     aircraft has no allowance and pays usage-scaled MRs as normal).
--   * aircraft_rates.supp_llp_per_fc_usd: LLP catalogue price per excess cycle,
--     per engine.
--   * epr_matrix_rows.rate_type = 'supplemental': the excess-FH matrix.

ALTER TABLE aircraft_rates
    ADD COLUMN IF NOT EXISTS included_fh          NUMERIC(8,2),
    ADD COLUMN IF NOT EXISTS included_fc          NUMERIC(8,2),
    ADD COLUMN IF NOT EXISTS supp_llp_per_fc_usd  NUMERIC(10,4);

-- MSN 5228: 175,000/mo fixed MR covers up to 250 FH and 125 FC per month.
UPDATE aircraft_rates r
   SET included_fh = 250,
       included_fc = 125,
       supp_llp_per_fc_usd = 366.15,
       updated_at = NOW()
  FROM aircraft a
 WHERE a.id = r.aircraft_id AND a.msn = 5228;

-- Supplemental EPR matrix for MSN 5228 (USD per excess FH, per engine).
INSERT INTO epr_matrix_rows (aircraft_id, rate_type, cycle_ratio, benign_rate, hot_rate)
SELECT a.id, 'supplemental', v.cr, v.benign, v.hot
  FROM aircraft a
 CROSS JOIN (VALUES
        (0.99, 800.00, 900.00),
        (1.99, 700.00, 800.00),
        (2.99, 600.00, 700.00),
        (4.00, 500.00, 600.00)
 ) AS v(cr, benign, hot)
 WHERE a.msn = 5228
ON CONFLICT (aircraft_id, rate_type, cycle_ratio) DO UPDATE SET
    benign_rate = EXCLUDED.benign_rate,
    hot_rate = EXCLUDED.hot_rate;
