# Per-Role & Flex Scouting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement per-role filtering and predictability metrics across the app, add a team Flex Picks card with role distribution bars, and build a dedicated `/roles` intelligence dashboard.

**Architecture:** Extend `frontend/src/lib/metrics.ts` with two pure functions (`flexHeroes` and `rolePredictabilityMatrix`), build two shared UI components (`RoleFilter.svelte` and `RoleDistributionBar.svelte`), integrate role filters into `/team/[slug]` and `/league`, add a new `/roles` route to the navbar, and prerender it statically.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript, Tailwind v4, Vitest, `@sveltejs/adapter-static`.

**Spec:** `docs/superpowers/specs/2026-08-27-per-role-flex-scouting-design.md`

## Global Constraints

- Strictly role-ordered slots: 1=EXP, 2=JGL, 3=MID, 4=GOLD, 5=ROAM. Bans are slot-ordered chronologically, so per-role logic strictly applies to picks (`isBan === false`).
- Zero new runtime npm dependencies.
- Static prerender compliance: all pages must prerender cleanly (`npm run build`).
- Dark esports visual tokens: `bg-surface`, `border-line`, `text-ink`, `text-muted`, `text-primary`, `text-gold`, `font-display` (Russo One), `font-body` (Chakra Petch), `font-mono` (JetBrains Mono).

---

## Task 1: Core Metrics & Models (`metrics.ts`)

**Files:**
- Modify: `frontend/src/lib/metrics.ts`
- Test: `frontend/src/lib/metrics.spec.ts`

**Interfaces:**
- Produces:
  - `ROLE_NAMES: Record<number, string>`
  - `export interface RoleDistribution { role: number; roleName: string; picks: number; share: number }`
  - `export interface FlexHero { hero: string; totalPicks: number; primaryRole: RoleDistribution; secondaryRoles: RoleDistribution[]; roles: RoleDistribution[]; flexRate: number }`
  - `export interface TeamRoleMatrixRow { teamId: number; teamName: string; overallHhi: number; roleHhi: Record<number, number> }`
  - `export function flexHeroes(data: Dataset, opts?: ScopeOptions): FlexHero[]`
  - `export function rolePredictabilityMatrix(data: Dataset, opts?: ScopeOptions): { teams: TeamRoleMatrixRow[]; league: Record<number, number> }`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/lib/metrics.spec.ts`:

```ts
import {
	ROLE_NAMES,
	flexHeroes,
	rolePredictabilityMatrix,
	type FlexHero
} from './metrics';

