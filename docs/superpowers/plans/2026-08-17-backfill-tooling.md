# Backfill Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two small tools the actual Season 17 + Season 18 backfill run needs: a CLI that fetches and snapshots named seasons, and a gap scanner that finds every unresolved hero/team string across all snapshots in one pass instead of halting on the first one.

**Architecture:** `backfill.py` adds a thin `backfill_season()` wrapper around the already-merged `fetch_and_snapshot_season()` (season number → wiki title) plus a `main()` CLI entry point with dependency-injected client construction, so it's testable without touching the network. `alias_gaps.py` reuses the parser's brace-matching primitives (`find_template_calls`, `split_top_level`, `params_dict`) directly over raw snapshot text — deliberately *not* calling `resolve_hero`/`resolve_team`, which raise on the first unknown string — so a triage pass can see every gap at once. `aliases.py` gets two new public read accessors so the scanner can check membership without reaching into its private cache functions.

**Tech Stack:** Python 3.12, `uv`, `httpx` (already a dependency), `argparse` (stdlib), pytest.

**Spec:** `docs/data-source.md` (Hazard 1, Hazard 3 — the alias problems this tooling exists to surface), `docs/roadmap.md` ("Backfill Season 17 as historical baseline, then Season 18 to date"), `docs/current-context.md` (immediate priority: backfill is next)

## Global Constraints

- Any hero string not in the alias table halts the *real* pipeline — never silently create a new hero (CLAUDE.md; data-source.md Hazard 1). The gap scanner in this plan is a triage tool, not the pipeline: it reports unresolved strings, it does not resolve them or feed them anywhere that skips the halt.
- Same rule for team strings, one level up (data-source.md Hazard 3).
- Snapshot root is `data/raw/`, sibling to `pipeline/` (stack.md monorepo layout) — same convention `aliases.py`'s `DATA_DIR` already uses (`Path(__file__).resolve().parents[3]`).
- 1 request / 2 seconds against Liquipedia, custom User-Agent, `action=query` never `action=parse` — already enforced inside `MediaWikiClient` (merged). This plan's tests never construct a client with a real transport.
- Python 3.12, `uv` for venv/deps/lockfile (stack.md).

---

## File Structure

```
pipeline/
  src/mlbb_pipeline/
    aliases.py         # + known_hero_aliases(), known_team_aliases() (public read accessors)
    backfill.py         # NEW: backfill_season(), main() CLI
    alias_gaps.py         # NEW: AliasGaps, scan_unknown_aliases()
  tests/
    test_aliases.py       # + accessor tests
    test_backfill.py       # NEW
    test_alias_gaps.py       # NEW
```

`backfill.py` depends on `fetcher.py` (merged) and `snapshot.py` (merged) but modifies neither. `alias_gaps.py` depends on `parser.py`'s primitives (merged) and the two new `aliases.py` accessors.

---

### Task 1: `backfill_season()` — season number to wiki title

**Files:**
- Create: `pipeline/src/mlbb_pipeline/backfill.py`
- Test: `pipeline/tests/test_backfill.py`

**Interfaces:**
- Consumes: `mlbb_pipeline.fetcher.MediaWikiClient`, `mlbb_pipeline.fetcher.fetch_and_snapshot_season(client, season_title, root) -> list[Path]` (both merged).
- Produces: `SEASON_TITLE_TEMPLATE: str`, `backfill_season(client: MediaWikiClient, season: str, root: Path) -> list[Path]` — used by Task 2's `main()`.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_backfill.py
from pathlib import Path

import httpx

from mlbb_pipeline.backfill import backfill_season
from mlbb_pipeline.fetcher import MediaWikiClient

ALLPAGES_RESPONSE = {
    "query": {
        "allpages": [
            {"pageid": 1, "ns": 0, "title": "MPL/Malaysia/Season 17/Regular Season"},
        ]
    }
}

