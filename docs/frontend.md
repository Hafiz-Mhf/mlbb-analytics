# Frontend

## Framework

SvelteKit — not Next.js. Less boilerplate, lighter runtime, no SSR/SEO need for a tool analysts open directly rather than find via search. See design.md.

## Routes

- `/` — Landing page with project value proposition and interactive team grid
- `/team/[slug]` — deep-linkable Team Scouting for one team (e.g. `/team/srg`), so a view is shareable between analysts, not just usable in-session
- `/league` — League Overview (Tournament Standings table with season toggles, cross-team HHI and presence comparison, role-filtered top picks)
- `/matchup` — Head-to-head comparison between any two teams (direct series/game records, Blue vs Red side performance, 3-way draft clash)
- `/sides` — Side Priority analysis (tournament Blue vs Red win rate split, 8-team side asymmetry matrix, First-Pick vs Counter-Pick hero priorities)
- `/sandbox` — Interactive Draft Sandbox (20-step tournament pick/ban simulator, Dual Coach & AI modes, real-time lane coverage & HHI scoring)
- `/roles` — Per-Role & Flex Scouting (8-team lane predictability matrix and tournament flex picks)
- `/log` — Match Log (series list — score, Bo count, team logos — filterable by team and stage, grouped into per-season sections so S17/S18 never mix)
- `/series/[seriesId]` — one series' games as a collapsible accordion, each game's picks/bans against the league baseline
- `/about`, `/contact`, `/privacy`, `/terms`, `/changelog` — static info/legal pages, linked from the footer only. No pipeline data, no dynamic params — plain prose components that inherit the root layout's `prerender = true`.

Filtering by patch was previously listed here and has been removed — Liquipedia records no patch field (data-source.md).

## Data flow

**There is no API.** v1 has no backend server (stack.md). The Python pipeline emits typed JSON into `src/lib/data/`, and SvelteKit prerenders against it at build time. A data refresh is a rebuild.

- The frontend never talks to Liquipedia, and in v1 it never talks to a server either. Everything it renders was computed at build time.
- Data volume makes this viable: a season is low thousands of draft rows, a few hundred KB of JSON. Sorting and filtering that client-side is instant, so interactive tables need no server round-trip.
- Team selection lives in the URL (route param), not component state — that is what makes `/team/srg` a real shareable link rather than session-only UI state.
- No client-state library. There is no mutation state to manage.

**Type safety across the boundary.** TypeScript types are generated from the pipeline's Pydantic models. A field rename in Python then breaks the frontend build, instead of silently rendering `undefined`. This is the only thing keeping the two languages honest with each other.

Phase 3's live assistant reintroduces a real backend. That is a Phase 3 decision — do not bend v1 to accommodate it.

## Mock-first build order

Screens get built before the pipeline finishes, against a mock data module in `src/lib/mock/`.

The mock is **not** hardcoded metric objects. It generates raw rows matching database.md's shape — `teams`, `heroes`, `matches`, `drafts` — and metrics are computed from them by real functions. Three consequences worth the extra effort:

- Numbers stay consistent across all three screens for free, because all three read the same rows
- The metric functions document exactly what the Python side must reproduce, removing ambiguity about whether HHI is over picks-only or picks-plus-bans
- Schema holes surface during the mockup rather than after the parser is written

The generator is seeded, so numbers are stable between reloads, and deliberately shaped: one predictable high-HHI team, one flexible low-HHI team, and one hero whose team ban-rate reads high until the baseline shows it is league-wide. Without that shaping the baseline pattern cannot be evaluated.

Swapping to real data is deleting `src/lib/mock/` and pointing the same functions at emitted JSON. The screens never know.

## Styling

Tailwind CSS v4, `@theme` tokens in `layout.css`. Superseded the original Audit Trail direction (charcoal base, amber accent, Syne/Inter) with the 18 Aug 2026 esports identity pivot (current-context.md): deep navy-black background (`--color-bg: #05070d`), electric-blue primary accent (`#38bdf8`), gold reserved for achievement/highlight only (`#fbbf24`), Russo One (display) + Chakra Petch (body) + JetBrains Mono (data), loaded for real via a Google Fonts `<link>` in `app.html`.

No chart library in v1 (stack.md). uiux.md is tables-first by design; add one only when a specific table demonstrably fails.

## Components

- **`DataTable.svelte`** — originally one reusable table behind all three v1 screens. No longer referenced by any route as of the 20 Aug 2026 Match Log redesign (Team Scouting and League Overview moved to `StatBlock`-led sections earlier; Match Log's series list and per-game breakdown are bespoke card/accordion markup, not tabular). Component and its spec still exist; nothing currently renders it.
- **Baseline annotation** as its own small component: raw value in mono, league baseline beside it, muted. This is the tool's core mechanic (planning.md) and the difference between insightful and misleading, so it must not drift between screens.
- **Freshness indicator** — last-updated timestamp, shown consistently wherever data appears (each screen's own header, plus the global footer's Data column). With weekly rebuilds, an analyst needs to know whether they are reading this week's meta or last week's. Deliberately not duplicated in the site header too — an early draft of the 20 Aug 2026 footer redesign put one there, but every screen already renders its own copy right under the page heading, so a global-header copy was pure duplication and got pulled back out.
- **Team tag** — colour swatch plus short code, needed once the dashboard covers all 8 teams (design-direction-v1.md).

Expect one refactor of the data table after all three screens exist. Its configuration surface is not knowable until three screens have pulled on it.

## Build and deploy

Fully prerendered, static output, single Vercel target. No serverless functions, no CORS, no second service. Deploys as a subdomain under hafizfaruqi.my, mirroring the existing hub setup.

## Deferred

Phase 3's live in-draft assistant needs fast client-side state during an actual draft clock and possibly a live data channel. Different rendering approach, different stack decisions, made when Phase 3 starts.
