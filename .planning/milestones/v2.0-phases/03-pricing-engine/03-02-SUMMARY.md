---
phase: 03-pricing-engine
plan: 02
subsystem: calculation-engine
tags: [decimal, tdd, pricing, interpolation, acmi, pure-functions, dataclasses]

# Dependency graph
requires:
  - phase: 03-pricing-engine
    plan: 01
    provides: pricing_config/crew_config tables, Pydantic schemas, repositories, mock DB handlers
  - phase: 02-aircraft-master-data
    provides: aircraft_rates table with cost data, epr_matrix_rows table
provides:
  - Pure Python pricing calculation engine (service.py) for all 7 ACMI components
  - EPR interpolation with boundary clamping and linear interpolation
  - CREW_COMPOSITION lookup for 6 (aircraft_type x lease_type) combinations
  - calculate_pricing orchestrator producing ComponentBreakdown dataclass
  - calculate_project_pnl for multi-MSN weighted aggregation
  - 53 unit tests covering all component calculators, edge cases, and Decimal precision
  - 2 Excel-verified parametrized fixture scenarios with exact Decimal equality
affects: [03-03-pricing-api, 03-04-pnl-frontend, 03-05-crew-page, 04-quote-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure-function calculation service with zero I/O, dataclass-based internal types separate from Pydantic API schemas, bisect-based EPR interpolation, CREW_COMPOSITION lookup dict for type/lease combinations]

key-files:
  created:
    - fastapi-project/app/pricing/service.py
    - fastapi-project/tests/test_pricing_service.py
    - fastapi-project/tests/test_pricing_fixtures.py
  modified: []

key-decisions:
  - "AircraftCosts dataclass takes pre-interpolated epr_rate (not raw matrix) -- caller responsibility to interpolate before constructing"
  - "CREW_COMPOSITION uses dict values {pilots, senior, regular} instead of tuples for readability and self-documenting access"
  - "ComponentBreakdown is a local dataclass (not Pydantic) to keep service.py pure with zero external dependencies beyond stdlib"
  - "calculate_project_pnl accepts flat dicts (not ComponentBreakdown) for flexibility in aggregation from different sources"
  - "EPR matrix must be pre-filtered by environment (benign/hot) before passing to calculate_pricing -- environment column selection is caller responsibility"

patterns-established:
  - "Pure calculation service: all functions take Decimal inputs, return Decimal outputs, no I/O or side effects"
  - "TDD flow: RED commit (failing tests), GREEN commit (passing implementation), tests and code co-evolve"
  - "Excel fixture verification: _compute_expected_scenario() functions replicate Excel formulas in test code for exact comparison"
  - "Margin formula: final_rate = total_cost / (1 - margin_percent/100) -- industry-standard cost-plus margin"

requirements-completed: [PRIC-02, PRIC-03, PRIC-05, PRIC-06]

# Metrics
duration: 9min
completed: 2026-03-05
---

# Phase 3 Plan 2: Pricing Calculation Engine Summary

**TDD pricing engine with 7 ACMI component calculators, EPR interpolation, crew/lease matrix, and 2 Excel-verified fixture scenarios passing with exact Decimal equality**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-05T12:17:03Z
- **Completed:** 2026-03-05T12:27:01Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- Pure Python calculation engine (service.py, 310 lines) with all 7 ACMI component calculators using only decimal.Decimal -- zero float usage
- EPR interpolation handles all edge cases: exact match, linear interpolation between rows, boundary clamping, empty matrix ValueError, single-row matrix
- Crew cost varies correctly across all 6 combinations: A320/A321 x wet/damp/moist with ordering invariants verified (damp < moist < wet)
- 2 Excel-verified fixture scenarios (MSN 3055 wet/benign, MSN 3378 damp/hot) pass with exact Decimal equality on all 7 component breakdowns
- Full test suite: 112 tests green with zero regressions from prior phases

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests** - `77ebf6f` (test)
2. **Task 2 (GREEN): Implementation passing all tests** - `84d3993` (feat)

## Files Created/Modified
- `fastapi-project/app/pricing/service.py` - Pure calculation engine: AircraftCosts/PricingConfig/CrewConfig dataclasses, CREW_COMPOSITION lookup, interpolate_epr, 7 component calculators, calculate_pricing orchestrator, calculate_project_pnl aggregator
- `fastapi-project/tests/test_pricing_service.py` - 40+ unit tests: EPR interpolation (8 tests), crew composition (6 tests), component calculators (14 tests), margin/rate (4 tests), full orchestration (4 tests), project aggregation (4 tests)
- `fastapi-project/tests/test_pricing_fixtures.py` - Excel-verified fixtures: 2 parametrized scenarios with explicit formula documentation, plus margin and project aggregation integration tests

## Decisions Made
- AircraftCosts dataclass takes pre-interpolated epr_rate field rather than raw EPR matrix -- the caller (API layer in Plan 03) is responsible for interpolation before constructing the dataclass, keeping the calculation service pure
- CREW_COMPOSITION values are dicts ({"pilots": 2, "senior": 1, "regular": 3}) instead of tuples for self-documenting field access without positional indexing
- ComponentBreakdown is a local dataclass separate from the Pydantic schema in schemas.py -- the router layer converts between them, keeping service.py free of Pydantic dependency
- calculate_project_pnl accepts flat dicts rather than ComponentBreakdown objects for flexibility in aggregation scenarios
- EPR matrix environment filtering (benign_rate vs hot_rate column selection) is caller responsibility -- service receives pre-selected rate tuples

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rewrote pre-existing service.py with incompatible interface**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** A prior session had created an incomplete service.py with different dataclass fields (epr_escalation instead of epr_rate), tuple-based CREW_COMPOSITION, and different calculate_pricing signature
- **Fix:** Fully rewrote service.py with correct interface matching the TDD test specifications
- **Files modified:** fastapi-project/app/pricing/service.py
- **Verification:** All 53 pricing tests pass, full suite 112 tests green
- **Committed in:** 84d3993 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix for pre-existing incompatible code)
**Impact on plan:** Necessary to align implementation with TDD test contract. No scope creep.

## Issues Encountered
- Pre-existing service.py from a prior incomplete session had different dataclass fields and function signatures -- fully replaced with correct implementation matching TDD tests

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Calculation engine complete: Plan 03-03 (Pricing API) can import calculate_pricing, interpolate_epr, and all dataclasses
- AircraftCosts, PricingConfig, CrewConfig dataclasses define the API layer's data contract for converting DB records to calculation inputs
- Test infrastructure established: future API integration tests can use the same fixture data and expected values
- CREW_COMPOSITION exported for potential use in crew config validation

## Self-Check: PASSED

All 3 files verified present. Both task commits (77ebf6f, 84d3993) found in git log.

---
*Phase: 03-pricing-engine*
*Completed: 2026-03-05*