REVISION_RESPONSE = {
    "query": {
        "pages": {
            "1": {
                "title": "MPL/Malaysia/Season 17/Regular Season",
                "revisions": [{"slots": {"main": {"*": "{{Matchlist|id=X}}"}}}],
            }
        }
    }
}


def test_backfill_season_builds_title_from_season_number(tmp_path: Path):
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        if request.url.params.get("list") == "allpages":
            return httpx.Response(200, json=ALLPAGES_RESPONSE)
        return httpx.Response(200, json=REVISION_RESPONSE)

    client = MediaWikiClient(transport=httpx.MockTransport(handler), sleep_fn=lambda s: None)
    paths = backfill_season(client, "17", tmp_path)

    assert len(paths) == 1
    assert paths[0].read_text(encoding="utf-8") == "{{Matchlist|id=X}}"
    discover_request = captured[0]
    assert discover_request.url.params["apprefix"] == "MPL/Malaysia/Season 17/"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_backfill.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mlbb_pipeline.backfill'`

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/src/mlbb_pipeline/backfill.py
from __future__ import annotations

from pathlib import Path

from .fetcher import MediaWikiClient, fetch_and_snapshot_season

SEASON_TITLE_TEMPLATE = "MPL/Malaysia/Season {season}"


def backfill_season(client: MediaWikiClient, season: str, root: Path) -> list[Path]:
    """Fetch and snapshot every subpage of MPL Malaysia's given season
    number (e.g. '17', '18'). Thin wrapper turning a season number into
    the wiki page title fetch_and_snapshot_season expects."""
    season_title = SEASON_TITLE_TEMPLATE.format(season=season)
    return fetch_and_snapshot_season(client, season_title, root)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_backfill.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/backfill.py pipeline/tests/test_backfill.py
git commit -m "feat: backfill_season wraps fetch_and_snapshot_season with a season number"
```

---

### Task 2: `main()` CLI entry point

**Files:**
- Modify: `pipeline/src/mlbb_pipeline/backfill.py` (append `DEFAULT_DATA_ROOT`, `main`)
- Modify: `pipeline/tests/test_backfill.py` (append tests)
- Modify: `pipeline/pyproject.toml` (register console script)

**Interfaces:**
- Consumes: `backfill_season` (Task 1), `MediaWikiClient` (merged).
- Produces: `DEFAULT_DATA_ROOT: Path`, `main(argv: list[str] | None = None, *, client_factory: Callable[[], MediaWikiClient] = MediaWikiClient) -> None` — the entry point the live backfill run (post-plan, not a task) invokes.

- [ ] **Step 1: Write the failing test**

```python
# appended to pipeline/tests/test_backfill.py
from mlbb_pipeline.backfill import main


def _fake_client_factory(handler):
    def factory() -> MediaWikiClient:
        return MediaWikiClient(transport=httpx.MockTransport(handler), sleep_fn=lambda s: None)

    return factory


def test_main_defaults_to_seasons_17_and_18(tmp_path: Path, capsys):
    requested_seasons: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        titles_param = request.url.params.get("titles", "")
        apprefix_param = request.url.params.get("apprefix", "")
        for season in ("17", "18"):
            marker = f"MPL/Malaysia/Season {season}/"
            if apprefix_param == marker and season not in requested_seasons:
                requested_seasons.append(season)
        if request.url.params.get("list") == "allpages":
            page_title = apprefix_param + "Regular Season"
            return httpx.Response(
                200,
                json={"query": {"allpages": [{"pageid": 1, "ns": 0, "title": page_title}]}},
            )
        return httpx.Response(
            200,
            json={
                "query": {
                    "pages": {
                        "1": {
                            "title": titles_param,
                            "revisions": [{"slots": {"main": {"*": "{{Matchlist}}"}}}],
                        }
                    }
                }
            },
        )

    main(
        ["--root", str(tmp_path)],
        client_factory=_fake_client_factory(handler),
    )

    assert requested_seasons == ["17", "18"]
    captured = capsys.readouterr()
    assert "season-17" in captured.out
    assert "season-18" in captured.out


