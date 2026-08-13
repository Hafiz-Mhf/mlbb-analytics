# Roadmap

Format: Now / Next / Later, anchored to MPL MY Season 18 (14 Aug – Oct 2026).

## Now — before/during early Season 18

**Backend**
- [ ] Stand up database (see database.md) and migrate the existing S17 parser output into it
- [ ] Build the weekly ingestion job for S18 (parse → validate against known totals → load)
- [ ] Stand up FastAPI endpoints for the three v1 views (team scouting, league overview, match log)

**Frontend** (see frontend.md)
- [ ] Scaffold SvelteKit routes: `/`, `/team/[slug]`, `/league`, `/log`
- [ ] Build the shared data-table and baseline-annotation components once, before wiring individual screens
- [ ] Wire Tailwind + Audit Trail tokens (design-direction-v1.md)
- [ ] Connect routes to the FastAPI endpoints above

- Target: live before S18's first few match weeks are done, not after the season ends

## Next — once v1 is live and stable
- [ ] Post-game review module (draft-decision scope, not full film)
- [ ] Historical trend views (S17 vs S18 comparison)
- [ ] Revisit distribution: is anyone in the scene actually using v1? If not, find out why before building more

## Later — after Next is validated
- [ ] Live in-draft assistant
- [ ] Decide then whether real per-team usage justifies accounts/private notes (currently out of scope — see security.md)

## Risks to watch
- **Scope creep**: solo builder, three-phase ambition — resist polishing Now past "correct and current" before starting Next
- **Data freshness**: v1 is only as useful as its last refresh; the weekly job is not optional once S18 starts
- **Liquipedia dependency**: any edit-format change on their end breaks the parser — the step-4-style validation check needs to run every refresh, not just once
