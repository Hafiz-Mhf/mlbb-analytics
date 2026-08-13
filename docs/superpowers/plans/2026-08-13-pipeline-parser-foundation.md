# Pipeline Parser Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `pipeline/` Python project and build the wikitext→typed-record core: Pydantic models, hero/team alias normalization with halt-on-unknown, and a brace-matching parser for `{{Matchlist}}`/`{{Match}}`/`{{Map}}`, proven against a golden wikitext fixture.

**Architecture:** A `uv`-managed package (`mlbb_pipeline`) with no I/O dependencies in this plan — it consumes wikitext strings and produces validated `ParsedGame` Pydantic objects in memory. Three layers: `models.py` (schema), `aliases.py` (curated JSON lookup tables with hard-fail on unknown strings), `parser.py` (three generic brace-aware template primitives, composed into `parse_map` → `parse_match` → `parse_matchlist`). Fetching from Liquipedia, snapshotting, SQLite, metrics, and CI are explicitly out of scope — see "Not in this plan" at the end.

**Tech Stack:** Python 3.12, `uv`, Pydantic v2, pytest. No `httpx` usage yet (added when the fetcher is built).

**Spec:** `CLAUDE.md`, `docs/data-source.md`, `docs/database.md`, `docs/stack.md`

## Global Constraints

- Python 3.12, `uv` for venv/deps/lockfile — no pip/poetry (stack.md).
- No backend server; the pipeline is a build-time script, never a service (stack.md).
- Any hero string not in the alias table halts the pipeline — never silently create a new hero (data-source.md Hazard 1; database.md; stack.md correctness layer).
- Any team string not in the alias table halts the pipeline — same rule, one level up (data-source.md Hazard 3; database.md).
- Alias matching is case-insensitive; short forms are curated data, not fuzzy/prefix heuristics — `yss`→`yi sun-shin` and `yz`→`yu zhong` prove heuristics fail (data-source.md).
- No `role` field/column on heroes. Role is derived from `drafts.slot` per pick, never stored on the hero (database.md; CLAUDE.md).
- `finished=skip` map blocks are unplayed placeholders and must be filtered out, never stored (data-source.md field map).
- Brace-matching is required, not optional — a flat regex over `{{TeamOpponent|...}}` recovered only 56/64 known series because nested `substitutes={{PlayerSubstitutions|...}}` spans lines and contains braces (data-source.md).
- Every played game must have exactly 10 picks and 10 bans; anything else is a hard failure (stack.md correctness layer).
- No `patch` field anywhere — not modeled (database.md).

---

## File Structure

```
pipeline/
  pyproject.toml
  src/mlbb_pipeline/
    __init__.py
    models.py       # Team, Hero, MatchRecord, DraftRecord, ParsedGame
    aliases.py       # resolve_hero(), resolve_team(), UnknownHeroError, UnknownTeamError
    parser.py         # brace-matching primitives + parse_map/parse_match/parse_matchlist
  tests/
    fixtures/
      s17_w1_sample.wiki
    test_models.py
    test_aliases.py
    test_parser_primitives.py
    test_parser_map.py
    test_parser_match.py
    test_golden_fixture.py
data/
  aliases/
    hero_aliases.json
    team_aliases.json
```

`data/aliases/*.json` live at the repo root (sibling to `pipeline/`), per the monorepo layout in stack.md and the `data/raw/` convention in database.md. They are seed tables — they cover the fixture used here plus every short form documented in data-source.md Hazard 1/3. They get extended with the rest of the 94 hero strings / 16 team strings when the fetcher and backfill run (Phase 2, not this plan).

---

### Task 1: Project scaffold

**Files:**
- Create: `pipeline/pyproject.toml`
- Create: `pipeline/src/mlbb_pipeline/__init__.py`
- Test: `pipeline/tests/test_package.py`

**Interfaces:**
- Produces: `mlbb_pipeline.__version__: str`, importable package `mlbb_pipeline` for every later task.

- [x] **Step 1: Write the failing test**

```python
# pipeline/tests/test_package.py
import mlbb_pipeline


def test_package_exposes_version():
    assert mlbb_pipeline.__version__ == "0.1.0"
```

- [x] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_package.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mlbb_pipeline'` (pyproject.toml doesn't exist yet either, so `uv run` itself will fail to find a project; that failure counts as the expected RED).

- [x] **Step 3: Write minimal implementation**

```toml
# pipeline/pyproject.toml
[project]
name = "mlbb-pipeline"
version = "0.1.0"
description = "Build-time pipeline: Liquipedia wikitext -> SQLite -> JSON for MLBB Analytics"
requires-python = ">=3.12"
dependencies = [
    "pydantic>=2.7",
]

[project.optional-dependencies]
dev = ["pytest>=8.0"]

[tool.pytest.ini_options]
testpaths = ["tests"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/mlbb_pipeline"]

[dependency-groups]
dev = ["pytest>=8.0"]
```

```python
# pipeline/src/mlbb_pipeline/__init__.py
__version__ = "0.1.0"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_package.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/pyproject.toml pipeline/src/mlbb_pipeline/__init__.py pipeline/tests/test_package.py
git commit -m "chore: scaffold pipeline uv project"
```

