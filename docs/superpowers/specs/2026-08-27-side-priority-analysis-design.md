# Side Priority Analysis (Blue vs Red) — Design Spec

_Written 27 Aug 2026. Roadmap: docs/roadmap.md "Next" list (Side Priority Analysis)._

## What this is, in plain words

In competitive Mobile Legends: Bang Bang (MPL), draft strategy fundamentally shifts based on map side:
1. **Blue Side Advantage (First Pick)**: Blue side picks first in the draft (Slot 1), allowing them to secure the #1 uncontested meta hero or force the opponent into a ban.
2. **Red Side Advantage (Counter-Pick & Double-Pick)**: Red side gets the final counter-pick in the draft, plus two consecutive picks in Phase 1 (Slots 2 & 3) to lock in synergistic combos.
3. **Team Side Asymmetry**: Some teams are heavily reliant on Blue side first-pick momentum (*e.g. 75% win rate on Blue vs 40% on Red*), while others are versatile or excel at counter-drafting on Red.

This feature introduces a dedicated **Side Priority Analysis (`/sides`)** screen with league-wide side meta stats, an 8-team side asymmetry matrix, and side-specific hero priority rankings (First-Pick vs Counter-Pick value).

---

## Route & Navigation Architecture

- **Dedicated Route**: `/sides`
- **URL Parameters**: Supports `?season=[season]` (`all`, `18`, `17`).
- **Main Navigation (`+layout.svelte`)**: Add `SIDES` tab to the primary navigation bar.
- **Team Scouting Integration (`/team/[slug]`)**: Direct links from the 8-team side matrix to individual team scouting pages.

---

## Metric Calculations (`frontend/src/lib/metrics.ts`)

All calculation logic will be implemented as pure, deterministic functions in `metrics.ts` and covered by unit tests in `metrics.spec.ts`.

### 1. League-Wide Side Performance (`leagueSidePerformance`)

```typescript
export interface LeagueSideStats {
	totalMatches: number;
	blueWins: number;
	blueWinRate: number;
	redWins: number;
	redWinRate: number;
	avgBlueGameDurationSeconds: number;
	avgRedGameDurationSeconds: number;
}

export function leagueSidePerformance(
	data: Dataset,
	opts: ScopeOptions = {}
): LeagueSideStats
```

* Iterates through `data.matches` in scope.
* For each match:
  - If `winnerId === team1Id`, winning side is `team1Side`.
  - If `winnerId === team2Id`, winning side is `team1Side === 'blue' ? 'red' : 'blue'`.
* Computes win counts, win rates, and average match durations for Blue wins vs Red wins.

---

### 2. Team Side Asymmetry Matrix (`teamSideMatrix`)

```typescript
export type SideReliance = 'blue_reliant' | 'balanced' | 'red_reliant';

export interface TeamSideRow {
	teamId: number;
	teamName: string;
	shortCode: string | null;
	blueGames: number;
	blueWins: number;
	blueWinRate: number;
	redGames: number;
	redWins: number;
	redWinRate: number;
	sideDelta: number; // blueWinRate - redWinRate
	reliance: SideReliance;
}

export function teamSideMatrix(
	data: Dataset,
	opts: ScopeOptions = {}
): TeamSideRow[]
```

* Computes `sidePerformance` for each of the 8 teams in scope.
* Calculates `sideDelta = blueWinRate - redWinRate`.
* Categorizes reliance:
  - `blue_reliant` if `sideDelta >= 0.15` (and $\ge 3$ games per side).
  - `red_reliant` if `sideDelta <= -0.15` (and $\ge 3$ games per side).
  - `balanced` otherwise.

---

### 3. Side-Specific Hero Priorities (`heroSidePriorities`)

```typescript
export interface HeroSideStat {
	hero: string;
	bluePresence: number;
	bluePickRate: number;
	blueBanRate: number;
	blueWins: number;
	blueGames: number;
	blueWinRate: number;
	redPresence: number;
	redPickRate: number;
	redBanRate: number;
	redWins: number;
	redGames: number;
	redWinRate: number;
	presenceDelta: number; // bluePresence - redPresence
	winRateDelta: number;   // blueWinRate - redWinRate
}

export interface HeroSidePrioritiesResult {
	bluePriority: HeroSideStat[]; // Sorted by Blue presence / first-pick value
	redPriority: HeroSideStat[];  // Sorted by Red presence / counter-pick value
	winRateSwings: HeroSideStat[]; // Sorted by |winRateDelta| with sample floor >= 5 games
}

export function heroSidePriorities(
	data: Dataset,
	opts: ScopeOptions = {}
): HeroSidePrioritiesResult
```

