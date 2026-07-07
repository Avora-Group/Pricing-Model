"""Quote repository for CRUD operations on quotes and MSN snapshots.

Extends BaseRepository with methods for quote creation, listing,
retrieval, status updates, and atomic quote number generation.
All JSONB columns use DecimalEncoder for Decimal-safe serialization.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.db.base_repository import BaseRepository


class QuoteRepository(BaseRepository):
    """Repository for quotes, quote_msn_snapshots, and quote_sequences tables."""

    async def generate_quote_number(self, client_code: str) -> str:
        """Generate next sequential quote number for a client code.

        Uses INSERT ... ON CONFLICT DO UPDATE for atomic counter increment.
        Example output: EZJ-001, EZJ-002, RYR-001
        """
        row = await self.fetch_one(
            """INSERT INTO quote_sequences (client_code, last_seq)
               VALUES ($1, 1)
               ON CONFLICT (client_code)
               DO UPDATE SET last_seq = quote_sequences.last_seq + 1
               RETURNING last_seq""",
            client_code,
        )
        seq = row["last_seq"]
        return f"{client_code}-{seq:03d}"

    async def create_quote(
        self,
        quote_number: str,
        client_name: str,
        client_code: str,
        created_by: int,
        exchange_rate: Decimal,
        margin_percent: Decimal,
        total_eur_per_bh: Decimal | None,
        msn_list: list[int],
        period_start: str | None,
        period_end: str | None,
        pricing_config_snapshot: dict,
        crew_config_snapshot: dict,
        costs_config_snapshot: dict,
        dashboard_state: dict,
        project_id: int | None = None,
    ) -> dict:
        """Insert a new quote with JSONB snapshots. Returns the created row."""
        return await self.fetch_one(
            """INSERT INTO quotes (
                quote_number, client_name, client_code, created_by,
                exchange_rate, margin_percent, total_eur_per_bh,
                msn_list, period_start, period_end,
                pricing_config_snapshot, crew_config_snapshot,
                costs_config_snapshot, dashboard_state, project_id
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15
            ) RETURNING *""",
            quote_number, client_name, client_code, created_by,
            exchange_rate, margin_percent, total_eur_per_bh,
            msn_list, period_start, period_end,
            pricing_config_snapshot,
            crew_config_snapshot,
            costs_config_snapshot,
            dashboard_state,
            project_id,
        )

    async def create_msn_snapshot(
        self,
        quote_id: int,
        msn: int,
        aircraft_type: str,
        aircraft_id: int,
        msn_input: dict,
        breakdown: dict,
        monthly_pnl: dict,
        monthly_cost: Decimal | None,
        monthly_revenue: Decimal | None,
    ) -> dict:
        """Insert a per-MSN snapshot for a quote. Returns the created row.

        The main inputs are also written to dedicated columns (extracted from
        msn_input) so they're directly queryable in the database.
        """
        def _num(v):
            try:
                return Decimal(str(v)) if v not in (None, "") else None
            except Exception:
                return None

        # For seasonal MSNs the per-month figures live under summer/winter; fall
        # back to those so the columns aren't blank.
        season = msn_input.get("summer") if msn_input.get("seasonalityEnabled") else None
        def _field(key):
            v = msn_input.get(key)
            if (v in (None, "")) and isinstance(season, dict):
                v = season.get(key)
            return v

        return await self.fetch_one(
            """INSERT INTO quote_msn_snapshots (
                quote_id, msn, aircraft_type, aircraft_id,
                msn_input, breakdown, monthly_pnl,
                monthly_cost, monthly_revenue,
                mgh, acmi_rate, cycle_ratio, environment,
                crew_sets, lease_type, rate_currency, mgh_mode
            ) VALUES (
                $1, $2, $3, $4,
                $5::jsonb, $6::jsonb, $7::jsonb,
                $8, $9,
                $10, $11, $12, $13,
                $14, $15, $16, $17
            ) RETURNING *""",
            quote_id, msn, aircraft_type, aircraft_id,
            msn_input,
            breakdown,
            monthly_pnl,
            monthly_cost, monthly_revenue,
            _num(_field("mgh")), _num(_field("acmiRate")), _num(_field("cycleRatio")),
            msn_input.get("environment"),
            _num(msn_input.get("crewSets")), msn_input.get("leaseType"),
            msn_input.get("rateCurrency"), msn_input.get("mghMode"),
        )

    async def list_quotes(
        self,
        search: str | None = None,
        status: str | None = None,
        msn: int | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        """List quotes with optional search, status, and MSN filters.

        Search matches against client_name (ILIKE) or quote_number (ILIKE).
        MSN filter uses GIN index on msn_list for array containment.
        Results ordered by created_at DESC with LIMIT/OFFSET pagination.
        """
        conditions: list[str] = []
        params: list[Any] = []
        idx = 1

        if search:
            conditions.append(
                f"(client_name ILIKE ${idx} OR quote_number ILIKE ${idx})"
            )
            params.append(f"%{search}%")
            idx += 1

        if status:
            conditions.append(f"status = ${idx}")
            params.append(status)
            idx += 1

        if msn is not None:
            conditions.append(f"msn_list @> ARRAY[${idx}]::INTEGER[]")
            params.append(msn)
            idx += 1

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        params.extend([limit, offset])
        query = f"""SELECT id, quote_number, client_name, client_code, status,
                           exchange_rate, margin_percent, total_eur_per_bh,
                           msn_list, period_start, period_end,
                           created_by, created_at
                    FROM quotes
                    {where}
                    ORDER BY created_at DESC
                    LIMIT ${idx} OFFSET ${idx + 1}"""

        return await self.fetch_many(query, *params)

    async def count_quotes(
        self,
        search: str | None = None,
        status: str | None = None,
        msn: int | None = None,
    ) -> int:
        """Count quotes matching the same filters as list_quotes."""
        conditions: list[str] = []
        params: list[Any] = []
        idx = 1

        if search:
            conditions.append(
                f"(client_name ILIKE ${idx} OR quote_number ILIKE ${idx})"
            )
            params.append(f"%{search}%")
            idx += 1

        if status:
            conditions.append(f"status = ${idx}")
            params.append(status)
            idx += 1

        if msn is not None:
            conditions.append(f"msn_list @> ARRAY[${idx}]::INTEGER[]")
            params.append(msn)
            idx += 1

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT COUNT(*) as count FROM quotes {where}"

        row = await self.fetch_one(query, *params)
        return row["count"] if row else 0

    async def get_quote(self, quote_id: int) -> dict | None:
        """Get a single quote by ID (includes all columns)."""
        return await self.fetch_one(
            "SELECT * FROM quotes WHERE id = $1",
            quote_id,
        )

    async def get_quote_msn_snapshots(self, quote_id: int) -> list[dict]:
        """Get all MSN snapshots for a quote, ordered by MSN."""
        return await self.fetch_many(
            "SELECT * FROM quote_msn_snapshots WHERE quote_id = $1 ORDER BY msn",
            quote_id,
        )

    async def update_status(self, quote_id: int, status: str) -> dict | None:
        """Update only the status column of a quote. Returns updated row.

        Snapshot columns remain immutable -- only status can change.
        """
        return await self.fetch_one(
            "UPDATE quotes SET status = $1 WHERE id = $2 RETURNING *",
            status, quote_id,
        )

    async def update_quote(self, quote_id: int, **fields) -> dict | None:
        """Update a quote's mutable fields in place. Returns the updated row.

        quote_number, created_by, status and created_at are preserved; the
        snapshot/state columns and metadata are replaced (edit-in-place).
        JSONB columns are passed as dicts and encoded by the connection codec.
        """
        if not fields:
            return await self.get_quote(quote_id)
        jsonb = {
            "pricing_config_snapshot",
            "crew_config_snapshot",
            "costs_config_snapshot",
            "dashboard_state",
        }
        set_parts = []
        args = []
        for i, (key, value) in enumerate(fields.items(), start=1):
            cast = "::jsonb" if key in jsonb else ""
            set_parts.append(f"{key} = ${i}{cast}")
            args.append(value)
        args.append(quote_id)
        return await self.fetch_one(
            f"UPDATE quotes SET {', '.join(set_parts)} WHERE id = ${len(args)} RETURNING *",
            *args,
        )

    async def delete_msn_snapshots(self, quote_id: int) -> None:
        """Remove all per-MSN snapshots for a quote (before re-creating them)."""
        await self.execute(
            "DELETE FROM quote_msn_snapshots WHERE quote_id = $1", quote_id
        )

    async def delete_quote(self, quote_id: int) -> bool:
        """Delete a quote by ID. Returns True if a row was deleted.

        Associated quote_msn_snapshots are removed automatically via
        ON DELETE CASCADE.
        """
        result = await self.execute(
            "DELETE FROM quotes WHERE id = $1", quote_id
        )
        return result == "DELETE 1"