---

### Task 2: Pydantic models

**Files:**
- Create: `pipeline/src/mlbb_pipeline/models.py`
- Test: `pipeline/tests/test_models.py`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `DraftRecord(team_slot: Literal[1,2], slot: int, hero: str, is_ban: bool)`, `MatchRecord(series_id, season, stage: Literal["regular_season","playoffs"], team1: str, team2: str, team1_side: Literal["blue","red"], winner: Literal[1,2], game_length: str, game_number_in_series: int, played_at: str | None)`, `ParsedGame(match: MatchRecord, drafts: list[DraftRecord])` — used by every parser task below.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_models.py
import pytest
from pydantic import ValidationError

from mlbb_pipeline.models import DraftRecord, MatchRecord, ParsedGame


def _match(**overrides) -> MatchRecord:
    base = dict(
        series_id="MPLMYS17W1_M1",
        season="17",
        stage="regular_season",
        team1="Selangor Red Giants",
        team2="Team Vamos",
        team1_side="blue",
        winner=1,
        game_length="21:59",
        game_number_in_series=1,
        played_at="April 3, 2026 - 17:00",
    )
    base.update(overrides)
    return MatchRecord(**base)


def _draft(team_slot: int, slot: int, hero: str, is_ban: bool) -> DraftRecord:
    return DraftRecord(team_slot=team_slot, slot=slot, hero=hero, is_ban=is_ban)


def test_draft_record_rejects_slot_out_of_range():
    with pytest.raises(ValidationError):
        DraftRecord(team_slot=1, slot=6, hero="chou", is_ban=False)


def test_parsed_game_rejects_wrong_pick_or_ban_count():
    drafts = [_draft(1, 1, "sora", False)]  # only 1 pick, 0 bans
    with pytest.raises(ValidationError, match="10 picks and 10 bans"):
        ParsedGame(match=_match(), drafts=drafts)


def test_parsed_game_accepts_ten_picks_and_ten_bans():
    drafts = [_draft(1, s, f"pick-a-{s}", False) for s in range(1, 6)]
    drafts += [_draft(2, s, f"pick-b-{s}", False) for s in range(1, 6)]
    drafts += [_draft(1, s, f"ban-a-{s}", True) for s in range(1, 6)]
    drafts += [_draft(2, s, f"ban-b-{s}", True) for s in range(1, 6)]

    game = ParsedGame(match=_match(), drafts=drafts)

    assert len(game.drafts) == 20
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mlbb_pipeline.models'`

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/src/mlbb_pipeline/models.py
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class Team(BaseModel):
    canonical_name: str
    short_code: str | None = None


class Hero(BaseModel):
    canonical_name: str


class DraftRecord(BaseModel):
    """One pick or ban. `slot` means role (1=EXP..5=Roam) when is_ban is False,
    and ban order (not role) when is_ban is True — see database.md."""

    team_slot: Literal[1, 2]
    slot: int = Field(ge=1, le=5)
    hero: str
    is_ban: bool


class MatchRecord(BaseModel):
    """One played game. `winner`/`team_slot` refer to opponent 1 or 2 as written
    in the wikitext; resolving them to real team ids happens at DB-build time,
    outside this plan's scope."""

    series_id: str
    season: str
    stage: Literal["regular_season", "playoffs"]
    team1: str
    team2: str
    team1_side: Literal["blue", "red"]
    winner: Literal[1, 2]
    game_length: str
    game_number_in_series: int = Field(ge=1)
    played_at: str | None = None


class ParsedGame(BaseModel):
    match: MatchRecord
    drafts: list[DraftRecord]

    @field_validator("drafts")
    @classmethod
    def must_have_ten_picks_and_ten_bans(cls, v: list[DraftRecord]) -> list[DraftRecord]:
        picks = [d for d in v if not d.is_ban]
        bans = [d for d in v if d.is_ban]
        if len(picks) != 10 or len(bans) != 10:
            raise ValueError(
                f"expected 10 picks and 10 bans, got {len(picks)} picks and {len(bans)} bans"
            )
        return v
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_models.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/models.py pipeline/tests/test_models.py
git commit -m "feat: add pipeline Pydantic models with 10-pick/10-ban invariant"
```

---

### Task 3: Hero alias resolution

**Files:**
- Create: `data/aliases/hero_aliases.json`
- Create: `pipeline/src/mlbb_pipeline/aliases.py`
- Test: `pipeline/tests/test_aliases.py`

**Interfaces:**
- Produces: `resolve_hero(raw: str) -> str`, `UnknownHeroError(ValueError)` — used by `parser.py` (Task 6).

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_aliases.py
import pytest

from mlbb_pipeline.aliases import UnknownHeroError, resolve_hero


def test_resolve_hero_normalizes_full_name_casing():
    assert resolve_hero("Guinevere") == "guinevere"


def test_resolve_hero_normalizes_documented_short_forms():
    assert resolve_hero("guin") == "guinevere"
    assert resolve_hero("yz") == "yu zhong"
    assert resolve_hero("yss") == "yi sun-shin"
    assert resolve_hero("phove") == "phoveus"


def test_resolve_hero_strips_whitespace():
    assert resolve_hero("  valen  ") == "valentina"


def test_resolve_hero_unknown_string_halts():
    with pytest.raises(UnknownHeroError):
        resolve_hero("totally-not-a-hero")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_aliases.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mlbb_pipeline.aliases'`

