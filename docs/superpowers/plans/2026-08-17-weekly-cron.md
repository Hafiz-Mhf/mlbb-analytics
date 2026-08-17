# GitHub Actions Weekly Cron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A GitHub Actions workflow that fetches Season 18's latest wikitext, rebuilds `data/mlbb.db` and `dataset.json`, and commits+pushes the result — weekly, unattended — while never publishing bad data.

**Architecture:** One workflow, two triggers (`schedule` + `workflow_dispatch` for manual runs). Steps: checkout → install `uv` → `pytest` (code correctness) → `mlbb-backfill --season 18` (fetch, only the live season — S17 is a closed historical baseline, re-fetching it weekly wastes Liquipedia's rate budget for zero benefit) → `mlbb-build` (rebuild db, emit JSON; its internal `check_no_regression` halts and raises on data loss, stack.md's "a failed validation never publishes") → if anything under `data/raw`, `data/mlbb.db`, or `frontend/src/lib/data/dataset.json` changed, commit as `github-actions[bot]` and push. A step failure (network error, halted regression check, alias gap) fails the job before the commit step ever runs — nothing gets published on a bad run, matching every other invariant already built into the pipeline (roadmap.md's risk: "Data freshness... the weekly job is not optional once S18 is running").

**Tech Stack:** GitHub Actions, `astral-sh/setup-uv` (already the project's Python tool per stack.md — no reason to introduce `actions/setup-python` + manual `uv` install when one action does both).

**Spec:** `docs/stack.md` ("Scheduling" row: "GitHub Actions cron, weekly during season... a failed run is a visible red X rather than a silent cron on a laptop") and `docs/roadmap.md` line 27.

## Global Constraints

- No secrets required — Liquipedia's MediaWiki API needs no key (CLAUDE.md).
- Weekly cadence, not date-gated to the Aug–Oct 2026 season window — gating by date means updating the workflow file every season; an off-season run just finds no new games, diffs empty, and commits nothing. Simpler, and self-correcting.
- Only `--season 18` is fetched in the cron job. Season 17 is closed and already committed (roadmap.md: "Backfill Season 17 as historical baseline... done").
- `contents: write` permission, scoped to this workflow only (default `GITHUB_TOKEN`, no PAT).
- A failed step must leave `main` untouched — no partial/bad commit, ever.

---

## File Structure

- Create: `.github/workflows/weekly-build.yml` — the only file this plan touches. First workflow file in the repo (none exist yet).

## Task 1: Weekly build workflow

**Files:**
- Create: `.github/workflows/weekly-build.yml`

**Interfaces:**
- Consumes: `mlbb-backfill`, `mlbb-build` CLI entry points (`pipeline/pyproject.toml`, already exist), `pytest` (`pipeline/tests/`, 89 tests as of this plan).
- Produces: nothing consumed elsewhere — this is the terminal automation step. A successful run's side effect is a git commit on `main` touching `data/raw/season-18/*.wiki`, `data/mlbb.db`, `frontend/src/lib/data/dataset.json`.

- [ ] **Step 1: Write the workflow file**

```yaml
# .github/workflows/weekly-build.yml
name: Weekly build

on:
  schedule:
    # Mondays 00:00 UTC. stack.md: "weekly during season" — always-on is
    # simpler than a date-gated schedule and self-corrects off-season
    # (no new games -> no diff -> no commit).
    - cron: '0 0 * * 1'
  workflow_dispatch: {}

permissions:
  contents: write

concurrency:
  group: weekly-build
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: astral-sh/setup-uv@v3
        with:
          enable-cache: true

      - name: Run pipeline tests
        working-directory: pipeline
        run: uv run pytest

      - name: Fetch Season 18 snapshots
        working-directory: pipeline
        run: uv run mlbb-backfill --season 18

      - name: Rebuild database and emit dataset.json
        working-directory: pipeline
        run: uv run mlbb-build

      - name: Check for changes
        id: changes
        run: |
          git add -A data/raw data/mlbb.db frontend/src/lib/data/dataset.json
          if git diff --cached --quiet; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
          else
            echo "changed=true" >> "$GITHUB_OUTPUT"
          fi

      - name: Commit and push
        if: steps.changes.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git commit -m "data: weekly refresh ($(date -u +%F))"
          git push
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python -c "import yaml, sys; yaml.safe_load(open('.github/workflows/weekly-build.yml'))" ` (any YAML parser works — this just catches indentation/syntax errors before pushing; GitHub's own schema validation happens server-side on push and is checked in Step 4).

Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/weekly-build.yml
git commit -m "feat: add weekly GitHub Actions build/refresh cron"
```

- [ ] **Step 4: Push and verify GitHub accepts the workflow**

Run: `git push`, then `gh workflow list` and confirm `Weekly build` appears (proves GitHub parsed it as a valid workflow — an invalid one is silently omitted from this list, not just filtered).

- [ ] **Step 5: Manual smoke test (requires explicit go-ahead — this triggers a real fetch against Liquipedia and, if S18 has new games since 17 Aug, a real push to main)**

Run: `gh workflow run "Weekly build"`, then `gh run watch` (or `gh run list --workflow="Weekly build"` to find the run id first). Confirm the run goes green and, if it committed, that the commit looks correct (`git log -1`, `git show --stat HEAD`).

---

## Self-Review Notes

**Spec coverage:** stack.md's "Scheduling" row ("GitHub Actions cron, weekly during season... a failed run is a visible red X") — the workflow's own failure semantics (any step failing stops the job before the commit step) cover this directly. roadmap.md line 27 ("GitHub Actions weekly cron") — done by this single-file task.

**Out of scope, deliberately:** a separate on-push/PR test workflow. Not requested by roadmap.md's item 8, which names only the weekly cron. Worth a future line item, not this one.

**No placeholder check:** every step has literal, runnable content — no TBD/"add error handling"/etc.
