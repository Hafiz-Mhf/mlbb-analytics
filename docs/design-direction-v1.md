# Design Direction v1

**Superseded 18 Aug 2026 — see "Esports identity pivot" below.** This doc originally extended the Audit Trail system (from the hafizfaruqi.my portfolio) rather than starting fresh. That's no longer the live identity; kept below for history.

## Esports identity pivot (18 Aug 2026)

Direct feedback: the Audit Trail-carryover look "looks very basic... does not look like a proper visual to share." Investigating turned up the actual root cause — **Syne/Inter/JetBrains Mono were never really loaded.** No `@font-face`, no Google Fonts `<link>`, anywhere in the codebase. The whole typography identity had been silently falling back to system sans-serif since the project started; the "carried over from Audit Trail" fonts below never rendered once.

Replaced with a fresh, esports-native identity rather than re-wiring the old one (user's explicit choice over "keep brand, add depth" — see the redesign conversation):

- **Background**: deep navy-black (`#05070d`), not warm charcoal — plus two faint radial gradients (blue top-left, gold top-right) behind the whole page for atmosphere
- **Surface**: `#0c1120` card background, `#121a30` hover/elevated, `#1f2b45` borders — every table/stat block now sits in a bordered `.card` (`border-radius: 0.75rem`) instead of floating bare on the page background, which was most of what read as "basic"
- **Text**: `#eef2f8` primary, `#7c8aa6` muted (contrast-checked: 5.9:1 muted-on-bg, primary ~14:1)
- **Primary accent**: electric blue `#38bdf8` — links, active nav, focus rings, sort indicator, chart line/fill, filter dropdown text
- **Gold accent**: `#fbbf24` — reserved for achievement/highlight only (winner badge ring + pill and notable-pick/ban ring on `/series/[seriesId]`, StatBlock's top gradient bar, winning score in `/log`'s list), never a general interactive color
- **Delta colors**: `#4ade80` positive / `#f87171` negative, unchanged in spirit from the old green/red pair, just retuned to sit on the new dark navy
- **Display font**: Russo One (real Google Fonts `<link>` in `app.html` now, with preconnect) — bold broadcast-graphic impact for headings and the big stat numbers
- **Body font**: Chakra Petch — techy/angular, replaces Inter
- **Data font**: JetBrains Mono, unchanged — draft rows, tables, HHI values still tabular mono

All raw hex Tailwind arbitrary-value classes (`text-[#8a8478]`, `border-[#3a352c]`, etc.) that had accumulated across every component were replaced with real Tailwind v4 `@theme` tokens (`text-muted`, `border-line`, `bg-surface`, `text-primary`, `text-gold`, `text-positive`/`text-negative`) — fixes the `color-semantic` anti-pattern (raw hex in components) the ui-ux-pro-max checklist flags, not just a coat of paint.

## Carried over from Audit Trail (historical — replaced above)

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

**Resolved (18 Aug 2026):** confirmed during the visual-hierarchy redesign pass — amber stayed scoped to links, focus rings, active nav, and the sort indicator; season/win-rate deltas got their own green/red pair instead of amber, so it never became a data color. See current-context.md.
