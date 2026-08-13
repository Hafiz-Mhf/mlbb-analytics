# Database

## Engine
SQLite for v1. Zero infra, single file, entirely sufficient for a read-mostly dashboard with a weekly batch refresh and no concurrent-write problem. Migrate to Postgres only if/when this needs multiple writers or heavier concurrent read load — not a v1 concern.

## Core tables

**teams**
- id, name, short_code, season (a team's identity can span seasons; keep season as a column, not a separate join table, until there's a real reason not to)

**heroes**
- id, name, role (EXP / Jungle / Mid / Gold / Roam — matches Liquipedia's slot ordering)

**matches**
- id, series_id, season, patch, team1_id, team2_id, team1_side, winner_id, game_length, game_number_in_series

**drafts**
- id, match_id, team_id, role_slot (1–5), hero_id, is_ban (bool)
- one row per pick or ban — this is the granularity everything else (presence, HHI, baseline comparisons) is computed from

**metrics_cache** (optional, but recommended once the dashboard has real traffic)
- team_id, season, metric_name (presence / hhi / ban_rate), role, hero_id (nullable), value, computed_at
- precomputed on each weekly refresh rather than recalculated per page load

## Refresh strategy
Weekly job during active season: re-run parser → run the same validation-check pattern as the original S17 work (compare against an independently known number, e.g. current standings) → only write to the live tables if validation passes → recompute metrics_cache. Never let a failed validation silently publish new numbers to the dashboard.

## What's explicitly not modeled yet
Player-level identity across team changes, gold/timeline event data (not available from Liquipedia), any user/account data (no auth in v1).
