# Side Priority Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Side Priority Analysis screen (`/sides`), providing league-wide and team-specific draft intelligence on Blue Side (First Pick) vs Red Side (Counter-Pick / Double-Pick).

**Architecture:** Implement pure analytical functions in `frontend/src/lib/metrics.ts` (`leagueSidePerformance`, `teamSideMatrix`, `heroSidePriorities`), unit tested in `metrics.spec.ts`. Build `/sides/+page.svelte` using SvelteKit reactive runes, URL search params (`?season=...`), clean card hierarchy, plain English terminology with `<abbr>` tooltips, and link from main navigation.

**Tech Stack:** SvelteKit 2, Svelte 5 runes (`$state`, `$derived`, `$effect`), Tailwind CSS v4, Vitest.

## Global Constraints

- Wording must be accessible to both casual fans and serious analysts (plain labels with technical precision in `<abbr>` tooltips).
- Reuses existing design system (`HeroTag.svelte`, `TeamTag.svelte`, `StatBlock.svelte`, Tailwind tokens `bg-surface`, `border-line`, `text-primary`, `text-gold`).
- All calculations must be pure functions in `metrics.ts` with 100% test coverage in `metrics.spec.ts`.
- Page must be responsive with 0px horizontal overflow on mobile (<640px).

---

### Task 1: Side Priority Metric Functions & Unit Tests

**Files:**
- Modify: `frontend/src/lib/metrics.ts`
- Modify: `frontend/src/lib/metrics.spec.ts`

**Interfaces:**
- Produces:
  - `leagueSidePerformance(data: Dataset, opts?: ScopeOptions): LeagueSideStats`
  - `teamSideMatrix(data: Dataset, opts?: ScopeOptions): TeamSideRow[]`
  - `heroSidePriorities(data: Dataset, opts?: ScopeOptions): HeroSidePrioritiesResult`

- [ ] **Step 1: Write failing unit tests for side priority metrics in `metrics.spec.ts`**

```typescript
describe('leagueSidePerformance', () => {
	it('calculates total matches, Blue vs Red wins and win rates correctly', () => {
		const data = fixture(); // 2 games: Game 1 Blue wins, Game 2 Red wins
		const stats = leagueSidePerformance(data);
		expect(stats.totalMatches).toBe(2);
		expect(stats.blueWins).toBe(1);
		expect(stats.blueWinRate).toBe(0.5);
		expect(stats.redWins).toBe(1);
		expect(stats.redWinRate).toBe(0.5);
	});
});

describe('teamSideMatrix', () => {
	it('computes 8-team side performance rows with side delta and reliance', () => {
		const data = fixture();
		const matrix = teamSideMatrix(data);
		expect(matrix.length).toBe(2);
		expect(matrix[0].teamName).toBe('Selangor Red Giants');
		expect(matrix[0].blueGames).toBe(1);
		expect(matrix[0].redGames).toBe(1);
		expect(matrix[0].reliance).toBeDefined();
	});
});

describe('heroSidePriorities', () => {
	it('computes hero side presence, first-pick priority, and side win deltas', () => {
		const data = fixture();
		const priorities = heroSidePriorities(data);
		expect(priorities.bluePriority).toBeDefined();
		expect(priorities.redPriority).toBeDefined();
		expect(priorities.winRateSwings).toBeDefined();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` inside `frontend/`
Expected: FAIL with missing exports.

- [ ] **Step 3: Implement metric functions in `frontend/src/lib/metrics.ts`**

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
): LeagueSideStats {
	const matches = scopedMatches(data, opts);
	if (matches.length === 0) {
		return {
			totalMatches: 0,
			blueWins: 0,
			blueWinRate: 0,
			redWins: 0,
			redWinRate: 0,
			avgBlueGameDurationSeconds: 0,
			avgRedGameDurationSeconds: 0
		};
	}

	let blueWins = 0;
	let redWins = 0;
	let blueSecs = 0;
	let blueSecsCount = 0;
	let redSecs = 0;
	let redSecsCount = 0;

	for (const m of matches) {
		const winningSide = m.winnerId === m.team1Id ? m.team1Side : m.team1Side === 'blue' ? 'red' : 'blue';
		let dur = 0;
		if (m.gameLength) {
			const parts = m.gameLength.split(':').map((p) => parseInt(p, 10));
			if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
				dur = parts[0] * 60 + parts[1];
			}
		}

		if (winningSide === 'blue') {
			blueWins++;
			if (dur > 0) {
				blueSecs += dur;
				blueSecsCount++;
			}
		} else {
			redWins++;
			if (dur > 0) {
				redSecs += dur;
				redSecsCount++;
			}
		}
	}

	return {
		totalMatches: matches.length,
		blueWins,
		blueWinRate: matches.length > 0 ? blueWins / matches.length : 0,
		redWins,
		redWinRate: matches.length > 0 ? redWins / matches.length : 0,
		avgBlueGameDurationSeconds: blueSecsCount > 0 ? Math.round(blueSecs / blueSecsCount) : 0,
		avgRedGameDurationSeconds: redSecsCount > 0 ? Math.round(redSecs / redSecsCount) : 0
	};
}

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
	sideDelta: number;
	reliance: SideReliance;
}

