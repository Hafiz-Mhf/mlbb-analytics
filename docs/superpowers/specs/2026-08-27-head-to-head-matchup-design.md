# Head-to-Head Matchup Tool — Design Spec

_Written 27 Aug 2026. Roadmap: docs/roadmap.md "Next" list (Head-to-Head Matchup Tool)._

## What this is, in plain words

In competitive Mobile Legends: Bang Bang (MPL), before any match, coaches, analysts, and fans analyze how two teams match up against each other:
1. **Draft Clash & Hero Priority**: Which heroes are contested battlegrounds (wanted by both teams), and which are unique signature picks that must be respected or banned?
2. **Side Performance (Blue vs Red)**: Does Team A thrive on Blue side first-pick momentum while Team B relies on Red side counter-picks?
3. **Lane-by-Lane Role Matchups**: Which lanes have rigid champion pools vs wide flexibility, and who are the key comfort heroes across EXP, Jungle, Mid, Gold, and Roam?
4. **Direct Head-to-Head Encounters**: What happened in their actual past matches against each other?

This feature introduces a dedicated **Head-to-Head Matchup Tool (`/matchup`)** with dual-team selectors, season filtering, plain-language wording with technical depth in tooltips, and rich visual breakdown cards.

---

## Route & Navigation Architecture

- **Dedicated Route**: `/matchup`
- **URL Parameters**: Supports `?t1=[team1Slug]&t2=[team2Slug]&season=[season]` for shareability, bookmarking, and deep links.
  - Defaults to `t1=srg` and `t2=fl` (or first available distinct team) if omitted.
- **Main Navigation (`+layout.svelte`)**: Add `MATCHUP` tab to the primary navigation bar.
- **Team Scouting Integration (`/team/[slug]`)**: Add a "Compare Matchup" action link that preselects the current team into `/matchup?t1=[slug]`.

---

## Metric Calculations (`frontend/src/lib/metrics.ts`)

All calculation logic will be implemented as pure, deterministic functions in `metrics.ts` and covered by unit tests in `metrics.spec.ts`.

### 1. Direct Head-to-Head Summary (`headToHeadSummary`)

```typescript
export interface HeadToHeadSummary {
	team1Wins: number;       // Direct match wins (individual games)
	team2Wins: number;
	totalGames: number;
	team1SeriesWins: number; // Direct series wins
	team2SeriesWins: number;
	totalSeries: number;
	directMatchIds: number[];
	avgGameLengthSeconds: number;
}

export function headToHeadSummary(
	data: Dataset,
	team1Id: number,
	team2Id: number,
	opts: ScopeOptions = {}
): HeadToHeadSummary
```

* Filters `data.matches` for games where `{team1Id, team2Id}` were the opposing teams within `opts.season` (or all seasons if undefined).
* Groups matches by `seriesId` to compute series scores (`team1SeriesWins` vs `team2SeriesWins`).
* Counts game wins (`winnerId === team1Id` vs `winnerId === team2Id`).
* Computes average match length in seconds (parsed from `gameLength` string `"mm:ss"`).

### 2. Side Performance (`sidePerformance`)

```typescript
export interface SideStats {
	blueGames: number;
	blueWins: number;
	blueWinRate: number;
	redGames: number;
	redWins: number;
	redWinRate: number;
}

export function sidePerformance(
	data: Dataset,
	teamId: number,
	opts: ScopeOptions = {}
): SideStats
```

* Determines side for each match:
  - If `match.team1Id === teamId`, side is `match.team1Side`.
  - If `match.team2Id === teamId`, side is `match.team1Side === 'blue' ? 'red' : 'blue'`.
* Calculates total games, wins, and win rates for Blue Side and Red Side separately.

### 3. Draft Clash & Hero Priority (`heroClash`)

```typescript
export type ClashCategory = 'contested' | 'team1_priority' | 'team2_priority';

export interface HeroClashItem {
	hero: string;
	team1Rate: number;       // Pick/ban presence for Team 1
	team2Rate: number;       // Pick/ban presence for Team 2
	leagueRate: number;      // League baseline presence
	team1PickRate: number;
	team1BanRate: number;
	team2PickRate: number;
	team2BanRate: number;
	category: ClashCategory;
	primaryRole?: number;    // Most common role slot (1..5)
}

export interface HeroClashResult {
	contested: HeroClashItem[];      // High presence for both (e.g. >= 25% for both or top combined)
	team1Priority: HeroClashItem[];  // High for T1 (>= 25%), low for T2 (< 20%)
	team2Priority: HeroClashItem[];  // High for T2 (>= 25%), low for T1 (< 20%)
}

export function heroClash(
	data: Dataset,
	team1Id: number,
	team2Id: number,
	opts: ScopeOptions = {}
): HeroClashResult
```

