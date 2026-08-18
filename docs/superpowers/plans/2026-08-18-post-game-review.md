# Post-Game Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two new backward-looking draft stats (a per-team draft-concentration trend, and a per-hero pick/ban-vs-winning comparison) plus a one-game detail page, all sourced from data the site already has.

**Architecture:** Everything lives in `frontend/`. Two new pure functions in `frontend/src/lib/metrics.ts` compute the stats straight from the already-committed `dataset.json` (no pipeline, schema, or JSON-shape change). A new small reusable chart piece draws the trend line. A new route (`/match/[id]`) shows one game's draft next to each team's own history. `/log` gets clickable rows into that new route, and `/team/[slug]` gets two new sections built from the new stats.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes, snippets), TypeScript, Tailwind v4, Vitest (`vitest-browser-svelte` for component tests, plain Vitest for pure-function tests). No new dependency.

**Spec:** `docs/superpowers/specs/2026-08-18-post-game-review-design.md`

## Global Constraints

- No pipeline/schema/`dataset.json` shape changes — this phase is 100% inside `frontend/`.
- No chart library (CLAUDE.md's deliberate no's list) — the trend line is a hand-built SVG polyline.
- Rolling window is a fixed 10 games this phase (`DEFAULT_ROLLING_WINDOW = 10`), not user-adjustable.
- Win/loss comparison needs at least 5 games with a hero before it shows a number (`MIN_SAMPLE = 5`); below that, the hero is left out of the result entirely, never shown with a shaky percentage.
- `playedAt` looks like `"August 16, 2026 - 17:00"` and does not parse as a date as-is — normalize by replacing `" - "` with `" "` before `new Date(...)`, and fall back to sorting by `id` if parsing ever fails.
- Match `/team/[slug]`'s and `/match/[id]`'s pages stay untested directly, matching how `/league` and `/log` already work in this codebase today — only the reusable pieces and the calculations feeding them get test files.
- Match existing code style exactly: tabs for indentation, single quotes, the same muted color tokens already used throughout (`#8a8478` for secondary text, `#3a352c`/`#2a2620` for borders, `--color-amber` for the accent).

---

## Task 1: `rollingHhi` — draft-concentration trend over time

**Files:**
- Modify: `frontend/src/lib/metrics.ts` (append after `hhiByRole`, currently ending at line 81)
- Test: `frontend/src/lib/metrics.spec.ts` (append new `describe('rollingHhi', ...)` block)

**Interfaces:**
- Consumes: `Dataset`, `MatchRow`, `DraftRow` (already imported in `metrics.ts`); the file's existing private helpers `countByHero(data, drafts)` and `hhiFromCounts(counts)`.
- Produces: `export interface RollingHhiPoint { matchId: number; playedAt: string | null; hhi: number }` and `export function rollingHhi(data: Dataset, teamId: number, windowSize: number = 10): RollingHhiPoint[]` — Task 8 (team page) calls this directly.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/lib/metrics.spec.ts`:

```ts
function seasonSpanningFixture(): Dataset {
	const teams = [
		{ id: 1, canonicalName: 'Selangor Red Giants', shortCode: 'SRG' },
		{ id: 2, canonicalName: 'Team Vamos', shortCode: 'VMS' }
	];
	const heroes = [
		{ id: 1, canonicalName: 'freya' },
		{ id: 2, canonicalName: 'guinevere' }
	];
	// Ids are deliberately out of chronological order (20, 5, 10) so a test
	// that passes only by sorting on `playedAt` — not on `id` — proves the
	// function actually reads the date, not just happens to agree with it.
	const matches: Dataset['matches'] = [
		{ id: 20, seriesId: 'S17M1', season: '17', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: 'June 1, 2026 - 15:00' },
		{ id: 5, seriesId: 'S17M2', season: '17', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 2, gameLength: '10:00', gameNumberInSeries: 1, playedAt: 'June 8, 2026 - 15:00' },
		{ id: 10, seriesId: 'S18M1', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: 'August 14, 2026 - 15:00' }
	];
	const drafts: Dataset['drafts'] = [
		{ id: 1, matchId: 20, teamId: 1, slot: 1, heroId: 1, isBan: false }, // freya
		{ id: 2, matchId: 5, teamId: 1, slot: 1, heroId: 2, isBan: false }, // guinevere
		{ id: 3, matchId: 10, teamId: 1, slot: 1, heroId: 1, isBan: false } // freya again
	];
	return { teams, heroes, matches, drafts };
}

