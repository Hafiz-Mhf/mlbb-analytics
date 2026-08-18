# Roadmap

Format: Now / Next / Later, anchored to MPL MY Season 18 (14 Aug – Oct 2026).

**Timing note.** These docs were written as if a validated parser already existed. It does not (current-context.md). Season 18 starts 14 Aug 2026 with zero code written, so "live before the season is underway" is off the table. Build the pipeline correctly and backfill — the season's data is not going anywhere, and rushing is how the correctness layer gets skipped, which would defeat the point of the tool.

## Now — build the thing

**Step 0: DONE (13 Aug 2026)** — pick slots verified role-ordered over all 164 S17 games. Per-role features are cleared. See data-source.md.

**Step 1: DONE (13 Aug 2026)** — pipeline parser foundation merged to main. `pipeline/` uv project, Pydantic models (`MatchRecord`/`DraftRecord`/`ParsedGame`), hero + team alias resolution with halt-on-unknown, brace-matching parser for `{{Matchlist}}`/`{{Match}}`/`{{Map}}`, golden-file fixture test. 28 tests passing. No fetcher, no SQLite, no metrics yet — plan and scope boundary at `docs/superpowers/plans/2026-08-13-pipeline-parser-foundation.md`.

**Step 2: DONE (13 Aug 2026)** — fetcher + snapshot merged. `MediaWikiClient` (custom UA, 2s throttle, gzip via httpx defaults), `fetch_wikitext`, `discover_season_subpages`, `snapshot_path`/`write_snapshot`/`read_snapshot`, and `fetch_and_snapshot_season` composing all three. 40 tests passing, all HTTP mocked via `httpx.MockTransport` — no test spends a real request against the rate limit. Plan and scope boundary at `docs/superpowers/plans/2026-08-13-fetcher-snapshot.md`.

**Pipeline** (stack.md)
- [x] `uv` project scaffold, Pydantic models for the data shapes
- [x] Fetcher: MediaWiki action API, custom User-Agent, 2s throttle, gzip. Discovers season subpages rather than hardcoding them.
- [x] Snapshot raw wikitext to `data/raw/`, committed — writer exists; no snapshots written yet, that's the backfill run
- [x] Parser: `{{Matchlist}}` / `{{Match}}` / `{{Map}}`, brace-matching for nested `TeamOpponent`, filter `finished=skip`
- [x] Hero alias normalization table + the rule that an unknown hero string **halts** the run (team alias table done too, same rule)
- [x] Validation invariants (stack.md): 10 picks / 10 bans per game — enforced in `ParsedGame`. Counts moving plausibly between runs — `check_no_regression` in `build.py`, halts a rebuild that loses games/series. Still open: team records vs. published standings — needs a standings-page parser that doesn't exist yet.
- [x] Golden-file tests against a committed fixture. Unit tests on every metric function — `test_metrics.py`, including a sanity check against the real committed archive.
- [x] SQLite build from snapshots (database.md) — schema, seed, insert, regression guard, `mlbb-build` CLI. `data/mlbb.db` committed.
- [x] Metrics: presence, HHI (overall + per-role) — league baseline is `team_id=None` reused, not a separate code path.
- [x] Backfill Season 17 as historical baseline, then Season 18 to date — done 17 Aug 2026, live wiki run, counts verified/corrected.
- [x] Typed JSON emit — `emit.py`, one `dataset.json` matching the frontend's TS types field-for-field. `mlbb-build` writes both the db and the JSON in one pass.
- [x] GitHub Actions weekly cron — done 17 Aug 2026, `.github/workflows/weekly-build.yml` (schedule + `workflow_dispatch`), smoke-tested via manual run: fetched S18, rebuilt db, committed and pushed `284c605` unattended. Plan: `docs/superpowers/plans/2026-08-17-weekly-cron.md`.

**Frontend** (frontend.md)
- [x] Scaffold SvelteKit routes: `/`, `/team/[slug]`, `/league`, `/log`
- [x] Mock data module matching database.md's raw row shapes (not pre-computed metrics), so screens could be built before real JSON exists
- [x] Build the shared data-table and baseline-annotation components once, before wiring individual screens
- [x] Wire Tailwind + Audit Trail tokens (design-direction-v1.md)
- [x] Swap the mock module for real emitted JSON — done 17 Aug 2026, `src/lib/mock/` deleted per this file's own instruction, browser-verified against real data
- [x] Generated TypeScript types from the Pydantic models, so a field rename breaks the build instead of rendering `undefined` — done 17 Aug 2026, `dataset_models.py` + `gen_ts.py` (custom generator, no new npm dep) + `emit.py` validation. Plan: `docs/superpowers/plans/2026-08-17-generated-ts-types.md`.

**Target:** correct and public during Season 18, with S17 as baseline. Not "before week 1".

## Next — once v1 is live and stable

- [x] Post-game review module (draft-decision scope, not match film) — done 18 Aug 2026: `/match/[id]` single-game draft breakdown, plus a rolling-HHI trend chart and pick/ban win-rate-delta tables on `/team/[slug]`. No pipeline changes needed. Spec: `docs/superpowers/specs/2026-08-18-post-game-review-design.md`. Plan: `docs/superpowers/plans/2026-08-18-post-game-review.md`.
- [ ] Season 17 vs Season 18 trend views
- [ ] Re-check whether Liquipedia has migrated MLBB to the new `match2` system — if so, the parser becomes deletable and the format-change risk below disappears
- [ ] Revisit distribution: is anyone in the scene actually using v1? If not, find out why before building more

## Later — after Next is validated

- [ ] Live in-draft assistant. This is the phase that reintroduces a runtime backend (stack.md) — FastAPI, and possibly Docker with it.
- [ ] Decide then whether real per-team usage justifies accounts and private notes (currently out of scope — security.md)

## Risks to watch

- **Hero aliases.** The live one. 94 strings for 80 heroes; unnormalized it invents phantom heroes and understates HHI, the metric the tool exists to provide. Mitigated by the halt-on-unknown-hero rule — that rule is not negotiable.
- **Team name variants.** Same problem one level up, and measured: 16 distinct strings for 8 teams, from inconsistent casing and short forms. Bigetron alone appears four ways. Left alone, its history splits and the league baseline is computed over a wrong denominator. Mitigated by `team_aliases` and the same halt-on-unknown rule (database.md).
- **Doc claims outrunning evidence.** This section previously asserted a Bigetron cross-season rename and that Team Flash was new with no history. Both were wrong, inferred from partial scans rather than measured — the same failure mode as the original "validated parser" claim, caught twice in one day. Anything asserted here should be traceable to data-source.md.
- **Liquipedia format dependency.** Any template change on their end breaks the parser. Mitigated by committed raw snapshots (reparse history without refetching) and by validation running every refresh, not just once.
- **Flex picks vs. role tables.** Role ordering is verified, but 4.5% of picks are heroes used in a second role. Any code that treats a hero as having one fixed role will be wrong for those. Derive role from `drafts.slot` per pick, never from a hero attribute.
- **Data freshness.** v1 is only as useful as its last refresh; the weekly job is not optional once S18 is running.
- **Scope creep.** Solo builder, three-phase ambition. Resist polishing Now past "correct and current" before starting Next.
- **Docs drifting from reality.** This roadmap previously described migrating parser output that never existed. Update current-context.md whenever something material changes.