* Computes presence, pick rate, and ban rate for `team1Id`, `team2Id`, and the league baseline across the selected season scope.
* Identifies primary role slot for each hero from historical draft picks.
* Classifies heroes into:
  1. **Contested**: High pick/ban rate for both teams ($\ge 25\%$ for both, or top combined contest rating).
  2. **Team 1 Priority**: High pick/ban rate for Team 1 ($\ge 25\%$) with low priority for Team 2 ($< 20\%$).
  3. **Team 2 Priority**: High pick/ban rate for Team 2 ($\ge 25\%$) with low priority for Team 1 ($< 20\%$).

### 4. Role Comparison Matrix (`matchupRoleComparison`)

```typescript
export interface RoleMatchupItem {
	role: number;
	roleName: string;
	team1Hhi: number;
	team2Hhi: number;
	leagueHhi: number;
	team1TopPicks: Array<{ hero: string; rate: number; picks: number }>;
	team2TopPicks: Array<{ hero: string; rate: number; picks: number }>;
}

export function matchupRoleComparison(
	data: Dataset,
	team1Id: number,
	team2Id: number,
	opts: ScopeOptions = {}
): RoleMatchupItem[]
```

* For each of the 5 roles (EXP, JGL, MID, GOLD, ROAM):
  - Computes `hhiByRole` for Team 1, Team 2, and League baseline.
  - Retrieves top 3 most picked heroes per team in that lane.

---

## UI Components & Screen Structure (`/matchup/+page.svelte`)

### 1. Interactive Team Selector Bar
* **Team 1 Dropdown**: Displays team logo, canonical name, and short code.
* **⇄ Swap Button**: Quickly inverts Team 1 and Team 2 positions in state and URL.
* **Team 2 Dropdown**: Displays opponent team; automatically prevents selecting the same team.
* **Season Filter Pills**: `All Seasons`, `Season 18`, `Season 17` with instant client-side update.

### 2. Matchup Overview Banner
* Large visual score card showing **Direct Head-to-Head Record**:
  - Series Score (e.g. `2 — 1`) and Game Score (`5W – 3L`).
* Comparative metric blocks:
  - Overall Tournament Win Rate (Team 1 vs Team 2).
  - Draft Predictability (HHI) (Team 1 vs Team 2 vs League).
  - Average Match Duration.

### 3. Side Performance (Blue vs Red) Card
* Visual side-by-side comparison bars for Team 1 and Team 2:
  - Blue Side Win Rate & Games Played.
  - Red Side Win Rate & Games Played.
* Plain-language takeaway callout (e.g., *"SRG wins 75% on Blue Side vs 44% on Red Side"*).

### 4. Hero Priority & Draft Clash Card
* Segmented sub-tab switch:
  - **Contested Heroes** *(wanted by both teams)*
  - **[Team 1] Signatures** *(high priority for Team 1)*
  - **[Team 2] Signatures** *(high priority for Team 2)*
* Structured data table with [`HeroTag`](file:///d:/mlbb-analytics/frontend/src/lib/components/HeroTag.svelte), Pick %, Ban %, Total Presence %, League Baseline, and Role badge.

### 5. Lane-by-Lane Breakdown Card
* 5 lane rows/cards (EXP, Jungle, Mid, Gold, Roam):
  - Predictability comparison indicator for each lane.
  - Top 3 comfort heroes with pick counts and mini-HeroTags side-by-side.

### 6. Direct Encounters History
* Accordion list of all direct matches between Team 1 and Team 2.
* Renders series date, series score, per-game winner, side (Blue/Red), game duration, and pick/ban summaries with direct links to `/series/[seriesId]`.
* Clean fallback message if no direct games exist in the chosen season filter.

---

## Plain Language & Terminology Guidelines

| Technical Term | Public Display Label | Tooltip / Description |
| :--- | :--- | :--- |
| **HHI (Concentration)** | **Draft Predictability** | Herfindahl-Hirschman Index: Higher scores mean a narrow, predictable hero pool; lower scores indicate wide draft flexibility. |
| **Presence %** | **Pick & Ban Rate** | Percentage of matches where this hero was either picked or banned. |
| **Contested Heroes** | **Contested Battlegrounds** | High-priority heroes heavily drafted or banned by both teams. |
| **Side Advantage** | **Blue vs Red Side Win Rate** | Performance difference between First Pick (Blue) and Counter-Pick (Red). |

---

## Testing & Quality Gates

1. **Unit Tests (`frontend/src/lib/metrics.spec.ts`)**:
   - `headToHeadSummary`: Series score, game win/loss, game length calculation, zero-match edge cases.
   - `sidePerformance`: Blue/Red game counts, win rates, undefeated cases.
   - `heroClash`: Categorization of contested vs signature priorities, sorting, league comparison.
   - `matchupRoleComparison`: Per-role HHI computation and top-picks aggregation.
2. **Type Checking & Svelte Checks**:
   - `npm run check` passes with 0 errors.
   - `npm test` passes 100% of tests.
3. **Prerender & Build Verification**:
   - `npm run build` succeeds cleanly.
   - Live browser verification on desktop and mobile (0px horizontal overflow).

---

## Explicitly Not in Scope

- Live real-time draft prediction assistant (deferred to Later phase).
- Player-specific head-to-head records (Liquipedia wikitext only records team drafts, not player rosters).