describe('rollingHhi', () => {
	it('returns an empty list for a team with no games', () => {
		const data = seasonSpanningFixture();
		expect(rollingHhi(data, 999)).toEqual([]);
	});

	it('sorts by playedAt (not id) and keeps accumulating across the season boundary', () => {
		const data = seasonSpanningFixture();
		const points = rollingHhi(data, 1, 10);
		expect(points.map((p) => p.matchId)).toEqual([20, 5, 10]);
		expect(points[0].hhi).toBeCloseTo(1, 10); // just freya
		expect(points[1].hhi).toBeCloseTo(0.5, 10); // freya + guinevere, 50/50
		expect(points[2].hhi).toBeCloseTo(5 / 9, 10); // freya x2, guinevere x1 across all 3
	});

	it('drops the oldest game once the window is full', () => {
		const data = seasonSpanningFixture();
		const points = rollingHhi(data, 1, 2);
		expect(points[2].hhi).toBeCloseTo(0.5, 10); // window is just [id 5, id 10]: one freya, one guinevere
	});
});
```

Also add `rollingHhi` to the existing `import { hhi, hhiByRole, pickRateByRole, presence } from './metrics';` line at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/metrics.spec.ts`
Expected: FAIL — `rollingHhi` is not exported / not defined.

- [ ] **Step 3: Write minimal implementation**

Append to `frontend/src/lib/metrics.ts`:

```ts
export interface RollingHhiPoint {
	matchId: number;
	playedAt: string | null;
	hhi: number;
}

const DEFAULT_ROLLING_WINDOW = 10;

function parsePlayedAt(playedAt: string | null): number | null {
	if (!playedAt) return null;
	const t = new Date(playedAt.replace(' - ', ' ')).getTime();
	return Number.isNaN(t) ? null : t;
}

function teamGamesSorted(data: Dataset, teamId: number): MatchRow[] {
	const games = data.matches.filter((m) => m.team1Id === teamId || m.team2Id === teamId);
	return games.slice().sort((a, b) => {
		const ta = parsePlayedAt(a.playedAt);
		const tb = parsePlayedAt(b.playedAt);
		if (ta !== null && tb !== null) return ta - tb;
		return a.id - b.id;
	});
}

function draftsInMatches(
	data: Dataset,
	teamId: number,
	matchIds: Set<number>,
	picksOnly: boolean
): DraftRow[] {
	return data.drafts.filter(
		(d) => d.teamId === teamId && matchIds.has(d.matchId) && (!picksOnly || !d.isBan)
	);
}

export function rollingHhi(
	data: Dataset,
	teamId: number,
	windowSize: number = DEFAULT_ROLLING_WINDOW
): RollingHhiPoint[] {
	const games = teamGamesSorted(data, teamId);
	return games.map((game, i) => {
		const window = games.slice(Math.max(0, i - windowSize + 1), i + 1);
		const matchIds = new Set(window.map((m) => m.id));
		const counts = countByHero(data, draftsInMatches(data, teamId, matchIds, true));
		return { matchId: game.id, playedAt: game.playedAt, hhi: hhiFromCounts(counts) };
	});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/metrics.spec.ts`