- [ ] **Step 3: Write minimal implementation**

```json
{
  "sora": "sora",
  "guin": "guinevere",
  "guinevere": "guinevere",
  "zhuxin": "zhuxin",
  "granger": "granger",
  "chou": "chou",
  "phove": "phoveus",
  "phoveus": "phoveus",
  "leo": "leomord",
  "leomord": "leomord",
  "yve": "yve",
  "harith": "harith",
  "khaleed": "khaleed",
  "baxia": "baxia",
  "valen": "valentina",
  "valentina": "valentina",
  "kalea": "kalea",
  "suyou": "suyou",
  "harley": "harley",
  "freya": "freya",
  "marcel": "marcel",
  "fanny": "fanny",
  "gloo": "gloo",
  "claude": "claude",
  "arlot": "arlott",
  "arlott": "arlott",
  "bene": "benedetta",
  "benedetta": "benedetta",
  "esme": "esmeralda",
  "esmeralda": "esmeralda",
  "fred": "fredrinn",
  "fredrinn": "fredrinn",
  "gatot": "gatotkaca",
  "gatotkaca": "gatotkaca",
  "lance": "lancelot",
  "lancelot": "lancelot",
  "lapu": "lapu-lapu",
  "lapu-lapu": "lapu-lapu",
  "luoyi": "luo yi",
  "luo yi": "luo yi",
  "yss": "yi sun-shin",
  "yi sun-shin": "yi sun-shin",
  "yz": "yu zhong",
  "yu zhong": "yu zhong"
}
```

Save this as `data/aliases/hero_aliases.json`. This seed covers every hero in the golden fixture (Task 8) plus every short/full pair documented in data-source.md Hazard 1. It is extended with the remaining S17 hero strings when the fetcher runs against the live wiki (Phase 2, not this plan) — comment that fact in `aliases.py`, not in the JSON (JSON has no comments).

```python
# pipeline/src/mlbb_pipeline/aliases.py
from __future__ import annotations

import json
from pathlib import Path

# data/aliases/*.json live at the repo root, sibling to pipeline/ (stack.md monorepo
# layout). These are seed tables: they cover the golden fixture plus every alias
# documented in data-source.md. Extend them during the Season 17 backfill (Phase 2).
DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "aliases"


class UnknownHeroError(ValueError):
    """Raised when a wikitext hero string has no entry in hero_aliases.json.
    Never catch this to silently invent a new hero — add the string to the
    alias table instead (data-source.md Hazard 1)."""


class UnknownTeamError(ValueError):
    """Raised when a wikitext team string has no entry in team_aliases.json.
    Same rule as UnknownHeroError, one level up (data-source.md Hazard 3)."""


def _load_alias_table(filename: str) -> dict[str, str]:
    path = DATA_DIR / filename
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


_hero_aliases_cache: dict[str, str] | None = None
_team_aliases_cache: dict[str, str] | None = None


def _hero_aliases() -> dict[str, str]:
    global _hero_aliases_cache
    if _hero_aliases_cache is None:
        _hero_aliases_cache = _load_alias_table("hero_aliases.json")
    return _hero_aliases_cache


def _team_aliases() -> dict[str, str]:
    global _team_aliases_cache
    if _team_aliases_cache is None:
        _team_aliases_cache = _load_alias_table("team_aliases.json")
    return _team_aliases_cache


def resolve_hero(raw: str) -> str:
    key = raw.strip().lower()
    table = _hero_aliases()
    if key not in table:
        raise UnknownHeroError(
            f"unrecognized hero string {raw!r} — add it to data/aliases/hero_aliases.json, "
            "never invent a new hero silently"
        )
    return table[key]


def resolve_team(raw: str) -> str:
    key = " ".join(raw.strip().lower().split())
    table = _team_aliases()
    if key not in table:
        raise UnknownTeamError(
            f"unrecognized team string {raw!r} — add it to data/aliases/team_aliases.json, "
            "never invent a new team silently"
        )
    return table[key]
```

Note: `resolve_team` is implemented here already (Task 4 adds its test and the JSON table it depends on). `data/aliases/team_aliases.json` does not exist yet after this task, so any code path calling `resolve_team` before Task 4 will raise `FileNotFoundError` — that's fine, nothing in this task calls it yet.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_aliases.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add data/aliases/hero_aliases.json pipeline/src/mlbb_pipeline/aliases.py pipeline/tests/test_aliases.py
git commit -m "feat: hero alias normalization with halt-on-unknown"
```

---

### Task 4: Team alias resolution

**Files:**
- Create: `data/aliases/team_aliases.json`
- Modify: `pipeline/tests/test_aliases.py` (append team tests)

**Interfaces:**
- Produces: confirms `resolve_team(raw: str) -> str` (already written in Task 3) against real data — used by `parser.py` (Task 7).

- [ ] **Step 1: Write the failing test**

```python
# appended to pipeline/tests/test_aliases.py
from mlbb_pipeline.aliases import UnknownTeamError, resolve_team