* Evaluates drafts on Blue vs Red sides:
  - Computes presence, pick rate, and ban rate separately for Blue side and Red side.
  - Computes games won and win rate when a hero was drafted on Blue vs Red.
* Groups into:
  1. **First-Pick Priority (Blue)**: Top heroes prioritized on Blue side.
  2. **Counter-Pick Priority (Red)**: Top heroes prioritized on Red side.
  3. **Side Win-Rate Swings**: Heroes with the highest performance disparities between sides ($\ge 5$ total games).

---

## UI Components & Screen Structure (`/sides/+page.svelte`)

### 1. Header & Season Filter Bar
* Page title: **Side Priority Analysis**.
* Description: *"Compare how drafting and win rates shift based on First Pick (Blue) vs Counter-Pick (Red)."*
* Season filter tabs (`All Seasons`, `Season 18`, `Season 17`).

### 2. League Side Meta Split Banner
* **Dual-Color Win-Rate Split Bar**: Sky Blue vs Rose Red visual segmented bar showing win totals and percentages.
* Stat cards:
  - Total Matches Analyzed.
  - First-Pick Win Advantage (+/− % margin).
  - Blue Win Avg Duration vs Red Win Avg Duration.

### 3. 8-Team Side Asymmetry Matrix Card
* Table comparing all 8 teams:
  - Team (Logo, name, link to `/team/[slug]`).
  - Blue Record (`Wins - Losses (Win Rate %)`).
  - Red Record (`Wins - Losses (Win Rate %)`).
  - Side Delta (+/− % advantage).
  - Reliance Tag (`Blue-Reliant`, `Balanced`, `Red-Reliant`).

### 4. Side-Specific Hero Priorities Card
* Segmented sub-tab switch:
  - **First-Pick Priority (Blue Side)** *(top heroes on Blue)*
  - **Counter-Pick Priority (Red Side)** *(top heroes on Red)*
  - **Side Win-Rate Swings** *(biggest win-rate divergence between sides)*
* Structured data table with [`HeroTag`](file:///d:/mlbb-analytics/frontend/src/lib/components/HeroTag.svelte), Blue Presence %, Red Presence %, Blue WR, Red WR, and Delta annotations.

---

## Plain Language & Terminology Guidelines

| Technical Term | Public Display Label | Tooltip / Description |
| :--- | :--- | :--- |
| **Blue Side Advantage** | **First Pick Advantage** | Blue side drafts first in pick/ban, enabling them to secure the #1 priority meta hero. |
| **Red Side Advantage** | **Counter-Pick & Double-Pick** | Red side gets the final counter-pick in draft, plus two consecutive picks in Phase 1 (slots 2 & 3). |
| **Side Delta** | **Side Win-Rate Gap** | Difference between a team's win rate on Blue side vs Red side. |
| **Side Reliance** | **Side Bias / Balance** | Indicates whether a team performs significantly better on a specific side ($\ge 15\%$ difference). |

---

## Testing & Quality Gates

1. **Unit Tests (`frontend/src/lib/metrics.spec.ts`)**:
   - `leagueSidePerformance`: Total matches, Blue/Red wins, win rates, and durations.
   - `teamSideMatrix`: 8-team side calculations, delta computation, and reliance labeling.
   - `heroSidePriorities`: Blue vs Red presence and win-rate disparity calculations.
2. **Component Test (`src/routes/sides/sides-page.svelte.spec.ts`)**:
   - Verifies rendering of banner, 8-team matrix, and side priority tabs.
3. **Type Checking & Svelte Checks**:
   - `npm run check` passes with 0 errors.
   - `npm test` passes 100% of tests.
4. **Prerender & Build Verification**:
   - `npm run build` succeeds cleanly.
   - 0px horizontal overflow on mobile viewports.

---

## Explicitly Not in Scope

- Ban role assignment (bans do not have role slots).
- In-game side objectives (turtle/lord pit side varies by map seed, which is not in Liquipedia data).
