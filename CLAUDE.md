# Draft Log — Context for AI Assistants

One-line: An MLBB (Mobile Legends: Bang Bang) esports data analysis platform for MPL Malaysia, built to give team analysts (SRG, Team Vamos, Team Rey, and the rest of the 8-team league) the kind of pre-draft/pick-ban numbers football coaches get from football analytics — presence rate, hero concentration (HHI), opponent tendencies — before they walk into a draft.

## Who's building this
Solo project by Fiz (final-year IT/BI & Analytics student, QA background). Originated as a public Threads tutorial thread walking through the data pipeline for Selangor Red Giants (SRG); now scoping into a league-wide tool.

## What's already true, don't re-derive it
- Data source is Liquipedia wikitext (Moonton has no public esports API; MPL's own site is JS-rendered)
- A Python parser extracts Match/Map blocks into rows: MPL MY Season 17 produced 64 series, 164 games, 328 draft rows
- Parser was validated against two independently-known numbers (SRG 46 games/35 wins; S17 standings 12-2, game record 25-8) before any analysis was trusted
- Liquipedia pick slots are role-ordered (EXP, Jungle, Mid, Gold, Roam), not draft-order — this is what makes per-role/per-player breakdowns possible
- Core metrics: presence (picks+bans / games) for meta breadth, HHI (sum of squared pick shares) for team predictability — always compared against league baseline, never read in isolation (see the Fanny ban-rate lesson: 78.3% for SRG reads high until you see the league baseline is 84.7%)
- MPL MY Season 18 runs Aug 14–Oct 2026, 8 partnered teams (SRG, Team Vamos, Team Rey are the legacy MY orgs; RRQ and Bigetron each field a second MY team)

## Stack
- Backend: Python + FastAPI, wrapping the existing parser/analysis code directly — no rewrite into another language (detail: database.md)
- Frontend: SvelteKit, chosen over Next.js for less boilerplate and a lighter runtime — appropriate for a dashboard-heavy internal tool with no real SEO need (detail: frontend.md)
- DB: SQLite (see database.md)
- Fast-validation path: Streamlit can wrap the same Python analysis into a shippable dashboard in days, as a throwaway v0 to test real usage before investing in the full SvelteKit build — if taken, frontend.md's routes/components still apply once you graduate off Streamlit

## Sequencing decision (don't relitigate without reason)
Build order is Now → Next → Later: draft/ban-pick prep first (extends what's already built), post-game review second (scoped to draft-decision review, not full match film — Liquipedia has no gold/timeline data), live in-draft assistant last. See planning.md and roadmap.md.

## Design/tech decisions
See design.md, design-direction-v1.md, database.md (backend/data) and frontend.md (SvelteKit structure, routes, data flow) for the reasoning — don't propose a from-scratch stack or visual identity without reading those first.