def test_resolve_team_normalizes_case_variants():
    assert resolve_team("Bigetron MY by VIT") == "Bigetron MY by VIT"
    assert resolve_team("bigetron my by vit") == "Bigetron MY by VIT"
    assert resolve_team("Bigetron MY by Vit") == "Bigetron MY by VIT"


def test_resolve_team_normalizes_short_forms():
    assert resolve_team("ig") == "Invictus Gaming"
    assert resolve_team("All Combo") == "AC Esports"


def test_resolve_team_unknown_string_halts():
    with pytest.raises(UnknownTeamError):
        resolve_team("Definitely Not A Team")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_aliases.py -v`
Expected: FAIL — `FileNotFoundError` from `_load_alias_table("team_aliases.json")` (the file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

```json
{
  "ac esports": "AC Esports",
  "all combo": "AC Esports",
  "ac": "AC Esports",
  "bigetron my by vit": "Bigetron MY by VIT",
  "invictus gaming": "Invictus Gaming",
  "ig": "Invictus Gaming",
  "rrq tora": "RRQ Tora",
  "selangor red giants": "Selangor Red Giants",
  "srg": "Selangor Red Giants",
  "team flash": "Team Flash",
  "team rey": "Team Rey",
  "team vamos": "Team Vamos"
}
```

Save as `data/aliases/team_aliases.json`. Case variants (`Bigetron MY by VIT` / `by Vit` / lowercase) collapse for free because `resolve_team` lowercases before lookup — only genuinely different strings (`ig`, `All Combo`) need their own key. This covers the 8 teams plus every alias documented in data-source.md Hazard 3.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_aliases.py -v`
Expected: PASS (7 passed)

- [ ] **Step 5: Commit**

```bash
git add data/aliases/team_aliases.json pipeline/tests/test_aliases.py
git commit -m "feat: team alias normalization with halt-on-unknown"
```

---

### Task 5: Brace-matching parser primitives

**Files:**
- Create: `pipeline/src/mlbb_pipeline/parser.py`
- Test: `pipeline/tests/test_parser_primitives.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `find_matching_close(text: str, open_idx: int) -> int`, `split_top_level(body: str) -> list[str]`, `params_dict(parts: list[str]) -> dict[str, str]`, `find_template_calls(text: str, name: str) -> list[str]`, `strip_comments(text: str) -> str` — used by Tasks 6 and 7.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_parser_primitives.py
from mlbb_pipeline.parser import (
    find_matching_close,
    find_template_calls,
    params_dict,
    split_top_level,
    strip_comments,
)


def test_find_matching_close_handles_nesting():
    text = "{{Outer|a={{Inner|b=1}}|c=2}}"
    open_idx = text.index("{{Outer")
    close_idx = find_matching_close(text, open_idx)
    assert text[close_idx] == "}"
    assert text[open_idx:close_idx + 1] == text  # whole string is one template


def test_split_top_level_ignores_pipes_inside_nested_braces():
    body = "a=1|b={{Inner|x=1|y=2}}|c=3"
    assert split_top_level(body) == ["a=1", "b={{Inner|x=1|y=2}}", "c=3"]


def test_params_dict_ignores_positional_parts():
    parts = ["Team Name", "a=1", "b=2"]
    assert params_dict(parts) == {"a": "1", "b": "2"}


def test_find_template_calls_extracts_nested_body():
    text = "prefix {{TeamOpponent|Selangor Red Giants|substitutes={{PlayerSubstitutions|{{Substitution|in=Unii|out=Sekys}}}}}} suffix"
    bodies = find_template_calls(text, "TeamOpponent")
    assert len(bodies) == 1
    assert bodies[0].startswith("Selangor Red Giants")
    assert "PlayerSubstitutions" in bodies[0]


def test_find_template_calls_returns_multiple_in_order():
    text = "{{Map|winner=1}} and {{Map|winner=2}}"
    bodies = find_template_calls(text, "Map")
    assert bodies == ["winner=1", "winner=2"]


def test_strip_comments_removes_html_comments():
    text = "a=1 <!-- Hero picks --> |b=2"
    assert strip_comments(text) == "a=1  |b=2"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_parser_primitives.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mlbb_pipeline.parser'`

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/src/mlbb_pipeline/parser.py
from __future__ import annotations

import re


def strip_comments(text: str) -> str:
    """Remove HTML comments (e.g. '<!-- Hero picks -->') before template
    parsing — they contain no braces so they can't desync brace matching,
    but left in place they corrupt whichever param they trail."""
    return re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)


def find_matching_close(text: str, open_idx: int) -> int:
    """open_idx is the index of the first '{' of a '{{' pair. Returns the
    index of the *second* '}' of the matching '}}', tracking nested pairs."""
    depth = 0
    i = open_idx
    n = len(text)
    while i < n:
        pair = text[i:i + 2]
        if pair == "{{":
            depth += 1
            i += 2
            continue
        if pair == "}}":
            depth -= 1
            i += 2
            if depth == 0:
                return i - 1
            continue
        i += 1
    raise ValueError(f"unmatched '{{{{' starting at index {open_idx}")


