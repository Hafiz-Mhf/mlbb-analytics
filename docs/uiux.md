# UI/UX

## Primary user and moment
A team analyst, before a draft, needs an opponent's tendencies fast. Every screen should answer "what do I need to know about Team X before we draft against them" in under a few seconds of scanning — this is the design constraint everything else serves.

## v1 navigation (three views)
1. **Team Scouting** (default landing) — pick a team, see: presence by hero, team HHI, ban-rate with league baseline annotated, last N games log
2. **League Overview** — cross-team comparison: HHI ranked across all 8 teams, meta-wide presence, so a number never has to be read without knowing where it sits league-wide
3. **Match Log** — raw draft-by-draft record, filterable by team and stage, styled as a log stream (see design-direction-v1.md)

**From the 13 Aug 2026 source check (data-source.md):**
- *Filter by patch* was previously listed on Match Log. Liquipedia records no patch field on any game, so it is removed. Stage (Regular Season / Playoffs) replaces it as the second filter axis.
- *By role* breakdowns are **cleared to build.** Pick slots are verified role-ordered (EXP/Jungle/Mid/Gold/Roam), so Team Scouting can show presence and HHI per role.
- *Flex* is a new pattern worth designing for. 4.5% of picks are heroes used in a second role, and that is real signal rather than error. A hero shown in a role table should indicate when a team also plays it elsewhere — this is the kind of thing an opposing coach most wants to know and cannot get from a pick count.

## Interaction patterns
- **Team selector** persists across views (pick once, it follows you) — this is the single control that makes the dashboard team-agnostic instead of SRG-only
- **Baseline toggle**: every ban-rate/presence number can show "raw" or "vs. league baseline" — default to baseline-adjusted, since that's the whole analytical value-add over just reading Liquipedia directly
- **Freshness indicator**: visible "last updated" timestamp tied to the weekly refresh job — an analyst needs to know if they're looking at last week's meta or this week's

## Phase 2/3 additions (don't build into v1 nav yet)
- Post-game review adds a per-match "draft review" screen, linked from Match Log
- Live assistant is a separate, purpose-built real-time view (not a tab bolted onto the existing dashboard) — it has different interaction needs (fast entry during an actual draft clock) and shouldn't compromise v1's scanning-focused layout

## Accessibility/practical notes
- Dense data tables need real column sorting/filtering, not just static tables — this is a tool people will use under time pressure
- Mobile isn't a v1 priority (analysts will use this at a desk/laptop pre-draft), but the live assistant in Phase 3 may need to work on a tablet sideline — worth keeping in mind for that phase's stack choice, not v1's
