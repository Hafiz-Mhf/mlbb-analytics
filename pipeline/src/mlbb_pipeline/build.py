from __future__ import annotations

import sqlite3

from .aliases import known_hero_aliases, known_team_aliases

# Short forms documented in CLAUDE.md's team list. RRQ Tora's is not yet
# determined on the live wiki — a known cosmetic gap, not a blocker.
TEAM_SHORT_CODES: dict[str, str | None] = {
    "AC Esports": "AC",
    "Bigetron MY by VIT": "BTRM",
    "Invictus Gaming": "IG",
    "RRQ Tora": None,
    "Selangor Red Giants": "SRG",
    "Team Flash": "FL",
    "Team Rey": "REY",
    "Team Vamos": "VMS",
}


def seed_reference_tables(conn: sqlite3.Connection) -> None:
    """Populate teams/heroes and their alias tables from the alias JSON
    files (aliases.py) — the single source of truth for both. Must run
    once against a freshly created schema before any game is inserted."""
    team_aliases = known_team_aliases()
    team_ids: dict[str, int] = {}
    for canonical_name in sorted(set(team_aliases.values())):
        cur = conn.execute(
            "INSERT INTO teams (canonical_name, short_code) VALUES (?, ?)",
            (canonical_name, TEAM_SHORT_CODES.get(canonical_name)),
        )
        team_ids[canonical_name] = cur.lastrowid
    for alias, canonical_name in team_aliases.items():
        conn.execute(
            "INSERT INTO team_aliases (alias, team_id) VALUES (?, ?)",
            (alias, team_ids[canonical_name]),
        )

    hero_aliases = known_hero_aliases()
    hero_ids: dict[str, int] = {}
    for canonical_name in sorted(set(hero_aliases.values())):
        cur = conn.execute(
            "INSERT INTO heroes (canonical_name) VALUES (?)", (canonical_name,)
        )
        hero_ids[canonical_name] = cur.lastrowid
    for alias, canonical_name in hero_aliases.items():
        conn.execute(
            "INSERT INTO hero_aliases (alias, hero_id) VALUES (?, ?)",
            (alias, hero_ids[canonical_name]),
        )
    conn.commit()