def split_top_level(body: str) -> list[str]:
    """Split body on '|' characters that are not nested inside '{{ }}'."""
    parts: list[str] = []
    depth = 0
    buf: list[str] = []
    i = 0
    n = len(body)
    while i < n:
        pair = body[i:i + 2]
        if pair == "{{":
            depth += 1
            buf.append(pair)
            i += 2
            continue
        if pair == "}}":
            depth -= 1
            buf.append(pair)
            i += 2
            continue
        ch = body[i]
        if ch == "|" and depth == 0:
            parts.append("".join(buf))
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    parts.append("".join(buf))
    return parts


def params_dict(parts: list[str]) -> dict[str, str]:
    """Turn 'key=value' parts into a dict, keeping insertion order. Positional
    (no top-level '=') parts, e.g. a TeamOpponent's team name, are ignored."""
    params: dict[str, str] = {}
    for part in parts:
        if "=" not in part:
            continue
        key, _, value = part.partition("=")
        params[key.strip()] = value.strip()
    return params


def find_template_calls(text: str, name: str) -> list[str]:
    """Find every top-level '{{name|...}}' occurrence in text, brace-matched.
    Returns the raw body of each occurrence (leading '|' stripped), in order."""
    marker = "{{" + name
    lower_text = text.lower()
    lower_marker = marker.lower()
    bodies: list[str] = []
    i = 0
    while True:
        idx = lower_text.find(lower_marker, i)
        if idx == -1:
            break
        close = find_matching_close(text, idx)
        body = text[idx + len(marker):close - 1]
        if body.startswith("|"):
            body = body[1:]
        bodies.append(body)
        i = close + 1
    return bodies
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_parser_primitives.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/parser.py pipeline/tests/test_parser_primitives.py
git commit -m "feat: brace-matching template parsing primitives"
```

---

### Task 6: Parse a Map block

**Files:**
- Modify: `pipeline/src/mlbb_pipeline/parser.py` (append `parse_map`)
- Test: `pipeline/tests/test_parser_map.py`

**Interfaces:**
- Consumes: `find_template_calls`, `split_top_level`, `params_dict` (Task 5), `resolve_hero` (Task 3), `resolve_team` (Task 4), `ParsedGame`/`MatchRecord`/`DraftRecord` (Task 2).
- Produces: `parse_map(raw_value: str, *, series_id: str, season: str, stage: Literal["regular_season","playoffs"], team1_raw: str, team2_raw: str, played_at: str | None, game_number_in_series: int) -> ParsedGame | None` — used by `parse_match` (Task 7).

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_parser_map.py
import pytest

from mlbb_pipeline.aliases import UnknownHeroError
from mlbb_pipeline.parser import parse_map

RAW_MAP = (
    "{{Map|team1side=blue|team2side=red|length=21:59|winner=1"
    "|t1h1=sora|t1h2=guin|t1h3=zhuxin|t1h4=granger|t1h5=chou"
    "|t2h1=phoveus|t2h2=leomord|t2h3=yve|t2h4=harith|t2h5=khaleed"
    "|t1b1=baxia|t1b2=valen|t1b3=kalea|t1b4=suyou|t1b5=harley"
    "|t2b1=freya|t2b2=marcel|t2b3=fanny|t2b4=gloo|t2b5=claude}}"
)


def _kwargs(**overrides):
    base = dict(
        series_id="MPLMYS17W1_M1",
        season="17",
        stage="regular_season",
        team1_raw="Selangor Red Giants",
        team2_raw="Team Vamos",
        played_at="April 3, 2026 - 17:00",
        game_number_in_series=1,
    )
    base.update(overrides)
    return base


def test_parse_map_returns_none_for_finished_skip():
    game = parse_map("{{Map|finished=skip}}", **_kwargs())
    assert game is None


def test_parse_map_builds_match_record():
    game = parse_map(RAW_MAP, **_kwargs())
    assert game is not None
    assert game.match.team1 == "Selangor Red Giants"
    assert game.match.team1_side == "blue"
    assert game.match.winner == 1
    assert game.match.game_length == "21:59"


def test_parse_map_normalizes_hero_short_forms():
    game = parse_map(RAW_MAP, **_kwargs())
    picks = {(d.team_slot, d.slot): d.hero for d in game.drafts if not d.is_ban}
    bans = {(d.team_slot, d.slot): d.hero for d in game.drafts if d.is_ban}
    assert picks[(1, 2)] == "guinevere"
    assert bans[(1, 2)] == "valentina"
    assert len(picks) == 10
    assert len(bans) == 10


def test_parse_map_halts_on_unknown_hero():
    bad_map = RAW_MAP.replace("t1h1=sora", "t1h1=not-a-real-hero")
    with pytest.raises(UnknownHeroError):
        parse_map(bad_map, **_kwargs())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_parser_map.py -v`
Expected: FAIL — `ImportError: cannot import name 'parse_map' from 'mlbb_pipeline.parser'`

- [ ] **Step 3: Write minimal implementation**

