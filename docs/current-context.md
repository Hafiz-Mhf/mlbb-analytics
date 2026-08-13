# Current Context

_Last updated: 13 Aug 2026_

## Where things stand
- Parser + validated dataset exist for MPL MY Season 17 (64 series / 164 games / 328 draft rows)
- Analysis so far is exploratory (Threads thread): presence, HHI by role, cross-team HHI comparison, respect-ban vs meta-ban baseline check
- No product built yet — no database, no dashboard, no live app. This planning set is the first step toward one.

## What's about to change the picture
MPL Malaysia Season 18 starts **14 Aug 2026** (tomorrow) and runs through October. This is the actual trigger for building something real rather than continuing to analyze S17 retrospectively — a live season is what makes the tool useful to an analyst instead of just a case study.

## Immediate priority
Stand up the ingestion pipeline so it can catch Season 18 data as it happens (see roadmap.md), and ship the smallest real thing — a draft-prep dashboard — before the season is meaningfully underway, not after.

## Known constraints going in
- Solo builder, portfolio/proof-of-concept framing (not yet a paid engagement with any team)
- Liquipedia gives picks/bans/side/winner/length — no gold graphs, objectives, or kill timelines, which caps how deep "post-game review" can ever go on this data source
- Real teams (SRG, Vamos, Rey, and the rest) are the aspirational audience, not confirmed users yet — usage has to be earned by the tool being genuinely current and correct during S18, not assumed
