# Frontend Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All three v1 screens (Team Scouting, League Overview, Match Log) built and navigable, rendering against a seeded mock data module — per frontend.md's "mock-first build order," so the JSON shape the real pipeline must emit gets discovered by building the UI against it, not guessed up front. No real data, no JSON emission from Python in this plan.

**Architecture:** `frontend/` is a new SvelteKit 2 + Svelte 5 + Tailwind v4 project (`npx sv create`, already scaffolded and verified — see Task 1). `src/lib/mock/generator.ts` produces a seeded, deterministic `MockDataset` shaped exactly like `database.md`'s raw tables (teams/heroes/matches/drafts) — not pre-computed metric objects. `src/lib/mock/metrics.ts` is a line-for-line TypeScript mirror of `pipeline/src/mlbb_pipeline/metrics.py`'s `presence`/`hhi`/`pickRateByRole`/`hhiByRole`, operating on the mock rows in memory instead of SQL — this is what "removes ambiguity about whether HHI is picks-only or picks-plus-bans" (frontend.md) for whoever writes the real JSON-emit step later, because the two implementations must produce identical numbers on the same rows. Four shared components (`TeamTag`, `BaselineAnnotation`, `FreshnessIndicator`, `DataTable`) get built once and consumed by all three routes.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript, Tailwind v4 (`@tailwindcss/vite`, CSS-first `@theme`), Vitest 4 (`vitest-browser-svelte` for component tests against real headless Chromium, plain `vitest` for logic tests), `@sveltejs/adapter-static`.

**Spec:** `docs/frontend.md` (routes, data flow, mock-first order, components), `docs/uiux.md` (navigation, interaction patterns), `docs/design-direction-v1.md` + `design.md` (tokens, principles), `docs/database.md` (raw row shapes the mock must match), `pipeline/src/mlbb_pipeline/metrics.py` (formulas the mock metrics must mirror exactly)

## Global Constraints

