# UI/UX

## Primary user and moment
A team analyst, before a draft, needs an opponent's tendencies fast. Every screen should answer "what do I need to know about Team X before we draft against them" in under a few seconds of scanning — this is the design constraint everything else serves.

## v1 navigation (three views)
1. **Team Scouting** (default landing) — pick a team, see: presence by hero/role, HHI by role, ban-rate with league baseline annotated, last N games log
2. **League Overview** — cross-team comparison (the step-8 pattern): HHI ranked across all 8 teams, meta-wide presence, so a number never has to be read without knowing where it sits league-wide
3. **Match Log** — raw draft-by-draft record, filterable by team/patch, styled as a log stream (see design-direction-v1.md)

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
