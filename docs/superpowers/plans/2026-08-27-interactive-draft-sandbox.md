# Interactive Draft Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Interactive Draft Sandbox (`/sandbox`), simulating official 20-step MPL 5v5 pick/ban sequences with real-time AI recommendations, role coverage indicators, predictability scoring, and dual coach / solo simulation modes.

**Architecture:** Pure analytical functions in `frontend/src/lib/metrics.ts` (`OFFICIAL_DRAFT_SEQUENCE`, `draftRecommendations`, `evaluateSideDraft`), unit tested in `metrics.spec.ts`. Reactive Svelte 5 state machine in `/sandbox/+page.svelte` supporting undo/redo, side swapping, auto-pick, and summary copy. Main nav tab in `+layout.svelte`.

**Tech Stack:** SvelteKit 2, Svelte 5 runes (`$state`, `$derived`, `$effect`), Tailwind CSS v4, Vitest.

## Global Constraints

- Must follow the official 20-step sequence: 6 Phase 1 Bans (3 each) -> 6 Phase 1 Picks (3 each) -> 4 Phase 2 Bans (2 each) -> 4 Phase 2 Picks (2 each).
- Wording must be plain and accessible with hover tooltips for technical terms.
- Mobile responsive with 0px horizontal overflow.
- All metrics covered by unit tests, component tested with Vitest browser.
- Automatically update `CHANGELOG.md` and in-app `/changelog`.

---

### Task 1: Draft Sequence & Recommendation Metrics

**Files:**
- Modify: `frontend/src/lib/metrics.ts`
- Modify: `frontend/src/lib/metrics.spec.ts`

- [ ] **Step 1: Write failing unit tests in `metrics.spec.ts`**

```typescript
describe('draftRecommendations', () => {
	it('provides ranked recommendations excluding unavailable heroes and prioritizing open roles', () => {
		const data = fixture();
		const recs = draftRecommendations(data, 1, 'blue', 'pick', new Set(['Chou']), new Set([1]));
		expect(recs.length).toBeGreaterThan(0);
		expect(recs.some((r) => r.hero === 'Chou')).toBe(false);
	});
});

describe('evaluateSideDraft', () => {
	it('computes 5-lane completion and draft HHI score', () => {
		const data = fixture();
		const evaluation = evaluateSideDraft(data, 1, ['Chou', 'Alpha', 'Valentina', 'Beatrix', 'Hylos'], ['Fanny']);
		expect(evaluation.isComplete).toBe(true);
		expect(evaluation.missingRoles.length).toBe(0);
		expect(evaluation.draftHhi).toBeGreaterThanOrEqual(0);
	});
});
```

- [ ] **Step 2: Implement sequence, recommendation engine, and evaluation in `metrics.ts`**

```typescript
export interface DraftStep {
	stepIndex: number;
	phase: 1 | 2;
	action: 'ban' | 'pick';
	side: 'blue' | 'red';
	slotIndex: number;
	label: string;
}

export const OFFICIAL_DRAFT_SEQUENCE: DraftStep[] = [
	{ stepIndex: 0, phase: 1, action: 'ban', side: 'blue', slotIndex: 0, label: 'Blue Ban 1' },
	{ stepIndex: 1, phase: 1, action: 'ban', side: 'red',  slotIndex: 0, label: 'Red Ban 1' },
	{ stepIndex: 2, phase: 1, action: 'ban', side: 'blue', slotIndex: 1, label: 'Blue Ban 2' },
	{ stepIndex: 3, phase: 1, action: 'ban', side: 'red',  slotIndex: 1, label: 'Red Ban 2' },
	{ stepIndex: 4, phase: 1, action: 'ban', side: 'blue', slotIndex: 2, label: 'Blue Ban 3' },
	{ stepIndex: 5, phase: 1, action: 'ban', side: 'red',  slotIndex: 2, label: 'Red Ban 3' },
	{ stepIndex: 6, phase: 1, action: 'pick', side: 'blue', slotIndex: 0, label: 'Blue Pick 1 (First Pick)' },
	{ stepIndex: 7, phase: 1, action: 'pick', side: 'red',  slotIndex: 0, label: 'Red Pick 1' },
	{ stepIndex: 8, phase: 1, action: 'pick', side: 'red',  slotIndex: 1, label: 'Red Pick 2' },
	{ stepIndex: 9, phase: 1, action: 'pick', side: 'blue', slotIndex: 1, label: 'Blue Pick 2' },
	{ stepIndex: 10, phase: 1, action: 'pick', side: 'blue', slotIndex: 2, label: 'Blue Pick 3' },
	{ stepIndex: 11, phase: 1, action: 'pick', side: 'red',  slotIndex: 2, label: 'Red Pick 3' },
	{ stepIndex: 12, phase: 2, action: 'ban', side: 'red',  slotIndex: 3, label: 'Red Ban 4' },
	{ stepIndex: 13, phase: 2, action: 'ban', side: 'blue', slotIndex: 3, label: 'Blue Ban 4' },
	{ stepIndex: 14, phase: 2, action: 'ban', side: 'red',  slotIndex: 4, label: 'Red Ban 5' },
	{ stepIndex: 15, phase: 2, action: 'ban', side: 'blue', slotIndex: 4, label: 'Blue Ban 5' },
	{ stepIndex: 16, phase: 2, action: 'pick', side: 'red',  slotIndex: 3, label: 'Red Pick 4' },
	{ stepIndex: 17, phase: 2, action: 'pick', side: 'blue', slotIndex: 3, label: 'Blue Pick 4' },
	{ stepIndex: 18, phase: 2, action: 'pick', side: 'blue', slotIndex: 4, label: 'Blue Pick 5' },
	{ stepIndex: 19, phase: 2, action: 'pick', side: 'red',  slotIndex: 4, label: 'Red Pick 5 (Counter-Pick)' }
];
```

- [ ] **Step 3: Run `npm test` and verify pass**
- [ ] **Step 4: Commit changes**

---

### Task 2: Navigation Integration

**Files:**
- Modify: `frontend/src/routes/+layout.svelte`

- [ ] **Step 1: Add `SANDBOX` to `navLinks` array**
- [ ] **Step 2: Commit changes**

---

### Task 3: Build the Interactive Draft Sandbox UI (`/sandbox/+page.svelte`)

**Files:**
- Create: `frontend/src/routes/sandbox/+page.svelte`
- Create: `frontend/src/routes/sandbox/sandbox-page.svelte.spec.ts`

- [ ] **Step 1: Build `/sandbox/+page.svelte`**
  - Mode selector (`Vs Simulated Opponent` vs `Dual Coach`).
  - Team selectors with quick swap.
  - Action buttons (`Undo`, `Reset`, `Auto-Pick`, `Copy Summary`).
  - Dual-sided board (Blue side left, Red side right, turn HUD center).
  - Searchable Hero Selection Pool with lane filters.
- [ ] **Step 2: Create component test `sandbox-page.svelte.spec.ts`**
- [ ] **Step 3: Run `npm run check` and `npm test`**
- [ ] **Step 4: Commit changes**

---

### Task 4: Documentation & Changelogs

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `frontend/src/routes/changelog/+page.svelte`
- Modify: `docs/current-context.md`
- Modify: `docs/roadmap.md`
- Modify: `README.md`

- [ ] **Step 1: Run `npm run build` static prerender**
- [ ] **Step 2: Update all changelogs, context, roadmap, and README files**
- [ ] **Step 3: Commit and push to `origin/main`**