Append to `pipeline/src/mlbb_pipeline/parser.py`:

```python
from typing import Literal

from .aliases import resolve_hero, resolve_team
from .models import DraftRecord, MatchRecord, ParsedGame


def parse_map(
    raw_value: str,
    *,
    series_id: str,
    season: str,
    stage: Literal["regular_season", "playoffs"],
    team1_raw: str,
    team2_raw: str,
    played_at: str | None,
    game_number_in_series: int,
) -> ParsedGame | None:
    """Parse one '{{Map|...}}' template. Returns None if the game is
    finished=skip — an unplayed placeholder in an unfinished series
    (data-source.md field map) that must never be stored."""
    bodies = find_template_calls(raw_value, "Map")
    if not bodies:
        raise ValueError(f"no Map template found in {raw_value!r}")
    params = params_dict(split_top_level(bodies[0]))

    if params.get("finished") == "skip":
        return None

    match = MatchRecord(
        series_id=series_id,
        season=season,
        stage=stage,
        team1=resolve_team(team1_raw),
        team2=resolve_team(team2_raw),
        team1_side=params["team1side"],
        winner=int(params["winner"]),
        game_length=params["length"],
        game_number_in_series=game_number_in_series,
        played_at=played_at,
    )

    drafts: list[DraftRecord] = []
    for team_slot in (1, 2):
        for slot in range(1, 6):
            raw_hero = params.get(f"t{team_slot}h{slot}")
            if raw_hero:
                drafts.append(
                    DraftRecord(
                        team_slot=team_slot,
                        slot=slot,
                        hero=resolve_hero(raw_hero),
                        is_ban=False,
                    )
                )
        for slot in range(1, 6):
            raw_hero = params.get(f"t{team_slot}b{slot}")
            if raw_hero:
                drafts.append(
                    DraftRecord(
                        team_slot=team_slot,
                        slot=slot,
                        hero=resolve_hero(raw_hero),
                        is_ban=True,
                    )
                )

    return ParsedGame(match=match, drafts=drafts)
```

Add the `from typing import Literal` and the two new imports to the top of the file rather than mid-file — keep all imports at the top of `parser.py` when applying this step.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_parser_map.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/parser.py pipeline/tests/test_parser_map.py
git commit -m "feat: parse Map blocks into ParsedGame, filtering finished=skip"
```

---

### Task 7: Parse Match and Matchlist

**Files:**
- Modify: `pipeline/src/mlbb_pipeline/parser.py` (append `parse_team_opponent`, `strip_date_template_suffix`, `parse_match`, `parse_matchlist`)
- Test: `pipeline/tests/test_parser_match.py`

**Interfaces:**
- Consumes: `find_template_calls`, `split_top_level`, `params_dict`, `strip_comments` (Task 5), `parse_map` (Task 6).
- Produces: `parse_matchlist(text: str, *, season: str, stage: Literal["regular_season","playoffs"]) -> list[ParsedGame]` — the public entry point used by the fetcher/backfill in Phase 2, and by the golden-fixture test (Task 8).

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_parser_match.py
from mlbb_pipeline.parser import (
    parse_match,
    parse_matchlist,
    parse_team_opponent,
    strip_date_template_suffix,
)

RAW_MATCH = (
    "{{Match|bestof=3"
    "|opponent1={{TeamOpponent|Selangor Red Giants}}"
    "|opponent2={{TeamOpponent|Team Vamos}}"
    "|date=April 3, 2026 - 17:00 {{Abbr/MYT}}"
    "|map1={{Map|team1side=blue|team2side=red|length=21:59|winner=1"
    "|t1h1=sora|t1h2=guin|t1h3=zhuxin|t1h4=granger|t1h5=chou"
    "|t2h1=phoveus|t2h2=leomord|t2h3=yve|t2h4=harith|t2h5=khaleed"
    "|t1b1=baxia|t1b2=valen|t1b3=kalea|t1b4=suyou|t1b5=harley"
    "|t2b1=freya|t2b2=marcel|t2b3=fanny|t2b4=gloo|t2b5=claude}}"
    "|map2={{Map|finished=skip}}"
    "}}"
)


def test_strip_date_template_suffix_removes_trailing_template():
    assert strip_date_template_suffix("April 3, 2026 - 17:00 {{Abbr/MYT}}") == "April 3, 2026 - 17:00"


def test_parse_team_opponent_extracts_positional_name():
    assert parse_team_opponent("{{TeamOpponent|Team Vamos}}") == "Team Vamos"


def test_parse_team_opponent_extracts_name_with_nested_substitutes():
    raw = "{{TeamOpponent|Selangor Red Giants|substitutes={{PlayerSubstitutions|{{Substitution|in=Unii|out=Sekys}}}}}}"
    assert parse_team_opponent(raw) == "Selangor Red Giants"


def test_parse_match_returns_only_played_games():
    games = parse_match(RAW_MATCH, series_id="MPLMYS17W1_M1", season="17", stage="regular_season")
    assert len(games) == 1
    assert games[0].match.team1 == "Selangor Red Giants"
    assert games[0].match.team2 == "Team Vamos"
    assert games[0].match.played_at == "April 3, 2026 - 17:00"
    assert games[0].match.game_number_in_series == 1


def test_parse_matchlist_builds_series_id_from_matchlist_id_and_key():
    # M1's value is the full RAW_MATCH template, wrapped in a Matchlist.
    text = "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}"
    games = parse_matchlist(text, season="17", stage="regular_season")
    assert len(games) == 1
    assert games[0].match.series_id == "MPLMYS17W1_M1"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_parser_match.py -v`
