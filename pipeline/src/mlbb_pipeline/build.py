from __future__ import annotations

import sqlite3

from .aliases import known_hero_aliases, known_team_aliases
from .models import ParsedGame

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


def _team_id(conn: sqlite3.Connection, canonical_name: str) -> int:
    row = conn.execute(
        "SELECT id FROM teams WHERE canonical_name = ?", (canonical_name,)
    ).fetchone()
    return row[0]


def _hero_id(conn: sqlite3.Connection, canonical_name: str) -> int:
    row = conn.execute(
        "SELECT id FROM heroes WHERE canonical_name = ?", (canonical_name,)
    ).fetchone()
    return row[0]


def insert_game(conn: sqlite3.Connection, game: ParsedGame) -> int:
    """Insert one already-validated, already-alias-resolved ParsedGame
    (parser.py) as one matches row plus twenty drafts rows. Returns the
    new matches.id."""
    match = game.match
    team1_id = _team_id(conn, match.team1)
    team2_id = _team_id(conn, match.team2)
    winner_id = team1_id if match.winner == 1 else team2_id

    cur = conn.execute(
        """INSERT INTO matches
           (series_id, season, stage, team1_id, team2_id, team1_side,
            winner_id, game_length, game_number_in_series, played_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            match.series_id,
            match.season,
            match.stage,
            team1_id,
            team2_id,
            match.team1_side,
            winner_id,
            match.game_length,
            match.game_number_in_series,
            match.played_at,
        ),
    )
    match_id = cur.lastrowid

    for draft in game.drafts:
        team_id = team1_id if draft.team_slot == 1 else team2_id
        hero_id = _hero_id(conn, draft.hero)
        conn.execute(
            """INSERT INTO drafts (match_id, team_id, slot, hero_id, is_ban)
               VALUES (?, ?, ?, ?, ?)""",
            (match_id, team_id, draft.slot, hero_id, int(draft.is_ban)),
        )

    return match_id
