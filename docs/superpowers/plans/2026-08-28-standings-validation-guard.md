# Standings-Based Parser & Validation Guard Implementation Plan

**Goal:** Implement a parser for Liquipedia's published Regular Season standings tables (`GroupTableLeague`) and wire a build-halting validation guard into `mlbb_pipeline` enforcing that computed series/game $W-L$ records in SQLite match published standings byte-for-byte.

**Architecture:** 
1. Fetch and snapshot regular-season parsed HTML (`standings.html`) via MediaWiki API `action=parse`.
2. Parse published standings using `mlbb_pipeline.standings.parse_standings_html` with team alias resolution.
3. Validate computed records against published standings via `validate_standings` during `build_database` in `build.py`, raising `StandingsMismatchError` to halt the build if any discrepancy is detected.

**Tech Stack:** Python 3.12, SQLite, httpx, pytest.

---

### Task 1: Standings Models, Parser, and Validation Guard
**Files:**
- Create: `pipeline/src/mlbb_pipeline/standings.py`
- Test: `pipeline/tests/test_standings.py`

### Task 2: Fetcher & Snapshot Extension
**Files:**
- Modify: `pipeline/src/mlbb_pipeline/fetcher.py`
- Test: `pipeline/tests/test_fetcher.py`
- Test: `pipeline/tests/test_backfill.py`

### Task 3: Build Pipeline Integration
**Files:**
- Modify: `pipeline/src/mlbb_pipeline/build.py`
- Test: `pipeline/tests/test_build.py`
- Snapshots: `data/raw/mpl/malaysia/season-17/standings.html`, `data/raw/mpl/malaysia/season-18/standings.html`

### Task 4: Documentation & Changelog
**Files:**
- Modify: `docs/roadmap.md`
- Modify: `docs/current-context.md`
- Modify: `CHANGELOG.md`
- Modify: `frontend/src/routes/changelog/+page.svelte`