Expected: FAIL — `ImportError: cannot import name 'parse_match' from 'mlbb_pipeline.parser'`

- [ ] **Step 3: Write minimal implementation**

Append to `pipeline/src/mlbb_pipeline/parser.py` (add `import re` at the top if not already present from Task 5 — it already is):

```python
DATE_TEMPLATE_SUFFIX = re.compile(r"\s*\{\{[^{}]*\}\}\s*$")


def strip_date_template_suffix(raw_date: str) -> str:
    """'April 3, 2026 - 17:00 {{Abbr/MYT}}' -> 'April 3, 2026 - 17:00'
    (data-source.md: 'template suffix must be stripped')."""
    previous = None
    current = raw_date
    while previous != current:
        previous = current
        current = DATE_TEMPLATE_SUFFIX.sub("", current)
    return current.strip()


def parse_team_opponent(raw_value: str) -> str:
    """raw_value looks like '{{TeamOpponent|Selangor Red Giants|substitutes=...}}'.
    Returns the raw (unresolved) team name string — call resolve_team() on it."""
    bodies = find_template_calls(raw_value, "TeamOpponent")
    if not bodies:
        raise ValueError(f"no TeamOpponent template found in {raw_value!r}")
    parts = split_top_level(bodies[0])
    if not parts or "=" in parts[0]:
        raise ValueError(f"TeamOpponent has no positional team name: {raw_value!r}")
    return parts[0].strip()


def parse_match(
    raw_value: str,
    *,
    series_id: str,
    season: str,
    stage: Literal["regular_season", "playoffs"],
) -> list[ParsedGame]:
    """Parse one '{{Match|...}}' template into its played games (finished=skip
    maps are dropped by parse_map)."""
    bodies = find_template_calls(raw_value, "Match")
    if not bodies:
        raise ValueError(f"no Match template found in {raw_value!r}")
    params = params_dict(split_top_level(bodies[0]))

    team1_raw = parse_team_opponent(params["opponent1"])
    team2_raw = parse_team_opponent(params["opponent2"])
    played_at = strip_date_template_suffix(params["date"]) if "date" in params else None

    map_keys = sorted(
        (k for k in params if re.fullmatch(r"map\d+", k)),
        key=lambda k: int(k[3:]),
    )

    games: list[ParsedGame] = []
    for key in map_keys:
        game_number = int(key[3:])
        game = parse_map(
            params[key],
            series_id=series_id,
            season=season,
            stage=stage,
            team1_raw=team1_raw,
            team2_raw=team2_raw,
            played_at=played_at,
            game_number_in_series=game_number,
        )
        if game is not None:
            games.append(game)
    return games


def parse_matchlist(
    text: str,
    *,
    season: str,
    stage: Literal["regular_season", "playoffs"],
) -> list[ParsedGame]:
    """Parse every '{{Matchlist|...}}' template in a page's wikitext into
    played games across all its series. Public entry point for a whole page."""
    text = strip_comments(text)
    games: list[ParsedGame] = []
    for body in find_template_calls(text, "Matchlist"):
        params = params_dict(split_top_level(body))
        matchlist_id = params.get("id", "unknown")
        series_keys = sorted(
            (k for k in params if re.fullmatch(r"M\d+", k)),
            key=lambda k: int(k[1:]),
        )
        for key in series_keys:
            series_id = f"{matchlist_id}_{key}"
            games.extend(
                parse_match(params[key], series_id=series_id, season=season, stage=stage)
            )
    return games
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_parser_match.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/parser.py pipeline/tests/test_parser_match.py
git commit -m "feat: parse Match/Matchlist into series of played games"
```

---

### Task 8: Golden-file test against a real wikitext fixture

**Files:**
- Create: `pipeline/tests/fixtures/s17_w1_sample.wiki`
- Test: `pipeline/tests/test_golden_fixture.py`

**Interfaces:**
- Consumes: `parse_matchlist` (Task 7).
- Produces: nothing new — this is the end-to-end proof the whole chain works on real wiki syntax, brace nesting included.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_golden_fixture.py
from pathlib import Path

from mlbb_pipeline.parser import parse_matchlist

FIXTURE = Path(__file__).parent / "fixtures" / "s17_w1_sample.wiki"


