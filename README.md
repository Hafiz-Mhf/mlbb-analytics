# 🎮 MLBB Analytics

**Draft-prep scouting for MPL Malaysia — every number next to the league baseline that gives it meaning.**

[![tests](https://img.shields.io/badge/tests-165%20passing-4CAF50)](#-testing)
[![pipeline](https://img.shields.io/badge/pipeline-Python%203.12-3776AB?logo=python&logoColor=white)](pipeline)
[![frontend](https://img.shields.io/badge/frontend-SvelteKit%20%2B%20Svelte%205-FF3E00?logo=svelte&logoColor=white)](frontend)
[![data source](https://img.shields.io/badge/data-Liquipedia-orange)](docs/data-source.md)
[![status](https://img.shields.io/badge/status-v1%20live-blue)](docs/current-context.md)

> ⚠️ **Unofficial fan project.** Not affiliated with or endorsed by MPL, Moonton, or the teams shown. Logos and hero art belong to their respective owners.

---

## 🧭 What this is

Before a match, tell a coach what the other team will probably pick and ban — **and whether that's actually unusual, or just what everyone in the league does.**

That second part is the whole point. Anyone can count picks — [Liquipedia](https://liquipedia.net/mobilelegends/) already shows raw numbers. Nobody shows the comparison.

> "SRG banned Fanny in 78% of games" sounds like SRG fears Fanny — **until you see the league average is 84.7%**, meaning SRG respects her *less* than most teams do. Same number, opposite conclusion.

Every stat in this tool is shown next to its league baseline. Without one, a number can lie.

This is a **draft** tool, permanently. Liquipedia's public data covers picks, bans, side, winner, and game length — no gold, no objectives, no kill timelines. So it tells you *what* a team drafts and *how predictable* they are, never *how they play*.

## ✨ Screens

| Screen | Route | What it shows |
|---|---|---|
| 🏠 **Team Scouting** | `/team/[slug]` | A team's pick/ban rates vs. league baseline, lane filter, rolling predictability sparkline, Flex Picks card, Season 17→18 swings, and win-rate deltas |
| ⚔️ **Matchup Tool** | `/matchup` | Head-to-head comparison between any two teams: direct series/game records, Blue vs Red side performance, 3-way draft clash (Contested battlegrounds vs Signatures), and lane comfort picks |
| ⚖️ **Side Priority** | `/sides` | League-wide Blue vs Red win rate split banner, 8-team side asymmetry matrix with reliance classifications, and First-Pick vs Counter-Pick hero priorities |
| 🎮 **Draft Sandbox** | `/sandbox` | 20-step official tournament mock draft simulator with Dual Coach and Solo vs AI modes, live AI recommendations, 5-lane coverage checklist, and draft HHI scoring |
| 📊 **League Overview** | `/league` | League-wide Tournament Standings table with season toggles, presence and HHI (draft concentration) rankings, role-filtered top picks, and season-over-season swings |
| 🛡️ **Roles & Flex** | `/roles` | 8-team Role Predictability Matrix (EXP/JGL/MID/GOLD/ROAM) and Tournament Flex Picks table |
| 📜 **Match Log** | `/log` | Every series grouped by season, with win scores, best-of format, and links to full draft breakdowns |
| 🔍 **Series Detail** | `/series/[seriesId]` | One series as a collapsible accordion — every game's picks/bans labeled against team history and league baseline, notable divergences highlighted |

Plus five static info pages linked from the footer only — `/about`, `/contact`, `/privacy`, `/terms`, `/changelog` — no dataset dependency.

## 📐 Core metrics

- **Presence** — `(picks + bans) / games played` — how much the league or a team touches a hero. Meta breadth.
- **HHI** — sum of squared pick shares — how concentrated a team's drafting is. Predictability.
- **Both are computed overall and per role** (EXP / Jungle / Mid / Gold / Roam — pick slots are role-ordered 95.7% of the time, verified against all of Season 17).
- Every metric is exposed at two scopes — team vs. league, and season vs. season — so a raw number never stands alone.

## 🏆 Coverage

All 8 MPL Malaysia teams, Season 17 (closed, full baseline) and Season 18 (live, updated weekly):

`AC Esports` · `Bigetron MY by VIT` · `Invictus Gaming` · `RRQ Tora` · `Selangor Red Giants` · `Team Flash` · `Team Rey` · `Team Vamos`

## 🏗️ How it works

```
Liquipedia wikitext  →  Python pipeline  →  SQLite (committed)  →  dataset.json  →  SvelteKit (static)
   (data/raw/*.wiki)      parse+validate      data/mlbb.db         frontend/src        prerendered site
```

There is **no backend server**. The Python pipeline runs at build time (weekly, via GitHub Actions), not as a live service — Vercel's filesystem is ephemeral, so the pipeline fetches, validates, and commits a fresh dataset instead of querying anything at request time.

1. **Fetch** — a throttled MediaWiki client pulls wikitext and parsed HTML standings from Liquipedia (no API key exists; rate-limited to 1 request/2s with a custom User-Agent)
2. **Parse** — `{{Matchlist}}` / `{{Bracket}}` / `{{Match}}` / `{{Map}}` templates become typed Pydantic rows; unplayed games (`finished=skip` or blank future matches) are filtered
3. **Normalize** — hero and team name aliases are resolved against a committed alias table; an *unknown* string halts the build rather than silently inventing a phantom hero
4. **Validate** — regular-season series ($W-L$) and game ($W-L$) records are validated against published Liquipedia standings snapshots (`standings.html`), and a regression guard blocks the swap if a rebuild ever produces *fewer* games or series than what's already committed
5. **Emit** — SQLite rows are mapped to `dataset.json`, validated against a Pydantic wire-format schema before it's written
6. **Publish** — a diff-gated commit pushes the new dataset; Vercel rebuilds the static site

A failed validation at any step **never publishes**. Stale-but-correct beats fresh-but-wrong.

## 📦 Repository layout

```
mlbb-analytics/
├── pipeline/           Python 3.12 build-time pipeline (uv-managed)
│   ├── src/mlbb_pipeline/
│   │   ├── fetcher.py       throttled Liquipedia client + standings fetcher
│   │   ├── parser.py        wikitext → structured rows
│   │   ├── standings.py     Liquipedia standings parser + build validation guard
│   │   ├── aliases.py       hero/team alias normalization (halt-on-unknown)
│   │   ├── schema.py/build.py   SQLite build + regression guard
│   │   ├── metrics.py       presence, HHI (overall + per-role)
│   │   ├── emit.py          SQLite → dataset.json
│   │   └── gen_ts.py        generates frontend/src/lib/types.ts from the same Pydantic models
│   └── tests/
├── frontend/            SvelteKit 2 + Svelte 5 + Tailwind v4, prerendered
│   └── src/lib/data/dataset.json   the committed dataset the site reads
├── data/
│   ├── raw/*.wiki       committed wikitext snapshots (the raw archive, not a build artifact)
│   ├── raw/mpl/malaysia/season-*/standings.html  committed regular-season standings HTML snapshots
│   ├── aliases/         hero_aliases.json, team_aliases.json
│   └── mlbb.db          committed SQLite build
├── docs/                planning.md, data-source.md, stack.md, current-context.md, and more
└── .github/workflows/   weekly-build.yml — Monday 00:00 UTC cron
```

## 🚀 Getting started

**Pipeline** (Python 3.12, [uv](https://docs.astral.sh/uv/)):

```bash
cd pipeline
uv sync
uv run pytest                # run the test suite (100 tests)
uv run mlbb-backfill --season 18   # fetch + snapshot the live season
uv run mlbb-build            # rebuild data/mlbb.db and dataset.json
uv run mlbb-gen-types        # regenerate frontend/src/lib/types.ts
```

**Frontend** (Node.js, npm):

```bash
cd frontend
npm install
npm run dev                  # local dev server
npm test                     # 65 Vitest tests
npm run check                # svelte-check
npm run build                # static build for deploy
```

## 🧪 Testing

165 tests passing — 100 pipeline (`pytest`) + 65 frontend (`vitest`). A build never ships without both green, standings validation matching published tables, and the pipeline's regression guard passing.

## 🗺️ Status & roadmap

**v1 is live**, wired end to end on real data — see [`docs/current-context.md`](docs/current-context.md) for the full, dated history. Weekly refresh runs automatically via GitHub Actions.

- ✅ **Now** — draft-prep dashboard, presence + HHI baselines, weekly refresh, Season 17 historical baseline, standings validation guard
- ✅ **Next** — post-game draft review, Season 17→18 trend views, generated TypeScript types, per-role & flex scouting, head-to-head matchup tool, side priority analysis, interactive draft sandbox, tournament standings dashboard
- 🔭 **Later** (gated on real usage) — live in-draft assistant, accounts/private team notes

The current gap isn't code — every planned feature for this stage is shipped. It's **distribution**: nobody in the MPL MY scene has used it yet. See [`docs/planning.md`](docs/planning.md) for the full reasoning.

## 📚 Documentation

| Doc | Covers |
|---|---|
| [`docs/planning.md`](docs/planning.md) | Why this exists, scope, what it will never be |
| [`docs/data-source.md`](docs/data-source.md) | Liquipedia wikitext findings, verified counts, hero/team alias hazards |
| [`docs/stack.md`](docs/stack.md) | Stack decisions and the deliberate no's (no Docker, no Postgres, no chart library, no auth) |
| [`docs/database.md`](docs/database.md) | SQLite schema |
| [`docs/frontend.md`](docs/frontend.md) | SvelteKit architecture |
| [`docs/current-context.md`](docs/current-context.md) | Live, dated project state |
| [`docs/roadmap.md`](docs/roadmap.md) | Now → Next → Later sequencing |

## 👤 Author

Solo project by **Fiz** — final-year IT/BI & Analytics student. Originated as a public Threads tutorial thread on the data pipeline for Selangor Red Giants, now scoped into a league-wide tool.

## 📄 License

No license has been declared yet — all rights reserved by default until one is added.

## ⚠️ Disclaimer

Unofficial fan project. Not affiliated with or endorsed by MPL, Moonton, or the teams shown. Logos and hero art are property of their respective owners. All match data is sourced from [Liquipedia](https://liquipedia.net/mobilelegends/) under its terms of use.
