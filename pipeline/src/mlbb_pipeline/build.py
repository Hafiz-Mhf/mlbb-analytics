from __future__ import annotations

import re
import sqlite3
from pathlib import Path

from .aliases import known_hero_aliases, known_team_aliases
from .models import ParsedGame
from .parser import parse_bracket, parse_matchlist
from .schema import create_schema

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


_SEASON_DIR_RE = re.compile(r"season-(\d+)$")
_STAGE_BY_STEM = {"regular-season": "regular_season", "playoffs": "playoffs"}


def discover_snapshots(root: Path) -> list[tuple[Path, str, str]]:
    """Every 'season-{N}/regular-season.wiki' or 'season-{N}/playoffs.wiki'
    under root, as (path, season, stage). Skips 'statistics.wiki' and
    anything under a 'statistics/' subdirectory — those aren't
    Matchlist/Bracket pages, matched here by the parent directory not
    being named 'season-{N}'."""
    found: list[tuple[Path, str, str]] = []
    for path in sorted(root.rglob("*.wiki")):
        stage = _STAGE_BY_STEM.get(path.stem)
        season_match = _SEASON_DIR_RE.search(path.parent.name)
        if stage is None or season_match is None:
            continue
        found.append((path, season_match.group(1), stage))
    return found


_PARSER_BY_STAGE = {"regular_season": parse_matchlist, "playoffs": parse_bracket}


def build_database(root: Path, db_path: Path) -> dict[str, int]:
    """Full rebuild: fresh schema, seeded reference tables, every game in
    every snapshot under root inserted. Always starts from an empty
    database — a full rebuild from all snapshots, not an incremental one
    (stack.md), so a parser fix retroactively corrects history. Returns
    played-game and distinct-series counts for check_no_regression."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_path.unlink(missing_ok=True)

    conn = sqlite3.connect(db_path)
    try:
        create_schema(conn)
        seed_reference_tables(conn)

        game_count = 0
        series_ids: set[str] = set()
        for path, season, stage in discover_snapshots(root):
            text = path.read_text(encoding="utf-8")
            parse = _PARSER_BY_STAGE[stage]
            for game in parse(text, season=season, stage=stage):
                insert_game(conn, game)
                series_ids.add(game.match.series_id)
                game_count += 1
        conn.commit()
    finally:
        conn.close()

    return {"games": game_count, "series": len(series_ids)}


class RegressionError(RuntimeError):
    """Raised when a rebuild would produce fewer games or series than the
    previously committed database. stack.md's build-halting invariant
    against a partial fetch or Liquipedia data silently disappearing —
    a failed check here must mean nothing gets published."""


def check_no_regression(previous_db_path: Path, new_counts: dict[str, int]) -> None:
    """No-op if there is no previously committed db (first-ever build).
    Otherwise compares matches/series counts and raises RegressionError
    if the new build has fewer of either."""
    if not previous_db_path.exists():
        return

    conn = sqlite3.connect(previous_db_path)
    try:
        old_games = conn.execute("SELECT COUNT(*) FROM matches").fetchone()[0]
        old_series = conn.execute(
            "SELECT COUNT(DISTINCT series_id) FROM matches"
        ).fetchone()[0]
    finally:
        conn.close()

    if new_counts["games"] < old_games or new_counts["series"] < old_series:
        raise RegressionError(
            f"rebuild produced fewer games/series than the committed db "
            f"(games {old_games}->{new_counts['games']}, "
            f"series {old_series}->{new_counts['series']}) "
            "-- halting, nothing published"
        )