def test_main_accepts_explicit_seasons(tmp_path: Path, capsys):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.params.get("list") == "allpages":
            apprefix_param = request.url.params["apprefix"]
            return httpx.Response(
                200,
                json={
                    "query": {
                        "allpages": [
                            {"pageid": 1, "ns": 0, "title": apprefix_param + "Playoffs"}
                        ]
                    }
                },
            )
        return httpx.Response(
            200,
            json={
                "query": {
                    "pages": {
                        "1": {
                            "title": request.url.params["titles"],
                            "revisions": [{"slots": {"main": {"*": "{{Matchlist}}"}}}],
                        }
                    }
                }
            },
        )

    main(
        ["--season", "17", "--root", str(tmp_path)],
        client_factory=_fake_client_factory(handler),
    )

    captured = capsys.readouterr()
    assert "season-17" in captured.out
    assert "season-18" not in captured.out
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_backfill.py -v`
Expected: FAIL — `ImportError: cannot import name 'main' from 'mlbb_pipeline.backfill'`

- [ ] **Step 3: Write minimal implementation**

Append to `pipeline/src/mlbb_pipeline/backfill.py` (add `argparse` and `Callable` to imports):

```python
import argparse
from typing import Callable

# ... (existing imports stay; SEASON_TITLE_TEMPLATE and backfill_season stay above)

# data/raw/ lives at the repo root, sibling to pipeline/ (stack.md), same
# convention as aliases.py's DATA_DIR: parents[3] from this file is the repo root.
DEFAULT_DATA_ROOT = Path(__file__).resolve().parents[3] / "data" / "raw"
DEFAULT_SEASONS = ["17", "18"]


def main(
    argv: list[str] | None = None,
    *,
    client_factory: Callable[[], MediaWikiClient] = MediaWikiClient,
) -> None:
    """CLI entry point: fetch and snapshot each requested season.
    `client_factory` is overridable so tests never touch the real network."""
    parser = argparse.ArgumentParser(description="Backfill MPL Malaysia season snapshots.")
    parser.add_argument(
        "--season",
        action="append",
        dest="seasons",
        help="Season number to backfill (repeatable). Defaults to 17 and 18.",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=DEFAULT_DATA_ROOT,
        help="Snapshot root directory. Defaults to data/raw/ at the repo root.",
    )
    args = parser.parse_args(argv)
    seasons = args.seasons or DEFAULT_SEASONS

    client = client_factory()
    try:
        for season in seasons:
            for path in backfill_season(client, season, args.root):
                print(path)
    finally:
        client.close()


if __name__ == "__main__":
    main()
```

Register a console script in `pipeline/pyproject.toml`:

```toml
[project.scripts]
mlbb-backfill = "mlbb_pipeline.backfill:main"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_backfill.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/backfill.py pipeline/tests/test_backfill.py pipeline/pyproject.toml
git commit -m "feat: backfill CLI entry point for named seasons"
```

---

### Task 3: Public alias-table read accessors

**Files:**
- Modify: `pipeline/src/mlbb_pipeline/aliases.py` (append `known_hero_aliases`, `known_team_aliases`)
- Modify: `pipeline/tests/test_aliases.py` (append tests)

**Interfaces:**
- Consumes: `_hero_aliases()`, `_team_aliases()` (existing private cache loaders).
- Produces: `known_hero_aliases() -> dict[str, str]`, `known_team_aliases() -> dict[str, str]` — used by `alias_gaps.py` (Task 4).

- [ ] **Step 1: Write the failing test**

```python
# appended to pipeline/tests/test_aliases.py
from mlbb_pipeline.aliases import known_hero_aliases, known_team_aliases


def test_known_hero_aliases_contains_documented_short_forms():
    table = known_hero_aliases()
    assert table["guin"] == "guinevere"
    assert table["guinevere"] == "guinevere"


