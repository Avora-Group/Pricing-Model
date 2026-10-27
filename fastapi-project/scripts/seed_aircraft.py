"""Seed script: populate aircraft database from workbook data.

Populates the aircraft, aircraft_rates, and epr_matrix_rows tables with all 11
MSNs, each with a "current" and a parallel "naked" rate set.

Rates and EPR tables come from "Updated rates for 2026.xlsx": the IN sheet is
the current basis, the OUT sheet the naked basis. Escalations are not in that
workbook and are kept from earlier sources.

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
# CURRENT rates (all 11 MSNs), from the IN sheet of Updated rates for 2026.xlsx.
# MSN 5228 is a direct lease (6Y check 175000, other MRs 0, as in the file).
# ---------------------------------------------------------------------------

AIRCRAFT_DATA = {
    3055: {
        "lease_rent": "185000.00",
        "six_year": "15413.95",
        "twelve_year": "8418.19",
        "ldg": "4333.21",
        "apu": "59.7400",
        "llp1": "332.0000",
        "llp2": "332.0000",
    },
    3378: {
        "lease_rent": "185000.00",
        "six_year": "14334.75",
        "twelve_year": "7513.07",
        "ldg": "4864.50",
        "apu": "53.8200",
        "llp1": "348.7300",
        "llp2": "348.7300",
    },
    3461: {
        "lease_rent": "185000.00",
        "six_year": "16207.05",
        "twelve_year": "8913.62",
        "ldg": "6010.04",
        "apu": "62.8300",
        "llp1": "332.0000",
        "llp2": "332.0000",
    },
    3570: {
        "lease_rent": "200000.00",
        "six_year": "14729.09",
        "twelve_year": "8248.95",
        "ldg": "5302.30",
        "apu": "52.7850",
        "llp1": "348.7300",
        "llp2": "348.8300",
    },
    3605: {
        "lease_rent": "185000.00",
        "six_year": "14965.90",
        "twelve_year": "8174.08",
        "ldg": "4206.52",
        "apu": "58.7100",
        "llp1": "315.0900",
        "llp2": "315.0900",
    },
    4247: {
        "lease_rent": "185000.00",
        "six_year": "15413.95",
        "twelve_year": "8418.19",
        "ldg": "4333.21",
        "apu": "59.7400",
        "llp1": "348.7300",
        "llp2": "348.7300",
    },
    5228: {
        "lease_rent": "360000.00",
        "six_year": "175000.00",
        "twelve_year": "0.00",
        "ldg": "0.00",
        "apu": "0.0000",
        "llp1": "0.0000",
        "llp2": "0.0000",
    },
    5931: {
        "lease_rent": "220000.00",
        "six_year": "16774.00",
        "twelve_year": "9225.00",
        "ldg": "6220.00",
        "apu": "65.0000",
        "llp1": "310.0800",
        "llp2": "310.0800",
    },
    1932: {
        "lease_rent": "230000.00",
        "six_year": "15000.00",
        "twelve_year": "8700.00",
        "ldg": "5500.00",
        "apu": "70.0000",
        "llp1": "315.0900",
        "llp2": "315.0900",
    },
    1960: {
        "lease_rent": "235000.00",
        "six_year": "17139.60",
        "twelve_year": "10712.25",
        "ldg": "5892.25",
        "apu": "69.6300",
        "llp1": "305.5800",
        "llp2": "305.5800",
    },
    1503: {
        "lease_rent": "240000.00",
        "six_year": "14664.00",
        "twelve_year": "8112.00",
        "ldg": "5460.00",
        "apu": "52.0000",
        "llp1": "315.0900",
        "llp2": "315.0900",
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
        ("0", "448.35", "672.00"),
        ("1", "448.35", "672.00"),
        ("1.5", "319.20", "478.80"),
        ("2", "273.00", "410.55"),
        ("2.25", "258.30", "387.45"),
        ("2.5", "250.95", "375.90"),
        ("3", "243.60", "364.35"),
    ],
    3378: [
        ("0.62", "689.40", "896.85"),
        ("0.87", "556.82", "725.27"),
        ("1.12", "466.36", "606.74"),
        ("1.37", "403.97", "525.63"),
        ("1.62", "364.98", "475.72"),
        ("1.87", "335.34", "436.72"),
        ("2.12", "311.95", "405.53"),
        ("2.37", "293.23", "382.13"),
        ("2.5", "286.74", "373.21"),
        ("2.62", "280.75", "364.98"),
        ("2.87", "272.95", "355.62"),
        ("3.12", "269.83", "350.94"),
        ("3.37", "268.27", "349.38"),
        ("3.62", "266.71", "347.82"),
        ("4", "263.59", "343.14"),
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
        ("0.8", "577.72", "895.46"),
        ("1", "532.80", "825.84"),
        ("1.5", "420.51", "651.79"),
        ("2", "357.57", "554.23"),
        ("2.25", "328.15", "508.63"),
        ("2.5", "311.96", "483.54"),
        ("3", "283.90", "440.04"),
        ("3.5", "268.11", "415.57"),
    ],
    3605: [
        ("0", "448.35", "673.05"),
        ("1", "448.35", "673.05"),
        ("1.5", "320.25", "479.85"),
        ("2", "273.00", "410.55"),
        ("2.25", "259.35", "388.50"),
        ("2.5", "252.00", "378.00"),
        ("3", "243.60", "364.35"),
    ],
    4247: [
        ("0", "416.96", "695.97"),
        ("1", "416.96", "695.97"),
        ("1.5", "310.36", "516.23"),
        ("2", "263.34", "439.95"),
        ("2.5", "238.26", "396.05"),
        ("3", "227.81", "380.38"),
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
        ("0.99", "529.97", "741.96"),
        ("1.24", "445.48", "623.68"),
        ("1.49", "381.84", "534.58"),
        ("1.74", "318.20", "445.48"),
        ("1.99", "297.82", "415.24"),
        ("2.24", "287.37", "385.00"),
        ("2.49", "273.79", "383.31"),
        ("2.74", "261.25", "365.75"),
        ("2.99", "245.57", "343.80"),
        ("3.24", "229.90", "321.86"),
        ("3.5", "209.00", "292.60"),
    ],
    1932: [
        ("0.86", "707.55", "955.42"),
        ("1.11", "571.26", "771.14"),
        ("1.36", "488.30", "658.98"),
        ("1.61", "430.23", "580.86"),
        ("1.86", "387.56", "522.77"),
        ("2.11", "354.38", "478.71"),
        ("2.36", "327.12", "440.65"),
        ("2.61", "304.59", "410.61"),
        ("2.86", "285.63", "384.57"),
        ("3.11", "271.40", "366.54"),
        ("3.5", "257.19", "346.51"),
    ],
    1960: [
        ("0.86", "605.49", "849.24"),
        ("1.11", "488.62", "683.40"),
        ("1.36", "417.38", "584.34"),
        ("1.61", "368.41", "515.33"),
        ("1.86", "331.68", "464.13"),
        ("2.11", "302.74", "422.95"),
        ("2.36", "279.37", "391.78"),
        ("2.61", "260.45", "366.19"),
        ("2.86", "244.87", "342.81"),
        ("3.11", "232.62", "325.00"),
        ("3.5", "219.27", "307.19"),
        ("3.99", "219.27", "307.19"),
    ],
    1503: [
        ("0.86", "567.00", "737.10"),
        ("1.11", "441.00", "573.30"),
        ("1.36", "415.05", "540.33"),
        ("1.61", "393.75", "488.00"),
        ("1.86", "356.86", "441.81"),
        ("2.11", "343.35", "405.68"),
        ("2.36", "322.97", "381.28"),
        ("2.61", "312.90", "369.41"),
        ("2.86", "305.31", "361.11"),
        ("3.11", "294.00", "347.45"),
        ("3.5", "271.95", "321.68"),
        ("4", "249.90", "294.95"),
    ],
}

# ---------------------------------------------------------------------------
# NAKED rates -- parallel cost basis from the OUT sheet of Updated rates for
# 2026.xlsx. Blank airframe MRs in the file (owned airframes: 3378, 1932, 1960,
# 1503) are stored as 0. MSN 4247 has no OUT rates, so it keeps its earlier naked
# rates (from Naked Aircraft Cost.xlsx); its naked EPR table is from OUT. MSN 1960
# uses the AERSALE tables (OUT: the column AF copy). New naked MSNs reuse their
# current escalations. Exposed only to cost-access users.
# ---------------------------------------------------------------------------

NAKED_MSNS = [3055, 3378, 3461, 3570, 3605, 4247, 5228, 5931, 1932, 1960, 1503]

NAKED_AIRCRAFT_DATA = {
    3055: {
        "lease_rent": "150000.00",
        "six_year": "14012.58",
        "twelve_year": "7653.46",
        "ldg": "3939.28",
        "apu": "54.0244",
        "llp1": "332.0000",
        "llp2": "332.0000",
    },
    3378: {
        "lease_rent": "155000.00",
        "six_year": "0.00",
        "twelve_year": "0.00",
        "ldg": "0.00",
        "apu": "0.0000",
        "llp1": "348.7300",
        "llp2": "349.0000",
    },
    3461: {
        "lease_rent": "165000.00",
        "six_year": "14733.78",
        "twelve_year": "8103.15",
        "ldg": "5463.63",
        "apu": "57.2886",
        "llp1": "315.4100",
        "llp2": "315.4100",
    },
    3570: {
        "lease_rent": "185000.00",
        "six_year": "13390.83",
        "twelve_year": "7498.58",
        "ldg": "4821.03",
        "apu": "48.6400",
        "llp1": "348.7300",
        "llp2": "348.7300",
    },
    3605: {
        "lease_rent": "160000.00",
        "six_year": "14013.13",
        "twelve_year": "7653.46",
        "ldg": "3939.28",
        "apu": "54.6400",
        "llp1": "315.0900",
        "llp2": "315.0900",
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
    5228: {
        "lease_rent": "335924.00",
        "six_year": "0.00",
        "twelve_year": "0.00",
        "ldg": "0.00",
        "apu": "0.0000",
        "llp1": "0.0000",
        "llp2": "0.0000",
    },
    5931: {
        "lease_rent": "188000.00",
        "six_year": "14000.00",
        "twelve_year": "8000.00",
        "ldg": "5400.00",
        "apu": "55.0000",
        "llp1": "294.1700",
        "llp2": "294.1700",
    },
    1932: {
        "lease_rent": "125000.00",
        "six_year": "0.00",
        "twelve_year": "0.00",
        "ldg": "0.00",
        "apu": "0.0000",
        "llp1": "315.0900",
        "llp2": "315.0900",
    },
    1960: {
        "lease_rent": "130000.00",
        "six_year": "0.00",
        "twelve_year": "0.00",
        "ldg": "0.00",
        "apu": "0.0000",
        "llp1": "315.0900",
        "llp2": "315.0900",
    },
    1503: {
        "lease_rent": "120000.00",
        "six_year": "0.00",
        "twelve_year": "0.00",
        "ldg": "0.00",
        "apu": "0.0000",
        "llp1": "315.0900",
        "llp2": "303.8000",
    },
}

NAKED_ESCALATION_RATES = {
    3055: {"epr": "0.0500", "llp": "0.0800", "af_apu": "0.0300"},
    3378: {"epr": "0.0300", "llp": "0.0850", "af_apu": "0"},
    3461: {"epr": "0.0300", "llp": "0.0800", "af_apu": "0.0300"},
    3570: {"epr": "0.0450", "llp": "0.0800", "af_apu": "0.0350"},
    3605: {"epr": "0.0500", "llp": "0.0800", "af_apu": "0.0300"},
    4247: {"epr": "0.0450", "llp": "0.0800", "af_apu": "0.0300"},
    5228: {"epr": "0.035", "llp": "0.08", "af_apu": "0.035"},
    5931: {"epr": "0", "llp": "0", "af_apu": "0"},
    1932: {"epr": "0.05", "llp": "0.08", "af_apu": "0.04"},
    1960: {"epr": "0.05", "llp": "0.08", "af_apu": "0.04"},
    1503: {"epr": "0.05", "llp": "0.08", "af_apu": "0.04"},
}

NAKED_EPR_TABLES = {
    3055: [
        ("0", "376.81", "565.21"),
        ("1", "358.57", "502.00"),
        ("1.5", "255.26", "357.36"),
        ("2", "218.79", "306.31"),
        ("2.25", "206.64", "289.29"),
        ("2.5", "200.56", "280.78"),
        ("3", "194.48", "272.27"),
    ],
    3378: [
        ("1", "325.00", "419.50"),
        ("1.5", "300.00", "387.00"),
        ("1.75", "288.00", "371.40"),
        ("2", "275.00", "354.50"),
        ("2.3", "265.00", "341.50"),
        ("2.5", "250.00", "322.00"),
        ("3", "220.00", "283.00"),
        ("3.5", "205.00", "263.50"),
    ],
    3461: [
        ("0.99", "397.84", "517.19"),
        ("1.24", "334.18", "434.44"),
        ("1.49", "286.44", "372.38"),
        ("1.74", "238.70", "310.31"),
        ("1.99", "230.22", "299.28"),
        ("2.24", "221.73", "288.25"),
        ("2.49", "212.18", "275.83"),
        ("2.74", "206.88", "268.94"),
        ("2.99", "201.57", "262.04"),
        ("3.24", "196.27", "255.15"),
        ("4", "190.96", "248.25"),
    ],
    3570: [
        ("0.8", "462.19", "716.38"),
        ("1", "426.25", "660.68"),
        ("1.5", "336.41", "521.43"),
        ("2", "286.06", "443.39"),
        ("2.25", "262.52", "406.91"),
        ("2.5", "249.57", "386.83"),
        ("3", "227.12", "352.04"),
        ("3.5", "214.49", "332.46"),
    ],
    3605: [
        ("0", "358.86", "553.91"),
        ("1", "358.86", "553.91"),
        ("1.5", "255.84", "394.88"),
        ("2", "218.79", "337.70"),
        ("2.25", "207.21", "328.78"),
        ("2.5", "201.43", "319.84"),
        ("3", "194.48", "300.18"),
    ],
    4247: [
        ("0", "333.91", "556.91"),
        ("1", "333.91", "556.91"),
        ("1.5", "248.04", "412.61"),
        ("2", "211.08", "351.79"),
        ("2.5", "190.80", "317.21"),
        ("3", "182.46", "304.09"),
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
        ("0", "437.00", "568.10"),
        ("0.87", "353.00", "458.90"),
        ("1.12", "301.00", "391.30"),
        ("1.37", "267.00", "347.10"),
        ("1.62", "239.00", "310.70"),
        ("1.87", "219.00", "284.70"),
        ("2.12", "216.00", "280.80"),
        ("2.37", "202.00", "262.60"),
        ("2.62", "198.00", "257.40"),
        ("2.87", "193.00", "250.90"),
        ("3.12", "188.00", "244.40"),
    ],
    1932: [
        ("0.5", "398.03", "517.44"),
        ("1", "343.95", "447.13"),
        ("1.5", "288.79", "375.42"),
        ("2", "274.73", "357.14"),
        ("2.5", "254.07", "330.29"),
        ("3", "238.49", "310.04"),
        ("3.5", "213.18", "277.14"),
        ("4", "204.42", "265.75"),
    ],
    1960: [
        ("0.86", "582.00", "803.00"),
        ("1.11", "458.00", "633.00"),
        ("1.36", "396.00", "547.00"),
        ("1.61", "340.00", "469.00"),
        ("1.86", "307.00", "423.00"),
        ("2.11", "280.00", "387.00"),
        ("2.36", "259.00", "358.00"),
        ("2.61", "244.00", "337.00"),
        ("2.86", "230.00", "317.00"),
        ("3.11", "221.00", "305.00"),
        ("3.12", "215.00", "296.00"),
    ],
    1503: [
        ("0.86", "475.62", "666.30"),
        ("1.11", "383.50", "536.68"),
        ("1.36", "327.79", "458.48"),
        ("1.61", "289.23", "403.85"),
        ("1.86", "260.31", "364.22"),
        ("2.11", "237.81", "332.08"),
        ("2.36", "219.60", "307.44"),
        ("2.61", "204.60", "287.09"),
        ("2.86", "191.75", "268.88"),
        ("3.11", "182.11", "254.95"),
        ("3.5", "172.47", "241.03"),
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
