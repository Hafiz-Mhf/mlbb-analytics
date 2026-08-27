# Head-to-Head Matchup Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the interactive Head-to-Head Matchup Tool (`/matchup`), allowing users to compare any two MPL teams on draft tendencies, contested hero priority, side win rates, and direct match history.

**Architecture:** Implement pure analytical functions in `frontend/src/lib/metrics.ts` (`headToHeadSummary`, `sidePerformance`, `heroClash`, `matchupRoleComparison`), unit tested in `metrics.spec.ts`. Build `/matchup/+page.svelte` using SvelteKit reactive `$state`/`$derived`, URL search parameters (`?t1=...&t2=...&season=...`), clean card hierarchy, plain English labels with tooltip definitions, and link from main navigation and Team Scouting.

**Tech Stack:** SvelteKit 2, Svelte 5 runes (`$state`, `$derived`, `$effect`), Tailwind CSS v4 (`@theme` tokens), Vitest.

## Global Constraints

- Wording must be accessible to both casual fans and serious analysts (plain labels with technical precision in `<abbr>` tooltips).
- Reuses existing design system (`HeroTag.svelte`, `TeamTag.svelte`, `StatBlock.svelte`, Tailwind tokens `bg-surface`, `border-line`, `text-primary`, `text-gold`).
- All calculations must be pure functions in `metrics.ts` with 100% test coverage in `metrics.spec.ts`.
- Page must be responsive with 0px horizontal overflow on mobile (<640px).

---

### Task 1: Head-to-Head Metric Functions & Unit Tests

**Files:**
- Modify: `frontend/src/lib/metrics.ts`
- Modify: `frontend/src/lib/metrics.spec.ts`

**Interfaces:**
- Produces:
  - `headToHeadSummary(data: Dataset, team1Id: number, team2Id: number, opts?: ScopeOptions): HeadToHeadSummary`
  - `sidePerformance(data: Dataset, teamId: number, opts?: ScopeOptions): SideStats`
  - `heroClash(data: Dataset, team1Id: number, team2Id: number, opts?: ScopeOptions): HeroClashResult`
  - `matchupRoleComparison(data: Dataset, team1Id: number, team2Id: number, opts?: ScopeOptions): RoleMatchupItem[]`

- [ ] **Step 1: Write the failing unit tests for matchup metrics in `metrics.spec.ts`**

```typescript
describe('headToHeadSummary', () => {
	it('calculates direct series, game scores, and average game length', () => {
		const data = fixture(); // 2 games between team 1 and 2 in series M1, game 1 won by T1 (10:00), game 2 won by T2 (12:00)
		const summary = headToHeadSummary(data, 1, 2);
		expect(summary.totalGames).toBe(2);
		expect(summary.team1Wins).toBe(1);
		expect(summary.team2Wins).toBe(1);
		expect(summary.totalSeries).toBe(1);
		expect(summary.avgGameLengthSeconds).toBe(660); // (600 + 720) / 2
	});

	it('returns 0s when no direct games were played', () => {
		const data = fixture();
		const summary = headToHeadSummary(data, 1, 999);
		expect(summary.totalGames).toBe(0);
		expect(summary.team1Wins).toBe(0);
		expect(summary.team2Wins).toBe(0);
		expect(summary.totalSeries).toBe(0);
	});
});

describe('sidePerformance', () => {
	it('computes Blue and Red side games, wins, and win rates accurately', () => {
		const data = fixture(); // Game 1: T1 on Blue (wins); Game 2: T1 on Red (loses)
		const t1Side = sidePerformance(data, 1);
		expect(t1Side.blueGames).toBe(1);
		expect(t1Side.blueWins).toBe(1);
		expect(t1Side.blueWinRate).toBe(1.0);
		expect(t1Side.redGames).toBe(1);
		expect(t1Side.redWins).toBe(0);
		expect(t1Side.redWinRate).toBe(0.0);

		const t2Side = sidePerformance(data, 2);
		expect(t2Side.blueGames).toBe(1);
		expect(t2Side.blueWins).toBe(1);
		expect(t2Side.blueWinRate).toBe(1.0);
		expect(t2Side.redGames).toBe(1);
		expect(t2Side.redWins).toBe(0);
		expect(t2Side.redWinRate).toBe(0.0);
	});
});

describe('heroClash', () => {
	it('categorizes heroes into contested vs team signature priorities', () => {
		const data = fixture();
		const clash = heroClash(data, 1, 2);
		expect(clash.contested).toBeDefined();
		expect(clash.team1Priority).toBeDefined();
		expect(clash.team2Priority).toBeDefined();
	});
});

describe('matchupRoleComparison', () => {
	it('returns 5 lane comparisons with team HHI and top picks', () => {
		const data = fixture();
		const roles = matchupRoleComparison(data, 1, 2);
		expect(roles.length).toBe(5);
		expect(roles[0].roleName).toBe('EXP');
		expect(roles[0].team1Hhi).toBeGreaterThanOrEqual(0);
		expect(roles[0].team2Hhi).toBeGreaterThanOrEqual(0);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` inside `frontend/`
