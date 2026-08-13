# Draft Log — Context for AI Assistants

**In plain words: before a match, tell a coach what the other team will probably pick and ban — and whether that's actually unusual, or just what everyone in the league does.**

The second half is the whole point. Anyone can count picks; Liquipedia already shows that. Nobody has the comparison. "SRG banned Fanny in 78% of games" sounds like SRG fears Fanny — until you see the league average is 84.7%, meaning SRG respects her *less* than most. Same number, opposite conclusion. Every number in this tool appears next to its league baseline. Without one, a number can lie. Full statement of intent: planning.md.

Target users are analysts for the 8 MPL Malaysia teams. Nobody has asked for this yet — see planning.md, "Two objectives".

## Who's building this
Solo project by Fiz (final-year IT/BI & Analytics student, QA background). Originated as a public Threads tutorial thread on the data pipeline for Selangor Red Giants (SRG); now scoping into a league-wide tool.

## Project state — read this before assuming anything exists
**As of 13 Aug 2026: no code exists.** This repo contains planning docs only.

An earlier version of this file claimed a working, validated parser and a loaded S17 dataset. That was aspirational and is now corrected. There is no parser, no database, no dashboard.

## What's actually verified, don't re-derive it
Everything below was measured against the live wiki on 13 Aug 2026. Detail and method: docs/data-source.md.

- Data source is Liquipedia **wikitext** via the free MediaWiki action API (no key; 1 req/2s; custom User-Agent required). Moonton has no public esports API and MPL's own site is JS-rendered.
- **LPDB is unusable here** — the MLBB wiki still uses legacy `{{Matchlist}}`/`{{Match}}`/`{{Map}}` templates, so `match2` structured data is not populated. Wikitext parsing is the only path.
- Picks are `t{1,2}h{1..5}`, bans are `t{1,2}b{1..5}`, both inside `{{Map}}`. Games with `finished=skip` are unplayed and must be filtered.
- **Season 17 real totals: 72 series (64 regular season + 8 playoffs), 164 played games (132 + 32).** The old "64 series / 164 games" pairing mixed two different scopes.
- Data quality is high: of 132 regular-season games, zero are missing a pick, ban, side, winner, or length.
- **Hero aliases are the top correctness hazard.** 94 distinct hero strings represent only 80 heroes (`guin`/`guinevere`, `yz`/`yu zhong`, `phove`/`phoveus`, 11 more). Unnormalized, this invents phantom heroes and corrupts HHI, which squares shares. An unknown hero string must halt the pipeline, never create a new hero.
- **No patch field exists** on any game. Patch-based filtering must derive from date, or be dropped.
- Liquipedia has no gold, objectives, or kill timelines. This is a **draft** tool permanently — what a team drafts and how predictable they are, never how they play.
- Core metrics: presence (picks+bans / games) for meta breadth, HHI (sum of squared pick shares) for predictability — always shown against league baseline, never in isolation.
- MPL MY Season 18 runs Aug 14 – Oct 2026, 8 partnered teams (SRG, Team Vamos, Team Rey are the legacy MY orgs; RRQ and Bigetron each field a second MY team).

## Explicitly UNVERIFIED — do not build on it yet
Liquipedia pick slots being **role-ordered** (EXP, Jungle, Mid, Gold, Roam) rather than draft-ordered. This was previously asserted as fact; it appears to be an editor convention that mostly holds. Every per-role feature depends on it. Measure how often it holds before speccing role breakdowns.

## Stack
Detail: stack.md. Summary:
- **No backend server in v1.** Python is a build-time pipeline that runs weekly in GitHub Actions: fetch → snapshot → parse → validate → SQLite → emit JSON → commit → Vercel rebuild.
- Frontend: SvelteKit + Tailwind, prerendered against that JSON (frontend.md)
- Store: SQLite as a committed build-time archive, not a runtime store (database.md)
- Deliberate no's, already decided: **no Docker, no FastAPI in v1, no Postgres, no chart library, no auth, no Streamlit v0.** Don't re-propose these without a stated reason.
- Correctness layer is not optional — golden-file tests plus build-halting invariants. A failed validation never publishes. Stale-but-correct beats fresh-but-wrong.

## Sequencing decision (don't relitigate without reason)
Now → Next → Later: draft/pick-ban prep first, post-game review second (draft-decision scope only — no gold or timeline data exists), live in-draft assistant last. See planning.md and roadmap.md.

## Design/tech decisions
See design.md, design-direction-v1.md, database.md and frontend.md for the reasoning — don't propose a from-scratch stack or visual identity without reading those first.
