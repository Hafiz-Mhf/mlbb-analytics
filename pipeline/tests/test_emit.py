import sqlite3

from mlbb_pipeline.build import insert_game, seed_reference_tables
from mlbb_pipeline.emit import dataset_from_db
from mlbb_pipeline.parser import parse_map
from mlbb_pipeline.schema import create_schema

RAW_MAP = (
    "{{Map|team1side=blue|team2side=red|length=21:59|winner=1"
    "|t1h1=sora|t1h2=guin|t1h3=zhuxin|t1h4=granger|t1h5=chou"
    "|t2h1=phoveus|t2h2=leomord|t2h3=yve|t2h4=harith|t2h5=khaleed"
    "|t1b1=baxia|t1b2=valen|t1b3=kalea|t1b4=suyou|t1b5=harley"
    "|t2b1=freya|t2b2=marcel|t2b3=fanny|t2b4=gloo|t2b5=claude}}"
)


def _conn_with_one_game() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    create_schema(conn)
    seed_reference_tables(conn)
    game = parse_map(
        RAW_MAP,
        series_id="MPLMYS17W1_M1",
        season="17",
        stage="regular_season",
        team1_raw="Selangor Red Giants",
        team2_raw="Team Vamos",
        played_at="April 3, 2026 - 17:00",
        game_number_in_series=1,
    )
    insert_game(conn, game)
    conn.commit()
    return conn


def test_dataset_from_db_has_all_four_tables():
    dataset = dataset_from_db(_conn_with_one_game())
    assert set(dataset.keys()) == {"teams", "heroes", "matches", "drafts", "generatedAt"}
    assert len(dataset["teams"]) == 8
    assert len(dataset["matches"]) == 1
    assert len(dataset["drafts"]) == 20


def test_dataset_from_db_uses_camelcase_field_names_matching_types_ts():
    dataset = dataset_from_db(_conn_with_one_game())

    team = next(t for t in dataset["teams"] if t["canonicalName"] == "Selangor Red Giants")
    assert team["shortCode"] == "SRG"
    assert set(team.keys()) == {"id", "canonicalName", "shortCode"}

    match = dataset["matches"][0]
    assert set(match.keys()) == {
        "id", "seriesId", "season", "stage", "team1Id", "team2Id",
        "team1Side", "winnerId", "gameLength", "gameNumberInSeries", "playedAt",
    }
    assert match["seriesId"] == "MPLMYS17W1_M1"
    assert match["gameNumberInSeries"] == 1

    draft = dataset["drafts"][0]
    assert set(draft.keys()) == {"id", "matchId", "teamId", "slot", "heroId", "isBan"}
    assert isinstance(draft["isBan"], bool)


import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from mlbb_pipeline.emit import write_dataset


def test_write_dataset_writes_valid_json(tmp_path: Path):
    dataset = dataset_from_db(_conn_with_one_game())
    out_path = tmp_path / "nested" / "dataset.json"

    write_dataset(dataset, out_path)

    loaded = json.loads(out_path.read_text(encoding="utf-8"))
    assert loaded == dataset


class _ColumnDroppingConn:
    """Wraps a real connection, rewriting the teams query to null out
    canonical_name — simulates a renamed/dropped SQL column without
    relying on sqlite3.Connection being subclassable/patchable (it's a
    C-level immutable type)."""

    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def execute(self, sql, *args, **kwargs):
        if "SELECT id, canonical_name, short_code FROM teams" in sql:
            sql = sql.replace("canonical_name", "NULL")
        return self._conn.execute(sql, *args, **kwargs)


def test_dataset_from_db_raises_on_schema_break():
    """Simulates a renamed/dropped SQL column (teams.canonical_name -> NULL)
    to prove dataset_from_db halts instead of emitting a bad dataset.json —
    the stack.md guarantee this whole model layer exists for."""
    conn = _ColumnDroppingConn(_conn_with_one_game())

    with pytest.raises(ValidationError):
        dataset_from_db(conn)
