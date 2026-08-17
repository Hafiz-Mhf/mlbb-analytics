from __future__ import annotations

import sqlite3

SCHEMA_SQL = """
CREATE TABLE teams (
    id INTEGER PRIMARY KEY,
    canonical_name TEXT NOT NULL UNIQUE,
    short_code TEXT
);

CREATE TABLE team_names (
    team_id INTEGER NOT NULL REFERENCES teams(id),
    season TEXT NOT NULL,
    display_name TEXT NOT NULL,
    PRIMARY KEY (team_id, season)
);

CREATE TABLE team_aliases (
    alias TEXT PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id)
);

CREATE TABLE heroes (
    id INTEGER PRIMARY KEY,
    canonical_name TEXT NOT NULL UNIQUE
);

CREATE TABLE hero_aliases (
    alias TEXT PRIMARY KEY,
    hero_id INTEGER NOT NULL REFERENCES heroes(id)
);

CREATE TABLE matches (
    id INTEGER PRIMARY KEY,
    series_id TEXT NOT NULL,
    season TEXT NOT NULL,
    stage TEXT NOT NULL,
    team1_id INTEGER NOT NULL REFERENCES teams(id),
    team2_id INTEGER NOT NULL REFERENCES teams(id),
    team1_side TEXT NOT NULL,
    winner_id INTEGER NOT NULL REFERENCES teams(id),
    game_length TEXT NOT NULL,
    game_number_in_series INTEGER NOT NULL,
    played_at TEXT,
    UNIQUE (series_id, game_number_in_series)
);

CREATE TABLE drafts (
    id INTEGER PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id),
    team_id INTEGER NOT NULL REFERENCES teams(id),
    slot INTEGER NOT NULL,
    hero_id INTEGER NOT NULL REFERENCES heroes(id),
    is_ban INTEGER NOT NULL
);
"""


def create_schema(conn: sqlite3.Connection) -> None:
    """Create all seven tables (database.md) in an empty database.
    Idempotent only in the sense that build_database (Task 5) always
    calls this against a fresh file — running it twice against the
    same connection raises (tables already exist), by design."""
    conn.executescript(SCHEMA_SQL)
