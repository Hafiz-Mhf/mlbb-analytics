# Changelog

All notable changes to the MLBB Analytics project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

---

## [2026-08-27]

### Added
- **Side Priority Analysis (`/sides`)**:
  - Tournament-wide Blue vs Red win rate split banner with duration breakdowns and first-pick advantage margins.
  - 8-team side asymmetry matrix tracking Blue and Red records, side delta, and reliance classifications (`Blue-Reliant`, `Balanced`, `Red-Reliant`).
  - Side-specific hero priority rankings categorizing picks into First-Pick Priority (Blue), Counter-Pick Priority (Red), and Side Win-Rate Swings.
- **Head-to-Head Matchup Tool (`/matchup`)**:
  - Dual-team selectors with "⇄ Swap" quick toggle and season filter tabs.
  - Direct series & game record overview with average game length.
  - 3-way draft clash categorization (Contested battlegrounds, Team 1 signatures, Team 2 signatures).
  - 5-lane HHI predictability comparison and top 3 comfort picks per lane.
  - Direct match encounter accordions linking to full draft breakdowns on `/series/[seriesId]`.
- **Per-Role & Flex Scouting (`/roles`)**:
  - 8-team Role Predictability Matrix (EXP, Jungle, Mid, Gold, Roam) comparing lane HHI against league baseline.
  - Tournament Flex Picks table tracking heroes drafted across multiple roles with primary/secondary lane shares.
  - Per-role filters and lane-specific HHI callouts on `/team/[slug]` and `/league`.

### Changed
- Navigation updated to include `Matchup`, `Side Priority`, and `Roles & Flex` tabs.
- Test coverage expanded to 141 tests (89 pipeline pytest + 52 frontend vitest).

---

## [2026-08-20]

### Added
- Real landing page with the project pitch and interactive team grid.
- Redesigned Match Log (`/log`) grouping matches into per-series views (`/series/[seriesId]`).
- Notable pick and ban highlights in the series draft view.
- League Overview meta split into pick/ban top 10 by season.

---

## [2026-08-18]

### Added
- Esports visual identity and accessible UI styling across every screen.
- Team switcher with real team logos and short codes.
- Season 17 vs Season 18 comparison panels on Team Scouting and League Overview.
- Rolling predictability sparkline and pick/ban win-rate deltas on Team Scouting.
- Per-game draft breakdown pages.

---

## [2026-08-17]

### Added
- End-to-end data pipeline parsing Liquipedia wikitext into validated SQLite database (`data/mlbb.db`).
- Hero and team alias normalization with halt-on-unknown validation invariants.
- Core presence and HHI predictability metrics overall and per role.
- Weekly automated refresh via GitHub Actions.

---

## [2026-08-13]

### Added
- Project initialized: MediaWiki throttled client and wikitext parser foundations.