Expected: PASS, all `rollingHhi` cases green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/metrics.ts frontend/src/lib/metrics.spec.ts
git commit -m "feat: add rollingHhi draft-concentration trend"
```

---

## Task 2: `pickWinRateDelta` — does this hero line up with winning?

**Files:**
- Modify: `frontend/src/lib/metrics.ts` (append after Task 1's additions)
- Test: `frontend/src/lib/metrics.spec.ts` (append new `describe('pickWinRateDelta', ...)` block)

**Interfaces:**
- Consumes: same `Dataset` shape as Task 1; does not depend on Task 1's functions.
- Produces: `export interface WinRateDelta { hero: string; delta: number; games: number }` and `export function pickWinRateDelta(data: Dataset, teamId: number, opts?: { isBan?: boolean }): WinRateDelta[]` — Task 8 calls this twice (once for picks, once with `{ isBan: true }`).

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/lib/metrics.spec.ts`:

```ts
function winRateFixture(): Dataset {
	const teams = [
		{ id: 1, canonicalName: 'Selangor Red Giants', shortCode: 'SRG' },
		{ id: 2, canonicalName: 'Team Vamos', shortCode: 'VMS' }
	];
	const heroes = [
		{ id: 1, canonicalName: 'sora' },
		{ id: 2, canonicalName: 'guinevere' },
		{ id: 3, canonicalName: 'freya' }
	];
	const heroId = (name: string) => heroes.find((h) => h.canonicalName === name)!.id;

	// Team 1 plays 9 games: wins games 1-5, loses games 6-9.
	const winners = [1, 1, 1, 1, 1, 2, 2, 2, 2];
	const matches: Dataset['matches'] = winners.map((winnerId, i) => ({
		id: i + 1,
		seriesId: `M${i + 1}`,
		season: '18',
		stage: 'regular_season' as const,
		team1Id: 1,
		team2Id: 2,
		team1Side: 'blue' as const,
		winnerId,
		gameLength: '10:00',
		gameNumberInSeries: 1,
		playedAt: null
	}));

	const drafts: Dataset['drafts'] = [];
	let id = 1;
	const pick = (matchId: number, hero: string) =>
		drafts.push({ id: id++, matchId, teamId: 1, slot: 1, heroId: heroId(hero), isBan: false });

	// sora: picked in all 5 wins only -> 5 games, 100% win rate (well above team's 5/9 overall).
	for (let g = 1; g <= 5; g++) pick(g, 'sora');
	// freya: picked in the 5 wins plus 1 loss -> 6 games, 5/6 win rate (still above overall, smaller edge).
	for (let g = 1; g <= 5; g++) pick(g, 'freya');
	pick(6, 'freya');
	// guinevere: picked only in the 4 losses -> 4 games, below the 5-game threshold, must be excluded.
	pick(6, 'guinevere');
	pick(7, 'guinevere');
	pick(8, 'guinevere');
	pick(9, 'guinevere');

	return { teams, heroes, matches, drafts };
}

describe('pickWinRateDelta', () => {
	it('excludes heroes below the 5-game threshold, includes at and above it, sorted best first', () => {
		const data = winRateFixture();
		const deltas = pickWinRateDelta(data, 1);
		expect(deltas.map((d) => d.hero)).toEqual(['sora', 'freya']);
		expect(deltas[0].games).toBe(5);
		expect(deltas[0].delta).toBeCloseTo(1 - 5 / 9, 10);
		expect(deltas[1].games).toBe(6);
		expect(deltas[1].delta).toBeCloseTo(5 / 6 - 5 / 9, 10);
	});

	it('scopes to bans only when isBan is set, and returns nothing when there are none', () => {
		const data = winRateFixture();
		expect(pickWinRateDelta(data, 1, { isBan: true })).toEqual([]);
	});
});
```

Also add `pickWinRateDelta` to the top-of-file import from `./metrics`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/metrics.spec.ts`
Expected: FAIL — `pickWinRateDelta` is not exported / not defined.

- [ ] **Step 3: Write minimal implementation**

Append to `frontend/src/lib/metrics.ts`:

```ts
export interface WinRateDelta {
	hero: string;
	delta: number;
	games: number;
}

