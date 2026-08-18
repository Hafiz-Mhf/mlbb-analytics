# Season 17 vs Season 18 Trend Views — Design Spec

_Written 18 Aug 2026. Roadmap: docs/roadmap.md "Next" phase, item 2. Scope source: planning.md's "Should have" list ("Season 17 vs Season 18 trend context") and roadmap.md's "Season 17 vs Season 18 trend views."_

## What this is, in plain words

Season 17 is finished. Season 18 just started (14 Aug 2026, one week of games in). This adds two small sections — one on the Team page, one on the League page — that put last season's numbers next to this season's, so a coach or scene-follower can see **is this team, or the league as a whole, drafting differently than they did last year**, as the new season's evidence builds up week by week.

## Why almost no new code

`presence` and `hhi` in `frontend/src/lib/metrics.ts` already accept a `season` filter (`{ teamId?, season? }`). Comparing S17 to S18 for any team, or league-wide, is already possible by calling the same functions twice with different `season` values — nothing needed changes in the pipeline or in `dataset.json`. The only new code is one small function that does the before/after subtraction and hands back a sorted list, plus two new sections of UI.

## The new calculation (`frontend/src/lib/metrics.ts`)

`presenceDelta(data, beforeSeason, afterSeason, opts?)` — calls `presence()` twice (once per season, forwarding an optional `teamId`), and for every hero either season touched, returns `{ hero, before, after, delta }` where `delta = after - before`. Sorted by the size of the swing (`|delta|`), biggest first, so both directions (heroes gaining ground and heroes losing it) show up together. A hero present in only one season gets `0` for the other side rather than being dropped — a hero going from 0% to 20% is exactly the kind of swing this view exists to surface.

`'17'` and `'18'` are passed in as plain arguments, not hardcoded inside the function — but both call sites (team page, league page) call it with exactly those two literal strings, since those are the only two seasons that exist (CLAUDE.md: "Season 17 and Season 18 have the same eight teams"). No attempt to generalize to a hypothetical future season list; that's a rewrite for whenever Season 19 exists, not a v1 concern.

## Team page (`/team/[slug]`): new section

One summary line: the team's HHI last season next to this season, each with its own game count directly beside it — e.g. "S17: 0.032 (64 games) → S18: 0.041 (7 games)". The game count sits right next to the number on purpose: this view's whole point is watching a trend emerge from a small sample, so hiding the sample size would be dishonest about how much to trust it — the opposite choice from the win-rate-delta table shipped in the post-game review phase, which hides thin data instead of labeling it, because that table's numbers get read as "should I trust this," while this one's numbers get read as "how is this season shaping up so far."

Below that: a table from `presenceDelta(data, '17', '18', { teamId })` — every hero the team touched in either season, S17 rate, S18 rate, and the gap, biggest swings first. No row-count cap; a team's own hero pool across two seasons is small enough (dozens, not hundreds) that a cap isn't needed.

## League page (`/league`): new section

Same shape, no `teamId` — league-wide HHI, S17 next to S18, each with its own total-games count. Below it, `presenceDelta(data, '17', '18')` (no `teamId`), same sort, capped to the top 15 rows by `|delta|` — the existing "Meta-wide presence" table on that page already caps at 10, so a similar-sized cap keeps the two sections visually consistent rather than one dwarfing the other.

## Testing

- `metrics.spec.ts`: new cases for `presenceDelta` — a hero present in both seasons (delta computed correctly, sign both ways), a hero present in only one season (the missing side reads as `0`, not dropped), sort order (biggest `|delta|` first regardless of sign), and the `teamId` filter actually scoping to one team's own drafts rather than the league.
- No new components, so no new component test files. The two page sections follow the same untested-page convention already established for `/team/[slug]`, `/league`, `/log`, and `/match/[id]` — only the calculation gets a test file.

## Explicitly not in this phase

- Any season beyond S17/S18 — there isn't one yet.
- A visual chart for this comparison (a two-column table is the whole ask; no chart library per CLAUDE.md's deliberate no's, and a two-point "trend" has nothing a line would show that the two numbers don't already say).
- Per-role breakdowns of the delta table — the existing per-role work (CLAUDE.md) isn't wired into any UI yet; folding it into this table too is scope creep on a feature that's supposed to be small.
