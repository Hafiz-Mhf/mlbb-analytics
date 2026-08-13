# Frontend

## Framework
SvelteKit — not Next.js. Reasoning (see claude.md/design.md): less boilerplate, lighter runtime, no SSR/SEO need for a tool analysts open directly, not a public marketing site.

## Routes (v1)
- `/` — Team Scouting (default landing, team selector drives everything below it)
- `/team/[slug]` — deep-linkable version of Team Scouting for a specific team (e.g. `/team/srg`) — makes a view shareable between analysts, not just usable in-session
- `/league` — League Overview (cross-team HHI/presence comparison, the step-8 pattern)
- `/log` — Match Log (draft-by-draft record, filterable by team/patch)

## Data flow
- The frontend never talks to Liquipedia directly — only ever calls the FastAPI backend's REST endpoints, which read from SQLite (see database.md)
- Plain fetch-based loading via SvelteKit's `load` functions, not a heavy client-state library — the data is read-mostly and refreshed weekly on the backend, so there's no real client-side mutation state to manage in v1
- Team selection lives in the URL (route param), not just component state — that's what makes `/team/srg` a real, shareable link instead of a session-only UI state

## Styling
Tailwind CSS, already the convention across hafizfaruqi.my properties, configured with the Audit Trail tokens from design-direction-v1.md (charcoal base, amber accent, Syne/Inter/JetBrains Mono). No new styling framework decision needed — this continues an existing setup rather than starting one.

## Component approach
- One reusable data-table component behind Team Scouting, League Overview, and Match Log — they're all variations of "rows of draft/metric data," so one implementation, three configurations, not three bespoke tables
- The baseline-annotation pattern (raw value + muted league-baseline value beside it) as its own small reusable component — it's used everywhere per design-direction-v1.md, and it's the tool's core "insightful vs. misleading" mechanic, so it shouldn't drift between screens
- A freshness-indicator component (last-updated timestamp) shown consistently wherever data appears

## Build/deploy
- Most v1 views are read-mostly and prerender-friendly; only the freshness indicator and any interactive filtering need to run client-side
- Deploy path mirrors the existing hub-and-subdomain setup (Vercel, per homepage-hub.md) — this likely lives as a subdomain under hafizfaruqi.my rather than a standalone deployment

## What's deferred
Phase 3's live in-draft assistant will likely need a different rendering approach entirely (fast client-side state during an actual draft clock, possibly a live data channel for real-time entry). Don't bend v1's mostly-static architecture to accommodate that now — it's a Phase 3 decision, made when Phase 3 starts, not a v1 constraint.
