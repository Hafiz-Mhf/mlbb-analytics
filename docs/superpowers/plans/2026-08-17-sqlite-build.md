# SQLite Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SQLite archive: schema creation, seeding the alias tables as reference data, parsing every committed `data/raw/*.wiki` snapshot into it, and a `mlbb-build` CLI — the step between the backfilled snapshots (done) and metrics/JSON emission (next plan, not this one).

**Architecture:** `schema.py` holds the DDL as one `CREATE TABLE` script and a `create_schema(conn)` that runs it. `build.py` seeds `teams`/`heroes`/their alias tables from `aliases.py`'s existing `known_team_aliases()`/`known_hero_aliases()`, discovers every `season-{N}/regular-season.wiki` and `season-{N}/playoffs.wiki` snapshot under `data/raw/`, parses each with the already-merged `parse_matchlist`/`parse_bracket`, and inserts every resulting `ParsedGame` (already fully validated and alias-resolved by the parser — this task's only new resolution is canonical name/hero string → integer id). A full rebuild always starts from an empty database (stack.md: "Rebuild SQLite from all snapshots, not incrementally"), built to a temp path and only swapped into place if it does not regress game/series counts versus the previously committed db.

**Tech Stack:** Python 3.12, `uv`, stdlib `sqlite3` (no new dependency — "zero infra" per stack.md), `argparse`, pytest.

**Spec:** `docs/database.md` (schema, build strategy), `docs/stack.md` (build-halting invariants), `CLAUDE.md` (team short-code list, verified S17 counts)

## Global Constraints