const MIN_SAMPLE = 5;

function teamWinRate(
	data: Dataset,
	teamId: number,
	matchIds?: Set<number>
): { wins: number; games: number; rate: number } {
	const games = data.matches.filter(
		(m) => (m.team1Id === teamId || m.team2Id === teamId) && (!matchIds || matchIds.has(m.id))
	);
	const wins = games.filter((m) => m.winnerId === teamId).length;
	return { wins, games: games.length, rate: games.length === 0 ? 0 : wins / games.length };
}

export function pickWinRateDelta(
	data: Dataset,
	teamId: number,
	opts: { isBan?: boolean } = {}
): WinRateDelta[] {
	const isBan = opts.isBan ?? false;
	const overall = teamWinRate(data, teamId);
	const heroName = new Map(data.heroes.map((h) => [h.id, h.canonicalName]));
	const matchIdsByHero = new Map<number, Set<number>>();
	for (const d of data.drafts) {
		if (d.teamId !== teamId || d.isBan !== isBan) continue;
		if (!matchIdsByHero.has(d.heroId)) matchIdsByHero.set(d.heroId, new Set());
		matchIdsByHero.get(d.heroId)!.add(d.matchId);
	}
	const results: WinRateDelta[] = [];
	for (const [heroId, matchIds] of matchIdsByHero) {
		if (matchIds.size < MIN_SAMPLE) continue;
		const withHero = teamWinRate(data, teamId, matchIds);
		results.push({
			hero: heroName.get(heroId)!,
			delta: withHero.rate - overall.rate,
			games: withHero.games
		});
	}
	return results.sort((a, b) => b.delta - a.delta);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/metrics.spec.ts`
Expected: PASS, all `pickWinRateDelta` cases green, and all pre-existing `metrics.spec.ts` cases still green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/metrics.ts frontend/src/lib/metrics.spec.ts
git commit -m "feat: add pickWinRateDelta pick/ban-vs-winning comparison"
```

---

## Task 3: `sparklinePoints` — pure chart-coordinate math

**Files:**
- Create: `frontend/src/lib/sparkline.ts`
- Test: `frontend/src/lib/sparkline.spec.ts`

**Interfaces:**
- Consumes: nothing from this codebase (plain numbers in, plain string out).
- Produces: `export function sparklinePoints(values: number[], width: number, height: number): string` — an SVG `points` attribute value. Task 4 is the only consumer.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/sparkline.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sparklinePoints } from './sparkline';

