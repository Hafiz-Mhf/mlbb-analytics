# Data Source

_Verified 13 Aug 2026 against the live MLBB wiki. Everything here was measured, not assumed._

This file is the parser specification. If the parser and this document disagree, one of them is a bug.

## Access

Liquipedia offers two APIs. Only one is usable here.

| | MediaWiki action API | LPDB (api.liquipedia.net v3) |
|---|---|---|
| Access | Free, no key | Approved request + API key |
| Rate limit | 1 req / 2s (`parse` actions: 1 / 30s) | 60 req / hour |
| Returns | Raw wikitext | Structured `match2` records |
| **Usable for MLBB?** | **Yes** | **No — see below** |

**LPDB is a dead end for this project.** The MLBB wiki still uses the *legacy* match templates (`{{Matchlist}}` / `{{Match}}` / `{{Map}}`). Neither S17 page contains a single `MatchGroup` occurrence, which means `match2` / `match2game` is not populated for this wiki. There is no structured pick/ban data to query. Wikitext parsing is the only path.

Re-check this before Phase 2. If the wiki migrates to the new match system, the parser becomes deletable and the format-change risk disappears with it.

### Terms compliance (binding, not optional)

- Custom `User-Agent` identifying the project and a contact address. Generic agents (`python-requests`, `curl`) are explicitly listed as likely to be blocked.
- Throttle to 1 request per 2 seconds. Do not use `action=parse` (30s limit) when `action=query&prop=revisions` will do.
- Send `Accept-Encoding: gzip` and reuse connections.
- Stay unauthenticated — better cache behaviour on their side.
- Violations trigger automatic IP bans.

Endpoint used:

```
GET https://liquipedia.net/mobilelegends/api.php
    ?action=query&prop=revisions&rvprop=content&rvslots=main&format=json
    &titles=MPL/Malaysia/Season%2017/Regular%20Season
```

## Page layout

Matches do not live on the season page. `MPL/Malaysia/Season 17` contains rosters, prize pool, and broadcast info only — zero match templates. Matches are on subpages:

- `MPL/Malaysia/Season 17/Regular Season`
- `MPL/Malaysia/Season 17/Playoffs`

The parser must discover subpages from the season page rather than assume the two names, since bracket stages vary between seasons.

## Structure

Real excerpt, S17 Regular Season, Week 1 Match 1:

```
{{Matchlist|width=350px|id=MPLMYS17W1|title=Week 1
|M1header=Day 1|M3header=Day 2|M6header=Day 3
|M1={{Match
    |bestof=3 |caster1=Mars (Malaysian Caster) |mvp=Yums
    |opponent1={{TeamOpponent|Selangor Red Giants
        |substitutes={{PlayerSubstitutions
        |{{Substitution|in=Unii|out=Sekys}}}}
    }}
    |opponent2={{TeamOpponent|Team Vamos}}
    |date=April 3, 2026 - 17:00 {{Abbr/MYT}}
    |map1={{Map|vod=... |team1side=blue |team2side=red |length=21:59 |winner=1
        <!-- Hero picks -->
        |t1h1=sora |t1h2=guin |t1h3=zhuxin |t1h4=granger |t1h5=chou
        |t2h1=phoveus |t2h2=leomord |t2h3=yve |t2h4=harith |t2h5=khaleed
        <!-- Hero bans -->
        |t1b1=baxia |t1b2=valen |t1b3=kalea |t1b4=suyou |t1b5=harley
        |t2b1=freya |t2b2=marcel |t2b3=fanny |t2b4=gloo |t2b5=claude
    }}
    |map3={{Map|finished=skip}}
}}
```

### Field map

| Level | Field | Notes |
|---|---|---|
| `Matchlist` | `id`, `title` | `title` carries the week label ("Week 1") |
| | `M{n}header` | Day label, applies to that match onward |
| `Match` | `bestof` | 3 in regular season, 5 in playoffs |
| | `opponent1`, `opponent2` | `{{TeamOpponent\|Team Name}}` — **can nest** `substitutes` / `PlayerSubstitutions`, so brace-matching is required, not a flat regex |
| | `date` | `April 3, 2026 - 17:00 {{Abbr/MYT}}` — template suffix must be stripped |
| | `map1`..`map{n}` | One per game in the series |
| `Map` | `team1side`, `team2side` | `blue` / `red` |
| | `winner` | `1` or `2`, refers to `opponent1`/`opponent2` |
| | `length` | `MM:SS` |
| | `t{1,2}h{1..5}` | **Picks**, 10 per game |
| | `t{1,2}b{1..5}` | **Bans**, 10 per game |
| | `finished=skip` | Unplayed game in an unfinished Bo3/Bo5 — **must be filtered out** |

