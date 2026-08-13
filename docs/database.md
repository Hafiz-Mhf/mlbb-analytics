# Database

## Role — read this first

SQLite is **not** the app's runtime store. v1 has no backend server (stack.md); the frontend is prerendered against static JSON.

SQLite is the **build-time archive**: the pipeline parses committed wikitext snapshots into it, computes metrics from it, and emits JSON for the frontend. Its value is durability and queryability, not serving.

```
data/raw/*.wiki  →  SQLite (committed)  →  metrics  →  frontend/src/lib/data/*.json
```

Why keep it at all, if JSON is what ships:

- **Ad-hoc SQL.** Exploratory questions during a season ("has any team ever first-phase-banned this hero?") are one query, not a new script.
- **Re-derive without refetch.** Change a metric definition, rebuild from the archive, never touch Liquipedia.
- **History accumulates.** Snapshots plus DB give a record across seasons that the live wiki does not preserve.

The database file is committed. It is small, and committing it makes every build reproducible from the repo alone.

## Engine

SQLite. Zero infra, single file, read-mostly, one writer, weekly. Postgres would be a downgrade here — it adds a managed dependency for concurrency this project does not have. Revisit only if Phase 3's live assistant needs runtime writes.

## Core tables

**teams**
- `id`, `canonical_name`, `short_code`

**team_names**
- `team_id`, `season`, `display_name`

**team_aliases**
- `alias`, `team_id`

`team_aliases` is required and measured: **16 distinct strings for 8 teams** across the pages checked, from inconsistent casing (`Bigetron MY by VIT` / `Bigetron MY by Vit` / `bigetron my by vit`) and short forms (`ig`). Unnormalized, Bigetron's history splits four ways and the league baseline is computed over a wrong denominator. Same halt-on-unknown rule as heroes: an unrecognized team string fails the run. See data-source.md, Hazard 3.

`team_names` separates stable identity from per-season display name. This is a **precaution, not a response to observed data** — no cross-season rename exists in this dataset. Sponsor-suffix changes are common enough in esports to be worth the one extra table, and it costs nothing, but do not cite it as evidence-backed.

Season 17 and Season 18 have the same eight teams, so every team has a full historical baseline from day one. See data-source.md for the list.

**heroes**
- `id`, `canonical_name`, `role`

**hero_aliases**
- `alias`, `hero_id`

Not optional. Liquipedia editors write both `guinevere` and `guin`, `yu zhong` and `yz` — 94 distinct strings for 80 heroes in Season 17 alone. Unnormalized, this creates phantom heroes and understates HHI, which squares shares. See data-source.md, Hazard 1.

Every hero string encountered must resolve through this table. **An unresolved string halts the pipeline** — it is never inserted as a new hero. A hero release or a new editor shortcut must break the build loudly.

`role` is provisional: it depends on the unverified slot-ordering convention (data-source.md, Hazard 2). If that convention does not hold, this column is dropped along with the per-role features.

**matches**
- `id`, `series_id`, `season`, `stage`, `team1_id`, `team2_id`, `team1_side`, `winner_id`, `game_length`, `game_number_in_series`, `played_at`

Two changes from the original schema:

- **`patch` removed.** No patch field exists on any of the 164 Season 17 games. If patch context is ever needed, derive it from `played_at` against a hand-maintained patch calendar — a separate table, honestly labelled as derived rather than sourced.
- **`stage` added.** Regular Season and Playoffs live on separate wiki pages and have different `bestof` values; the distinction matters for baselines.

Only played games are stored. Maps carrying `finished=skip` are unplayed placeholders in an unfinished series and are filtered at parse time — 42 of 206 map blocks in Season 17.

**drafts**
- `id`, `match_id`, `team_id`, `slot` (1–5), `hero_id`, `is_ban` (bool)

**One row per pick or ban.** Season 17 at this granularity is 164 games × 20 = **3,280 rows**. The old docs said "328 draft rows", which is 164 × 2 — that counted *team-game* rows, a different and coarser thing. Everything downstream (presence, HHI, baselines) is computed from this table, so the fine granularity is the correct one.

`slot` is positional, not draft order — Liquipedia does not record pick order. Whether the position maps to a role is the open question above.

## Build strategy

Weekly during an active season, in GitHub Actions:

1. Fetch changed season subpages (2s throttle, custom User-Agent)
2. Write raw wikitext to `data/raw/`, committed
3. Rebuild SQLite from **all** snapshots, not incrementally — idempotent, so a parser fix retroactively corrects history
4. Run validation invariants (stack.md). **Any failure halts the run and publishes nothing.**
5. Compute metrics, emit JSON to the frontend
6. Commit and push, triggering the Vercel rebuild

Step 4 is the point of the whole design. Wrong numbers handed to a real analyst before a real draft is the actual harm model, so stale-but-correct always beats fresh-but-wrong.

## Not modeled

- Player-level identity across team changes
- Gold, objectives, kill timelines — not available from the source, permanently (data-source.md)
- Draft order — not recorded by Liquipedia
- Any user or account data — no auth in v1 (security.md)
- `metrics_cache` — dropped. The original schema proposed it to avoid per-page-load recomputation, but with no runtime server there are no page loads to serve. The emitted JSON *is* the cache.