- **No JSON emission or real data in this plan.** Every screen reads `src/lib/mock/data.ts`'s singleton `MockDataset`. Swapping to real emitted JSON is a separate, later plan (frontend.md).
- **Mock generates raw rows, never hardcoded metric objects** (frontend.md, explicit). `generateMockDataset()` returns `{teams, heroes, matches, drafts}`; every screen computes its own numbers via `mock/metrics.ts`, exactly like the real frontend will compute them from emitted JSON.
- **Mock formulas must match `pipeline/src/mlbb_pipeline/metrics.py` exactly**: presence = (picks+bans)/games (CLAUDE.md, literal), HHI = sum of squared **pick-only** shares, league scope (`teamId` omitted) doubles the game-count denominator (two team-instances per game). See that file's docstrings — this plan's `metrics.ts` re-derives the same values from the same reasoning, not a new design.
- **Design tokens are fixed, not invented here**: base `#1A1814`, accent `#C8A97E` (amber), display font Syne, body Inter, mono JetBrains Mono (design-direction-v1.md, design.md). The doc's "open question" (amber competing with team colors) is resolved per its own suggested direction: amber is used only for the baseline-annotation pattern and interactive/focus states; team-color swatches are the dashboard's primary color signal.
- **Team swatch colors are not specified anywhere and are this plan's own judgment call** (documented in Task 2, same pattern as `TEAM_SHORT_CODES` in `build.py`) — eight evenly-spaced hues avoiding amber's hue range so swatches never get confused with the baseline-annotation accent. Easy to swap later; not asserted as brand-accurate.
- **Team selector persists across views** (uiux.md) via a Svelte store synced to `localStorage`, with the `/team/[slug]` URL param as the source of truth when present.
- **Fully static, no server** (frontend.md, stack.md): `adapter-static`, `export const prerender = true` at the root layout (already added, Task 1), and the dynamic `/team/[slug]` route needs an `entries()` export listing all 8 team slugs so it prerenders at build time.
- Package manager: npm (already used for the scaffold's `--install npm`). Node v24, already verified working in this environment.

---

## File Structure

```
frontend/                          # already scaffolded (Task 1) — SvelteKit 2 + Svelte 5 + TS,
                                    # Tailwind v4, Vitest 4 (unit + browser-component), adapter-static
  src/
    routes/
      +layout.ts                   # export const prerender = true (done, Task 1)
      +layout.svelte                # nav shell + team selector (Task 7)
      layout.css                    # @import 'tailwindcss'; + @theme tokens (Task 2)
      +page.svelte                 # / — redirects to first team (Task 8)
      team/[slug]/+page.ts           # entries() for prerender (Task 8)
      team/[slug]/+page.svelte        # Team Scouting (Task 8)
      league/+page.svelte            # League Overview (Task 9)
      log/+page.svelte              # Match Log (Task 10)
    lib/
      types.ts                     # Team/Hero/MatchRow/DraftRow/MockDataset (Task 3)
      mock/
        rng.ts                      # seeded PRNG (Task 3)
        generator.ts                 # generateMockDataset() (Task 3)
        data.ts                     # singleton mock dataset (Task 3)
        metrics.ts                  # presence/hhi/pickRateByRole/hhiByRole (Task 4)
      teams.ts                      # TEAM_COLORS, TEAM_SHORT_CODES (Task 2)
      components/
        BaselineAnnotation.svelte     # (Task 5)
        TeamTag.svelte               # (Task 6)
        FreshnessIndicator.svelte      # (Task 6)
        DataTable.svelte             # (Task 6)
```

---

### Task 1: SvelteKit scaffold — DONE

Already executed and verified in this session:

```bash
npx sv create frontend --template minimal --types ts \
  --add vitest="usages:unit,component" tailwindcss="plugins:none" \
  sveltekit-adapter="adapter:static" prettier eslint \
  --install npm --no-dir-check
cd frontend && npx playwright install chromium   # needed for vitest-browser-svelte
```

Removed the generated example files (`src/lib/vitest-examples/`), reset `src/routes/+page.svelte` to a placeholder, and added `src/routes/+layout.ts` with `export const prerender = true` (`adapter-static` refuses to build otherwise — confirmed by running `npm run build` and reading its exact error before adding the fix). Verified: `npm run test` (2 example tests, since replaced) and `npm run build` both pass cleanly, producing a static `build/` directory.

No further action — later tasks build on this directly.

---

### Task 2: Tailwind tokens + team colors

**Files:**
- Modify: `frontend/src/routes/layout.css`
- Create: `frontend/src/lib/teams.ts`
- Test: `frontend/src/lib/teams.spec.ts`

**Interfaces:**
- Produces: Tailwind `@theme` tokens (`--color-charcoal`, `--color-amber`, `--font-display`, `--font-body`, `--font-mono`), `TEAM_SHORT_CODES: Record<string, string | null>`, `TEAM_COLORS: Record<string, string>` (canonical team name → hex) — used by `TeamTag.svelte` (Task 6) and any route rendering a team name.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/teams.spec.ts
import { describe, it, expect } from 'vitest';
import { TEAM_COLORS, TEAM_SHORT_CODES } from './teams';

const EIGHT_TEAMS = [
	'AC Esports',
	'Bigetron MY by VIT',
	'Invictus Gaming',
	'RRQ Tora',
	'Selangor Red Giants',
	'Team Flash',
	'Team Rey',
	'Team Vamos'
];

describe('teams', () => {
	it('has a color and a short-code entry for all eight teams', () => {
		for (const name of EIGHT_TEAMS) {
			expect(TEAM_COLORS[name]).toMatch(/^#[0-9a-f]{6}$/i);
			expect(name in TEAM_SHORT_CODES).toBe(true);
		}
	});

	it('every color is distinct', () => {
		const values = Object.values(TEAM_COLORS);
		expect(new Set(values).size).toBe(values.length);
	});

	it('matches the pipeline short codes exactly (build.py TEAM_SHORT_CODES)', () => {
		expect(TEAM_SHORT_CODES['Selangor Red Giants']).toBe('SRG');
		expect(TEAM_SHORT_CODES['RRQ Tora']).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:unit -- --run teams.spec`
Expected: FAIL — `Cannot find module './teams'`

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/lib/teams.ts
// Colors are this plan's own judgment call, not sourced from real team
// branding — eight evenly-spaced hues chosen to stay clear of amber's
// hue range (~35-45°) so a team swatch is never mistaken for the
// baseline-annotation accent (design-direction-v1.md's open question).
// Short codes copied from pipeline/src/mlbb_pipeline/build.py's
// TEAM_SHORT_CODES so both sides agree — RRQ Tora's is genuinely
// unknown (a documented cosmetic gap, not a bug).
export const TEAM_COLORS: Record<string, string> = {
	'AC Esports': '#e5484d',
	'Bigetron MY by VIT': '#12a594',
	'Invictus Gaming': '#3e63dd',
	'RRQ Tora': '#e93d82',
	'Selangor Red Giants': '#46a758',
	'Team Flash': '#6e56cf',
	'Team Rey': '#00a2c7',
	'Team Vamos': '#ab4aba'
};

export const TEAM_SHORT_CODES: Record<string, string | null> = {
	'AC Esports': 'AC',
	'Bigetron MY by VIT': 'BTRM',
	'Invictus Gaming': 'IG',
	'RRQ Tora': null,
	'Selangor Red Giants': 'SRG',
	'Team Flash': 'FL',
	'Team Rey': 'REY',
	'Team Vamos': 'VMS'
};
```

Replace `frontend/src/routes/layout.css`:

```css
@import 'tailwindcss';

@theme {
	--color-charcoal: #1a1814;
	--color-amber: #c8a97e;
	--font-display: 'Syne', sans-serif;
	--font-body: 'Inter', sans-serif;
	--font-mono: 'JetBrains Mono', monospace;
}

body {
	background-color: var(--color-charcoal);
	color: #e8e4dc;
	font-family: var(--font-body);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:unit -- --run teams.spec`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/teams.ts frontend/src/lib/teams.spec.ts frontend/src/routes/layout.css
git commit -m "feat(frontend): design tokens and team colors/short codes"
```

---

### Task 3: Mock types, seeded generator, singleton dataset

**Files:**
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/mock/rng.ts`
- Create: `frontend/src/lib/mock/generator.ts`
- Create: `frontend/src/lib/mock/data.ts`
- Test: `frontend/src/lib/mock/generator.spec.ts`

**Interfaces:**
- Produces: `Team`, `Hero`, `MatchRow`, `DraftRow`, `MockDataset` (types), `mulberry32(seed: number): () => number`, `generateMockDataset(seed?: number): MockDataset`, `mockDataset: MockDataset` (the singleton, `data.ts`) — used by `metrics.ts` (Task 4) and every route (Tasks 8-10).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/mock/generator.spec.ts
import { describe, it, expect } from 'vitest';
import { generateMockDataset } from './generator';

describe('generateMockDataset', () => {
	it('is deterministic for a given seed', () => {
		const a = generateMockDataset(1);
		const b = generateMockDataset(1);
		expect(a.matches.length).toBe(b.matches.length);
		expect(a.drafts).toEqual(b.drafts);
	});

	it('produces all eight teams', () => {
		const data = generateMockDataset(1);
		expect(data.teams.length).toBe(8);
	});

	it('every game has exactly 20 draft rows (10 picks + 10 bans)', () => {
		const data = generateMockDataset(1);
		for (const match of data.matches) {
			const rows = data.drafts.filter((d) => d.matchId === match.id);
			expect(rows.filter((r) => !r.isBan).length).toBe(10);
			expect(rows.filter((r) => r.isBan).length).toBe(10);
		}
	});

	it('no hero repeats within a single game', () => {
		const data = generateMockDataset(1);
		for (const match of data.matches) {
			const heroIds = data.drafts.filter((d) => d.matchId === match.id).map((d) => d.heroId);
			expect(new Set(heroIds).size).toBe(heroIds.length);
		}
	});

	it('shapes team 0 as high-HHI (predictable) and team 1 as low-HHI (flexible)', () => {
		const data = generateMockDataset(1);
		const distinctHeroesPicked = (teamId: number) =>
			new Set(
				data.drafts
					.filter((d) => d.teamId === teamId && !d.isBan)
					.map((d) => d.heroId)
			).size;
		// team 0 (AC Esports) draws from a 6-hero signature pool;
		// team 1 (Bigetron) draws from the full ~26-hero pool
		expect(distinctHeroesPicked(data.teams[0].id)).toBeLessThanOrEqual(6);
		expect(distinctHeroesPicked(data.teams[1].id)).toBeGreaterThan(10);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:unit -- --run generator.spec`
Expected: FAIL — `Cannot find module './generator'`

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/lib/types.ts
export type Stage = 'regular_season' | 'playoffs';

export interface Team {
	id: number;
	canonicalName: string;
	shortCode: string | null;
}

export interface Hero {
	id: number;
	canonicalName: string;
}

export interface MatchRow {
	id: number;
	seriesId: string;
	season: string;
	stage: Stage;
	team1Id: number;
	team2Id: number;
	team1Side: 'blue' | 'red';
	winnerId: number;
	gameLength: string;
	gameNumberInSeries: number;
	playedAt: string | null;
}

export interface DraftRow {
	id: number;
	matchId: number;
	teamId: number;
	slot: number; // role (1=EXP..5=Roam) for picks, ban order for bans — database.md
	heroId: number;
	isBan: boolean;
}

export interface MockDataset {
	teams: Team[];
	heroes: Hero[];
	matches: MatchRow[];
	drafts: DraftRow[];
}
```

```ts
// frontend/src/lib/mock/rng.ts
// mulberry32 — small, fast, seedable PRNG. Deterministic output for a
// given seed is the whole point (frontend.md: "seeded, so numbers are
// stable between reloads").
export function mulberry32(seed: number): () => number {
	let a = seed;
	return function () {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
```

```ts
// frontend/src/lib/mock/generator.ts
import { TEAM_COLORS, TEAM_SHORT_CODES } from '../teams';
import type { DraftRow, Hero, MatchRow, MockDataset, Stage, Team } from '../types';
import { mulberry32 } from './rng';

const HERO_POOL = [
	'guinevere', 'freya', 'phoveus', 'harith', 'khaleed', 'leomord', 'yve', 'zhuxin',
	'granger', 'chou', 'sora', 'baxia', 'valentina', 'kalea', 'suyou', 'harley',
	'marcel', 'fanny', 'gloo', 'claude', 'lylia', 'selena', 'karrie', 'atlas',
	'esmeralda', 'fredrinn'
];

// Team 0's signature pool — deliberately small, so its HHI reads high
// and "predictable" (frontend.md's shaping requirement).
const PREDICTABLE_TEAM_POOL = HERO_POOL.slice(0, 6);

// The hero every team leans on banning regardless of who they're
// playing — demonstrates planning.md's core example directly: a raw
// per-team ban rate for this hero looks alarming until the league
// baseline shows everyone does it.
const UNIVERSALLY_BANNED_HERO = 'fanny';

function draw(rng: () => number, preferred: string[], used: Set<string>): string {
	const candidates = preferred.filter((h) => !used.has(h));
	const pool = candidates.length > 0 ? candidates : HERO_POOL.filter((h) => !used.has(h));
	const hero = pool[Math.floor(rng() * pool.length)];
	used.add(hero);
	return hero;
}

function teamPool(teamIndex: number): string[] {
	if (teamIndex === 0) return PREDICTABLE_TEAM_POOL; // predictable/high-HHI
	if (teamIndex === 1) return HERO_POOL; // flexible/low-HHI
	// every other team gets a fixed 10-hero slice of the pool, rotated
	// by team index, so each has its own moderate, distinct tendency
	const start = (teamIndex * 3) % HERO_POOL.length;
	return [...HERO_POOL.slice(start), ...HERO_POOL.slice(0, start)].slice(0, 10);
}

function generateGame(
	rng: () => number,
	heroIndex: Map<string, number>,
	team1Idx: number,
	team2Idx: number
): { picks: [number, number][]; bans: [number, number][] } {
	// [teamSlot, heroId][] — teamSlot 1 or 2, matching database.md
	const used = new Set<string>();
	const picks: [number, number][] = [];
	const bans: [number, number][] = [];

	// Picks are drawn before bans, deliberately not mirroring real draft
	// phase order (bans-then-picks), so a team's small signature pool
	// (the "predictable" shaping) is never crowded out by an unrelated
	// ban drawn from the full pool first. This is a mock-generation
	// detail, not a claim about real draft order (data-source.md: order
	// isn't even recorded).
	for (const [slot, teamIdx] of [
		[1, team1Idx],
		[2, team2Idx]
	] as const) {
		const pool = teamPool(teamIdx);
		for (let i = 0; i < 5; i++) {
			picks.push([slot, heroIndex.get(draw(rng, pool, used))!]);
		}
	}

	// Universal fanny-ban tendency: one side or the other bans her
	// first, 85% of the time (if she wasn't already picked this game).
	if (!used.has(UNIVERSALLY_BANNED_HERO) && rng() < 0.85) {
		const banningSlot = rng() < 0.5 ? 1 : 2;
		used.add(UNIVERSALLY_BANNED_HERO);
		bans.push([banningSlot, heroIndex.get(UNIVERSALLY_BANNED_HERO)!]);
	}

	// Remaining bans draw from the full pool, never a team's signature
	// pick pool — a "predictable" team's bans aren't what make it
	// predictable, its picks are.
	for (const [slot] of [[1], [2]] as const) {
		while (bans.filter(([s]) => s === slot).length < 5) {
			bans.push([slot, heroIndex.get(draw(rng, HERO_POOL, used))!]);
		}
	}

	return { picks, bans };
}

export function generateMockDataset(seed = 1): MockDataset {
	const rng = mulberry32(seed);

	const teams: Team[] = Object.keys(TEAM_COLORS).map((name, i) => ({
		id: i + 1,
		canonicalName: name,
		shortCode: TEAM_SHORT_CODES[name]
	}));
	const heroes: Hero[] = HERO_POOL.map((name, i) => ({ id: i + 1, canonicalName: name }));
	const heroIndex = new Map(heroes.map((h) => [h.canonicalName, h.id]));

	const matches: MatchRow[] = [];
	const drafts: DraftRow[] = [];
	let matchId = 1;
	let draftId = 1;

	const seasons: { season: string; stage: Stage; gamesPerPair: number }[] = [
		{ season: '17', stage: 'regular_season', gamesPerPair: 1 },
		{ season: '18', stage: 'regular_season', gamesPerPair: 1 }
	];

	for (const { season, stage, gamesPerPair } of seasons) {
		for (let i = 0; i < teams.length; i++) {
			for (let j = i + 1; j < teams.length; j++) {
				for (let g = 0; g < gamesPerPair; g++) {
					const { picks, bans } = generateGame(rng, heroIndex, i, j);
					const winnerSlot = rng() < 0.5 ? 1 : 2;
					const match: MatchRow = {
						id: matchId++,
						seriesId: `MOCK${season}_${teams[i].shortCode ?? i}${teams[j].shortCode ?? j}_${g}`,
						season,
						stage,
						team1Id: teams[i].id,
						team2Id: teams[j].id,
						team1Side: rng() < 0.5 ? 'blue' : 'red',
						winnerId: winnerSlot === 1 ? teams[i].id : teams[j].id,
						gameLength: `${10 + Math.floor(rng() * 10)}:${String(Math.floor(rng() * 60)).padStart(2, '0')}`,
						gameNumberInSeries: 1,
						playedAt: null
					};
					matches.push(match);

					const slotToTeamId = (slot: number) => (slot === 1 ? teams[i].id : teams[j].id);
					const roleCounters = new Map<number, number>();
					const banCounters = new Map<number, number>();
					for (const [slot, heroId] of picks) {
						const role = (roleCounters.get(slot) ?? 0) + 1;
						roleCounters.set(slot, role);
						drafts.push({
							id: draftId++,
							matchId: match.id,
							teamId: slotToTeamId(slot),
							slot: role,
							heroId,
							isBan: false
						});
					}
					for (const [slot, heroId] of bans) {
						const order = (banCounters.get(slot) ?? 0) + 1;
						banCounters.set(slot, order);
						drafts.push({
							id: draftId++,
							matchId: match.id,
							teamId: slotToTeamId(slot),
							slot: order,
							heroId,
							isBan: true
						});
					}
				}
			}
		}
	}

	return { teams, heroes, matches, drafts };
}
```

```ts
// frontend/src/lib/mock/data.ts
import { generateMockDataset } from './generator';

export const mockDataset = generateMockDataset(1);
export const generatedAt = new Date('2026-08-17T00:00:00Z').toISOString();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:unit -- --run generator.spec`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/mock/rng.ts frontend/src/lib/mock/generator.ts frontend/src/lib/mock/generator.spec.ts frontend/src/lib/mock/data.ts
git commit -m "feat(frontend): seeded mock data generator matching database.md's row shapes"
```

---

### Task 4: Mock metrics — mirrors pipeline/metrics.py

**Files:**
- Create: `frontend/src/lib/mock/metrics.ts`
- Test: `frontend/src/lib/mock/metrics.spec.ts`

**Interfaces:**
- Consumes: `MockDataset`, `MatchRow`, `DraftRow` (Task 3).
- Produces: `presence(data, opts?) -> Record<string, number>`, `pickRateByRole(data, role, opts?) -> Record<string, number>`, `hhi(data, opts?) -> number`, `hhiByRole(data, role, opts?) -> number`, where `opts = {teamId?: number; season?: string}` — used by every route (Tasks 8-10).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/mock/metrics.spec.ts
import { describe, it, expect } from 'vitest';
import { hhi, hhiByRole, pickRateByRole, presence } from './metrics';
import type { MockDataset } from '../types';

// Same two-game fixture as pipeline/tests/test_metrics.py, translated —
// hand-computed expected values must match the Python side exactly.
function fixture(): MockDataset {
	const teams = [
		{ id: 1, canonicalName: 'Selangor Red Giants', shortCode: 'SRG' },
		{ id: 2, canonicalName: 'Team Vamos', shortCode: 'VMS' }
	];
	const heroNames = [
		'sora', 'guinevere', 'zhuxin', 'granger', 'chou', 'lylia', 'selena', 'karrie',
		'atlas', 'phoveus', 'leomord', 'yve', 'harith', 'khaleed', 'baxia', 'valentina',
		'kalea', 'suyou', 'harley', 'freya', 'marcel', 'fanny', 'gloo', 'claude'
	];
	const heroes = heroNames.map((canonicalName, i) => ({ id: i + 1, canonicalName }));
	const heroId = (name: string) => heroes.find((h) => h.canonicalName === name)!.id;

	const matches = [
		{ id: 1, seriesId: 'M1', season: '17', stage: 'regular_season' as const, team1Id: 1, team2Id: 2, team1Side: 'blue' as const, winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 2, seriesId: 'M1', season: '17', stage: 'regular_season' as const, team1Id: 1, team2Id: 2, team1Side: 'red' as const, winnerId: 2, gameLength: '12:00', gameNumberInSeries: 2, playedAt: null }
	];

	const drafts: MockDataset['drafts'] = [];
	let id = 1;
	const addPicks = (matchId: number, teamId: number, names: string[]) =>
		names.forEach((name, i) =>
			drafts.push({ id: id++, matchId, teamId, slot: i + 1, heroId: heroId(name), isBan: false })
		);
	const addBans = (matchId: number, teamId: number, names: string[]) =>
		names.forEach((name, i) =>
			drafts.push({ id: id++, matchId, teamId, slot: i + 1, heroId: heroId(name), isBan: true })
		);

	addPicks(1, 1, ['sora', 'guinevere', 'zhuxin', 'granger', 'chou']);
	addPicks(1, 2, ['phoveus', 'leomord', 'yve', 'harith', 'khaleed']);
	addBans(1, 1, ['baxia', 'valentina', 'kalea', 'suyou', 'harley']);
	addBans(1, 2, ['freya', 'marcel', 'fanny', 'gloo', 'claude']);

	addPicks(2, 1, ['guinevere', 'lylia', 'selena', 'karrie', 'atlas']);
	addPicks(2, 2, ['harith', 'leomord', 'yve', 'phoveus', 'khaleed']);
	addBans(2, 1, ['baxia', 'valentina', 'kalea', 'suyou', 'harley']);
	addBans(2, 2, ['freya', 'marcel', 'fanny', 'gloo', 'claude']);

	return { teams, heroes, matches, drafts };
}

describe('presence', () => {
	it('is picks+bans over games played, per team', () => {
		const data = fixture();
		const rates = presence(data, { teamId: 1 });
		expect(rates['guinevere']).toBe(1.0);
		expect(rates['baxia']).toBe(1.0);
		expect(rates['zhuxin']).toBe(0.5);
	});

	it('league scope doubles the denominator', () => {
		const data = fixture();
		const rates = presence(data);
		expect(rates['baxia']).toBe(0.5);
	});
});

describe('hhi', () => {
	it('is sum of squared pick shares, picks only', () => {
		const data = fixture();
		const expected = (2 / 10) ** 2 + 8 * (1 / 10) ** 2;
		expect(hhi(data, { teamId: 1 })).toBeCloseTo(expected, 10);
	});
});

describe('hhiByRole', () => {
	it('scopes to one slot only', () => {
		const data = fixture();
		expect(hhiByRole(data, 2, { teamId: 1 })).toBeCloseTo(0.5, 10);
	});
});

describe('pickRateByRole', () => {
	it('matches only that slot', () => {
		const data = fixture();
		const slot1 = pickRateByRole(data, 1, { teamId: 1 });
		expect(slot1['sora']).toBe(0.5);
		expect(slot1['guinevere']).toBe(0.5);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:unit -- --run mock/metrics.spec`
Expected: FAIL — `Cannot find module './metrics'`

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/lib/mock/metrics.ts
// Mirrors pipeline/src/mlbb_pipeline/metrics.py exactly. Same formulas,
// same league-scope doubling — see that file's docstrings for why.
import type { DraftRow, MatchRow, MockDataset } from '../types';

export interface ScopeOptions {
	teamId?: number;
	season?: string;
}

function scopedMatches(data: MockDataset, opts: ScopeOptions): MatchRow[] {
	return data.matches.filter((m) => {
		if (opts.season !== undefined && m.season !== opts.season) return false;
		if (opts.teamId !== undefined && m.team1Id !== opts.teamId && m.team2Id !== opts.teamId)
			return false;
		return true;
	});
}

function instanceCount(data: MockDataset, opts: ScopeOptions): number {
	const matches = scopedMatches(data, opts);
	return opts.teamId !== undefined ? matches.length : matches.length * 2;
}

function scopedDrafts(
	data: MockDataset,
	opts: ScopeOptions & { picksOnly?: boolean; role?: number }
): DraftRow[] {
	const matchIds = new Set(scopedMatches(data, opts).map((m) => m.id));
	return data.drafts.filter((d) => {
		if (!matchIds.has(d.matchId)) return false;
		if (opts.teamId !== undefined && d.teamId !== opts.teamId) return false;
		if (opts.picksOnly && d.isBan) return false;
		if (opts.role !== undefined && d.slot !== opts.role) return false;
		return true;
	});
}

function countByHero(data: MockDataset, drafts: DraftRow[]): Record<string, number> {
	const heroName = new Map(data.heroes.map((h) => [h.id, h.canonicalName]));
	const counts: Record<string, number> = {};
	for (const d of drafts) {
		const name = heroName.get(d.heroId)!;
		counts[name] = (counts[name] ?? 0) + 1;
	}
	return counts;
}

export function presence(data: MockDataset, opts: ScopeOptions = {}): Record<string, number> {
	const denominator = instanceCount(data, opts);
	if (denominator === 0) return {};
	const counts = countByHero(data, scopedDrafts(data, opts));
	return Object.fromEntries(Object.entries(counts).map(([h, c]) => [h, c / denominator]));
}

export function pickRateByRole(
	data: MockDataset,
	role: number,
	opts: ScopeOptions = {}
): Record<string, number> {
	const denominator = instanceCount(data, opts);
	if (denominator === 0) return {};
	const counts = countByHero(data, scopedDrafts(data, { ...opts, picksOnly: true, role }));
	return Object.fromEntries(Object.entries(counts).map(([h, c]) => [h, c / denominator]));
}

function hhiFromCounts(counts: Record<string, number>): number {
	const total = Object.values(counts).reduce((a, b) => a + b, 0);
	if (total === 0) return 0;
	return Object.values(counts).reduce((sum, c) => sum + (c / total) ** 2, 0);
}

export function hhi(data: MockDataset, opts: ScopeOptions = {}): number {
	return hhiFromCounts(countByHero(data, scopedDrafts(data, { ...opts, picksOnly: true })));
}

export function hhiByRole(data: MockDataset, role: number, opts: ScopeOptions = {}): number {
	return hhiFromCounts(
		countByHero(data, scopedDrafts(data, { ...opts, picksOnly: true, role }))
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:unit -- --run mock/metrics.spec`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/mock/metrics.ts frontend/src/lib/mock/metrics.spec.ts
git commit -m "feat(frontend): mock metrics mirroring pipeline/metrics.py exactly"
```

---

### Task 5: `BaselineAnnotation` component

**Files:**
- Create: `frontend/src/lib/components/BaselineAnnotation.svelte`
- Test: `frontend/src/lib/components/BaselineAnnotation.svelte.spec.ts`

**Interfaces:**
- Produces: `<BaselineAnnotation value={number} baseline={number} format?={(n:number)=>string} />` — used by all three routes (Tasks 8-10). This is "the single most important UI pattern in the whole tool" (design-direction-v1.md) — raw value in mono, league baseline as a smaller muted secondary value.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/components/BaselineAnnotation.svelte.spec.ts
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BaselineAnnotation from './BaselineAnnotation.svelte';

describe('BaselineAnnotation', () => {
	it('shows the raw value and the league baseline together', async () => {
		render(BaselineAnnotation, { value: 0.78, baseline: 0.847 });

		await expect.element(page.getByText('78.0%')).toBeInTheDocument();
		await expect.element(page.getByText(/baseline/i)).toBeInTheDocument();
		await expect.element(page.getByText('84.7%')).toBeInTheDocument();
	});

	it('accepts a custom formatter', async () => {
		render(BaselineAnnotation, { value: 0.12, baseline: 0.2, format: (n: number) => n.toFixed(3) });

		await expect.element(page.getByText('0.120')).toBeInTheDocument();
		await expect.element(page.getByText('0.200')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:unit -- --run BaselineAnnotation`
Expected: FAIL — cannot find `./BaselineAnnotation.svelte`

- [ ] **Step 3: Write minimal implementation**

```svelte
<!-- frontend/src/lib/components/BaselineAnnotation.svelte -->
<script lang="ts">
	interface Props {
		value: number;
		baseline: number;
		format?: (n: number) => string;
	}

	const defaultFormat = (n: number) => `${(n * 100).toFixed(1)}%`;
	let { value, baseline, format = defaultFormat }: Props = $props();
</script>

<span class="inline-flex items-baseline gap-2 font-mono">
	<span class="text-base text-[#e8e4dc]">{format(value)}</span>
	<span class="text-xs text-[#8a8478]">baseline {format(baseline)}</span>
</span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:unit -- --run BaselineAnnotation`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/components/BaselineAnnotation.svelte frontend/src/lib/components/BaselineAnnotation.svelte.spec.ts
git commit -m "feat(frontend): BaselineAnnotation, the tool's core UI pattern"
```

---

### Task 6: `TeamTag`, `FreshnessIndicator`, `DataTable`

**Files:**
- Create: `frontend/src/lib/components/TeamTag.svelte`
- Create: `frontend/src/lib/components/FreshnessIndicator.svelte`
- Create: `frontend/src/lib/components/DataTable.svelte`
- Test: `frontend/src/lib/components/TeamTag.svelte.spec.ts`
- Test: `frontend/src/lib/components/FreshnessIndicator.svelte.spec.ts`
- Test: `frontend/src/lib/components/DataTable.svelte.spec.ts`

**Interfaces:**
- Produces: `<TeamTag name={string} />`, `<FreshnessIndicator generatedAt={string} />`, `<DataTable columns={{key,label}[]} rows={Record<string,unknown>[]} />` — used by all three routes (Tasks 8-10).

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/lib/components/TeamTag.svelte.spec.ts
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TeamTag from './TeamTag.svelte';

describe('TeamTag', () => {
	it('shows the short code and a color swatch', async () => {
		render(TeamTag, { name: 'Selangor Red Giants' });
		await expect.element(page.getByText('SRG')).toBeInTheDocument();
	});

	it('falls back to the full name when no short code exists', async () => {
		render(TeamTag, { name: 'RRQ Tora' });
		await expect.element(page.getByText('RRQ Tora')).toBeInTheDocument();
	});
});
```

```ts
// frontend/src/lib/components/FreshnessIndicator.svelte.spec.ts
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FreshnessIndicator from './FreshnessIndicator.svelte';

describe('FreshnessIndicator', () => {
	it('shows a last-updated label', async () => {
		render(FreshnessIndicator, { generatedAt: '2026-08-17T00:00:00Z' });
		await expect.element(page.getByText(/updated/i)).toBeInTheDocument();
	});
});
```

```ts
// frontend/src/lib/components/DataTable.svelte.spec.ts
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DataTable from './DataTable.svelte';

describe('DataTable', () => {
	it('renders a header per column and a row per data item', async () => {
		render(DataTable, {
			columns: [
				{ key: 'hero', label: 'Hero' },
				{ key: 'rate', label: 'Presence' }
			],
			rows: [
				{ hero: 'guinevere', rate: '45%' },
				{ hero: 'freya', rate: '49%' }
			]
		});
		await expect.element(page.getByRole('columnheader', { name: 'Hero' })).toBeInTheDocument();
		await expect.element(page.getByText('guinevere')).toBeInTheDocument();
		await expect.element(page.getByText('freya')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test:unit -- --run components/`
Expected: FAIL — none of the three components exist yet

- [ ] **Step 3: Write minimal implementation**

```svelte
<!-- frontend/src/lib/components/TeamTag.svelte -->
<script lang="ts">
	import { TEAM_COLORS, TEAM_SHORT_CODES } from '../teams';

	interface Props {
		name: string;
	}
	let { name }: Props = $props();
	const color = $derived(TEAM_COLORS[name] ?? '#8a8478');
	const label = $derived(TEAM_SHORT_CODES[name] ?? name);
</script>

<span class="inline-flex items-center gap-1.5 font-mono text-sm">
	<span class="inline-block h-2.5 w-2.5 rounded-full" style:background-color={color}></span>
	{label}
</span>
```

```svelte
<!-- frontend/src/lib/components/FreshnessIndicator.svelte -->
<script lang="ts">
	interface Props {
		generatedAt: string;
	}
	let { generatedAt }: Props = $props();
	const formatted = $derived(new Date(generatedAt).toLocaleString());
</script>

<span class="text-xs text-[#8a8478]">Updated {formatted}</span>
```

```svelte
<!-- frontend/src/lib/components/DataTable.svelte -->
<script lang="ts">
	interface Column {
		key: string;
		label: string;
	}
	interface Props {
		columns: Column[];
		rows: Record<string, unknown>[];
	}
	let { columns, rows }: Props = $props();
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
				{#each columns as col (col.key)}
					<td class="px-3 py-2">{row[col.key]}</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test:unit -- --run components/`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/components/TeamTag.svelte frontend/src/lib/components/FreshnessIndicator.svelte frontend/src/lib/components/DataTable.svelte frontend/src/lib/components/*.spec.ts
git commit -m "feat(frontend): TeamTag, FreshnessIndicator, DataTable"
```

---

### Task 7: Root layout — nav shell + persisted team selector

**Files:**
- Create: `frontend/src/lib/teamSelection.ts`
- Modify: `frontend/src/routes/+layout.svelte`

**Interfaces:**
- Produces: `selectedTeam` (a Svelte store backed by `localStorage`, `teamSelection.ts`) — used by Task 8's `/` redirect and the nav shell.

- [ ] **Step 1: Implement the store**

```ts
// frontend/src/lib/teamSelection.ts
// Team selector persists across views (uiux.md) — localStorage is the
// source of truth when no route param overrides it.
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'mlbb-analytics:selected-team';

function createSelectedTeam() {
	const initial = browser ? (localStorage.getItem(STORAGE_KEY) ?? 'srg') : 'srg';
	const { subscribe, set } = writable(initial);
	return {
		subscribe,
		set(slug: string) {
			if (browser) localStorage.setItem(STORAGE_KEY, slug);
			set(slug);
		}
	};
}

export const selectedTeam = createSelectedTeam();
```

- [ ] **Step 2: Build the nav shell**

```svelte
<!-- frontend/src/routes/+layout.svelte -->
<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { selectedTeam } from '$lib/teamSelection';

	let { children } = $props();

	const navLinks = [
		{ href: `/team/${$selectedTeam}`, label: 'Team Scouting' },
		{ href: '/league', label: 'League Overview' },
		{ href: '/log', label: 'Match Log' }
	];
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<header class="mb-8 flex items-center justify-between border-b border-[#3a352c] pb-4">
		<span class="font-[Syne] text-lg tracking-wide text-[#e8e4dc]">MLBB Analytics</span>
		<nav class="flex gap-6 text-sm">
			{#each navLinks as link (link.href)}
				<a
					href={link.href}
					class="text-[#8a8478] transition-colors hover:text-[--color-amber]"
					class:text-[--color-amber]={page.url.pathname === link.href}
				>
					{link.label}
				</a>
			{/each}
		</nav>
	</header>
	{@render children()}
</div>
```

- [ ] **Step 3: Verify manually**

Run: `cd frontend && npm run dev` and open the printed local URL. Expect the nav shell to render with three links and the charcoal/amber theme applied (no route content behind it yet — Tasks 8-10 add that). Stop the dev server after checking (Ctrl-C).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/teamSelection.ts frontend/src/routes/+layout.svelte
git commit -m "feat(frontend): nav shell and persisted team selector"
```

---

### Task 8: Team Scouting (`/` and `/team/[slug]`)

**Files:**
- Create: `frontend/src/routes/team/[slug]/+page.ts`
- Create: `frontend/src/routes/team/[slug]/+page.svelte`
- Modify: `frontend/src/routes/+page.svelte`

**Interfaces:**
- Consumes: `mockDataset`, `generatedAt` (Task 3), `presence`/`hhi`/`pickRateByRole`/`hhiByRole` (Task 4), `TeamTag`/`BaselineAnnotation`/`DataTable`/`FreshnessIndicator` (Tasks 5-6), `selectedTeam` (Task 7).

- [ ] **Step 1: Slug helpers and prerender entries**

```ts
// frontend/src/routes/team/[slug]/+page.ts
import { error } from '@sveltejs/kit';
import { mockDataset } from '$lib/mock/data';
import { TEAM_SHORT_CODES } from '$lib/teams';

export const prerender = true;

function slugFor(teamName: string): string {
	return (TEAM_SHORT_CODES[teamName] ?? teamName).toLowerCase().replace(/\s+/g, '-');
}

export function entries() {
	return mockDataset.teams.map((t) => ({ slug: slugFor(t.canonicalName) }));
}

export function load({ params }: { params: { slug: string } }) {
	const team = mockDataset.teams.find((t) => slugFor(t.canonicalName) === params.slug);
	if (!team) throw error(404, `Unknown team slug: ${params.slug}`);
	return { team };
}
```

- [ ] **Step 2: Team Scouting page**

`DataTable` (Task 6) only renders plain cell values, so this screen — which needs a `BaselineAnnotation` component inside each presence cell — hand-rolls its own table instead of using `DataTable`. `DataTable` stays reserved for Match Log (Task 10), where every cell is plain text.

```svelte
<!-- frontend/src/routes/team/[slug]/+page.svelte -->
<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/mock/data';
	import { hhi, presence } from '$lib/mock/metrics';
	import BaselineAnnotation from '$lib/components/BaselineAnnotation.svelte';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';
	import { selectedTeam } from '$lib/teamSelection';
	import { page } from '$app/state';

	let { data } = $props();
	const team = $derived(data.team);

	$effect(() => {
		selectedTeam.set(page.params.slug!);
	});

	const teamPresence = $derived(presence(mockDataset, { teamId: team.id }));
	const leaguePresence = $derived(presence(mockDataset));
	const teamHhi = $derived(hhi(mockDataset, { teamId: team.id }));
	const leagueHhi = $derived(hhi(mockDataset));

	const rows = $derived(
		Object.entries(teamPresence)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 15)
			.map(([hero, rate]) => ({ hero, value: rate, baseline: leaguePresence[hero] ?? 0 }))
	);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="flex items-center gap-3 font-[Syne] text-2xl">
			<TeamTag name={team.canonicalName} />
			{team.canonicalName}
		</h1>
		<FreshnessIndicator {generatedAt} />
	</div>

	<div class="font-mono text-sm text-[#8a8478]">
		Team HHI: <BaselineAnnotation value={teamHhi} baseline={leagueHhi} format={(n) => n.toFixed(3)} />
	</div>

	<table class="w-full border-collapse font-mono text-sm">
		<thead>
			<tr class="border-b border-[#3a352c] text-left text-[#8a8478]">
				<th class="px-3 py-2 font-normal">Hero</th>
				<th class="px-3 py-2 font-normal">Presence (vs. baseline)</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.hero)}
				<tr class="border-b border-[#2a2620]">
					<td class="px-3 py-2">{row.hero}</td>
					<td class="px-3 py-2">
						<BaselineAnnotation value={row.value} baseline={row.baseline} />
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
```

- [ ] **Step 3: Landing page redirects to the persisted team**

```svelte
<!-- frontend/src/routes/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { selectedTeam } from '$lib/teamSelection';
	import { onMount } from 'svelte';

	onMount(() => {
		goto(`/team/${$selectedTeam}`);
	});
</script>

<p class="font-mono text-sm text-[#8a8478]">Loading…</p>
```

- [ ] **Step 4: Verify manually**

Run: `cd frontend && npm run build && npm run preview`, open the printed URL, confirm `/` redirects to `/team/srg`, the page shows SRG's presence table with baseline-annotated values, and `/team/rrq-tora` also resolves (tests the null-short-code slug path). Stop the preview server after checking.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/team frontend/src/routes/+page.svelte
git commit -m "feat(frontend): Team Scouting screen"
```

---

### Task 9: League Overview (`/league`)

**Files:**
- Create: `frontend/src/routes/league/+page.svelte`

**Interfaces:**
- Consumes: same as Task 8.

- [ ] **Step 1: Build the page**

```svelte
<!-- frontend/src/routes/league/+page.svelte -->
<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/mock/data';
	import { hhi, presence } from '$lib/mock/metrics';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';

	const leaguePresence = $derived(presence(mockDataset));
	const leagueHhiValue = $derived(hhi(mockDataset));

	const rows = $derived(
		mockDataset.teams
			.map((team) => ({ team, teamHhi: hhi(mockDataset, { teamId: team.id }) }))
			.sort((a, b) => b.teamHhi - a.teamHhi)
	);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="font-[Syne] text-2xl">League Overview</h1>
		<FreshnessIndicator {generatedAt} />
	</div>

	<p class="font-mono text-sm text-[#8a8478]">
		League baseline HHI: {leagueHhiValue.toFixed(3)}
	</p>

	<table class="w-full border-collapse font-mono text-sm">
		<thead>
			<tr class="border-b border-[#3a352c] text-left text-[#8a8478]">
				<th class="px-3 py-2 font-normal">Team</th>
				<th class="px-3 py-2 font-normal">HHI (draft concentration)</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.team.id)}
				<tr class="border-b border-[#2a2620]">
					<td class="px-3 py-2"><TeamTag name={row.team.canonicalName} /></td>
					<td class="px-3 py-2">{row.teamHhi.toFixed(3)}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<h2 class="pt-4 font-[Syne] text-lg">Meta-wide presence (top 10)</h2>
	<table class="w-full border-collapse font-mono text-sm">
		<thead>
			<tr class="border-b border-[#3a352c] text-left text-[#8a8478]">
				<th class="px-3 py-2 font-normal">Hero</th>
				<th class="px-3 py-2 font-normal">League presence</th>
			</tr>
		</thead>
		<tbody>
			{#each Object.entries(leaguePresence)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 10) as [hero, rate] (hero)}
				<tr class="border-b border-[#2a2620]">
					<td class="px-3 py-2">{hero}</td>
					<td class="px-3 py-2">{(rate * 100).toFixed(1)}%</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
```

- [ ] **Step 2: Verify manually**

Run: `cd frontend && npm run build && npm run preview`, open `/league`, confirm the team-HHI table is sorted descending and the presence table shows freya near the top (Task 3's mock deliberately makes fanny the universally-banned outlier — the visible pattern this screen exists to surface).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/league
git commit -m "feat(frontend): League Overview screen"
```

---

### Task 10: Match Log (`/log`)

**Files:**
- Create: `frontend/src/routes/log/+page.svelte`

**Interfaces:**
- Consumes: `mockDataset` (Task 3), `DataTable`, `TeamTag`, `FreshnessIndicator` (Tasks 5-6).

- [ ] **Step 1: Build the page**

```svelte
<!-- frontend/src/routes/log/+page.svelte -->
<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/mock/data';
	import DataTable from '$lib/components/DataTable.svelte';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';

	let teamFilter = $state('all');
	let stageFilter = $state<'all' | 'regular_season' | 'playoffs'>('all');

	const teamName = new Map(mockDataset.teams.map((t) => [t.id, t.canonicalName]));

	const rows = $derived(
		mockDataset.matches
			.filter((m) => teamFilter === 'all' || m.team1Id === Number(teamFilter) || m.team2Id === Number(teamFilter))
			.filter((m) => stageFilter === 'all' || m.stage === stageFilter)
			.map((m) => ({
				series: m.seriesId,
				season: m.season,
				stage: m.stage,
				team1: teamName.get(m.team1Id),
				team2: teamName.get(m.team2Id),
				winner: teamName.get(m.winnerId),
				length: m.gameLength
			}))
	);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="font-[Syne] text-2xl">Match Log</h1>
		<FreshnessIndicator {generatedAt} />
	</div>

	<div class="flex gap-4 font-mono text-sm">
		<label>
			Team:
			<select bind:value={teamFilter} class="ml-1 bg-transparent text-[--color-amber]">
				<option value="all">All</option>
				{#each mockDataset.teams as team (team.id)}
					<option value={String(team.id)}>{team.canonicalName}</option>
				{/each}
			</select>
		</label>
		<label>
			Stage:
			<select bind:value={stageFilter} class="ml-1 bg-transparent text-[--color-amber]">
				<option value="all">All</option>
				<option value="regular_season">Regular Season</option>
				<option value="playoffs">Playoffs</option>
			</select>
		</label>
	</div>

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
	/>
</div>
```

- [ ] **Step 2: Verify manually**

Run: `cd frontend && npm run build && npm run preview`, open `/log`, confirm the table lists mock games and both filters narrow the row set.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/log
git commit -m "feat(frontend): Match Log screen"
```

---

### Task 11: Full-app verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `cd frontend && npm run test`
Expected: All tests from every task in this plan pass, pristine output.

- [ ] **Step 2: Run a production build**

Run: `cd frontend && npm run build`
Expected: Succeeds with `adapter-static`, no dynamic-route errors (Task 8's `entries()` must cover all 8 team slugs).

- [ ] **Step 3: Browser walkthrough**

Run: `cd frontend && npm run preview` (or `npm run dev`), then drive the app with a browser tool (Playwright MCP or equivalent) to confirm, per CLAUDE.md's instruction to test UI changes in a real browser before reporting done:
- `/` redirects to `/team/srg`
- Team Scouting shows a presence table with visible baseline annotations
- Switching to another team via `/team/ig` etc. persists on next visit to `/`
- `/league` shows teams sorted by HHI and a presence-ranked hero list
- `/log` lists games and both filters work
- Charcoal/amber theme is applied throughout, team swatches are visibly distinct

- [ ] **Step 4: Report**

Summarize what was verified and any visual rough edges worth a follow-up polish pass — this is a mockup (frontend.md), not final visual design.

---

## Not in this plan

- **Real data / JSON emission.** Every screen reads the seeded mock. Swapping to real pipeline-emitted JSON is a separate plan.
- **Flex-rate UI** (uiux.md: "a hero shown in a role table should indicate when a team also plays it elsewhere"). Needs the flex-rate metric, already deferred in the metrics plan.
- **Per-role breakdowns in the Team Scouting UI** (`pickRateByRole`/`hhiByRole` exist in `metrics.ts` but aren't wired into a screen yet — planning.md lists per-role as "Must have," but this plan's screens are deliberately shallow per current-context.md; a natural next iteration on Task 8).
- **Baseline toggle** (uiux.md: raw vs. baseline-adjusted). This plan always shows both side by side via `BaselineAnnotation`; a toggle to hide the baseline is a small follow-up, not core to proving the pattern.
- **Generated TypeScript types from Pydantic models** (roadmap.md). Only relevant once real JSON is being emitted.
- **Full component test coverage.** `DataTable`/`TeamTag`/`FreshnessIndicator` get one smoke test each; deeper edge-case coverage (empty rows, long hero names, etc.) is deferred until a real design pass.
