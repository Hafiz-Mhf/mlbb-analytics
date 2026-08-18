# Post-Game Review — Design Spec

_Written 18 Aug 2026. Roadmap: docs/roadmap.md "Next" phase, item 1. Scope source: planning.md's Phase 2 paragraph._

## What this is, in plain words

After a game is over, tell a coach two things: **is this team's drafting changing over time**, and **does picking or banning a specific hero actually line up with them winning or losing**. Not "how did they play" — the site never had gold, objectives, or kill timelines, and never will (CLAUDE.md). This is still a draft tool, just looking backward instead of forward.

Planning.md's original Phase 2 sketch also included "did the draft match the pre-game plan" — dropped from this spec. Nothing in the site stores a pre-game plan (no accounts, no saved predictions), so there's nothing real to compare against. Revisit only if the site ever grows a way to save a plan before a match.

## Why no pipeline changes

Checked `frontend/src/lib/data/dataset.json`: every one of the 181 committed games already has `winnerId` and a filled-in `playedAt` (100% coverage, verified by reading the file directly). Both new calculations below only need those two fields plus the picks/bans already in `drafts`. So this phase is frontend-only — new functions in `frontend/src/lib/metrics.ts`, two UI additions, no pipeline/schema/emit changes, no new `dataset.json` fields.

## The two new calculations (`frontend/src/lib/metrics.ts`)

Both live next to the existing `presence`/`hhi`/`pickRateByRole` functions and follow the same style: take the full `Dataset`, filter down, return plain numbers — no classes, no framework code.

**Correction from the version discussed in chat:** that version named two rolling functions, `rollingHhi` and `rollingPresence`. Presence is always a per-hero number (how often _that specific hero_ shows up) — there's no single number that means "presence" for a team as a whole, so there's nothing to draw as one line on a chart. HHI has no such problem — it's already one number per team. So this phase ships __`rollingHhi` only__ as the trend line. The "how often does a specific hero show up, and does it line up with winning" question is already answered by the win-rate-delta calculation below, which is per-hero by design.

### 1. Trend over time — `rollingHhi`

For one team, walk through their games in the order they were actually played (sort by `playedAt`), and at each point look back over their last N games (N=10 by default) to recompute HHI (how narrow their hero pool is). Output is a list of points — one per game — so it can be drawn as a line on a chart.

Because team IDs don't change between Season 17 and Season 18 (CLAUDE.md confirms same 8 teams), the trailing window keeps working right through the season boundary — a team's early-Season-18 trend line still has real history behind it instead of starting from zero.

`playedAt` is stored as a human-readable string like `"August 16, 2026 - 17:00"`, not a clean machine format — sorting needs a small parse step (or a fallback to match `id` order if parsing ever fails on an unexpected format; every row currently parses cleanly, verified against the live file).

### 2. Does this hero's presence line up with winning? — `pickWinRateDelta`

For one team, for every hero they've picked (or separately, banned) at least a handful of times: compare their win rate in games where that hero was picked/banned against their overall win rate. The difference is the "delta" — a positive number means they tend to win more when that hero's involved, negative means less.

**Small-sample guard:** a hero needs at least 5 team-instances (5 games where the team picked or banned it) before it gets a number at all. Below that, the function leaves it out of the results entirely — the calling UI shows "not enough games yet" rather than a shaky percentage. This matters right now specifically because Season 18 is one week in (per CLAUDE.md, started 14 Aug 2026) — most S18-only hero counts would fail this threshold today, which is expected and correct. As the season goes on, more heroes cross the threshold naturally; no extra runtime logic needed to "wait for more games," the same function just returns more entries as `dataset.json` grows week over week.

## New page: `/match/[id]` — one game, close up

Shows one full game: both teams' five picks and five bans each, side by side. Every single pick or ban is labeled two ways — how often that team normally picks/bans that hero (their own history) and how often the league as a whole does (the baseline). This reuses the same baseline-comparison piece already built for Team Scouting (`BaselineAnnotation`) rather than a new one — no new component needed here, same as how the Team and League pages already wire existing pieces together without inventing page-specific ones. Also shows who won, game length, and which series/stage it's from (regular season vs playoffs).

Reached by clicking a row on `/log` (Match Log already lists every game — it currently doesn't link anywhere). The Match Log's shared table piece (`DataTable`) gets one small optional addition — a way to turn the first cell of each row into a link — so every other page using that same piece is unaffected unless it opts in.

## Team page (`/team/[slug]`): two new boxes

1. **Trend chart** — the rolling HHI line from above, last 10 games, small chart (sparkline-sized, not a full dashboard chart). New small reusable piece since nothing in the site draws a line yet — one pure function that turns numbers into chart coordinates (so the math is testable on its own without a browser), plus a thin component that draws it.
2. **Win-rate-delta table** — one row per hero that's crossed the 5-game threshold, split into a picks table and a bans table, showing the delta and the game count it's based on. Heroes under the threshold aren't shown at all rather than shown grayed-out — an empty/short table for a team early in a season is honest, a long list of blanks isn't. Built the same way the Team page already builds its presence table — a plain table in the page itself, not a new shared piece, since nothing here needs to be reused elsewhere yet.

## Testing

- `metrics.spec.ts`: new cases for `rollingHhi` (empty history, a window that spans the S17→S18 boundary, a window smaller than the games played) and `pickWinRateDelta` (right below/at/above the 5-game threshold, delta sign correctness, the ban/pick split).
- A plain test file for the chart-coordinate function (no browser needed, it's just math).
- A Vitest component test for the new trend-chart piece (empty state vs. a real chart), following the same pattern as the site's other small pieces (`BaselineAnnotation`, `TeamTag`, `FreshnessIndicator`).
- The match page and the team page's new sections follow the same pattern already set by the Team/League/Match-Log pages in this codebase: none of those are tested directly today, only the reusable pieces and calculations they're built from are. This phase keeps that pattern rather than introducing a new one.

## Explicitly not in this phase

- Saved pre-game plans / draft-vs-plan comparison (see "plain words" section above).
- Any gameplay data (gold, objectives, timelines) — permanent constraint, not a v1 deferral (CLAUDE.md).
- Changing the 5-game threshold or window size N per user preference — both are fixed constants for this phase; making them adjustable is a later nice-to-have, not required to ship the feature.