def test_known_team_aliases_contains_all_eight_teams():
    table = known_team_aliases()
    assert table["srg"] == "Selangor Red Giants"
    assert len(set(table.values())) == 8
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_aliases.py -v`
Expected: FAIL — `ImportError: cannot import name 'known_hero_aliases' from 'mlbb_pipeline.aliases'`

- [ ] **Step 3: Write minimal implementation**

Append to `pipeline/src/mlbb_pipeline/aliases.py`:

```python
def known_hero_aliases() -> dict[str, str]:
    """Read-only view of the loaded hero alias table, for tooling that
    needs to check membership without triggering resolve_hero's halt
    (e.g. alias_gaps.py's triage scanner)."""
    return dict(_hero_aliases())


def known_team_aliases() -> dict[str, str]:
    """Same as known_hero_aliases(), one level up."""
    return dict(_team_aliases())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_aliases.py -v`
Expected: PASS (9 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/aliases.py pipeline/tests/test_aliases.py
git commit -m "feat: public read accessors for hero/team alias tables"
```

---

### Task 4: Gap scanner — find every unresolved string in one pass

**Files:**
- Create: `pipeline/src/mlbb_pipeline/alias_gaps.py`
- Test: `pipeline/tests/test_alias_gaps.py`

**Interfaces:**
- Consumes: `find_template_calls`, `split_top_level`, `params_dict`, `strip_comments` (`parser.py`, merged), `known_hero_aliases`, `known_team_aliases` (Task 3).
- Produces: `AliasGaps` (dataclass: `heroes: frozenset[str]`, `teams: frozenset[str]`), `scan_unknown_aliases(root: Path) -> AliasGaps` — the tool the live backfill triage loop (post-plan) runs after each fetch.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_alias_gaps.py
from pathlib import Path

from mlbb_pipeline.alias_gaps import scan_unknown_aliases

WIKI_TEXT = """
{{Matchlist|id=X|M1={{Match
    |opponent1={{TeamOpponent|Selangor Red Giants}}
    |opponent2={{TeamOpponent|Totally New Team}}
    |map1={{Map|team1side=blue|team2side=red|length=10:00|winner=1
        |t1h1=sora |t1h2=guin |t1h3=brand-new-hero |t1h4=granger |t1h5=chou
        |t2h1=phoveus |t2h2=leomord |t2h3=yve |t2h4=harith |t2h5=khaleed
        |t1b1=baxia |t1b2=valen |t1b3=kalea |t1b4=suyou |t1b5=harley
        |t2b1=freya |t2b2=marcel |t2b3=fanny |t2b4=gloo |t2b5=claude
    }}
    |map2={{Map|finished=skip
        |t1h1=another-unseen-hero
    }}
}}}}
"""


def test_scan_unknown_aliases_finds_new_hero_and_team(tmp_path: Path):
    (tmp_path / "season-17").mkdir()
    (tmp_path / "season-17" / "regular-season.wiki").write_text(
        WIKI_TEXT, encoding="utf-8"
    )

    gaps = scan_unknown_aliases(tmp_path)

    assert gaps.heroes == frozenset({"brand-new-hero"})
    assert gaps.teams == frozenset({"totally new team"})


def test_scan_unknown_aliases_ignores_known_short_forms(tmp_path: Path):
    (tmp_path / "season-17").mkdir()
    (tmp_path / "season-17" / "regular-season.wiki").write_text(
        WIKI_TEXT, encoding="utf-8"
    )

    gaps = scan_unknown_aliases(tmp_path)

    assert "guin" not in gaps.heroes
    assert "selangor red giants" not in gaps.teams


def test_scan_unknown_aliases_skips_finished_skip_maps(tmp_path: Path):
    (tmp_path / "season-17").mkdir()
    (tmp_path / "season-17" / "regular-season.wiki").write_text(
        WIKI_TEXT, encoding="utf-8"
    )

    gaps = scan_unknown_aliases(tmp_path)

    assert "another-unseen-hero" not in gaps.heroes


