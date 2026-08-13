# Planning

## What this is, in plain words

**Before a match, tell a coach what the other team will probably pick and ban — and whether that's actually unusual, or just what everyone in the league does.**

The second half is the whole point. Anyone can count picks; Liquipedia already shows that. What nobody has is the comparison. "SRG banned Fanny in 78% of games" sounds like SRG fears Fanny — until you see the league average is 84.7%, which means SRG respects her *less* than most teams do. Same number, opposite conclusion. So every number in this tool appears next to its league baseline. Without one, a number can lie.

Everything else — parser, database, dashboard — is machinery to make that sentence true and keep it current.

### Two objectives, running at once

1. **A real tool.** An MPL MY analyst opens it before drafting against a team and gets something they couldn't get themselves in five minutes on Liquipedia.
2. **A proof of skill.** A public, correct, live-updating data product. Built solo, on real data, during a real season.

They usually point the same way. When they conflict, it's polish vs. correctness — and correctness wins. A plain table with right numbers beats a beautiful one that reports Guinevere twice because the source spells her name two ways.

### What success looks like

One person in the MPL MY scene, who is not Fiz, references a number from this tool during Season 18. Not traffic. Not stars.

### What this will never be

Liquipedia has picks, bans, side, winner, and game length. No gold, no objectives, no kill timelines. So this is a **draft** tool, permanently — it can tell you what a team drafts and how predictable they are. It cannot tell you how they play. See data-source.md.

## Problem

MLBB pro teams rely on manual scouting — rewatching VODs, gut feel — for draft prep, because there is no public equivalent of football's analytics layer for MLBB. The underlying data exists publicly on Liquipedia, but nobody has turned it into a validated, always-current tool.

## Scope for v1 (Now)

**Must have**
- Team-agnostic draft-prep dashboard covering all 8 MPL MY Season 18 teams
- Presence rate and per-team hero concentration (HHI), both overall and **per role** — slot ordering is verified, so EXP/Jungle/Mid/Gold/Roam breakdowns are in scope (data-source.md)
- Baseline-adjusted comparison on every stat — the thing that separates this from a raw stats dump
- Weekly data refresh once Season 18 starts, with build-halting validation re-run every time (stack.md)
- Season 17 loaded as historical baseline, since Season 18 has no meaningful sample in its first weeks

**Should have**
- Simple ban-suggestion logic: flag heroes with high presence-against-baseline that an opponent hasn't banned recently
- Season 17 vs Season 18 trend context
- **Flex rate** — a hero's distribution across role slots, and how often a team uses a hero off its usual role. Falls out of the slot-ordering work for free (data-source.md), and is genuinely novel: it measures draft unpredictability in a way raw pick counts cannot.

**Won't have (v1)**
- Patch filtering — no patch field exists in the source
- User accounts or private per-team data (everything is public-derived, nothing to gate)
- Post-game review or live draft assistant (Next / Later — see roadmap.md)
- Gameplay-level analysis — not available from the source, and not a v1 deferral but a permanent constraint

## Phase 2 (Next): Post-game review

Scoped as *draft-decision* review, not match film: did the draft match the pre-game plan, how did rolling HHI and presence shift, simple win/loss correlation against specific picks or bans.

## Phase 3 (Later): Live in-draft assistant

Analyst manually enters picks and bans as they happen; the tool queries the dataset instantly for opponent tendencies and counter suggestions. Rule-based off historical rates — no ML needed here either. This is the phase that reintroduces a runtime backend (stack.md).

## Distribution

No cold outreach to Vamos, SRG, or Rey planned yet. The path to real usage is: build it well, keep it public and current through Season 18, let analysts and scene-followers find it. Direct outreach is a later, separate conversation — easier with live S18 numbers than an S17 retrospective.

## Biggest open assumption

That analysts want a *public* tool showing everyone's tendencies, rather than something private to their own team. Cheapest test: ship v1 and watch whether anyone in the scene references or shares it during S18. That is the real signal, not a survey.