Expected: FAIL with missing function exports.

- [ ] **Step 3: Implement metric functions in `frontend/src/lib/metrics.ts`**

```typescript
export interface HeadToHeadSummary {
	team1Wins: number;
	team2Wins: number;
	totalGames: number;
	team1SeriesWins: number;
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
): HeadToHeadSummary {
	const directMatches = data.matches.filter((m) => {
		if (opts.season !== undefined && m.season !== opts.season) return false;
		return (
			(m.team1Id === team1Id && m.team2Id === team2Id) ||
			(m.team1Id === team2Id && m.team2Id === team1Id)
		);
	});

	if (directMatches.length === 0) {
		return {
			team1Wins: 0,
			team2Wins: 0,
			totalGames: 0,
			team1SeriesWins: 0,
			team2SeriesWins: 0,
			totalSeries: 0,
			directMatchIds: [],
			avgGameLengthSeconds: 0
		};
	}

	let team1Wins = 0;
	let team2Wins = 0;
	let totalSeconds = 0;
	let durationCount = 0;

	for (const m of directMatches) {
		if (m.winnerId === team1Id) team1Wins++;
		else if (m.winnerId === team2Id) team2Wins++;

		if (m.gameLength) {
			const parts = m.gameLength.split(':').map((p) => parseInt(p, 10));
			if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
				totalSeconds += parts[0] * 60 + parts[1];
				durationCount++;
			}
		}
	}

	// Series score
	const seriesMap = new Map<string, { t1Wins: number; t2Wins: number }>();
	for (const m of directMatches) {
		if (!seriesMap.has(m.seriesId)) {
			seriesMap.set(m.seriesId, { t1Wins: 0, t2Wins: 0 });
		}
		const s = seriesMap.get(m.seriesId)!;
		if (m.winnerId === team1Id) s.t1Wins++;
		else if (m.winnerId === team2Id) s.t2Wins++;
	}

	let team1SeriesWins = 0;
	let team2SeriesWins = 0;
	for (const s of seriesMap.values()) {
		if (s.t1Wins > s.t2Wins) team1SeriesWins++;
		else if (s.t2Wins > s.t1Wins) team2SeriesWins++;
	}

	return {
		team1Wins,
		team2Wins,
		totalGames: directMatches.length,
		team1SeriesWins,
		team2SeriesWins,
		totalSeries: seriesMap.size,
		directMatchIds: directMatches.map((m) => m.id),
		avgGameLengthSeconds: durationCount > 0 ? Math.round(totalSeconds / durationCount) : 0
	};
}

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
): SideStats {
	const teamMatches = data.matches.filter((m) => {
		if (opts.season !== undefined && m.season !== opts.season) return false;
		return m.team1Id === teamId || m.team2Id === teamId;
	});

	let blueGames = 0;
	let blueWins = 0;
	let redGames = 0;
	let redWins = 0;

	for (const m of teamMatches) {
		const isTeam1 = m.team1Id === teamId;
		const teamSide = isTeam1 ? m.team1Side : m.team1Side === 'blue' ? 'red' : 'blue';
		const won = m.winnerId === teamId;

		if (teamSide === 'blue') {
			blueGames++;
			if (won) blueWins++;
		} else {
			redGames++;
			if (won) redWins++;
		}
	}

	return {
		blueGames,
		blueWins,
		blueWinRate: blueGames > 0 ? blueWins / blueGames : 0,
		redGames,
		redWins,
		redWinRate: redGames > 0 ? redWins / redGames : 0
	};
}

export type ClashCategory = 'contested' | 'team1_priority' | 'team2_priority';

export interface HeroClashItem {
	hero: string;
	team1Rate: number;
	team2Rate: number;
	leagueRate: number;
	team1PickRate: number;
	team1BanRate: number;
	team2PickRate: number;
	team2BanRate: number;
	category: ClashCategory;
	primaryRole?: number;
}

export interface HeroClashResult {
	contested: HeroClashItem[];
	team1Priority: HeroClashItem[];
	team2Priority: HeroClashItem[];
}

export function heroClash(
	data: Dataset,
	team1Id: number,
	team2Id: number,
	opts: ScopeOptions = {}
): HeroClashResult {
	const t1Pres = presence(data, { ...opts, teamId: team1Id });
	const t1Picks = pickRate(data, { ...opts, teamId: team1Id });
	const t1Bans = banRate(data, { ...opts, teamId: team1Id });

	const t2Pres = presence(data, { ...opts, teamId: team2Id });
	const t2Picks = pickRate(data, { ...opts, teamId: team2Id });
	const t2Bans = banRate(data, { ...opts, teamId: team2Id });

	const leaguePres = presence(data, opts);

	// Find primary role for each hero
	const heroPrimaryRole = new Map<string, number>();
	const heroNameMap = new Map(data.heroes.map((h) => [h.id, h.canonicalName]));
	const heroRolePicks = new Map<string, Map<number, number>>();

	for (const d of data.drafts) {
		if (d.isBan) continue;
		const name = heroNameMap.get(d.heroId)!;
		if (!heroRolePicks.has(name)) heroRolePicks.set(name, new Map());
		const rMap = heroRolePicks.get(name)!;
		rMap.set(d.slot, (rMap.get(d.slot) ?? 0) + 1);
	}

	for (const [name, rMap] of heroRolePicks.entries()) {
		let bestRole = 1;
		let maxPicks = -1;
		for (const [r, cnt] of rMap.entries()) {
			if (cnt > maxPicks) {
				maxPicks = cnt;
				bestRole = r;
			}
		}
		heroPrimaryRole.set(name, bestRole);
	}

	const allHeroes = new Set([...Object.keys(t1Pres), ...Object.keys(t2Pres)]);
	const items: HeroClashItem[] = [];

	for (const hero of allHeroes) {
		const t1 = t1Pres[hero] ?? 0;
		const t2 = t2Pres[hero] ?? 0;
		const lg = leaguePres[hero] ?? 0;

		let category: ClashCategory | null = null;
		if (t1 >= 0.25 && t2 >= 0.25) {
			category = 'contested';
		} else if (t1 >= 0.25 && t2 < 0.2) {
			category = 'team1_priority';
		} else if (t2 >= 0.25 && t1 < 0.2) {
			category = 'team2_priority';
		} else if (t1 + t2 >= 0.4) {
			category = 'contested';
		}

		if (category) {
			items.push({
				hero,
				team1Rate: t1,
				team2Rate: t2,
				leagueRate: lg,
				team1PickRate: t1Picks[hero] ?? 0,
				team1BanRate: t1Bans[hero] ?? 0,
				team2PickRate: t2Picks[hero] ?? 0,
				team2BanRate: t2Bans[hero] ?? 0,
				category,
				primaryRole: heroPrimaryRole.get(hero)
			});
		}
	}

	return {
		contested: items
			.filter((i) => i.category === 'contested')
			.sort((a, b) => b.team1Rate + b.team2Rate - (a.team1Rate + a.team2Rate)),
		team1Priority: items
			.filter((i) => i.category === 'team1_priority')
			.sort((a, b) => b.team1Rate - a.team1Rate),
		team2Priority: items
			.filter((i) => i.category === 'team2_priority')
			.sort((a, b) => b.team2Rate - a.team2Rate)
	};
}

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
): RoleMatchupItem[] {
	const result: RoleMatchupItem[] = [];

	for (let role = 1; role <= 5; role++) {
		const t1Hhi = hhiByRole(data, role, { ...opts, teamId: team1Id });
		const t2Hhi = hhiByRole(data, role, { ...opts, teamId: team2Id });
		const lgHhi = hhiByRole(data, role, opts);

		const t1PicksMap = pickRateByRole(data, role, { ...opts, teamId: team1Id });
		const t2PicksMap = pickRateByRole(data, role, { ...opts, teamId: team2Id });

		const t1TopPicks = Object.entries(t1PicksMap)
			.map(([hero, rate]) => ({ hero, rate, picks: Math.round(rate * instanceCount(data, { ...opts, teamId: team1Id })) }))
			.sort((a, b) => b.rate - a.rate)
			.slice(0, 3);

		const t2TopPicks = Object.entries(t2PicksMap)
			.map(([hero, rate]) => ({ hero, rate, picks: Math.round(rate * instanceCount(data, { ...opts, teamId: team2Id })) }))
			.sort((a, b) => b.rate - a.rate)
			.slice(0, 3);

		result.push({
			role,
			roleName: ROLE_NAMES[role],
			team1Hhi: t1Hhi,
			team2Hhi: t2Hhi,
			leagueHhi: lgHhi,
			team1TopPicks: t1TopPicks,
			team2TopPicks: t2TopPicks
		});
	}

	return result;
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npm test` inside `frontend/`
Expected: PASS with all tests passing.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/lib/metrics.ts frontend/src/lib/metrics.spec.ts
git commit -m "feat(metrics): add headToHeadSummary, sidePerformance, heroClash, and matchupRoleComparison"
```

---

### Task 2: Navigation & Header Integration

**Files:**
- Modify: `frontend/src/routes/+layout.svelte`
- Modify: `frontend/src/routes/team/[slug]/+page.svelte`

**Interfaces:**
- Consumes: Navigation paths and team slugs.
- Produces: `MATCHUP` tab in header nav, link to `/matchup?t1=[slug]` on Team Scouting page.

- [ ] **Step 1: Add `/matchup` link to navigation in `+layout.svelte`**

```svelte
const navLinks = $derived([
	{ href: resolve('/team/[slug]', { slug: $selectedTeam }), label: 'Team Scouting' },
	{ href: resolve('/matchup'), label: 'Matchup' },
	{ href: resolve('/league'), label: 'League Overview' },
	{ href: resolve('/roles'), label: 'Roles & Flex' },
	{ href: resolve('/log'), label: 'Match Log' }
]);
```

- [ ] **Step 2: Add "Compare in Matchup Tool" shortcut button to `/team/[slug]/+page.svelte`**

Add action button in the team header block next to `FreshnessIndicator`:
```svelte
<a
	href="{resolve('/matchup')}?t1={page.params.slug}"
	class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs text-primary transition-colors hover:border-primary hover:bg-surface-2"