- Two of stack.md's four build-halting invariants are **already enforced upstream and need no new code**: unknown hero/team string halts via `UnknownHeroError`/`UnknownTeamError` in `aliases.py` (raised during parsing, before this pipeline stage ever runs); "exactly 10 picks and 10 bans" halts via `ParsedGame`'s Pydantic validator in `models.py`. This plan implements the third — "game or series counts moving in an impossible direction between runs" — as `check_no_regression`. The fourth, "aggregate team records not matching published standings," needs a standings-page parser that does not exist yet and is out of scope (see "Not in this plan").
- SQLite is a **build-time archive, committed to git**, never a runtime store (database.md, stack.md). No ORM, no ODBC, no ODM — stdlib `sqlite3` only.
- `data/raw/` layout is `root/{...}/season-{N}/regular-season.wiki` and `root/{...}/season-{N}/playoffs.wiki` (snapshot.py's slugify convention, confirmed against the live S17/S18 backfill). Files under a `statistics/` subdirectory or named `statistics.wiki` are **not** Matchlist/Bracket pages and must be skipped.
- `MatchRecord.team1`/`team2`/drafts' `hero` are already **canonical, alias-resolved strings** by the time `ParsedGame` reaches this pipeline stage (`parse_map` calls `resolve_team`/`resolve_hero` internally) — this plan's insert code does plain `canonical_name` lookups, never re-resolves aliases.
- Python 3.12, `uv` for venv/deps/lockfile (stack.md).

---

## File Structure

```
pipeline/
  src/mlbb_pipeline/
    schema.py       # NEW: SCHEMA_SQL, create_schema(conn)
    build.py        # NEW: seed_reference_tables(), insert_game(), discover_snapshots(),
                     #      build_database(), check_no_regression(), main() CLI
  tests/
    test_schema.py     # NEW
    test_build.py       # NEW
```

`build.py` depends on `schema.py` (this plan), `aliases.py`'s `known_team_aliases`/`known_hero_aliases` (merged), `parser.py`'s `parse_matchlist`/`parse_bracket` (merged), and `models.py`'s `ParsedGame` (merged). Modifies neither.

---

### Task 1: Schema DDL

**Files:**
- Create: `pipeline/src/mlbb_pipeline/schema.py`
- Test: `pipeline/tests/test_schema.py`

**Interfaces:**
- Produces: `create_schema(conn: sqlite3.Connection) -> None` — used by `build.py`'s `build_database` (Task 5).

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_schema.py
import sqlite3

from mlbb_pipeline.schema import create_schema


def _table_names(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    return {row[0] for row in rows}


def test_create_schema_creates_all_seven_tables():
    conn = sqlite3.connect(":memory:")
    create_schema(conn)
    assert _table_names(conn) == {
        "teams",
        "team_names",
        "team_aliases",
        "heroes",
        "hero_aliases",
        "matches",
        "drafts",
    }


def test_create_schema_enforces_unique_canonical_names():
    conn = sqlite3.connect(":memory:")
    create_schema(conn)
    conn.execute("INSERT INTO teams (canonical_name) VALUES ('Selangor Red Giants')")
    try:
        conn.execute("INSERT INTO teams (canonical_name) VALUES ('Selangor Red Giants')")
        assert False, "expected UNIQUE constraint violation"
    except sqlite3.IntegrityError:
        pass
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_schema.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mlbb_pipeline.schema'`

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/src/mlbb_pipeline/schema.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_schema.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/schema.py pipeline/tests/test_schema.py
git commit -m "feat: SQLite schema for the seven build-time archive tables"
```

---

### Task 2: Seed reference tables (teams, heroes, their aliases)

**Files:**
- Create: `pipeline/src/mlbb_pipeline/build.py`
- Test: `pipeline/tests/test_build.py`

**Interfaces:**
- Consumes: `create_schema` (Task 1), `known_team_aliases`, `known_hero_aliases` (`aliases.py`, merged).
- Produces: `TEAM_SHORT_CODES: dict[str, str | None]`, `seed_reference_tables(conn: sqlite3.Connection) -> None` — used by `build_database` (Task 5).

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_build.py
import sqlite3

from mlbb_pipeline.build import seed_reference_tables
from mlbb_pipeline.schema import create_schema


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    create_schema(conn)
    return conn


def test_seed_reference_tables_inserts_eight_teams_with_aliases():
    conn = _conn()
    seed_reference_tables(conn)

    teams = conn.execute("SELECT canonical_name, short_code FROM teams").fetchall()
    assert len(teams) == 8
    by_name = dict(teams)
    assert by_name["Selangor Red Giants"] == "SRG"
    assert by_name["RRQ Tora"] is None  # short code not yet known (cosmetic gap)

    srg_id = conn.execute(
        "SELECT id FROM teams WHERE canonical_name = 'Selangor Red Giants'"
    ).fetchone()[0]
    alias_team_id = conn.execute(
        "SELECT team_id FROM team_aliases WHERE alias = 'srg'"
    ).fetchone()[0]
    assert alias_team_id == srg_id


def test_seed_reference_tables_inserts_heroes_with_aliases():
    conn = _conn()
    seed_reference_tables(conn)

    hero_count = conn.execute("SELECT COUNT(*) FROM heroes").fetchone()[0]
    assert hero_count > 60  # full roster, not just the golden-fixture short forms

    guinevere_id = conn.execute(
        "SELECT id FROM heroes WHERE canonical_name = 'guinevere'"
    ).fetchone()[0]
    alias_hero_id = conn.execute(
        "SELECT hero_id FROM hero_aliases WHERE alias = 'guin'"
    ).fetchone()[0]
    assert alias_hero_id == guinevere_id
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_build.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mlbb_pipeline.build'`

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/src/mlbb_pipeline/build.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_build.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/build.py pipeline/tests/test_build.py
git commit -m "feat: seed teams/heroes and their alias tables from aliases.py"
```

---

### Task 3: Insert one parsed game

**Files:**
- Modify: `pipeline/src/mlbb_pipeline/build.py` (append)
- Modify: `pipeline/tests/test_build.py` (append)

**Interfaces:**
- Consumes: `seed_reference_tables` (Task 2), `mlbb_pipeline.parser.parse_map`, `mlbb_pipeline.models.ParsedGame` (both merged).
- Produces: `insert_game(conn: sqlite3.Connection, game: ParsedGame) -> int` (returns the new `matches.id`) — used by `build_database` (Task 5).

- [ ] **Step 1: Write the failing test**

```python
# appended to pipeline/tests/test_build.py
from mlbb_pipeline.build import insert_game
from mlbb_pipeline.parser import parse_map

RAW_MAP = (
    "{{Map|team1side=blue|team2side=red|length=21:59|winner=1"
    "|t1h1=sora|t1h2=guin|t1h3=zhuxin|t1h4=granger|t1h5=chou"
    "|t2h1=phoveus|t2h2=leomord|t2h3=yve|t2h4=harith|t2h5=khaleed"
    "|t1b1=baxia|t1b2=valen|t1b3=kalea|t1b4=suyou|t1b5=harley"
    "|t2b1=freya|t2b2=marcel|t2b3=fanny|t2b4=gloo|t2b5=claude}}"
)


def _sample_game():
    return parse_map(
        RAW_MAP,
        series_id="MPLMYS17W1_M1",
        season="17",
        stage="regular_season",
        team1_raw="Selangor Red Giants",
        team2_raw="Team Vamos",
        played_at="April 3, 2026 - 17:00",
        game_number_in_series=1,
    )


def test_insert_game_writes_one_match_row():
    conn = _conn()
    seed_reference_tables(conn)

    match_id = insert_game(conn, _sample_game())

    row = conn.execute(
        "SELECT series_id, team1_id, team2_id, winner_id, game_length "
        "FROM matches WHERE id = ?",
        (match_id,),
    ).fetchone()
    srg_id, vamos_id = conn.execute(
        "SELECT id FROM teams WHERE canonical_name IN "
        "('Selangor Red Giants', 'Team Vamos') ORDER BY canonical_name"
    ).fetchall()
    srg_id, vamos_id = srg_id[0], vamos_id[0]
    assert row == ("MPLMYS17W1_M1", srg_id, vamos_id, srg_id, "21:59")


def test_insert_game_writes_twenty_draft_rows():
    conn = _conn()
    seed_reference_tables(conn)

    match_id = insert_game(conn, _sample_game())

    count = conn.execute(
        "SELECT COUNT(*) FROM drafts WHERE match_id = ?", (match_id,)
    ).fetchone()[0]
    assert count == 20

    guin_pick = conn.execute(
        """SELECT h.canonical_name FROM drafts d
           JOIN heroes h ON h.id = d.hero_id
           WHERE d.match_id = ? AND d.slot = 2 AND d.is_ban = 0
           AND d.team_id = (SELECT id FROM teams WHERE canonical_name = 'Selangor Red Giants')""",
        (match_id,),
    ).fetchone()[0]
    assert guin_pick == "guinevere"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_build.py -v`
Expected: FAIL — `ImportError: cannot import name 'insert_game' from 'mlbb_pipeline.build'`

- [ ] **Step 3: Write minimal implementation**

Append to `pipeline/src/mlbb_pipeline/build.py`:

```python
from .models import ParsedGame


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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_build.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/build.py pipeline/tests/test_build.py
git commit -m "feat: insert_game writes a parsed game as matches + drafts rows"
```

---

### Task 4: Discover snapshot files

**Files:**
- Modify: `pipeline/src/mlbb_pipeline/build.py` (append)
- Modify: `pipeline/tests/test_build.py` (append)

**Interfaces:**
- Produces: `discover_snapshots(root: Path) -> list[tuple[Path, str, str]]` (each tuple is `(path, season, stage)`) — used by `build_database` (Task 5).

- [ ] **Step 1: Write the failing test**

```python
# appended to pipeline/tests/test_build.py
from pathlib import Path

from mlbb_pipeline.build import discover_snapshots


def test_discover_snapshots_finds_regular_season_and_playoffs_only(tmp_path: Path):
    s17 = tmp_path / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text("a", encoding="utf-8")
    (s17 / "playoffs.wiki").write_text("b", encoding="utf-8")
    (s17 / "statistics.wiki").write_text("c", encoding="utf-8")
    stats = s17 / "statistics"
    stats.mkdir()
    (stats / "regular-season.wiki").write_text("d", encoding="utf-8")

    s18 = tmp_path / "mpl" / "malaysia" / "season-18"
    s18.mkdir(parents=True)
    (s18 / "regular-season.wiki").write_text("e", encoding="utf-8")

    found = discover_snapshots(tmp_path)

    assert sorted((season, stage) for _, season, stage in found) == [
        ("17", "playoffs"),
        ("17", "regular_season"),
        ("18", "regular_season"),
    ]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_build.py -v`
Expected: FAIL — `ImportError: cannot import name 'discover_snapshots' from 'mlbb_pipeline.build'`

- [ ] **Step 3: Write minimal implementation**

Append to `pipeline/src/mlbb_pipeline/build.py` (add `re` and `Path` to imports):

```python
import re
from pathlib import Path

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_build.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/build.py pipeline/tests/test_build.py
git commit -m "feat: discover_snapshots finds regular-season/playoffs wiki files"
```

---

### Task 5: `build_database` — full orchestration

**Files:**
- Modify: `pipeline/src/mlbb_pipeline/build.py` (append)
- Modify: `pipeline/tests/test_build.py` (append)

**Interfaces:**
- Consumes: `create_schema` (Task 1), `seed_reference_tables`, `insert_game`, `discover_snapshots` (Tasks 2-4), `parse_matchlist`, `parse_bracket` (`parser.py`, merged).
- Produces: `build_database(root: Path, db_path: Path) -> dict[str, int]` (keys `"games"`, `"series"`) — used by `main` (Task 6).

- [ ] **Step 1: Write the failing test**

```python
# appended to pipeline/tests/test_build.py
from mlbb_pipeline.build import build_database

RAW_MATCH = (
    "{{Match|bestof=3"
    "|opponent1={{TeamOpponent|Selangor Red Giants}}"
    "|opponent2={{TeamOpponent|Team Vamos}}"
    "|date=April 3, 2026 - 17:00 {{Abbr/MYT}}"
    "|map1=" + RAW_MAP + "}}"
)


def test_build_database_parses_regular_season_and_playoffs(tmp_path: Path):
    root = tmp_path / "raw"
    s17 = root / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text(
        "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    (s17 / "playoffs.wiki").write_text(
        "{{Bracket|Bracket/4L2DSU2L1D|id=MPLMYS17PL|R1M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    db_path = tmp_path / "mlbb.db"

    counts = build_database(root, db_path)

    assert counts == {"games": 2, "series": 2}
    conn = sqlite3.connect(db_path)
    stages = {
        row[0]
        for row in conn.execute("SELECT DISTINCT stage FROM matches").fetchall()
    }
    assert stages == {"regular_season", "playoffs"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_build.py -v`
Expected: FAIL — `ImportError: cannot import name 'build_database' from 'mlbb_pipeline.build'`

- [ ] **Step 3: Write minimal implementation**

Append to `pipeline/src/mlbb_pipeline/build.py` (add the new imports at the top alongside the existing ones):

```python
from .parser import parse_bracket, parse_matchlist
from .schema import create_schema

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_build.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/build.py pipeline/tests/test_build.py
git commit -m "feat: build_database orchestrates schema + seed + parse + insert"
```

---

### Task 6: Regression guard — halt if counts drop

**Files:**
- Modify: `pipeline/src/mlbb_pipeline/build.py` (append)
- Modify: `pipeline/tests/test_build.py` (append)

**Interfaces:**
- Consumes: `build_database` (Task 5).
- Produces: `RegressionError(RuntimeError)`, `check_no_regression(previous_db_path: Path, new_counts: dict[str, int]) -> None` — used by `main` (Task 7).

- [ ] **Step 1: Write the failing test**

```python
# appended to pipeline/tests/test_build.py
import pytest

from mlbb_pipeline.build import RegressionError, check_no_regression


def test_check_no_regression_passes_when_no_previous_db(tmp_path: Path):
    check_no_regression(tmp_path / "does-not-exist.db", {"games": 0, "series": 0})


def test_check_no_regression_passes_when_counts_hold_or_grow(tmp_path: Path):
    root = tmp_path / "raw"
    s17 = root / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text(
        "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    db_path = tmp_path / "mlbb.db"
    counts = build_database(root, db_path)

    check_no_regression(db_path, counts)  # same counts against itself


def test_check_no_regression_halts_on_fewer_games(tmp_path: Path):
    root = tmp_path / "raw"
    s17 = root / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text(
        "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    db_path = tmp_path / "mlbb.db"
    build_database(root, db_path)

    with pytest.raises(RegressionError):
        check_no_regression(db_path, {"games": 0, "series": 0})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_build.py -v`
Expected: FAIL — `ImportError: cannot import name 'RegressionError' from 'mlbb_pipeline.build'`

- [ ] **Step 3: Write minimal implementation**

Append to `pipeline/src/mlbb_pipeline/build.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_build.py -v`
Expected: PASS (9 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/build.py pipeline/tests/test_build.py
git commit -m "feat: check_no_regression halts a rebuild that loses games or series"
```

---

### Task 7: `main()` CLI entry point

**Files:**
- Modify: `pipeline/src/mlbb_pipeline/build.py` (append)
- Modify: `pipeline/tests/test_build.py` (append)
- Modify: `pipeline/pyproject.toml` (register console script)

**Interfaces:**
- Consumes: `build_database` (Task 5), `check_no_regression` (Task 6).
- Produces: `DEFAULT_DATA_ROOT: Path`, `DEFAULT_DB_PATH: Path`, `main(argv: list[str] | None = None) -> None` — the entry point the weekly GitHub Actions build (post-plan, not a task) invokes.

- [ ] **Step 1: Write the failing test**

```python
# appended to pipeline/tests/test_build.py
from mlbb_pipeline.build import main


def test_main_builds_db_and_prints_summary(tmp_path: Path, capsys):
    root = tmp_path / "raw"
    s17 = root / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text(
        "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    db_path = tmp_path / "mlbb.db"

    main(["--root", str(root), "--db", str(db_path)])

    assert db_path.exists()
    captured = capsys.readouterr()
    assert "games=1" in captured.out
    assert "series=1" in captured.out


def test_main_halts_and_leaves_committed_db_untouched_on_regression(
    tmp_path: Path, capsys
):
    root = tmp_path / "raw"
    s17 = root / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text(
        "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    db_path = tmp_path / "mlbb.db"
    main(["--root", str(root), "--db", str(db_path)])
    before = db_path.read_bytes()

    (s17 / "regular-season.wiki").write_text("{{Matchlist|id=MPLMYS17W1}}", encoding="utf-8")
    with pytest.raises(RegressionError):
        main(["--root", str(root), "--db", str(db_path)])

    assert db_path.read_bytes() == before
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_build.py -v`
Expected: FAIL — `ImportError: cannot import name 'main' from 'mlbb_pipeline.build'`

- [ ] **Step 3: Write minimal implementation**

Append to `pipeline/src/mlbb_pipeline/build.py` (add `argparse` to imports):

```python
import argparse

# data/ lives at the repo root, sibling to pipeline/ (stack.md), same
# convention as aliases.py's DATA_DIR and backfill.py's DEFAULT_DATA_ROOT:
# parents[3] from this file is the repo root.
DEFAULT_DATA_ROOT = Path(__file__).resolve().parents[3] / "data" / "raw"
DEFAULT_DB_PATH = Path(__file__).resolve().parents[3] / "data" / "mlbb.db"


def main(argv: list[str] | None = None) -> None:
    """CLI entry point: rebuild the SQLite archive from every committed
    snapshot. Builds to a temp path first and only replaces the committed
    db if check_no_regression passes — a failed check leaves the
    previously committed db untouched and exits via the raised exception
    (stack.md: 'a failed validation never publishes')."""
    parser = argparse.ArgumentParser(
        description="Build the SQLite archive from data/raw/ snapshots."
    )
    parser.add_argument("--root", type=Path, default=DEFAULT_DATA_ROOT)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    args = parser.parse_args(argv)

    tmp_path = args.db.with_suffix(".tmp")
    counts = build_database(args.root, tmp_path)
    check_no_regression(args.db, counts)
    tmp_path.replace(args.db)

    print(f"games={counts['games']} series={counts['series']}")


if __name__ == "__main__":
    main()
```

Register a console script in `pipeline/pyproject.toml`, alongside the existing `mlbb-backfill` entry:

```toml
[project.scripts]
mlbb-backfill = "mlbb_pipeline.backfill:main"
mlbb-build = "mlbb_pipeline.build:main"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_build.py -v`
Expected: PASS (11 passed)

- [ ] **Step 5: Run the full test suite**

Run: `uv run --project pipeline pytest pipeline/tests -v`
Expected: All tests from this plan plus every merged plan pass (63 passed), pristine output, no warnings.

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/mlbb_pipeline/build.py pipeline/tests/test_build.py pipeline/pyproject.toml
git commit -m "feat: mlbb-build CLI rebuilds and swaps in the SQLite archive"
```

---

## Not in this plan — the live run and beyond

Deliberately excluded from TDD tasks:

- **Actually invoking `main()` against the real `data/raw/` and committing `data/mlbb.db`.** A one-shot operational run, not a subsystem with a stable interface to test against. Runbook once this plan is merged: `uv run --project pipeline mlbb-build`, inspect the printed `games=`/`series=` line against data-source.md's verified 164/64, commit `data/mlbb.db`.
- **The "aggregate team records not matching published standings" invariant** (stack.md). Needs a standings-page wikitext parser that does not exist. A future plan's concern once a standings source is identified on the wiki.
- **`team_names` population.** The table exists (Task 1) but is left empty by this plan. database.md is explicit that it is "a precaution, not a response to observed data" — no reliable single display name per team per season exists in the source (some teams use multiple castings within the same season), so populating it would mean picking one arbitrarily. Revisit if a real per-season rename is ever observed.
- **Metrics computation (presence, HHI, baselines) and JSON emission for the frontend.** The next plan, reading from the archive this plan builds.
- **CI wiring (GitHub Actions).** stack.md's weekly build job; a separate, later concern.
