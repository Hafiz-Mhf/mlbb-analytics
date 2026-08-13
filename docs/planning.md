# Planning

## Problem
MLBB pro teams currently rely on manual scouting (rewatching VODs, gut-feel) for draft prep because there's no public equivalent of football's analytics layer for MLBB. The underlying data to build one exists publicly (Liquipedia) but nobody has turned it into a validated, always-current tool.

## Scope for v1 (Now)
**Must have**
- Team-agnostic draft-prep dashboard covering all 8 MPL MY Season 18 teams
- Presence rate, HHI by role, per-team opponent scouting view
- Baseline-adjusted "respect ban vs meta ban" comparison (the thing that separates this from a raw stats dump)
- Weekly data refresh once Season 18 starts, with the validation check re-run every time

**Should have**
- Simple ban-suggestion logic (flag heroes with high presence-against-baseline an opponent hasn't banned recently)
- Season 17 data kept as historical/trend context

**Won't have (v1)**
- User accounts or private per-team data (everything is public-data-derived, so there's nothing to gate yet)
- Post-game review or live draft assistant (Next / Later — see roadmap.md)
- Gameplay-level analysis (gold graphs, objectives, kill timelines) — not available from Liquipedia, explicitly out of scope until/unless a different data source is added

## Phase 2 (Next): Post-game review
Scoped as *draft-decision* review, not full match film: did the draft match the pre-game plan, how did the game shift rolling HHI/presence, simple win/loss correlation against specific picks or bans.

## Phase 3 (Later): Live in-draft assistant
Analyst manually enters picks/bans as they happen; tool queries the existing dataset instantly for opponent tendencies and counter suggestions. Rule-based off historical rates — no ML needed for v1 of this phase either.

## Distribution
No cold outreach to Vamos/SRG/Rey planned yet. Path to "real" usage is: build it well, keep it public and current through Season 18, let analysts/scene-followers find it. Direct outreach is a later, separate conversation — easier with live S18 numbers to show than S17 retrospective ones.

## Biggest open assumption
That analysts will actually want a public tool showing everyone's tendencies, rather than preferring something private to their own team. Cheapest test: ship the v1 dashboard and see if anyone in the scene references or shares it during S18 — that's the real signal, not a survey.