>
	<span>⇄</span>
	<span>Head-to-Head Compare</span>
</a>
```

- [ ] **Step 3: Run Svelte check and tests**

Run: `npm run check && npm test`
Expected: 0 errors, all tests pass.

- [ ] **Step 4: Commit changes**

```bash
git add frontend/src/routes/+layout.svelte frontend/src/routes/team/\[slug\]/+page.svelte
git commit -m "feat(nav): add matchup tab to layout and team scouting compare link"
```

---

### Task 3: Build the Head-to-Head Matchup Screen (`/matchup/+page.svelte`)

**Files:**
- Create: `frontend/src/routes/matchup/+page.svelte`

**Interfaces:**
- Consumes: `mockDataset`, `generatedAt`, `headToHeadSummary`, `sidePerformance`, `heroClash`, `matchupRoleComparison`, `hhi`, `presence`, `TeamTag`, `HeroTag`, `StatBlock`.
- Produces: Fully interactive reactive page at `/matchup`.

- [ ] **Step 1: Build the `/matchup/+page.svelte` route component**

Features included in the template:
1. URL param syncing (`?t1=srg&t2=fl&season=all`) with reactive Svelte 5 runes.
2. Dual team selector dropdowns with logos + "⇄ Swap" button.
3. Season filter pill bar (`All Seasons`, `Season 18`, `Season 17`).
4. Matchup Overview Banner (Direct series & game score, win rate, draft predictability, avg game duration).
5. Side Performance (Blue vs Red) side-by-side cards with percentage bars.
6. Draft Clash & Hero Priority card with 3 segmented sub-tabs (`Contested`, `Team 1 Signatures`, `Team 2 Signatures`) and table.
7. 5-Role Matchup Card (EXP, Jungle, Mid, Gold, Roam) comparing HHI and top 3 comfort picks.
8. Direct Match Encounters accordion listing past series and games with draft links.

- [ ] **Step 2: Run `npm run check` to verify TypeScript and Svelte 5 types**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 3: Run Vitest tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 4: Commit changes**

```bash
git add frontend/src/routes/matchup/+page.svelte
git commit -m "feat(routes): implement head-to-head matchup comparison screen"
```

---

### Task 4: Integration Verification & Documentation Update

**Files:**
- Modify: `docs/current-context.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Run production build check**

Run: `npm run build`
Expected: Prerender succeeds for all static routes including `/matchup`.

- [ ] **Step 2: Verify responsive layout and interactive states**

Verify in browser dev server:
- Team dropdown selection updates metrics and URL search params.
- Swap button correctly interchanges Team 1 and Team 2.
- Direct encounter accordion toggles game drafts.
- 0px horizontal overflow at mobile widths (<640px).

- [ ] **Step 3: Update documentation (`current-context.md` and `roadmap.md`)**

Mark Head-to-Head Matchup Tool as completed in `docs/roadmap.md` and document the feature in `docs/current-context.md`.

- [ ] **Step 4: Commit documentation**

```bash
git add docs/current-context.md docs/roadmap.md
git commit -m "docs: document head-to-head matchup tool release"
```
