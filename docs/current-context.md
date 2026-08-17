# Current Context

_Last updated: 17 Aug 2026_

## Where things stand

**Backfill has run against the live wiki.** S17 (Regular Season + Playoffs) and S18-to-date are fetched and snapshotted under `data/raw/`. The gap scanner ran clean afterward — 0 unresolved hero strings, 0 unresolved team strings — after extending `hero_aliases.json` with 61 previously-unseen full hero names (the golden fixture had only exercised 44 short-form/alias entries, not the full ~100-hero roster). Two real parser bugs surfaced by live data, both fixed with a failing test first: (1) `parse_map` only treated `finished=skip` as unplayed, but a scheduled future match on an in-progress season (S18) is instead an empty `{{Map}}` template with blank `winner=` and no `finished` param at all — now both are treated as unplayed; (2) the parser only understood `{{Matchlist}}` (regular season), never `{{Bracket}}` (playoffs), so every playoff series was silently dropped — `parse_bracket` now handles it via shared logic with `parse_matchlist`. 52 tests passing.

**Season 17 counts are now verified against a real parse, and corrected:** 64 series total (56 regular season + 8 playoffs), 164 played games (132 + 32) — see data-source.md. The previously-documented "72 series / 64 regular season" was never actually re-derived from data; 56 is exactly a full double round robin among 8 teams (`C(8,2)×2`) and 168 map blocks ÷ 56 series = 3.0 exactly. Season 18 to date (as of 17 Aug 2026, season started 14 Aug): 7 series / 17 games played so far — sanity-checked only, season is ongoing.

**The pipeline parser foundation and the fetcher/snapshot layer both exist and are merged to main.** `pipeline/` is a `uv`-managed Python 3.12 project (`mlbb_pipeline`) with Pydantic models, hero/team alias normalization (halt-on-unknown), a brace-matching parser for `{{Matchlist}}`/`{{Bracket}}`/`{{Match}}`/`{{Map}}`, a throttled `MediaWikiClient` (custom User-Agent, 2s interval, gzip), subpage discovery, a snapshot writer, a `mlbb-backfill` CLI, and an alias-gap scanner. Still missing: SQLite build, metrics, JSON emit, CI. Built via `docs/superpowers/plans/2026-08-13-pipeline-parser-foundation.md`, `docs/superpowers/plans/2026-08-13-fetcher-snapshot.md`, and `docs/superpowers/plans/2026-08-17-backfill-tooling.md`, which document what each deliberately left out.

Everything below this point was written before that work and describes the state prior to it.

An earlier version of these docs claimed a working, validated Python parser and a loaded Season 17 dataset (64 series, 164 games, 328 draft rows). That was aspirational, not real. Corrected across CLAUDE.md, roadmap.md, and database.md on 13 Aug 2026. Treat any doc claim as unverified unless data-source.md says it was measured.

What did happen today, in one brainstorming session:

- **Stack settled** and written up in stack.md, including the decision that v1 has **no backend server** — Python becomes a build-time pipeline, not a service. This resolved a real contradiction between frontend.md (deploy on Vercel), database.md (SQLite), and a weekly write job: Vercel's filesystem is ephemeral and read-only, so those three never composed.
- **Data source spiked against the live wiki.** Findings in data-source.md. Headlines: LPDB is unusable for MLBB so wikitext parsing is confirmed as the only path; data quality is excellent (zero missing fields across 132 regular-season games); real S17 totals are 64 series / 164 games (56 regular season + 8 playoffs — series count corrected 17 Aug 2026 against the live backfill); **hero aliases are a live correctness hazard** (94 strings, 80 heroes) that would silently corrupt HHI; and no patch field exists anywhere.
- **Objective written in plain words** at the top of planning.md, so it stops being restated as jargon.

## What's about to change the picture

MPL Malaysia Season 18 starts **14 Aug 2026** (tomorrow) and runs through October. S18 match pages are already live on Liquipedia.

Season 18 is the reason to build now rather than keep analyzing S17 retrospectively. But with zero code written the day before kickoff, "live before the season is underway" is no longer realistic — and chasing it is how the correctness layer gets skipped, which would defeat the point. The pipeline should be built properly and backfilled; S18 data is not going anywhere.

- **Pick-slot ordering verified.** Slots are role-ordered (EXP/Jungle/Mid/Gold/Roam), measured across all 164 S17 games with bans as a control group. Per-role features are cleared to build, and flex rate emerged as a new metric worth shipping.
- **Repo is public** at github.com/Hafiz-Mhf/mlbb-analytics, full correction history intact.

## Immediate priority

1. ~~Write the v1 spec, then the implementation plan.~~ Done — parser foundation plan executed, merged 13 Aug 2026.
2. ~~Fetcher + snapshot.~~ Done — merged 13 Aug 2026.
3. ~~Backfill: run the fetcher against S17 and S18-to-date, fix the halts that surface.~~ Done 17 Aug 2026 — snapshots fetched and committed to `data/raw/` (stack.md: raw archive is deliberately committed, not a build artifact), alias tables complete, two parser bugs fixed (unplayed-future-match filter, playoff bracket parsing), S17 counts verified.
4. SQLite build → metrics → JSON emit — next.
5. Then the frontend mockup: all three screens shallow, SvelteKit + Tailwind, against a mock data module whose shape matches the pipeline's JSON output.

No blocking unknowns remain. The only open item is cosmetic (RRQ Tora's short code).

## Known constraints going in

- Solo builder, final year. Portfolio and proof-of-concept framing, not a paid engagement.
- Liquipedia gives picks, bans, side, winner, and length — nothing else. This caps how deep post-game review can ever go, permanently.
- Real teams are the aspirational audience, not confirmed users. Usage has to be earned by the tool being genuinely current and correct during S18, not assumed.