export function teamSideMatrix(
	data: Dataset,
	opts: ScopeOptions = {}
): TeamSideRow[] {
	return data.teams.map((t) => {
		const side = sidePerformance(data, t.id, opts);
		const sideDelta = side.blueWinRate - side.redWinRate;
		let reliance: SideReliance = 'balanced';
		if (side.blueGames >= 2 && side.redGames >= 2) {
			if (sideDelta >= 0.15) reliance = 'blue_reliant';
			else if (sideDelta <= -0.15) reliance = 'red_reliant';
		}
		return {
			teamId: t.id,
			teamName: t.canonicalName,
			shortCode: t.shortCode,
			blueGames: side.blueGames,
			blueWins: side.blueWins,
			blueWinRate: side.blueWinRate,
			redGames: side.redGames,
			redWins: side.redWins,
			redWinRate: side.redWinRate,
			sideDelta,
			reliance
		};
	});
}

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
	presenceDelta: number;
	winRateDelta: number;
}

export interface HeroSidePrioritiesResult {
	bluePriority: HeroSideStat[];
	redPriority: HeroSideStat[];
	winRateSwings: HeroSideStat[];
}

export function heroSidePriorities(
	data: Dataset,
	opts: ScopeOptions = {}
): HeroSidePrioritiesResult {
	const matches = scopedMatches(data, opts);
	const matchIds = new Set(matches.map((m) => m.id));
	const matchSideMap = new Map<number, { blueTeamId: number; redTeamId: number; winnerId: number }>();

	for (const m of matches) {
		const blueTeamId = m.team1Side === 'blue' ? m.team1Id : m.team2Id;
		const redTeamId = m.team1Side === 'blue' ? m.team2Id : m.team1Id;
		matchSideMap.set(m.id, { blueTeamId, redTeamId, winnerId: m.winnerId });
	}

	const heroName = new Map(data.heroes.map((h) => [h.id, h.canonicalName]));
	const totalGames = matches.length;

	interface SideAccumulator {
		bluePicks: number;
		blueBans: number;
		blueWins: number;
		redPicks: number;
		redBans: number;
		redWins: number;
	}

	const statsMap = new Map<string, SideAccumulator>();

	for (const h of data.heroes) {
		statsMap.set(h.canonicalName, {
			bluePicks: 0,
			blueBans: 0,
			blueWins: 0,
			redPicks: 0,
			redBans: 0,
			redWins: 0
		});
	}

	for (const d of data.drafts) {
		if (!matchIds.has(d.matchId)) continue;
		const mInfo = matchSideMap.get(d.matchId);
		if (!mInfo) continue;

		const name = heroName.get(d.heroId)!;
		const acc = statsMap.get(name)!;
		const isBlue = d.teamId === mInfo.blueTeamId;
		const won = d.teamId === mInfo.winnerId;

		if (isBlue) {
			if (d.isBan) acc.blueBans++;
			else {
				acc.bluePicks++;
				if (won) acc.blueWins++;
			}
		} else {
			if (d.isBan) acc.redBans++;
			else {
				acc.redPicks++;
				if (won) acc.redWins++;
			}
		}
	}

	const allStats: HeroSideStat[] = [];

	for (const [hero, acc] of statsMap.entries()) {
		const bluePres = totalGames > 0 ? (acc.bluePicks + acc.blueBans) / totalGames : 0;
		const redPres = totalGames > 0 ? (acc.redPicks + acc.redBans) / totalGames : 0;
		const bluePick = totalGames > 0 ? acc.bluePicks / totalGames : 0;
		const blueBan = totalGames > 0 ? acc.blueBans / totalGames : 0;
		const redPick = totalGames > 0 ? acc.redPicks / totalGames : 0;
		const redBan = totalGames > 0 ? acc.redBans / totalGames : 0;

		const blueWR = acc.bluePicks > 0 ? acc.blueWins / acc.bluePicks : 0;
		const redWR = acc.redPicks > 0 ? acc.redWins / acc.redPicks : 0;

		if (bluePres > 0 || redPres > 0) {
			allStats.push({
				hero,
				bluePresence: bluePres,
				bluePickRate: bluePick,
				blueBanRate: blueBan,
				blueWins: acc.blueWins,
				blueGames: acc.bluePicks,
				blueWinRate: blueWR,
				redPresence: redPres,
				redPickRate: redPick,
				redBanRate: redBan,
				redWins: acc.redWins,
				redGames: acc.redPicks,
				redWinRate: redWR,
				presenceDelta: bluePres - redPres,
				winRateDelta: blueWR - redWR
			});
		}
	}

	return {
		bluePriority: allStats
			.slice()
			.sort((a, b) => b.bluePresence - a.bluePresence || b.presenceDelta - a.presenceDelta),
		redPriority: allStats
			.slice()
			.sort((a, b) => b.redPresence - a.redPresence || a.presenceDelta - b.presenceDelta),
		winRateSwings: allStats
			.filter((s) => s.blueGames + s.redGames >= 5 && s.blueGames >= 1 && s.redGames >= 1)
			.sort((a, b) => Math.abs(b.winRateDelta) - Math.abs(a.winRateDelta))
	};
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npm test` inside `frontend/`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/lib/metrics.ts frontend/src/lib/metrics.spec.ts
git commit -m "feat(metrics): add leagueSidePerformance, teamSideMatrix, and heroSidePriorities"
```

---

### Task 2: Navigation Integration

**Files:**
- Modify: `frontend/src/routes/+layout.svelte`

- [ ] **Step 1: Add `Sides` tab to `navLinks` in `+layout.svelte`**

```svelte
const navLinks = $derived([
	{ href: resolve('/team/[slug]', { slug: $selectedTeam }), label: 'Team Scouting' },
	{ href: resolve('/matchup'), label: 'Matchup' },
	{ href: resolve('/sides'), label: 'Side Priority' },
	{ href: resolve('/league'), label: 'League Overview' },
	{ href: resolve('/roles'), label: 'Roles & Flex' },
	{ href: resolve('/log'), label: 'Match Log' }
]);
```

- [ ] **Step 2: Commit changes**

```bash
git add frontend/src/routes/+layout.svelte
git commit -m "feat(nav): add side priority tab to layout navigation"
```

---

### Task 3: Build the Side Priority Screen (`/sides/+page.svelte`)

**Files:**
- Create: `frontend/src/routes/sides/+page.svelte`
- Create: `frontend/src/routes/sides/sides-page.svelte.spec.ts`

- [ ] **Step 1: Create `/sides/+page.svelte`**

Features:
1. Season filter controls (`All Seasons`, `Season 18`, `Season 17`) with browser-safe URL parameter sync.
2. League Side Meta Banner: Visual split bar with Blue vs Red win counts & %, avg match duration on Blue vs Red, and First-Pick Advantage margin.
3. 8-Team Side Asymmetry Matrix: Table comparing Blue W-L (%), Red W-L (%), Side Delta (+/− % gap), and Reliance badges.
4. Side-Specific Hero Priorities Card with 3 sub-tabs (`First-Pick Priority (Blue)`, `Counter-Pick Priority (Red)`, `Side Win-Rate Swings`).

- [ ] **Step 2: Create component test `sides-page.svelte.spec.ts`**

- [ ] **Step 3: Run `npm run check` and `npm test`**

Run: `npm run check && npm test`
Expected: 0 errors, all tests passing.

- [ ] **Step 4: Commit changes**

```bash
git add frontend/src/routes/sides/+page.svelte frontend/src/routes/sides/sides-page.svelte.spec.ts
git commit -m "feat(routes): implement side priority analysis dashboard"
```

---

### Task 4: Integration Verification & Documentation

**Files:**
- Modify: `docs/current-context.md`
- Modify: `docs/roadmap.md`
- Modify: `README.md`

- [ ] **Step 1: Run production build check**

Run: `npm run build`
Expected: Static prerender succeeds cleanly for `/sides`.

- [ ] **Step 2: Update documentation**

Document Side Priority Analysis in `docs/current-context.md`, mark done in `docs/roadmap.md`, and update `README.md` screen table and test counts.

- [ ] **Step 3: Commit documentation**

```bash
git add docs/current-context.md docs/roadmap.md README.md
git commit -m "docs: document side priority analysis feature release"
```
