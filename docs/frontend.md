# Frontend

## Framework

SvelteKit — not Next.js. Less boilerplate, lighter runtime, no SSR/SEO need for a tool analysts open directly rather than find via search. See design.md.

## Routes (v1)

- `/` — Team Scouting (default landing, team selector drives everything below it)
- `/team/[slug]` — deep-linkable Team Scouting for one team (e.g. `/team/srg`), so a view is shareable between analysts, not just usable in-session
- `/league` — League Overview (cross-team HHI and presence comparison)
- `/log` — Match Log (draft-by-draft record, filterable by team and stage)

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

Tailwind CSS, configured with the Audit Trail tokens from design-direction-v1.md — charcoal base, amber accent, Syne / Inter / JetBrains Mono. This continues the existing hafizfaruqi.my convention rather than starting a new one.

No chart library in v1 (stack.md). uiux.md is tables-first by design; add one only when a specific table demonstrably fails.

## Components

- **One reusable data table** behind Team Scouting, League Overview, and Match Log. All three are variations of "rows of draft or metric data" — one implementation, three configurations, not three bespoke tables.
- **Baseline annotation** as its own small component: raw value in mono, league baseline beside it, muted. This is the tool's core mechanic (planning.md) and the difference between insightful and misleading, so it must not drift between screens.
- **Freshness indicator** — last-updated timestamp, shown consistently wherever data appears. With weekly rebuilds, an analyst needs to know whether they are reading this week's meta or last week's.
- **Team tag** — colour swatch plus short code, needed once the dashboard covers all 8 teams (design-direction-v1.md).

Expect one refactor of the data table after all three screens exist. Its configuration surface is not knowable until three screens have pulled on it.

## Build and deploy

Fully prerendered, static output, single Vercel target. No serverless functions, no CORS, no second service. Deploys as a subdomain under hafizfaruqi.my, mirroring the existing hub setup.

## Deferred

Phase 3's live in-draft assistant needs fast client-side state during an actual draft clock and possibly a live data channel. Different rendering approach, different stack decisions, made when Phase 3 starts.
