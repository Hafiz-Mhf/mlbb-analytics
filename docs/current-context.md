# Current Context

_Last updated: 13 Aug 2026_

## Where things stand

**The pipeline parser foundation now exists and is merged to main.** `pipeline/` is a `uv`-managed Python 3.12 project (`mlbb_pipeline`) with Pydantic models, hero/team alias normalization (halt-on-unknown), and a brace-matching parser for `{{Matchlist}}`/`{{Match}}`/`{{Map}}`, proven against a golden wikitext fixture — 28 tests passing. It has no I/O yet: no fetcher, no snapshotting, no SQLite, no metrics, no CI. Built via `docs/superpowers/plans/2026-08-13-pipeline-parser-foundation.md`, which also documents what's deliberately out of scope (fetcher/snapshot/SQLite/metrics/backfill/GH Actions — the next plan).

Everything below this point was written before that work and describes the state prior to it.

An earlier version of these docs claimed a working, validated Python parser and a loaded Season 17 dataset (64 series, 164 games, 328 draft rows). That was aspirational, not real. Corrected across CLAUDE.md, roadmap.md, and database.md on 13 Aug 2026. Treat any doc claim as unverified unless data-source.md says it was measured.

What did happen today, in one brainstorming session:

- **Stack settled** and written up in stack.md, including the decision that v1 has **no backend server** — Python becomes a build-time pipeline, not a service. This resolved a real contradiction between frontend.md (deploy on Vercel), database.md (SQLite), and a weekly write job: Vercel's filesystem is ephemeral and read-only, so those three never composed.
- **Data source spiked against the live wiki.** Findings in data-source.md. Headlines: LPDB is unusable for MLBB so wikitext parsing is confirmed as the only path; data quality is excellent (zero missing fields across 132 regular-season games); real S17 totals are 72 series / 164 games; **hero aliases are a live correctness hazard** (94 strings, 80 heroes) that would silently corrupt HHI; and no patch field exists anywhere.
- **Objective written in plain words** at the top of planning.md, so it stops being restated as jargon.

## What's about to change the picture

MPL Malaysia Season 18 starts **14 Aug 2026** (tomorrow) and runs through October. S18 match pages are already live on Liquipedia.

Season 18 is the reason to build now rather than keep analyzing S17 retrospectively. But with zero code written the day before kickoff, "live before the season is underway" is no longer realistic — and chasing it is how the correctness layer gets skipped, which would defeat the point. The pipeline should be built properly and backfilled; S18 data is not going anywhere.

- **Pick-slot ordering verified.** Slots are role-ordered (EXP/Jungle/Mid/Gold/Roam), measured across all 164 S17 games with bans as a control group. Per-role features are cleared to build, and flex rate emerged as a new metric worth shipping.
- **Repo is public** at github.com/Hafiz-Mhf/mlbb-analytics, full correction history intact.

## Immediate priority

1. ~~Write the v1 spec, then the implementation plan.~~ Done — parser foundation plan executed, merged 13 Aug 2026.
2. Continue the pipeline: fetch → snapshot (parse/normalize/validate already exist) → SQLite → JSON. Next plan starts at "Fetcher + snapshot" in roadmap.md.
3. Then the frontend mockup: all three screens shallow, SvelteKit + Tailwind, against a mock data module whose shape matches the pipeline's JSON output.

No blocking unknowns remain. The only open items are cosmetic (RRQ Tora's short code) plus filling out the remaining hero/team alias strings once the fetcher runs against the live wiki.

## Known constraints going in

- Solo builder, final year. Portfolio and proof-of-concept framing, not a paid engagement.
- Liquipedia gives picks, bans, side, winner, and length — nothing else. This caps how deep post-game review can ever go, permanently.
- Real teams are the aspirational audience, not confirmed users. Usage has to be earned by the tool being genuinely current and correct during S18, not assumed.