function roleFixtureData(): Dataset {
	const teams = [
		{ id: 1, canonicalName: 'Selangor Red Giants', shortCode: 'SRG' },
		{ id: 2, canonicalName: 'Team Vamos', shortCode: 'VMS' }
	];
	const heroes = [
		{ id: 1, canonicalName: 'gloo' },
		{ id: 2, canonicalName: 'fanny' },
		{ id: 3, canonicalName: 'chou' }
	];
	const matches: Dataset['matches'] = [
		{ id: 1, seriesId: 'S18M1', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '12:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 2, seriesId: 'S18M2', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '14:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 3, seriesId: 'S18M3', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '15:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 4, seriesId: 'S18M4', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '16:00', gameNumberInSeries: 1, playedAt: null }
	];
	const drafts: Dataset['drafts'] = [
		// Match 1: Team 1 picks Gloo slot 1 (EXP), Team 2 picks Fanny slot 2 (JGL)
		{ id: 1, matchId: 1, teamId: 1, slot: 1, heroId: 1, isBan: false },
		{ id: 2, matchId: 1, teamId: 2, slot: 2, heroId: 2, isBan: false },
		// Match 2: Team 1 picks Gloo slot 1 (EXP), Team 2 picks Gloo slot 5 (ROAM)
		{ id: 3, matchId: 2, teamId: 1, slot: 1, heroId: 1, isBan: false },
		{ id: 4, matchId: 2, teamId: 2, slot: 5, heroId: 1, isBan: false },
		// Match 3: Team 1 picks Gloo slot 5 (ROAM), Team 2 picks Chou slot 5 (ROAM)
		{ id: 5, matchId: 3, teamId: 1, slot: 5, heroId: 1, isBan: false },
		{ id: 6, matchId: 3, teamId: 2, slot: 5, heroId: 3, isBan: false },
		// Match 4: Team 1 picks Fanny slot 2 (JGL), Team 2 picks Chou slot 1 (EXP)
		{ id: 7, matchId: 4, teamId: 1, slot: 2, heroId: 2, isBan: false },
		{ id: 8, matchId: 4, teamId: 2, slot: 1, heroId: 3, isBan: false }
	];
	return { teams, heroes, matches, drafts };
}

describe('flexHeroes', () => {
	it('identifies heroes picked in 2 or more distinct roles and computes correct distribution', () => {
		const data = roleFixtureData();
		const flex = flexHeroes(data);
		// gloo (3 picks: 2 EXP, 1 ROAM for Team 1; 1 pick ROAM for Team 2 -> total 4 picks: 2 EXP, 2 ROAM)
		// chou (2 picks: 1 ROAM, 1 EXP for Team 2 -> total 2 picks: 1 ROAM, 1 EXP)
		// fanny is 1 role only (JGL), so excluded
		expect(flex.map((f) => f.hero)).toEqual(['gloo', 'chou']);

		const gloo = flex.find((f) => f.hero === 'gloo')!;
		expect(gloo.totalPicks).toBe(4);
		expect(gloo.roles.length).toBe(2);
		expect(gloo.primaryRole.picks).toBe(2);
		expect(gloo.primaryRole.share).toBe(0.5);
		expect(gloo.flexRate).toBe(0.5);
	});

	it('scopes flex heroes to a specific team when teamId is passed', () => {
		const data = roleFixtureData();
		const team1Flex = flexHeroes(data, { teamId: 1 });
		expect(team1Flex.map((f) => f.hero)).toEqual(['gloo']);
		expect(team1Flex[0].totalPicks).toBe(3);
		expect(team1Flex[0].primaryRole.roleName).toBe('EXP');
		expect(team1Flex[0].primaryRole.picks).toBe(2);
		expect(team1Flex[0].secondaryRoles[0].roleName).toBe('ROAM');
		expect(team1Flex[0].secondaryRoles[0].picks).toBe(1);
	});
});

describe('rolePredictabilityMatrix', () => {
	it('computes HHI for each team and league baseline across all 5 roles', () => {
		const data = roleFixtureData();
		const matrix = rolePredictabilityMatrix(data);
		expect(matrix.teams.length).toBe(2);
		expect(matrix.teams[0].teamName).toBe('Selangor Red Giants');
		expect(matrix.teams[0].roleHhi[1]).toBeGreaterThanOrEqual(0);
		expect(matrix.teams[0].roleHhi[2]).toBeGreaterThanOrEqual(0);
		expect(matrix.league[1]).toBeGreaterThanOrEqual(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: TypeScript compilation failure or missing exports.

- [ ] **Step 3: Implement functions in `frontend/src/lib/metrics.ts`**

Add to `frontend/src/lib/metrics.ts`:

```ts
export const ROLE_NAMES: Record<number, string> = {
	1: 'EXP',
	2: 'JGL',
	3: 'MID',
	4: 'GOLD',
	5: 'ROAM'
};

export interface RoleDistribution {
	role: number;
	roleName: string;
	picks: number;
	share: number;
}

export interface FlexHero {
	hero: string;
	totalPicks: number;
	primaryRole: RoleDistribution;
	secondaryRoles: RoleDistribution[];
	roles: RoleDistribution[];
	flexRate: number;
}

export interface TeamRoleMatrixRow {
	teamId: number;
	teamName: string;
	overallHhi: number;
	roleHhi: Record<number, number>;
}

export function flexHeroes(data: Dataset, opts: ScopeOptions = {}): FlexHero[] {
	const drafts = scopedDrafts(data, { ...opts, picksOnly: true });
	const heroName = new Map(data.heroes.map((h) => [h.id, h.canonicalName]));
	const roleCountsByHero = new Map<string, Map<number, number>>();

	for (const d of drafts) {
		const name = heroName.get(d.heroId)!;
		if (!roleCountsByHero.has(name)) {
			roleCountsByHero.set(name, new Map());
		}
		const roleMap = roleCountsByHero.get(name)!;
		roleMap.set(d.slot, (roleMap.get(d.slot) ?? 0) + 1);
	}

	const result: FlexHero[] = [];
	for (const [hero, roleMap] of roleCountsByHero.entries()) {
		if (roleMap.size < 2) continue; // Not flexed
		const totalPicks = Array.from(roleMap.values()).reduce((a, b) => a + b, 0);
		const roles: RoleDistribution[] = Array.from(roleMap.entries())
			.map(([role, picks]) => ({
				role,
				roleName: ROLE_NAMES[role] ?? `Role ${role}`,
				picks,
				share: picks / totalPicks
			}))
			.sort((a, b) => b.picks - a.picks);

		const primaryRole = roles[0];
		const secondaryRoles = roles.slice(1);
		const flexRate = (totalPicks - primaryRole.picks) / totalPicks;

		result.push({
			hero,
			totalPicks,
			primaryRole,
			secondaryRoles,
			roles,
			flexRate
		});
	}

	return result.sort((a, b) => b.totalPicks - a.totalPicks || b.flexRate - a.flexRate);
}

export function rolePredictabilityMatrix(
	data: Dataset,
	opts: ScopeOptions = {}
): { teams: TeamRoleMatrixRow[]; league: Record<number, number> } {
	const teams = data.teams.map((team) => {
		const teamOpts = { ...opts, teamId: team.id };
		const roleHhi: Record<number, number> = {};
		for (let role = 1; role <= 5; role++) {
			roleHhi[role] = hhiByRole(data, role, teamOpts);
		}
		return {
			teamId: team.id,
			teamName: team.canonicalName,
			overallHhi: hhi(data, teamOpts),
			roleHhi
		};
	});

	const league: Record<number, number> = {};
	for (let role = 1; role <= 5; role++) {
		league[role] = hhiByRole(data, role, opts);
	}

	return { teams, league };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All unit tests in `metrics.spec.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/metrics.ts frontend/src/lib/metrics.spec.ts
git commit -m "feat(metrics): add flexHeroes and rolePredictabilityMatrix"
```

---

## Task 2: Shared Components (`RoleFilter` and `RoleDistributionBar`)

**Files:**
- Create: `frontend/src/lib/components/RoleFilter.svelte`
- Test: `frontend/src/lib/components/RoleFilter.svelte.spec.ts`
- Create: `frontend/src/lib/components/RoleDistributionBar.svelte`
- Test: `frontend/src/lib/components/RoleDistributionBar.svelte.spec.ts`

**Interfaces:**
- Produces:
  - `<RoleFilter selected={number | null} onchange={(role: number | null) => void} />`
  - `<RoleDistributionBar roles={RoleDistribution[]} totalPicks={number} />`

- [ ] **Step 1: Create `RoleFilter.svelte` and test**

`frontend/src/lib/components/RoleFilter.svelte`:

```svelte
<script lang="ts">
	import { ROLE_NAMES } from '$lib/metrics';

	let {
		selected = null,
		onchange
	}: {
		selected?: number | null;
		onchange?: (role: number | null) => void;
	} = $props();

	const roleOptions = [
		{ id: null, label: 'All Roles' },
		{ id: 1, label: ROLE_NAMES[1] },
		{ id: 2, label: ROLE_NAMES[2] },
		{ id: 3, label: ROLE_NAMES[3] },
		{ id: 4, label: ROLE_NAMES[4] },
		{ id: 5, label: ROLE_NAMES[5] }
	];
</script>

<div class="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by role">
	{#each roleOptions as opt (opt.id)}
		{@const isActive = selected === opt.id}
		<button
			type="button"
			role="tab"
			aria-selected={isActive}
			onclick={() => onchange?.(opt.id)}
			class="rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors {isActive
				? 'bg-primary text-black font-semibold'
				: 'bg-surface-2 text-muted hover:bg-surface-3 hover:text-ink'}"
		>
			{opt.label}
		</button>
	{/each}
</div>
```

`frontend/src/lib/components/RoleFilter.svelte.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RoleFilter from './RoleFilter.svelte';

describe('RoleFilter', () => {
	it('renders all role options and triggers onchange on click', async () => {
		let clickedRole: number | null = -1;
		const screen = render(RoleFilter, {
			selected: null,
			onchange: (role) => {
				clickedRole = role;
			}
		});

		const jglButton = screen.getByRole('tab', { name: 'JGL' });
		await expect.element(jglButton).toBeVisible();
		await jglButton.click();
		expect(clickedRole).toBe(2);
	});
});
```

- [ ] **Step 2: Create `RoleDistributionBar.svelte` and test**

`frontend/src/lib/components/RoleDistributionBar.svelte`:

```svelte
<script lang="ts">
	import type { RoleDistribution } from '$lib/metrics';

	let {
		roles = []
	}: {
		roles: RoleDistribution[];
	} = $props();

	const ROLE_COLORS: Record<number, string> = {
		1: 'bg-amber-500',
		2: 'bg-emerald-500',
		3: 'bg-blue-500',
		4: 'bg-purple-500',
		5: 'bg-rose-500'
	};
</script>

<div class="space-y-1.5">
	<div class="flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
		{#each roles as r (r.role)}
			<div
				class="{ROLE_COLORS[r.role] ?? 'bg-primary'} transition-all"
				style="width: {(r.share * 100).toFixed(1)}%"
				title="{r.roleName}: {r.picks} picks ({(r.share * 100).toFixed(1)}%)"
			></div>
		{/each}
	</div>
	<div class="flex flex-wrap gap-2 text-xs font-mono text-muted">
		{#each roles as r (r.role)}
			<span class="flex items-center gap-1">
				<span class="inline-block h-2 w-2 rounded-full {ROLE_COLORS[r.role] ?? 'bg-primary'}"></span>
				<span class="text-ink">{r.roleName}</span>
				<span>{r.picks} ({(r.share * 100).toFixed(0)}%)</span>
			</span>
		{/each}
	</div>
</div>
```

`frontend/src/lib/components/RoleDistributionBar.svelte.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RoleDistributionBar from './RoleDistributionBar.svelte';

describe('RoleDistributionBar', () => {
	it('renders distribution badges for each role', async () => {
		const screen = render(RoleDistributionBar, {
			roles: [
				{ role: 1, roleName: 'EXP', picks: 3, share: 0.75 },
				{ role: 5, roleName: 'ROAM', picks: 1, share: 0.25 }
			]
		});
		await expect.element(screen.getByText('EXP')).toBeVisible();
		await expect.element(screen.getByText('ROAM')).toBeVisible();
	});
});
```

- [ ] **Step 3: Run component tests**

Run: `npm test`
Expected: Both new component test files pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/components/RoleFilter.svelte frontend/src/lib/components/RoleFilter.svelte.spec.ts frontend/src/lib/components/RoleDistributionBar.svelte frontend/src/lib/components/RoleDistributionBar.svelte.spec.ts
git commit -m "feat(ui): add RoleFilter and RoleDistributionBar components"
```

---

## Task 3: Team Scouting Screen Integration (`/team/[slug]`)

**Files:**
- Modify: `frontend/src/routes/team/[slug]/+page.svelte`

**Requirements:**
- Add `RoleFilter` above the main Picked/Banned tables.
- Support selecting a role `selectedRole: number | null = $state(null)`.
- When `selectedRole !== null`:
  - Show role-specific picks table from `pickRateByRole(mockDataset, selectedRole, { teamId: team.id })` against `pickRateByRole(mockDataset, selectedRole)`.
  - Highlight role predictability: `hhiByRole(mockDataset, selectedRole, { teamId: team.id })` vs baseline `hhiByRole(mockDataset, selectedRole)`.
- Add a new **Flex Picks** card rendering `flexHeroes(mockDataset, { teamId: team.id })` using `RoleDistributionBar`. If no flex picks exist for this team, show a subtle empty-state message.

- [ ] **Step 1: Update `frontend/src/routes/team/[slug]/+page.svelte`**

Import `flexHeroes`, `hhiByRole`, `pickRateByRole`, `ROLE_NAMES`, `RoleFilter`, and `RoleDistributionBar`.
Wire reactive states and render the new Flex card and Role filter.

- [ ] **Step 2: Run tests & checks**

Run: `npm run check` and `npm test`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/team/[slug]/+page.svelte
git commit -m "feat(team): add role filter and flex picks card to Team Scouting"
```

---

## Task 4: League Overview Screen Integration (`/league`)

**Files:**
- Modify: `frontend/src/routes/league/+page.svelte`

**Requirements:**
- Add `RoleFilter` above the Meta Draft section.
- Selecting a role filters the Most Picked tables to that specific lane (using `pickRateByRole`).

- [ ] **Step 1: Update `frontend/src/routes/league/+page.svelte`**

Import `RoleFilter`, `pickRateByRole`, `ROLE_NAMES`.
Wire role state to the Meta Draft tables.

- [ ] **Step 2: Run tests & checks**

Run: `npm run check` and `npm test`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/league/+page.svelte
git commit -m "feat(league): add role filter to Meta Draft section"
```

---

## Task 5: Dedicated Screen (`/roles`) & Navigation

**Files:**
- Modify: `frontend/src/routes/+layout.svelte`
- Create: `frontend/src/routes/roles/+page.svelte`

**Requirements:**
- Add `ROLES` to nav pill bar in `+layout.svelte`.
- Create `/roles/+page.svelte`:
  - **Card 1: Team Role Predictability Matrix**:
    - Calls `rolePredictabilityMatrix(mockDataset)`.
    - 8 team rows with TeamTag, Overall HHI, and columns for EXP, JGL, MID, GOLD, ROAM.
    - League average baseline row at bottom.
  - **Card 2: Tournament Flex Picks**:
    - Calls `flexHeroes(mockDataset)`.
    - Table displaying all flex heroes with hero icon, total picks, primary role %, secondary role %, and `RoleDistributionBar`.

- [ ] **Step 1: Update `+layout.svelte`**

Add `/roles` link to navigation array in `frontend/src/routes/+layout.svelte`.

- [ ] **Step 2: Create `frontend/src/routes/roles/+page.svelte`**

Implement the page using standard card styling, `TeamTag`, `HeroTag`, `RoleDistributionBar`, and `FreshnessIndicator`.

- [ ] **Step 3: Run checks & test static build**

Run: `npm run check && npm test && npm run build`
Expected: Static build completes and generates `/roles/index.html`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/+layout.svelte frontend/src/routes/roles/+page.svelte
git commit -m "feat(roles): add dedicated /roles dashboard and nav item"
```

---

## Task 6: Final Verification & Documentation

**Files:**
- Modify: `docs/current-context.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Run full verification suite**

Run:
```bash
npm run check
npm test
npm run build
```

- [ ] **Step 2: Update documentation**

Update `docs/current-context.md` and `docs/roadmap.md` to reflect the completed Per-Role & Flex Scouting features.

- [ ] **Step 3: Commit**

```bash
git add docs/current-context.md docs/roadmap.md
git commit -m "docs: sync current-context and roadmap with per-role flex scouting"
```
