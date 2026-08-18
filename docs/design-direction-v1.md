# Design Direction v1

Extends the existing Audit Trail system (from the hafizfaruqi.my portfolio) rather than starting fresh.

## Carried over from Audit Trail
- Base: warm charcoal (#1A1814)
- Accent: amber (#C8A97E)
- Display font: Syne
- Body font: Inter
- Data/log font: JetBrains Mono

## New for this project
- **Team color coding**: each of the 8 MPL MY teams gets a small identifying swatch/tag next to its name in tables — needed once the dashboard is team-agnostic, wasn't a concern for a single-team analysis. The eight — unchanged between Season 17 and Season 18 — are AC Esports (AC), Bigetron MY by VIT (BTRM), Invictus Gaming (IG), RRQ Tora (RRQ), Selangor Red Giants (SRG), Team Flash (FL), Team Rey (TR), Team Vamos (VMS). See data-source.md. Swatches attach to the stable team identity rather than the display string, since the wiki spells several of these more than one way.
- **Data density mode**: the portfolio's Audit Trail is spacious/narrative; this needs a denser table mode for draft rows, presence tables, and HHI breakdowns — same fonts and palette, tighter spacing, more like a real terminal log than a marketing page
- **Baseline annotation pattern**: any stat that needs baseline context (ban rates, presence) shows the raw number in mono, with the league baseline as a smaller, muted secondary value beside it — this is the single most important UI pattern in the whole tool, since it's the difference between the tool being insightful vs. misleading

## Key screens (see uiux.md for full nav)
1. Team scouting view — the "before a draft" screen
2. League overview — presence/HHI across all 8 teams, the step-8-style comparison
3. Match log — a literal draft log, one row per pick/ban, styled like the QA log stream from the portfolio hero

## Open question to settle before building
Amber-as-primary-accent works for a portfolio; on a data-dense dashboard, consider using it only for the baseline-annotation pattern and interactive elements, keeping team-color swatches as the dashboard's main "color" so amber doesn't visually compete with team identity.
