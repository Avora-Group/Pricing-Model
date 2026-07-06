"""Seed script: populate aircraft database from workbook data.

Populates the aircraft, aircraft_rates, and epr_matrix_rows tables with all 11
MSNs (current rates), plus a parallel "naked" rate set for the 6 MSNs present in
"Naked Aircraft Cost.xlsx" (3055, 3378, 3461, 3570, 3605, 4247).

Current rates for those 6 MSNs were reconciled to "Naked Aircraft Cost.xlsx"
(the most up-to-date source). The remaining 5 MSNs keep their values from
"UNA Pricing Model 1 year.xlsx".

Naked rates and the naked EPR table are stored on the same aircraft_rates row
(naked_* columns) and in epr_matrix_rows with rate_type = 'naked'. They are only
ever exposed to users with cost access (enforced server-side).

Usage:
    python fastapi-project/scripts/seed_aircraft.py              # Live insert
    python fastapi-project/scripts/seed_aircraft.py --dry-run    # Print only

All numeric values are wrapped in Decimal(str(value)) to preserve precision.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from decimal import Decimal
from pathlib import Path

# ---------------------------------------------------------------------------
# CURRENT rates (all 11 MSNs). The 6 file MSNs reconciled to Naked Aircraft
# Cost.xlsx; the other 5 from UNA Pricing Model 1 year.xlsx.
# ---------------------------------------------------------------------------

AIRCRAFT_DATA = {
    3055: {
        "lease_rent": "185000.00",
        "six_year": "15876.00",
        "twelve_year": "8671.00",
        "ldg": "4463.00",
        "apu": "62.0000",
        "llp1": "310.0000",
        "llp2": "310.0000",
    },
    3378: {
        "lease_rent": "185000.00",
        "six_year": "13850.00",
        "twelve_year": "7259.00",
        "ldg": "4700.00",
        "apu": "52.0000",
        "llp1": "315.0000",
        "llp2": "325.1700",
    },
    3461: {
        "lease_rent": "185000.00",
        "six_year": "16207.05",
        "twelve_year": "8913.62",
        "ldg": "6010.05",
        "apu": "62.8300",
        "llp1": "294.8700",
        "llp2": "294.8700",
    },
    3570: {
        "lease_rent": "200000.00",
        "six_year": "14729.08",
        "twelve_year": "8248.95",
        "ldg": "5302.30",
        "apu": "52.7850",
        "llp1": "348.7275",
        "llp2": "348.7275",
    },
    3605: {
        "lease_rent": "185000.00",
        "six_year": "14965.90",
        "twelve_year": "8174.08",
        "ldg": "4206.52",
        "apu": "58.7100",
        "llp1": "310.3900",
        "llp2": "310.3900",
    },
    4247: {
        "lease_rent": "185000.00",
        "six_year": "15413.95",
        "twelve_year": "8418.19",
        "ldg": "4333.21",
        "apu": "59.7400",
        "llp1": "367.0816",
        "llp2": "367.0816",
    },
    5228: {
        "lease_rent": "210000",
        "six_year": "16207.16",
        "twelve_year": "8913.47",
        "ldg": "6010.00",
        "apu": "63.02",
        "llp1": "353.29",
        "llp2": "353.29",
    },
    5931: {
        "lease_rent": "220000",
        "six_year": "16207.16",
        "twelve_year": "8913.47",
        "ldg": "6010.00",
        "apu": "63.02",
        "llp1": "317.35",
        "llp2": "317.35",
    },
    1932: {
        "lease_rent": "235000",
        "six_year": "17139.6",
        "twelve_year": "10712.25",
        "ldg": "5892.255",
        "apu": "69.345",
        "llp1": "317.905",
        "llp2": "317.905",
    },
    1960: {
        "lease_rent": "235000",
        "six_year": "17139.6",
        "twelve_year": "10712.25",
        "ldg": "5892.255",
        "apu": "69.345",
        "llp1": "317.905",
        "llp2": "317.905",
    },
    1503: {
        "lease_rent": "235000",
        "six_year": "17139.6",
        "twelve_year": "10712.25",
        "ldg": "5892.255",
        "apu": "69.345",
        "llp1": "317.905",
        "llp2": "317.905",
    },
}

# Escalation rates (decimal fractions, 0.05 = 5%). Not used by the calc engine;
# stored/displayed only.
ESCALATION_RATES = {
    3055: {"epr": "0.0500", "llp": "0.0800", "af_apu": "0.0300"},
    3378: {"epr": "0.0450", "llp": "0.0850", "af_apu": "0.0350"},
    3461: {"epr": "0.0500", "llp": "0.0800", "af_apu": "0.0300"},
    3570: {"epr": "0.0500", "llp": "0.0800", "af_apu": "0.0350"},
    3605: {"epr": "0.0500", "llp": "0.0800", "af_apu": "0.0300"},
    4247: {"epr": "0.0450", "llp": "0.0800", "af_apu": "0.0300"},
    5228: {"epr": "0.035", "llp": "0.08", "af_apu": "0.035"},
    5931: {"epr": "0", "llp": "0", "af_apu": "0"},
    1932: {"epr": "0.05", "llp": "0.08", "af_apu": "0.04"},
    1960: {"epr": "0.05", "llp": "0.08", "af_apu": "0.04"},
    1503: {"epr": "0.05", "llp": "0.08", "af_apu": "0.04"},
}

# EPR tables per MSN -- (cycle_ratio, benign_rate, hot_rate)
EPR_TABLES = {
    3055: [
        ("0", "448.00", "672.00"),
        ("1", "319.00", "479.00"),
        ("1.5", "273.00", "410.00"),
        ("2", "258.00", "387.00"),
        ("2.5", "251.00", "376.00"),
        ("3", "243.00", "365.00"),
    ],
    3378: [
        ("0.62", "669.32", "870.72"),
        ("0.87", "540.61", "704.15"),
        ("1.12", "452.78", "589.06"),
        ("1.37", "392.20", "510.32"),
        ("1.62", "354.35", "461.86"),
        ("1.87", "325.57", "424.00"),
        ("2.12", "302.86", "393.72"),
        ("2.37", "284.69", "371.00"),
        ("2.62", "272.57", "354.35"),
        ("2.87", "265.00", "345.26"),
        ("3.12", "261.97", "340.72"),
        ("3.37", "260.46", "339.20"),
        ("3.62", "258.95", "337.69"),
        ("4", "255.92", "333.15"),
    ],
    3461: [
        ("0.99", "507.15", "659.40"),
        ("1.24", "426.30", "553.35"),
        ("1.49", "365.40", "474.60"),
        ("1.74", "304.50", "395.85"),
        ("1.99", "292.95", "381.15"),
        ("2.24", "282.45", "367.50"),
        ("2.49", "270.90", "351.75"),
        ("2.74", "263.55", "342.30"),
        ("2.99", "257.25", "333.90"),
        ("3.24", "249.90", "325.50"),
        ("3.5", "243.60", "316.05"),
    ],
    3570: [
        ("1", "535.36", "722.73"),
        ("1.5", "422.52", "570.40"),
        ("2", "359.28", "485.03"),
        ("2.25", "329.73", "445.13"),
        ("2.5", "313.45", "423.16"),
        ("3", "285.26", "385.10"),
        ("3.5", "269.39", "363.68"),
    ],
    3605: [
        ("1", "448.35", "673.05"),
        ("1.5", "320.25", "479.85"),
        ("2", "273.00", "410.55"),
        ("2.25", "259.35", "388.50"),
        ("2.5", "252.00", "378.00"),
        ("3", "243.60", "364.35"),
    ],
    4247: [
        ("1", "416.95", "695.97"),
        ("1.5", "310.36", "516.23"),
        ("2", "263.34", "439.94"),
        ("2.25", "238.26", "396.05"),
        ("2.5", "227.81", "380.38"),
    ],
    5228: [
        ("0.99", "450.00", "630.00"),
        ("1.24", "400.00", "560.00"),
        ("1.49", "335.00", "469.00"),
        ("1.74", "315.00", "441.00"),
        ("1.99", "295.00", "413.00"),
        ("2.24", "275.00", "385.00"),
        ("2.49", "265.00", "371.00"),
        ("2.74", "250.00", "350.00"),
        ("2.99", "235.00", "329.00"),
        ("3.24", "220.00", "308.00"),
        ("3.5", "210.00", "294.00"),
    ],
    5931: [
        ("0.99", "507.15", "710.01"),
        ("1.24", "426.30", "596.82"),
        ("1.49", "365.40", "511.56"),
        ("1.74", "304.50", "426.30"),
        ("1.99", "285.00", "399.00"),
        ("2.24", "275.00", "385.00"),
        ("2.49", "262.00", "366.80"),
        ("2.74", "250.00", "350.00"),
        ("2.99", "235.00", "329.00"),
        ("3.24", "220.00", "308.00"),
        ("3.5", "200.00", "280.00"),
    ],
    1932: [
        ("0.86", "656.21", "919.50"),
        ("1.11", "528.56", "740.62"),
        ("1.36", "451.54", "632.71"),
        ("1.61", "398.79", "557.32"),
        ("1.86", "358.70", "502.62"),
        ("2.11", "328.11", "458.27"),
        ("2.36", "302.79", "424.27"),
        ("2.61", "281.69", "396.18"),
        ("2.86", "264.81", "371.05"),
        ("3.11", "251.09", "351.83"),
        ("3.5", "237.38", "332.62"),
        ("4.0", "237.38", "332.62"),
    ],
    1960: [
        ("0.86", "656.21", "853.07"),
        ("1.11", "528.56", "687.12"),
        ("1.36", "451.54", "587.00"),
        ("1.61", "398.79", "518.43"),
        ("1.86", "358.70", "466.31"),
        ("2.11", "328.11", "426.54"),
        ("2.36", "302.79", "393.62"),
        ("2.61", "281.69", "366.19"),
        ("2.86", "264.81", "344.25"),
        ("3.11", "251.09", "326.42"),
        ("3.5", "237.38", "308.59"),
        ("3.99", "220.14", "286.19"),
        ("4.0", "219.79", "285.73"),
    ],
    1503: [
        ("0.86", "704.33", "950.95"),
        ("1.11", "568.48", "767.03"),
        ("1.36", "485.93", "656.26"),
        ("1.61", "428.45", "577.89"),
        ("1.86", "385.61", "520.41"),
        ("2.11", "353.21", "476.52"),
        ("2.36", "326.04", "438.90"),
        ("2.61", "303.05", "408.60"),
        ("2.86", "284.24", "382.47"),
        ("3.11", "269.61", "364.71"),
        ("3.5", "256.03", "344.85"),
    ],
}

# ---------------------------------------------------------------------------
# NAKED rates -- parallel cost basis for the 6 MSNs in Naked Aircraft Cost.xlsx.
# MSN 3378 airframe is owned (6Y/12Y/LDG/APU = 0); lease 120000 = 2 x 60000 engine
# lease. Exposed only to cost-access users.
# ---------------------------------------------------------------------------

NAKED_MSNS = [3055, 3378, 3461, 3570, 3605, 4247]

NAKED_AIRCRAFT_DATA = {
    3055: {
        "lease_rent": "150000.00",
        "six_year": "14013.00",
        "twelve_year": "7653.00",
        "ldg": "3939.00",
        "apu": "54.0000",
        "llp1": "310.0000",
        "llp2": "310.0000",
    },
    3378: {
        "lease_rent": "120000.00",
        "six_year": "0.00",
        "twelve_year": "0.00",
        "ldg": "0.00",
        "apu": "0.0000",
        "llp1": "315.0000",
        "llp2": "325.1700",
    },
    3461: {
        "lease_rent": "165000.00",
        "six_year": "14733.78",
        "twelve_year": "8103.15",
        "ldg": "5463.64",
        "apu": "57.2886",
        "llp1": "294.8700",
        "llp2": "294.8700",
    },
    3570: {
        "lease_rent": "185000.00",
        "six_year": "13390.83",
        "twelve_year": "7498.57",
        "ldg": "4821.03",
        "apu": "48.6450",
        "llp1": "348.7275",
        "llp2": "348.7275",
    },
    3605: {
        "lease_rent": "160000.00",
        "six_year": "14013.13",
        "twelve_year": "7653.46",
        "ldg": "3939.28",
        "apu": "54.6364",
        "llp1": "310.0800",
        "llp2": "310.0800",
    },
    4247: {
        "lease_rent": "150000.00",
        "six_year": "13604.24",
        "twelve_year": "7430.42",
        "ldg": "3824.39",
        "apu": "52.5300",
        "llp1": "332.0000",
        "llp2": "332.0000",
    },
}

NAKED_ESCALATION_RATES = {
    3055: {"epr": "0.0500", "llp": "0.0800", "af_apu": "0.0300"},
    3378: {"epr": "0.0300", "llp": "0.0850", "af_apu": "0"},
    3461: {"epr": "0.0300", "llp": "0.0800", "af_apu": "0.0300"},
    3570: {"epr": "0.0450", "llp": "0.0800", "af_apu": "0.0350"},
    3605: {"epr": "0.0500", "llp": "0.0800", "af_apu": "0.0300"},
    4247: {"epr": "0.0450", "llp": "0.0800", "af_apu": "0.0300"},
}

NAKED_EPR_TABLES = {
    3055: [
        ("0.99", "358.57", "537.86"),
        ("1.5", "255.26", "382.88"),
        ("2", "218.79", "328.19"),
        ("2.25", "206.64", "309.95"),
        ("2.5", "200.56", "300.84"),
        ("3", "194.48", "291.72"),
    ],
    3378: [
        ("0.62", "527.77", "686.58"),
        ("0.87", "426.28", "555.23"),
        ("1.12", "357.02", "464.49"),
        ("1.37", "309.26", "402.40"),
        ("1.62", "279.41", "364.19"),
        ("1.87", "256.72", "334.33"),
        ("2.12", "238.81", "310.45"),
        ("2.37", "224.48", "292.54"),
        ("2.62", "214.93", "279.41"),
        ("2.87", "208.96", "272.24"),
        ("3.12", "206.57", "268.66"),
        ("3.37", "205.38", "267.47"),
        ("3.62", "204.18", "266.27"),
        ("4", "201.79", "262.69"),
    ],
    3461: [
        ("0.99", "397.84", "596.76"),
        ("1.24", "334.18", "501.28"),
        ("1.49", "286.44", "429.66"),
        ("1.74", "238.70", "358.05"),
        ("1.99", "230.22", "345.32"),
        ("2.24", "221.73", "332.59"),
        ("2.49", "212.18", "318.27"),
        ("2.74", "206.88", "310.31"),
        ("2.99", "201.57", "302.36"),
        ("3.24", "196.27", "294.40"),
        ("4", "190.96", "286.44"),
    ],
    3570: [
        ("1", "426.25", "575.43"),
        ("1.5", "336.41", "454.15"),
        ("2", "286.06", "386.18"),
        ("2.25", "262.52", "354.41"),
        ("2.5", "249.57", "336.92"),
        ("3", "227.12", "306.61"),
        ("3.5", "214.49", "289.56"),
    ],
    3605: [
        ("1", "358.86", "466.52"),
        ("1.5", "255.84", "332.59"),
        ("2", "218.79", "284.43"),
        ("2.25", "207.21", "269.38"),
        ("2.5", "201.43", "261.85"),
        ("3", "194.48", "252.83"),
    ],
    4247: [
        ("1", "333.91", "556.91"),
        ("1.5", "248.04", "412.61"),
        ("2", "211.08", "351.79"),
        ("2.5", "190.80", "317.21"),
        ("3", "182.46", "304.09"),
    ],
}

# All MSNs in fleet order
ALL_MSNS = [3055, 3378, 3461, 3570, 3605, 4247, 5228, 5931, 1932, 1960, 1503]

# Aircraft type per MSN (A321 for 1503, 1932, 1960; A320 for the rest)
AIRCRAFT_TYPE = {msn: "A321" if msn in (1503, 1932, 1960) else "A320" for msn in ALL_MSNS}


def print_seed_data():
    """Print all seed data for dry-run mode."""
    print(f"\n{'='*60}")
    print(f"  Aircraft Seed Data -- {len(ALL_MSNS)} MSNs "
          f"({len(NAKED_MSNS)} with naked rates)")
    print(f"{'='*60}\n")
    for msn in ALL_MSNS:
        data = AIRCRAFT_DATA[msn]
        esc = ESCALATION_RATES[msn]
        epr = EPR_TABLES.get(msn, [])
        print(f"--- MSN {msn} ({AIRCRAFT_TYPE[msn]}) ---")
        print(f"  [current] lease={data['lease_rent']} 6Y={data['six_year']} "
              f"12Y={data['twelve_year']} LDG={data['ldg']} APU={data['apu']} "
              f"LLP={data['llp1']}/{data['llp2']}  esc={esc}  EPR rows={len(epr)}")
        if msn in NAKED_MSNS:
            nd = NAKED_AIRCRAFT_DATA[msn]
            nesc = NAKED_ESCALATION_RATES[msn]
            nepr = NAKED_EPR_TABLES.get(msn, [])
            print(f"  [naked]   lease={nd['lease_rent']} 6Y={nd['six_year']} "
                  f"12Y={nd['twelve_year']} LDG={nd['ldg']} APU={nd['apu']} "
                  f"LLP={nd['llp1']}/{nd['llp2']}  esc={nesc}  EPR rows={len(nepr)}")
    print(f"\nTotal: {len(ALL_MSNS)} aircraft.\n")


def _rate_fields(msn: int) -> dict:
    """Build the aircraft_rates column->value map for one MSN (current + naked)."""
    data = AIRCRAFT_DATA[msn]
    esc = ESCALATION_RATES[msn]
    fields = {
        "lease_rent_usd": Decimal(data["lease_rent"]),
        "six_year_check_usd": Decimal(data["six_year"]),
        "twelve_year_check_usd": Decimal(data["twelve_year"]),
        "ldg_usd": Decimal(data["ldg"]),
        "apu_rate_usd": Decimal(data["apu"]),
        "llp1_rate_usd": Decimal(data["llp1"]),
        "llp2_rate_usd": Decimal(data["llp2"]),
        "epr_escalation": Decimal(esc["epr"]),
        "llp_escalation": Decimal(esc["llp"]),
        "af_apu_escalation": Decimal(esc["af_apu"]),
    }
    if msn in NAKED_MSNS:
        nd = NAKED_AIRCRAFT_DATA[msn]
        nesc = NAKED_ESCALATION_RATES[msn]
        fields.update({
            "has_naked_rates": True,
            "naked_lease_rent_usd": Decimal(nd["lease_rent"]),
            "naked_six_year_check_usd": Decimal(nd["six_year"]),
            "naked_twelve_year_check_usd": Decimal(nd["twelve_year"]),
            "naked_ldg_usd": Decimal(nd["ldg"]),
            "naked_apu_rate_usd": Decimal(nd["apu"]),
            "naked_llp1_rate_usd": Decimal(nd["llp1"]),
            "naked_llp2_rate_usd": Decimal(nd["llp2"]),
            "naked_epr_escalation": Decimal(nesc["epr"]),
            "naked_llp_escalation": Decimal(nesc["llp"]),
            "naked_af_apu_escalation": Decimal(nesc["af_apu"]),
        })
    return fields


async def _replace_epr(conn, aircraft_id: int, rate_type: str, rows: list) -> None:
    """Upsert an aircraft's EPR rows for a rate_type, then drop stale rows.

    Idempotent and safe under concurrent seeding (upsert + delete-not-in-set).
    """
    kept = []
    for ratio, benign, hot in rows:
        cr = Decimal(ratio)
        kept.append(cr)
        await conn.execute(
            """
            INSERT INTO epr_matrix_rows (aircraft_id, rate_type, cycle_ratio, benign_rate, hot_rate)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (aircraft_id, rate_type, cycle_ratio) DO UPDATE SET
                benign_rate = EXCLUDED.benign_rate,
                hot_rate = EXCLUDED.hot_rate
            """,
            aircraft_id, rate_type, cr, Decimal(benign), Decimal(hot),
        )
    # Remove any rows for this (aircraft, rate_type) not in the desired set
    await conn.execute(
        "DELETE FROM epr_matrix_rows WHERE aircraft_id = $1 AND rate_type = $2 AND cycle_ratio <> ALL($3::numeric[])",
        aircraft_id, rate_type, kept or [Decimal("-1")],
    )


async def seed(database_url: str):
    """Seed the database with all aircraft, current + naked rates."""
    import asyncpg
    import ssl as _ssl

    ssl_ctx = None
    if ("proxy.rlwy.net" in database_url or "sslmode" in database_url) and "railway.internal" not in database_url:
        ssl_ctx = _ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = _ssl.CERT_NONE

    conn = await asyncpg.connect(database_url, ssl=ssl_ctx)
    try:
        for msn in ALL_MSNS:
            ac_type = AIRCRAFT_TYPE[msn]
            row = await conn.fetchrow(
                "INSERT INTO aircraft (msn, aircraft_type) VALUES ($1, $2) "
                "ON CONFLICT (msn) DO UPDATE SET aircraft_type = $2, updated_at = NOW() "
                "RETURNING id",
                msn, ac_type,
            )
            aircraft_id = row["id"]
            print(f"  Aircraft MSN {msn} -> id={aircraft_id}")

            # Upsert rates (current + naked columns) dynamically
            fields = _rate_fields(msn)
            cols = list(fields.keys())
            placeholders = ", ".join(f"${i}" for i in range(2, len(cols) + 2))
            col_sql = ", ".join(cols)
            update_sql = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols)
            await conn.execute(
                f"""
                INSERT INTO aircraft_rates (aircraft_id, {col_sql})
                VALUES ($1, {placeholders})
                ON CONFLICT (aircraft_id) DO UPDATE SET
                    {update_sql},
                    updated_at = NOW()
                """,
                aircraft_id, *fields.values(),
            )

            # Current EPR table
            await _replace_epr(conn, aircraft_id, "current", EPR_TABLES.get(msn, []))
            n_cur = len(EPR_TABLES.get(msn, []))

            # Naked EPR table (only for naked MSNs)
            n_nak = 0
            if msn in NAKED_MSNS:
                await _replace_epr(conn, aircraft_id, "naked", NAKED_EPR_TABLES.get(msn, []))
                n_nak = len(NAKED_EPR_TABLES.get(msn, []))

            print(f"    Rates + {n_cur} current EPR rows" +
                  (f" + {n_nak} naked EPR rows" if msn in NAKED_MSNS else ""))

        print(f"\nSeed complete: {len(ALL_MSNS)} aircraft "
              f"({len(NAKED_MSNS)} with naked rates).")
    finally:
        await conn.close()


def main():
    parser = argparse.ArgumentParser(description="Seed aircraft database")
    parser.add_argument("--dry-run", action="store_true", help="Print data without writing")
    args = parser.parse_args()

    if args.dry_run:
        print_seed_data()
        return

    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/acmi_pricing",
    )
    print(f"\nSeeding database at: {database_url}")
    asyncio.run(seed(database_url))


if __name__ == "__main__":
    main()