def test_parses_fixture_into_one_played_game_with_normalized_drafts():
    text = FIXTURE.read_text(encoding="utf-8")
    games = parse_matchlist(text, season="17", stage="regular_season")

    assert len(games) == 1
    game = games[0]

    assert game.match.series_id == "MPLMYS17W1_M1"
    assert game.match.team1 == "Selangor Red Giants"
    assert game.match.team2 == "Team Vamos"
    assert game.match.team1_side == "blue"
    assert game.match.winner == 1
    assert game.match.game_length == "21:59"
    assert game.match.game_number_in_series == 1
    assert game.match.played_at == "April 3, 2026 - 17:00"

    picks = {(d.team_slot, d.slot): d.hero for d in game.drafts if not d.is_ban}
    bans = {(d.team_slot, d.slot): d.hero for d in game.drafts if d.is_ban}

    assert picks[(1, 1)] == "sora"
    assert picks[(1, 2)] == "guinevere"  # normalized from short form 'guin'
    assert picks[(2, 3)] == "yve"
    assert bans[(1, 2)] == "valentina"   # normalized from short form 'valen'
    assert bans[(2, 5)] == "claude"
    assert len(picks) == 10
    assert len(bans) == 10


def test_finished_skip_maps_are_filtered_out():
    text = FIXTURE.read_text(encoding="utf-8")
    games = parse_matchlist(text, season="17", stage="regular_season")
    # map2 and map3 in the fixture are finished=skip; only map1 should surface.
    assert all(g.match.game_number_in_series == 1 for g in games)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_golden_fixture.py -v`
Expected: FAIL — `FileNotFoundError` (fixture doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `pipeline/tests/fixtures/s17_w1_sample.wiki` with exactly this content (a hand-verified, brace-balanced excerpt matching the real structure documented in data-source.md — nested `TeamOpponent`/`substitutes`/`PlayerSubstitutions`, an `Abbr/MYT` date suffix, HTML comments between params, and two `finished=skip` maps):

```wikitext
{{Matchlist|width=350px|id=MPLMYS17W1|title=Week 1
|M1header=Day 1|M3header=Day 2|M6header=Day 3
|M1={{Match
    |bestof=3
    |caster1=Mars (Malaysian Caster)
    |mvp=Yums
    |opponent1={{TeamOpponent|Selangor Red Giants
        |substitutes={{PlayerSubstitutions
            |{{Substitution|in=Unii|out=Sekys}}
        }}
    }}
    |opponent2={{TeamOpponent|Team Vamos}}
    |date=April 3, 2026 - 17:00 {{Abbr/MYT}}
    |map1={{Map|vod=https://example.com/vod1
        |team1side=blue |team2side=red |length=21:59 |winner=1
        <!-- Hero picks -->
        |t1h1=sora |t1h2=guin |t1h3=zhuxin |t1h4=granger |t1h5=chou
        |t2h1=phoveus |t2h2=leomord |t2h3=yve |t2h4=harith |t2h5=khaleed
        <!-- Hero bans -->
        |t1b1=baxia |t1b2=valen |t1b3=kalea |t1b4=suyou |t1b5=harley
        |t2b1=freya |t2b2=marcel |t2b3=fanny |t2b4=gloo |t2b5=claude
    }}
    |map2={{Map|finished=skip}}
    |map3={{Map|finished=skip}}
}}
}}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_golden_fixture.py -v`
Expected: PASS (2 passed)

If it fails with `ValueError: unmatched '{{' starting at index ...`, count `{{` vs `}}` occurrences in the fixture — they must match exactly (10 of each in this fixture) and every close must nest against its most recent unmatched open. Fix the fixture, not the parser.

- [ ] **Step 5: Run the full test suite**

Run: `uv run --project pipeline pytest pipeline/tests -v`
Expected: All tests from Tasks 1–8 pass (approx. 27 passed), pristine output, no warnings.

- [ ] **Step 6: Commit**

```bash
git add pipeline/tests/fixtures/s17_w1_sample.wiki pipeline/tests/test_golden_fixture.py
git commit -m "test: golden-file fixture proving parser end-to-end on real wikitext structure"
```

---

## Not in this plan — Phase 2

Deliberately excluded, per the Scope Check (this plan is one independent, self-testable subsystem — wikitext string in, normalized `ParsedGame` objects out):

- **Fetcher** (`httpx`, MediaWiki action API, 2s throttle, custom User-Agent, subpage discovery) — data-source.md.
- **Snapshotting** raw wikitext to `data/raw/`, committed — stack.md.
- **Validation invariants** that require multiple runs or external data: team records vs. published standings, counts moving plausibly between runs — stack.md. (The 10-pick/10-ban invariant is already enforced in this plan, inside `ParsedGame`.)
- **SQLite build** from parsed records (`database.md` schema: `teams`, `team_names`, `team_aliases`, `heroes`, `hero_aliases`, `matches`, `drafts` tables with real ids) — this plan's `team1`/`team2`/`hero` fields are canonical name strings, not foreign keys yet.
- **Metrics** (presence, HHI, league baselines) and **typed JSON emission**.
- **Backfill** of Season 17, then Season 18-to-date.
- **GitHub Actions weekly cron.**
- Filling out the remaining hero/team alias strings beyond what's documented in data-source.md (the full 94/16 lists were only partially enumerated there) — happens naturally when the fetcher runs against the live wiki and `UnknownHeroError`/`UnknownTeamError` surface real gaps.

Once this plan is merged, the next plan picks up at "Fetcher + snapshot" in roadmap.md's Pipeline checklist.
