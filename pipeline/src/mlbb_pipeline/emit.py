from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from .dataset_models import Dataset


def dataset_from_db(conn: sqlite3.Connection) -> dict:
    """Every row of teams/heroes/matches/drafts, field names mapped to
    the camelCase shape frontend/src/lib/types.ts declares (MockDataset,
    Team, Hero, MatchRow, DraftRow) — the frontend's data.ts imports
    this dict verbatim as JSON, so the shape must match exactly."""
    teams = [
        {"id": r[0], "canonicalName": r[1], "shortCode": r[2]}
        for r in conn.execute("SELECT id, canonical_name, short_code FROM teams")
    ]
    heroes = [
        {"id": r[0], "canonicalName": r[1]}
        for r in conn.execute("SELECT id, canonical_name FROM heroes")
    ]
    matches = [
        {
            "id": r[0],
            "seriesId": r[1],
            "season": r[2],
            "stage": r[3],
            "team1Id": r[4],
            "team2Id": r[5],
            "team1Side": r[6],
            "winnerId": r[7],
            "gameLength": r[8],
            "gameNumberInSeries": r[9],
            "playedAt": r[10],
        }
        for r in conn.execute(
            "SELECT id, series_id, season, stage, team1_id, team2_id, "
            "team1_side, winner_id, game_length, game_number_in_series, played_at "
            "FROM matches"
        )
    ]
    drafts = [
        {
            "id": r[0],
            "matchId": r[1],
            "teamId": r[2],
            "slot": r[3],
            "heroId": r[4],
            "isBan": bool(r[5]),
        }
        for r in conn.execute(
            "SELECT id, match_id, team_id, slot, hero_id, is_ban FROM drafts"
        )
    ]
    dataset = {"teams": teams, "heroes": heroes, "matches": matches, "drafts": drafts}
    Dataset.model_validate(dataset)  # raises on shape mismatch — halts the build (stack.md)
    return dataset


def write_dataset(dataset: dict, path: Path) -> None:
    """Write dataset as JSON to path, creating parent directories as
    needed. Vite/SvelteKit import JSON files natively, so the frontend
    side needs nothing beyond a plain `import dataset from '...json'`."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dataset, indent=2), encoding="utf-8")