describe('sparklinePoints', () => {
	it('returns an empty string for no values', () => {
		expect(sparklinePoints([], 100, 40)).toBe('');
	});

	it('centers a single value horizontally, at its own height', () => {
		expect(sparklinePoints([0.5], 100, 40)).toBe('50,20');
	});

	it('spans the full width for multiple values; low values sit near the bottom', () => {
		expect(sparklinePoints([0, 1], 100, 40)).toBe('0,40 100,0');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/sparkline.spec.ts`
Expected: FAIL — `frontend/src/lib/sparkline.ts` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/lib/sparkline.ts`:

```ts
export function sparklinePoints(values: number[], width: number, height: number): string {
	if (values.length === 0) return '';
	return values
		.map((v, i) => {
			const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
			const y = height - v * height;
			return `${x},${y}`;
		})
		.join(' ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/sparkline.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/sparkline.ts frontend/src/lib/sparkline.spec.ts
git commit -m "feat: add sparklinePoints chart-coordinate helper"
```

---

## Task 4: `TrendChart.svelte` — small line chart

**Files:**
- Create: `frontend/src/lib/components/TrendChart.svelte`
- Test: `frontend/src/lib/components/TrendChart.svelte.spec.ts`

**Interfaces:**
- Consumes: `sparklinePoints` from `$lib/sparkline` (Task 3).
- Produces: a Svelte component with props `{ values: number[]; label: string; width?: number; height?: number }` — Task 8 renders it with `values={trend.map((p) => p.hhi)}`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/components/TrendChart.svelte.spec.ts`:

```ts
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TrendChart from './TrendChart.svelte';

describe('TrendChart', () => {
	it('shows a fallback message when there is no history yet', async () => {
		render(TrendChart, { values: [], label: 'HHI trend' });
		await expect.element(page.getByText(/not enough games/i)).toBeInTheDocument();
	});

	it('renders a labeled chart when there is history', async () => {
		render(TrendChart, { values: [0.2, 0.5, 0.8], label: 'HHI trend' });
		await expect.element(page.getByRole('img', { name: 'HHI trend' })).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/components/TrendChart.svelte.spec.ts`
Expected: FAIL — `TrendChart.svelte` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/lib/components/TrendChart.svelte`:

```svelte
<script lang="ts">
	import { sparklinePoints } from '$lib/sparkline';

	interface Props {
		values: number[];
		label: string;
		width?: number;
		height?: number;
	}
	let { values, label, width = 160, height = 40 }: Props = $props();
	const coords = $derived(sparklinePoints(values, width, height));
</script>

{#if values.length === 0}
	<span class="text-xs text-[#8a8478]">Not enough games yet</span>
{:else}
	<svg
		{width}
		{height}
		viewBox={`0 0 ${width} ${height}`}
		role="img"
		aria-label={label}
		class="overflow-visible"
	>
		<polyline points={coords} fill="none" style="stroke: var(--color-amber); stroke-width: 1.5" />
	</svg>
{/if}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/components/TrendChart.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/components/TrendChart.svelte frontend/src/lib/components/TrendChart.svelte.spec.ts
git commit -m "feat: add TrendChart sparkline component"
```

---

## Task 5: `DataTable` — optional row links

**Files:**
- Modify: `frontend/src/lib/components/DataTable.svelte` (all 31 lines)
- Test: `frontend/src/lib/components/DataTable.svelte.spec.ts` (append one case)

**Interfaces:**
- Consumes: nothing new.
- Produces: new optional prop `rowHref?: (row: Record<string, unknown>) => string` on the existing `DataTable` component — Task 7 (`/log`) passes it; every other current caller (`/log` itself, pre-change) keeps working unchanged since the prop is optional.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/lib/components/DataTable.svelte.spec.ts`:

```ts
it('links the first cell of each row when rowHref is given', async () => {
	render(DataTable, {
		columns: [
			{ key: 'series', label: 'Series' },
			{ key: 'winner', label: 'Winner' }
		],
		rows: [{ series: 'M1', winner: 'SRG' }],
		rowHref: (row: Record<string, unknown>) => `/match/${row.series}`
	});
	const link = page.getByRole('link', { name: 'M1' });
	await expect.element(link).toBeInTheDocument();
	await expect.element(link).toHaveAttribute('href', '/match/M1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/components/DataTable.svelte.spec.ts`
Expected: FAIL — no link is rendered (`rowHref` is unused, plain text cell only).

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `frontend/src/lib/components/DataTable.svelte`:

```svelte
<script lang="ts">
	interface Column {
		key: string;
		label: string;
	}
	interface Props {
		columns: Column[];
		rows: Record<string, unknown>[];
		rowHref?: (row: Record<string, unknown>) => string;
	}
	let { columns, rows, rowHref }: Props = $props();
</script>

<table class="w-full border-collapse font-mono text-sm">
	<thead>
		<tr class="border-b border-[#3a352c] text-left text-[#8a8478]">
			{#each columns as col (col.key)}
				<th class="px-3 py-2 font-normal">{col.label}</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each rows as row, i (i)}
			<tr class="border-b border-[#2a2620]">
				{#each columns as col, ci (col.key)}
					<td class="px-3 py-2">
						{#if rowHref && ci === 0}
							<a href={rowHref(row)} class="text-[--color-amber] hover:underline">{row[col.key]}</a>
						{:else}
							{row[col.key]}
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/components/DataTable.svelte.spec.ts`
Expected: PASS, including the pre-existing "renders a header per column..." case (proves the optional prop didn't break the no-`rowHref` path).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/components/DataTable.svelte frontend/src/lib/components/DataTable.svelte.spec.ts
git commit -m "feat: let DataTable rows optionally link out"
```

---

## Task 6: `/match/[id]` — one game, close up

**Files:**
- Create: `frontend/src/routes/match/[id]/+page.ts`
- Create: `frontend/src/routes/match/[id]/+page.svelte`

**Interfaces:**
- Consumes: `mockDataset`, `generatedAt` from `$lib/data`; `presence` from `$lib/metrics` (pre-existing, unchanged); `BaselineAnnotation`, `FreshnessIndicator`, `TeamTag` components (all pre-existing, unchanged).
- Produces: the route `/match/[id]`, reached by a link from Task 7. Not consumed by any other task.

No test file for this task — matches how `/log`, `/league`, and `/team/[slug]` already work in this codebase (routes are wired manually and checked in the browser; only the reusable pieces and calculations underneath them have test files). Manual verification happens in Task 9.

- [ ] **Step 1: Create the route loader**

Create `frontend/src/routes/match/[id]/+page.ts`:

```ts
import { error } from '@sveltejs/kit';
import { mockDataset } from '$lib/data';

export const prerender = true;

export function entries() {
	return mockDataset.matches.map((m) => ({ id: String(m.id) }));
}

export function load({ params }: { params: { id: string } }) {
	const match = mockDataset.matches.find((m) => m.id === Number(params.id));
	if (!match) throw error(404, `Unknown match id: ${params.id}`);
	return { match };
}
```

- [ ] **Step 2: Create the page**

Create `frontend/src/routes/match/[id]/+page.svelte`:

```svelte
<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import { presence } from '$lib/metrics';
	import BaselineAnnotation from '$lib/components/BaselineAnnotation.svelte';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';

	let { data } = $props();
	const match = $derived(data.match);

	const teamName = new Map(mockDataset.teams.map((t) => [t.id, t.canonicalName]));
	const heroName = new Map(mockDataset.heroes.map((h) => [h.id, h.canonicalName]));
	const leaguePresence = $derived(presence(mockDataset));

	function sideRows(teamId: number) {
		const teamPresence = presence(mockDataset, { teamId });
		return mockDataset.drafts
			.filter((d) => d.matchId === match.id && d.teamId === teamId)
			.sort((a, b) => Number(a.isBan) - Number(b.isBan) || a.slot - b.slot)
			.map((d) => {
				const hero = heroName.get(d.heroId)!;
				return {
					hero,
					kind: d.isBan ? 'Ban' : 'Pick',
					value: teamPresence[hero] ?? 0,
					baseline: leaguePresence[hero] ?? 0
				};
			});
	}

	const team1Rows = $derived(sideRows(match.team1Id));
	const team2Rows = $derived(sideRows(match.team2Id));
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="font-[Syne] text-2xl">{match.seriesId} — Game {match.gameNumberInSeries}</h1>
		<FreshnessIndicator {generatedAt} />
	</div>

	<div class="font-mono text-sm text-[#8a8478]">
		{match.stage} · Season {match.season} · {match.gameLength} · winner {teamName.get(match.winnerId)}
	</div>

	<div class="grid grid-cols-2 gap-8">
		<div>
			<h2 class="mb-2 flex items-center gap-2 font-[Syne] text-lg">
				<TeamTag name={teamName.get(match.team1Id)!} />
				{teamName.get(match.team1Id)}
			</h2>
			{#each team1Rows as row (row.kind + row.hero)}
				<div class="flex items-center justify-between border-b border-[#2a2620] py-2 font-mono text-sm">
					<span>{row.kind}: {row.hero}</span>
					<BaselineAnnotation value={row.value} baseline={row.baseline} />
				</div>
			{/each}
		</div>
		<div>
			<h2 class="mb-2 flex items-center gap-2 font-[Syne] text-lg">
				<TeamTag name={teamName.get(match.team2Id)!} />
				{teamName.get(match.team2Id)}
			</h2>
			{#each team2Rows as row (row.kind + row.hero)}
				<div class="flex items-center justify-between border-b border-[#2a2620] py-2 font-mono text-sm">
					<span>{row.kind}: {row.hero}</span>
					<BaselineAnnotation value={row.value} baseline={row.baseline} />
				</div>
			{/each}
		</div>
	</div>
</div>
```

- [ ] **Step 3: Run the full test suite to make sure nothing broke**

Run: `cd frontend && npm run test`
Expected: PASS — same test count as before plus everything added in Tasks 1-5, no new failures (this task adds no tests of its own).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/match
git commit -m "feat: add /match/[id] single-game draft breakdown page"
```

---

## Task 7: Link `/log` rows into `/match/[id]`

**Files:**
- Modify: `frontend/src/routes/log/+page.svelte`

**Interfaces:**
- Consumes: `DataTable`'s new `rowHref` prop from Task 5.
- Produces: nothing new for later tasks.

No test file — same reasoning as Task 6 (route wiring, not a reusable piece). Verified in Task 9.

- [ ] **Step 1: Add the match id to each row and pass rowHref**

In `frontend/src/routes/log/+page.svelte`, change the `rows` derivation to include `id`, and pass `rowHref` to `DataTable`:

```svelte
	const rows = $derived(
		mockDataset.matches
			.filter((m) => teamFilter === 'all' || m.team1Id === Number(teamFilter) || m.team2Id === Number(teamFilter))
			.filter((m) => stageFilter === 'all' || m.stage === stageFilter)
			.map((m) => ({
				id: m.id,
				series: m.seriesId,
				season: m.season,
				stage: m.stage,
				team1: teamName.get(m.team1Id),
				team2: teamName.get(m.team2Id),
				winner: teamName.get(m.winnerId),
				length: m.gameLength
			}))
	);
```

```svelte
	<DataTable
		columns={[
			{ key: 'series', label: 'Series' },
			{ key: 'season', label: 'Season' },
			{ key: 'stage', label: 'Stage' },
			{ key: 'team1', label: 'Team 1' },
			{ key: 'team2', label: 'Team 2' },
			{ key: 'winner', label: 'Winner' },
			{ key: 'length', label: 'Length' }
		]}
		{rows}
		rowHref={(row) => `/match/${row.id}`}
	/>
```

- [ ] **Step 2: Run the full test suite**

Run: `cd frontend && npm run test`
Expected: PASS — no test targets this page directly, but this confirms nothing else regressed.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/log/+page.svelte
git commit -m "feat: link Match Log rows to their /match/[id] page"
```

---

## Task 8: Team page — trend chart and win-rate-delta tables

**Files:**
- Modify: `frontend/src/routes/team/[slug]/+page.svelte`

**Interfaces:**
- Consumes: `rollingHhi`, `pickWinRateDelta` from `$lib/metrics` (Tasks 1-2); `TrendChart` (Task 4).
- Produces: nothing new for later tasks — this is the last task.

No test file — same reasoning as Task 6. Verified in Task 9.

- [ ] **Step 1: Add the new imports and derived values**

In `frontend/src/routes/team/[slug]/+page.svelte`, extend the existing `$lib/metrics` import and add two new derived values after the existing `teamHhi`/`leagueHhi` lines:

```svelte
	import { hhi, pickWinRateDelta, presence, rollingHhi } from '$lib/metrics';
	import TrendChart from '$lib/components/TrendChart.svelte';
```

```svelte
	const trend = $derived(rollingHhi(mockDataset, team.id));
	const pickDeltas = $derived(pickWinRateDelta(mockDataset, team.id));
	const banDeltas = $derived(pickWinRateDelta(mockDataset, team.id, { isBan: true }));
```

- [ ] **Step 2: Add the two new sections to the markup**

Insert this after the existing `Team HHI: <BaselineAnnotation ...>` line and before the existing presence `<table>`:

```svelte
	<div>
		<h2 class="mb-2 font-[Syne] text-lg">Draft concentration, last 10 games</h2>
		<TrendChart values={trend.map((p) => p.hhi)} label={`${team.canonicalName} rolling HHI`} />
	</div>

	{#snippet deltaTable(rows: { hero: string; delta: number; games: number }[])}
		{#if rows.length === 0}
			<p class="font-mono text-xs text-[#8a8478]">Not enough games yet.</p>
		{:else}
			<table class="w-full border-collapse font-mono text-sm">
				<thead>
					<tr class="border-b border-[#3a352c] text-left text-[#8a8478]">
						<th class="px-3 py-2 font-normal">Hero</th>
						<th class="px-3 py-2 font-normal">Win rate vs. normal</th>
						<th class="px-3 py-2 font-normal">Games</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.hero)}
						<tr class="border-b border-[#2a2620]">
							<td class="px-3 py-2">{row.hero}</td>
							<td class="px-3 py-2">{row.delta >= 0 ? '+' : ''}{(row.delta * 100).toFixed(1)}%</td>
							<td class="px-3 py-2">{row.games}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	{/snippet}

	<div class="grid grid-cols-2 gap-8">
		<div>
			<h2 class="mb-2 font-[Syne] text-lg">Picks that line up with winning</h2>
			{@render deltaTable(pickDeltas)}
		</div>
		<div>
			<h2 class="mb-2 font-[Syne] text-lg">Bans that line up with winning</h2>
			{@render deltaTable(banDeltas)}
		</div>
	</div>
```

- [ ] **Step 3: Run the full test suite**

Run: `cd frontend && npm run test`
Expected: PASS — full count from before plus every case added in Tasks 1-5, still nothing new failing.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/team/[slug]/+page.svelte
git commit -m "feat: add draft-trend and win-rate-delta panels to Team Scouting"
```

---

## Task 9: Manual browser verification

**Files:** none — this task touches no files.

- [ ] **Step 1: Start the dev server**

Run: `cd frontend && npm run dev` (background/separate terminal)

- [ ] **Step 2: Check `/log` links out correctly**

Open `/log` in a browser. Confirm the first cell (`Series`) of each row is a clickable amber link. Click one; confirm it lands on `/match/<id>` and doesn't 404.

- [ ] **Step 3: Check `/match/[id]` renders real data**

On the opened match page, confirm: both teams' picks and bans are listed, each with a value and a "baseline" number next to it (not blank/NaN/undefined), the winner name matches the team that actually won, and the header shows a real series id and game number.

- [ ] **Step 4: Check `/team/[slug]` renders the two new sections**

Open `/team/srg` (or any team slug). Confirm the "Draft concentration, last 10 games" chart renders a visible line (not just the "Not enough games yet" fallback, since SRG has plenty of Season 17 history). Confirm the "Picks/Bans that line up with winning" tables show rows with a `+`/`-` percentage and a games count, or the "Not enough games yet" message if none crossed the threshold yet.

- [ ] **Step 5: Stop the dev server**

Kill the background `npm run dev` process.

- [ ] **Step 6: Update project docs**

Update `docs/current-context.md`'s "Where things stand" section and `docs/roadmap.md`'s "Next" checklist to mark post-game review as done, following the same style as the existing done-items (date, one-paragraph summary, what's still open). Commit:

```bash
git add docs/current-context.md docs/roadmap.md
git commit -m "docs: reflect post-game review live"
```
