# Changelog

All notable changes to the MLBB Analytics project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

---

## [2026-08-27]

### Added
- **Draft Sandbox Season 18 Recency Prioritization & Scope Switcher (`/sandbox`)**:
  - Season 18 matches now weighted $3\times$ higher in draft AI recommendations and lane slot detection so current meta trends (e.g. S18 priority picks & lane shifts) dominate over historical volume.
  - Added dedicated Season Scope filter switcher in the header (`🔥 Season 18 (Latest)`, `⚖️ All Time`, `📜 Season 17`).
- **Draft Sandbox Smart Auto-Flex Engine & Interactive Role Selector (`/sandbox`)**:
  - Automatically matches multi-role flex heroes (e.g. Paquito EXP $\rightarrow$ JGL) to open team lanes to complete 5-lane coverage (`5/5`).
  - Added golden `FLEX` badges on auto-flexed draft picks.
  - Interactive lane select dropdown (`EXP`, `JGL`, `MID`, `GOLD`, `ROAM`) allowing coaches to manually change assigned lane for any hero with instant recalculation of lane role coverage.
- **Interactive Draft Sandbox (`/sandbox`)**:
  - Full 20-step official MPL tournament pick/ban sequence state machine.
  - Dual control modes: `👥 Dual Coach (Manual)` and `👤 Vs Simulated AI`.
  - Turn-by-turn AI recommendations drawer matching team signatures and unfilled lane roles.
  - Live 5-lane role coverage checklist (`EXP`, `JGL`, `MID`, `GOLD`, `ROAM`) and dynamic HHI draft predictability scoring.
  - Searchable Hero Selection Pool with filter pills, undo/redo history, and copy draft summary export.
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
- Header navigation polished with `whitespace-nowrap` and tuned `xl` responsive breakpoints to prevent multi-line text wrapping on all viewports.
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
