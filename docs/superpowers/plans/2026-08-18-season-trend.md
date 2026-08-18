# Season 17 vs Season 18 Trend Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "last season vs this season" comparison to the Team page and the League page, reusing the site's existing season-filterable `presence`/`hhi` functions plus one new before/after helper.

**Architecture:** One new pure function in `frontend/src/lib/metrics.ts` (`presenceDelta`) does the per-hero before/after subtraction by calling the already-existing `presence()` twice. Both new UI sections — one on `/team/[slug]`, one on `/league` — are wired directly into those pages' existing scripts and markup, matching how every other section on those two pages already works. No pipeline, schema, or `dataset.json` changes.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Tailwind v4, Vitest. No new dependency, no new component.

**Spec:** `docs/superpowers/specs/2026-08-18-season-trend-design.md`

## Global Constraints

- No pipeline/schema/`dataset.json` shape changes — everything needed (`season` on `MatchRow`/via `drafts`→`matches`) already exists and is already wired into `presence()`/`hhi()`.
- `'17'` and `'18'` are passed as plain string arguments at each call site, not hardcoded inside `presenceDelta` itself — but every call site in this phase uses exactly those two literals, since those are the only two seasons that exist. No generalization to a hypothetical future season.
- Numbers show even for a thin Season 18 sample — no minimum-game hiding on this feature (unlike the post-game review phase's win-rate-delta table). The game count is shown directly beside each number instead, so the reader judges reliability themselves.
- No new component and no new component test file — this phase's only new test file covers `presenceDelta` itself. The two page sections follow the existing untested-page convention already used by every route in this codebase.
- Match existing code style: tabs, single quotes, the same muted color tokens (`#8a8478` secondary text, `#3a352c`/`#2a2620` borders, `--color-amber` accent).

---

## Task 1: `presenceDelta` — before/after per hero

**Files:**
- Modify: `frontend/src/lib/metrics.ts` (append after `pickWinRateDelta`, at the end of the file)
- Test: `frontend/src/lib/metrics.spec.ts` (append new `describe('presenceDelta', ...)` block)

**Interfaces:**
- Consumes: the file's existing exported `presence(data, opts)`.
- Produces: `export interface PresenceDelta { hero: string; before: number; after: number; delta: number }` and `export function presenceDelta(data: Dataset, beforeSeason: string, afterSeason: string, opts?: { teamId?: number }): PresenceDelta[]` — Tasks 2 and 3 both call this directly.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/lib/metrics.spec.ts`:

```ts
function seasonPresenceFixture(): Dataset {
	const teams = [
		{ id: 1, canonicalName: 'Selangor Red Giants', shortCode: 'SRG' },
		{ id: 2, canonicalName: 'Team Vamos', shortCode: 'VMS' }
	];
	const heroes = [
		{ id: 1, canonicalName: 'freya' },
		{ id: 2, canonicalName: 'guinevere' },
		{ id: 3, canonicalName: 'chou' },
		{ id: 4, canonicalName: 'kalea' }
	];
	const heroId = (name: string) => heroes.find((h) => h.canonicalName === name)!.id;

	// Team 1 plays 4 games in S17, 2 in S18. Team 2 plays alongside them in
	// every game (so league-scoped denominators differ from team-scoped
	// ones) but only ever touches kalea, never the three heroes under test.
	const matches: Dataset['matches'] = [
		{ id: 1, seriesId: 'S17M1', season: '17', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 2, seriesId: 'S17M2', season: '17', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 3, seriesId: 'S17M3', season: '17', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 4, seriesId: 'S17M4', season: '17', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 5, seriesId: 'S18M1', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 6, seriesId: 'S18M2', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null }
	];

	const drafts: Dataset['drafts'] = [];
	let id = 1;
	const pick = (matchId: number, teamId: number, hero: string) =>
		drafts.push({ id: id++, matchId, teamId, slot: 1, heroId: heroId(hero), isBan: false });

	// Team 1, S17: freya in all 4 games, chou in 1 of 4.
	pick(1, 1, 'freya');
	pick(2, 1, 'freya');
	pick(3, 1, 'freya');
	pick(4, 1, 'freya');
	pick(1, 1, 'chou');
	// Team 1, S18: freya in 1 of 2, guinevere (new) in both.
	pick(5, 1, 'freya');
	pick(5, 1, 'guinevere');
	pick(6, 1, 'guinevere');
	// Team 2: kalea in every game, both seasons — never touches the other three heroes.
	for (const matchId of [1, 2, 3, 4, 5, 6]) pick(matchId, 2, 'kalea');

	return { teams, heroes, matches, drafts };
}

describe('presenceDelta', () => {
	it('computes before/after/delta per hero, filling 0 for a season a hero never appeared in, sorted by |delta| descending', () => {
		const data = seasonPresenceFixture();
		const deltas = presenceDelta(data, '17', '18', { teamId: 1 });
		expect(deltas.map((d) => d.hero)).toEqual(['guinevere', 'freya', 'chou']);

		expect(deltas[0]).toMatchObject({ before: 0, after: 1, delta: 1 }); // guinevere: new in S18
		expect(deltas[1].before).toBeCloseTo(1, 10); // freya: 4/4 in S17
		expect(deltas[1].after).toBeCloseTo(0.5, 10); // freya: 1/2 in S18
		expect(deltas[1].delta).toBeCloseTo(-0.5, 10);
		expect(deltas[2]).toMatchObject({ after: 0 }); // chou: absent from S18 entirely
		expect(deltas[2].before).toBeCloseTo(0.25, 10); // chou: 1/4 in S17
	});

	it('scopes to one team when teamId is given, and to the whole league when it is omitted', () => {
		const data = seasonPresenceFixture();
		const teamScoped = presenceDelta(data, '17', '18', { teamId: 1 });
		const leagueScoped = presenceDelta(data, '17', '18');
		const teamFreya = teamScoped.find((d) => d.hero === 'freya')!;
		const leagueFreya = leagueScoped.find((d) => d.hero === 'freya')!;
		expect(teamFreya.before).toBeCloseTo(1, 10); // 4 of team 1's own 4 games
		expect(leagueFreya.before).toBeCloseTo(0.5, 10); // 4 of 8 league team-instances (denominator doubles)
	});
});
```

Also add `presenceDelta` to the top-of-file import from `./metrics`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/metrics.spec.ts`
Expected: FAIL — `presenceDelta` is not exported / not defined.

- [ ] **Step 3: Write minimal implementation**

Append to `frontend/src/lib/metrics.ts`:

```ts
export interface PresenceDelta {
	hero: string;
	before: number;
	after: number;
	delta: number;
}

export function presenceDelta(
	data: Dataset,
	beforeSeason: string,
	afterSeason: string,
	opts: { teamId?: number } = {}
): PresenceDelta[] {
	const before = presence(data, { ...opts, season: beforeSeason });
	const after = presence(data, { ...opts, season: afterSeason });
	const heroes = new Set([...Object.keys(before), ...Object.keys(after)]);
	return [...heroes]
		.map((hero) => {
			const b = before[hero] ?? 0;
			const a = after[hero] ?? 0;
			return { hero, before: b, after: a, delta: a - b };
		})
		.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/metrics.spec.ts`
Expected: PASS, all `presenceDelta` cases green, and every pre-existing case in the file still green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/metrics.ts frontend/src/lib/metrics.spec.ts
git commit -m "feat: add presenceDelta season-over-season comparison"
```

---

## Task 2: Team page — S17 vs S18 section

**Files:**
- Modify: `frontend/src/routes/team/[slug]/+page.svelte`

**Interfaces:**
- Consumes: `hhi`, `presenceDelta` from `$lib/metrics` (the import line already has `hhi`; `presenceDelta` is new from Task 1).
- Produces: nothing new for later tasks.

No test file — matches the untested-page convention already established for this route. Verified in Task 4.

- [ ] **Step 1: Extend the metrics import and add the derived values**

In `frontend/src/routes/team/[slug]/+page.svelte`, change:

```svelte
	import { hhi, pickWinRateDelta, presence, rollingHhi } from '$lib/metrics';
```

to:

```svelte
	import { hhi, pickWinRateDelta, presence, presenceDelta, rollingHhi } from '$lib/metrics';
```

Add after the existing `banDeltas` line:

```svelte
	const teamHhiS17 = $derived(hhi(mockDataset, { teamId: team.id, season: '17' }));
	const teamHhiS18 = $derived(hhi(mockDataset, { teamId: team.id, season: '18' }));
	const s17Games = $derived(
		mockDataset.matches.filter(
			(m) => (m.team1Id === team.id || m.team2Id === team.id) && m.season === '17'
		).length
	);
	const s18Games = $derived(
		mockDataset.matches.filter(
			(m) => (m.team1Id === team.id || m.team2Id === team.id) && m.season === '18'
		).length
	);
	const seasonDeltas = $derived(presenceDelta(mockDataset, '17', '18', { teamId: team.id }));
```

- [ ] **Step 2: Add the section to the markup**

Insert this after the existing "Draft concentration, last 10 games" `<div>` block and before the `{#snippet deltaTable...}` block:

```svelte
	<div>
		<h2 class="mb-2 font-[Syne] text-lg">Season 17 vs Season 18, by hero</h2>
		<p class="mb-3 font-mono text-sm text-[#8a8478]">
			HHI: {teamHhiS17.toFixed(3)} ({s17Games} games) → {teamHhiS18.toFixed(3)} ({s18Games} games)
		</p>
		<table class="w-full border-collapse font-mono text-sm">
			<thead>
				<tr class="border-b border-[#3a352c] text-left text-[#8a8478]">
					<th class="px-3 py-2 font-normal">Hero</th>
					<th class="px-3 py-2 font-normal">S17</th>
					<th class="px-3 py-2 font-normal">S18</th>
					<th class="px-3 py-2 font-normal">Change</th>
				</tr>
			</thead>
			<tbody>
				{#each seasonDeltas as row (row.hero)}
					<tr class="border-b border-[#2a2620]">
						<td class="px-3 py-2">{row.hero}</td>
						<td class="px-3 py-2">{(row.before * 100).toFixed(1)}%</td>
						<td class="px-3 py-2">{(row.after * 100).toFixed(1)}%</td>
						<td class="px-3 py-2">{row.delta >= 0 ? '+' : ''}{(row.delta * 100).toFixed(1)}%</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
```

- [ ] **Step 3: Run the full test suite and typecheck**

Run: `cd frontend && npm run test && npm run check`
Expected: PASS on both — no test targets this page directly, this confirms nothing else regressed and the new markup/types are sound.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/routes/team/[slug]/+page.svelte"
git commit -m "feat: add Season 17 vs Season 18 panel to Team Scouting"
```

---

## Task 3: League page — S17 vs S18 section

**Files:**
- Modify: `frontend/src/routes/league/+page.svelte`

**Interfaces:**
- Consumes: `hhi`, `presenceDelta` from `$lib/metrics` (the import line already has `hhi`; `presenceDelta` is new from Task 1).
- Produces: nothing new for later tasks.

No test file — same reasoning as Task 2. Verified in Task 4.

- [ ] **Step 1: Extend the metrics import and add the derived values**

In `frontend/src/routes/league/+page.svelte`, change:

```svelte
	import { hhi, presence } from '$lib/metrics';
```

to:

```svelte
	import { hhi, presence, presenceDelta } from '$lib/metrics';
```

Add after the existing `rows` derivation:

```svelte
	const leagueHhiS17 = $derived(hhi(mockDataset, { season: '17' }));
	const leagueHhiS18 = $derived(hhi(mockDataset, { season: '18' }));
	const s17Games = $derived(mockDataset.matches.filter((m) => m.season === '17').length);
	const s18Games = $derived(mockDataset.matches.filter((m) => m.season === '18').length);
	const seasonDeltas = $derived(presenceDelta(mockDataset, '17', '18').slice(0, 15));
```

- [ ] **Step 2: Add the section to the markup**

Insert this after the existing "Meta-wide presence (top 10)" `<table>` and before the closing `</div>`:

```svelte
	<h2 class="pt-4 font-[Syne] text-lg">Season 17 vs Season 18, biggest swings</h2>
	<p class="mb-3 font-mono text-sm text-[#8a8478]">
		League HHI: {leagueHhiS17.toFixed(3)} ({s17Games} games) → {leagueHhiS18.toFixed(3)} ({s18Games} games)
	</p>
	<table class="w-full border-collapse font-mono text-sm">
		<thead>
			<tr class="border-b border-[#3a352c] text-left text-[#8a8478]">
				<th class="px-3 py-2 font-normal">Hero</th>
				<th class="px-3 py-2 font-normal">S17</th>
				<th class="px-3 py-2 font-normal">S18</th>
				<th class="px-3 py-2 font-normal">Change</th>
			</tr>
		</thead>
		<tbody>
			{#each seasonDeltas as row (row.hero)}
				<tr class="border-b border-[#2a2620]">
					<td class="px-3 py-2">{row.hero}</td>
					<td class="px-3 py-2">{(row.before * 100).toFixed(1)}%</td>
					<td class="px-3 py-2">{(row.after * 100).toFixed(1)}%</td>
					<td class="px-3 py-2">{row.delta >= 0 ? '+' : ''}{(row.delta * 100).toFixed(1)}%</td>
				</tr>
			{/each}
		</tbody>
	</table>
```

- [ ] **Step 3: Run the full test suite and typecheck**

Run: `cd frontend && npm run test && npm run check`
Expected: PASS on both.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/league/+page.svelte
git commit -m "feat: add Season 17 vs Season 18 panel to League Overview"
```

---

## Task 4: Manual browser verification and docs update

**Files:** `docs/current-context.md`, `docs/roadmap.md` — no other files touched.

- [ ] **Step 1: Start the dev server**

Run: `cd frontend && npm run dev` (background/separate terminal)

- [ ] **Step 2: Check `/team/[slug]`**

Open `/team/srg`. Confirm the new "Season 17 vs Season 18, by hero" section shows a real HHI comparison line with real game counts (S17 should be a large number like 60+, S18 a small number like 5-10 this early in the season) and a table of heroes with S17%, S18%, and a signed change column.

- [ ] **Step 3: Check `/league`**

Open `/league`. Confirm the new "Season 17 vs Season 18, biggest swings" section shows a league HHI comparison line and a 15-row table sorted by the size of the swing, both gainers and droppers present.

- [ ] **Step 4: Stop the dev server**

Kill the background `npm run dev` process.

- [ ] **Step 5: Update project docs**

Update `docs/current-context.md`'s "Where things stand" section and `docs/roadmap.md`'s "Next" checklist to mark this item done, following the same style as the existing done-items. Commit:

```bash
git add docs/current-context.md docs/roadmap.md
git commit -m "docs: reflect season trend views live"
```