def test_scan_unknown_aliases_returns_empty_for_no_files(tmp_path: Path):
    gaps = scan_unknown_aliases(tmp_path)
    assert gaps.heroes == frozenset()
    assert gaps.teams == frozenset()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_alias_gaps.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mlbb_pipeline.alias_gaps'`

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/src/mlbb_pipeline/alias_gaps.py
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .aliases import known_hero_aliases, known_team_aliases
from .parser import find_template_calls, params_dict, split_top_level, strip_comments


@dataclass(frozen=True)
class AliasGaps:
    """Every hero/team string found in a set of snapshots that has no
    entry in the alias tables. A triage report, not a resolver — nothing
    here is fed back into the real parser, which still halts on unknowns
    (data-source.md Hazard 1, Hazard 3)."""

    heroes: frozenset[str]
    teams: frozenset[str]


def scan_unknown_aliases(root: Path) -> AliasGaps:
    """Walk every '*.wiki' snapshot under root and collect every hero/team
    string with no entry in the alias tables, in one pass. Unlike
    resolve_hero/resolve_team, this never raises — it exists precisely so
    a human can see every gap at once before extending the alias tables,
    rather than discovering them one halt at a time."""
    hero_table = known_hero_aliases()
    team_table = known_team_aliases()
    unknown_heroes: set[str] = set()
    unknown_teams: set[str] = set()

    for path in sorted(root.rglob("*.wiki")):
        text = strip_comments(path.read_text(encoding="utf-8"))

        for body in find_template_calls(text, "Map"):
            params = params_dict(split_top_level(body))
            if params.get("finished") == "skip":
                continue
            for team_slot in (1, 2):
                for slot in range(1, 6):
                    for prefix in ("h", "b"):
                        raw = params.get(f"t{team_slot}{prefix}{slot}")
                        if raw is None:
                            continue
                        key = raw.strip().lower()
                        if key not in hero_table:
                            unknown_heroes.add(key)

        for body in find_template_calls(text, "TeamOpponent"):
            parts = split_top_level(body)
            if not parts or "=" in parts[0]:
                continue
            key = " ".join(parts[0].strip().lower().split())
            if key not in team_table:
                unknown_teams.add(key)

    return AliasGaps(heroes=frozenset(unknown_heroes), teams=frozenset(unknown_teams))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_alias_gaps.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Run the full test suite**

Run: `uv run --project pipeline pytest pipeline/tests -v`
Expected: All tests from this plan plus both merged plans pass (approx. 51 passed), pristine output, no warnings.

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/mlbb_pipeline/alias_gaps.py pipeline/tests/test_alias_gaps.py
git commit -m "feat: alias gap scanner surfaces every unresolved string in one pass"
```

---

## Not in this plan — the live run

Deliberately excluded from TDD tasks because it is a one-shot operational run against the real wiki, not a subsystem with a stable interface to test against:

- **Actually invoking `main()` against the live Liquipedia API.** Every test above uses `httpx.MockTransport`.
- **Extending `data/aliases/hero_aliases.json` / `team_aliases.json`** with the real unknown strings `scan_unknown_aliases` reports. This is manual/human-reviewed table curation, not code.
- **Committing the fetched `data/raw/*.wiki` snapshots.**
- **Running `parse_matchlist` over every snapshot** to confirm it produces exactly 72 series / 164 played games for Season 17 (data-source.md verified counts), with Season 18 counts left as a sanity check only, since the season is in progress.
- **SQLite build, metrics, JSON emission** — unchanged from the earlier plans' exclusions.

Once this plan is merged, the runbook is: `uv run --project pipeline mlbb-backfill`, then `uv run --project pipeline python -c "from pathlib import Path; from mlbb_pipeline.alias_gaps import scan_unknown_aliases; print(scan_unknown_aliases(Path('data/raw')))"`, extend the alias JSON files, re-run the scan until both sets are empty, then parse everything and check the counts.