## Verified counts — Season 17

| | Series | Map blocks | `finished=skip` | Played games |
|---|---|---|---|---|
| Regular Season | 64 | 168 | 36 | **132** |
| Playoffs | 8 | 38 | 6 | **32** |
| **Total** | **72** | **206** | **42** | **164** |

Field coverage was measured on the 132 Regular Season games. Playoffs counts above are structural only; run the same coverage check on Playoffs before trusting it.

Of those 132 games:

- **0** missing any of the 10 picks
- **0** missing side, winner, or length
- **0** with a patch field (see below)

Data quality is excellent. The risks are not missing data — they are the two below.

## Hazard 1: hero aliases

The Regular Season contains **94 distinct hero strings for 80 actual heroes.** Editors use both full names and wiki shortcuts, sometimes within the same match.

| short | full | true total |
|---|---|---|
| `arlot` 1 | `arlott` 46 | 47 |
| `bene` 4 | `benedetta` 33 | 37 |
| `esme` 1 | `esmeralda` 5 | 6 |
| `fred` 2 | `fredrinn` 16 | 18 |
| `gatot` 3 | `gatotkaca` 29 | 32 |
| `guin` 10 | `guinevere` 108 | **118** |
| `lance` 1 | `lancelot` 9 | 10 |
| `lapu` 1 | `lapu-lapu` 24 | 25 |
| `leo` 3 | `leomord` 74 | 77 |
| `luoyi` 1 | `luo yi` 2 | 3 |
| `phove` 8 | `phoveus` 98 | **106** |
| `valen` 8 | `valentina` 62 | 70 |
| `yss` 8 | `yi sun-shin` 51 | **59** |
| `yz` 2 | `yu zhong` 16 | 18 |

53 of 2,640 pick+ban slots (2.0%) use a short form.

**Why this matters more than 2% suggests.** Unnormalized, Guinevere reports 108 and a phantom hero named "guin" appears at 10. Presence is understated for the real hero and invented for one that does not exist. HHI is hit harder — it sums *squared* shares, so splitting one hero across two names understates concentration, and concentration is precisely what HHI claims to measure. A bug here makes the tool confidently wrong about the metric it exists to provide.

**`yss` and `yz` also prove heuristics fail.** A prefix or fuzzy match catches `phove`→`phoveus` but never `yz`→`yu zhong`. Normalization must come from an explicit table sourced from the wiki's own hero-name resolution, not from string similarity.

**Required parser behaviour:** an unrecognized hero string is a **hard failure that halts the pipeline**, never a silently-created new hero. A new hero release or a new editor shortcut must break the build loudly. This is the single most important correctness rule in the project.

## Hazard 2: pick slot ordering — UNVERIFIED

CLAUDE.md previously asserted that pick slots are role-ordered (`h1`=EXP, `h2`=Jungle, `h3`=Mid, `h4`=Gold, `h5`=Roam) rather than draft-ordered.

**This has not been verified.** Spot-checking suggests it is an editor convention that mostly holds and sometimes does not. It is not an enforced field, and Liquipedia's templates do not appear to validate it.

Every per-role feature depends entirely on this being true — HHI by role, role breakdowns, per-role presence. Verify it before speccing any of them: cross-check a sample of games against known player roles for that roster, and measure how often the convention holds. If it holds at, say, 95%, decide explicitly whether 5% wrong role attribution is acceptable or whether role features get dropped.

## What Liquipedia does not have

Permanent constraints on the entire product, not just v1:

- **No patch version.** Zero of 164 games carry one. Any patch-based filtering must derive patch from match date against a hand-maintained patch calendar, or be dropped.
- **No gold, objectives, kill timelines, or any in-game events.** This is why the tool is a *draft* tool permanently. It can describe what a team drafts and how predictable they are. It cannot describe how they play.
- **No draft order.** Slots are positional, so first-pick / last-pick reasoning is unavailable.
- **No per-player hero assignment** beyond whatever the slot convention implies (see Hazard 2).

## Open

- The full 8-team Season 18 roster list. Names seen so far in S17 data: Selangor Red Giants, Team Vamos, Team Rey, RRQ Tora, Bigetron MY. Needs confirming from the S18 page.
- Whether team names are stable across seasons, or whether the `teams` table needs alias handling too — the same hazard as heroes, one level up.
