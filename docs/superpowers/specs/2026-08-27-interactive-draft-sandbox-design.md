# Interactive Draft Sandbox — Design Spec

_Written 27 Aug 2026. Roadmap: docs/roadmap.md "Next" list (Interactive Draft Sandbox)._

## What this is, in plain words

In competitive Mobile Legends: Bang Bang (MPL), matches are often won or lost in the draft room. Coaches and analysts spend hours testing draft scenarios, preparing bans against opponent signatures, and practicing team compositions.

The **Interactive Draft Sandbox (`/sandbox`)** provides an authentic, client-side 5v5 tournament draft simulator following the official 20-step MPL pick/ban sequence. It features:
1. **Dual Mode Control**:
   - `👥 Dual Coach Mode`: Full manual control of both Blue and Red drafts for scrim prep.
   - `👤 Vs Simulated Opponent Mode`: Solo practice where the AI opponent automatically calculates and locks in their historical priority picks.
2. **Real-Time AI Recommendations**: Turn-by-turn scouting suggestions based on team signatures, league meta strength, and open role requirements.
3. **Live Draft Intelligence**: 5-lane role coverage checklist (`EXP`, `Jungle`, `Mid`, `Gold`, `Roam`) and real-time draft concentration (HHI) scoring.
4. **Draft Controls**: Full undo/redo, side swapping, instant reset, and one-click draft summary text export.

---

## Route & Navigation Architecture

- **Dedicated Route**: `/sandbox`
- **URL Parameters**: Supports `?blue=[slug]&red=[slug]&season=[season]`.
- **Main Navigation (`+layout.svelte`)**: Add `SANDBOX` tab in the header.
- **Matchup Integration (`/matchup`)**: Add "Test in Draft Sandbox" quick action button.

---

## Metric & Recommendation Engine (`frontend/src/lib/metrics.ts`)

All calculation logic will be implemented as pure, deterministic functions in `metrics.ts` and covered by unit tests in `metrics.spec.ts`.

### 1. Official 20-Step Draft Sequence State Machine

```typescript
export interface DraftStep {
	stepIndex: number; // 0 to 19
	phase: 1 | 2;
	action: 'ban' | 'pick';
	side: 'blue' | 'red';
	slotIndex: number; // 0 to 4 for picks/bans per side
	label: string;
}

export const OFFICIAL_DRAFT_SEQUENCE: DraftStep[] = [
	// Phase 1 Bans (3 each)
	{ stepIndex: 0, phase: 1, action: 'ban', side: 'blue', slotIndex: 0, label: 'Blue Ban 1' },
	{ stepIndex: 1, phase: 1, action: 'ban', side: 'red',  slotIndex: 0, label: 'Red Ban 1' },
	{ stepIndex: 2, phase: 1, action: 'ban', side: 'blue', slotIndex: 1, label: 'Blue Ban 2' },
	{ stepIndex: 3, phase: 1, action: 'ban', side: 'red',  slotIndex: 1, label: 'Red Ban 2' },
	{ stepIndex: 4, phase: 1, action: 'ban', side: 'blue', slotIndex: 2, label: 'Blue Ban 3' },
	{ stepIndex: 5, phase: 1, action: 'ban', side: 'red',  slotIndex: 2, label: 'Red Ban 3' },
	// Phase 1 Picks (3 each)
	{ stepIndex: 6, phase: 1, action: 'pick', side: 'blue', slotIndex: 0, label: 'Blue Pick 1 (First Pick)' },
	{ stepIndex: 7, phase: 1, action: 'pick', side: 'red',  slotIndex: 0, label: 'Red Pick 1' },
	{ stepIndex: 8, phase: 1, action: 'pick', side: 'red',  slotIndex: 1, label: 'Red Pick 2' },
	{ stepIndex: 9, phase: 1, action: 'pick', side: 'blue', slotIndex: 1, label: 'Blue Pick 2' },
	{ stepIndex: 10, phase: 1, action: 'pick', side: 'blue', slotIndex: 2, label: 'Blue Pick 3' },
	{ stepIndex: 11, phase: 1, action: 'pick', side: 'red',  slotIndex: 2, label: 'Red Pick 3' },
	// Phase 2 Bans (2 each)
	{ stepIndex: 12, phase: 2, action: 'ban', side: 'red',  slotIndex: 3, label: 'Red Ban 4' },
	{ stepIndex: 13, phase: 2, action: 'ban', side: 'blue', slotIndex: 3, label: 'Blue Ban 4' },
	{ stepIndex: 14, phase: 2, action: 'ban', side: 'red',  slotIndex: 4, label: 'Red Ban 5' },
	{ stepIndex: 15, phase: 2, action: 'ban', side: 'blue', slotIndex: 4, label: 'Blue Ban 5' },
	// Phase 2 Picks (2 each)
	{ stepIndex: 16, phase: 2, action: 'pick', side: 'red',  slotIndex: 3, label: 'Red Pick 4' },
	{ stepIndex: 17, phase: 2, action: 'pick', side: 'blue', slotIndex: 3, label: 'Blue Pick 4' },
	{ stepIndex: 18, phase: 2, action: 'pick', side: 'blue', slotIndex: 4, label: 'Blue Pick 5' },
	{ stepIndex: 19, phase: 2, action: 'pick', side: 'red',  slotIndex: 4, label: 'Red Pick 5 (Counter-Pick)' }
];
```

---

### 2. AI Turn Recommendations (`draftRecommendations`)

```typescript
export interface DraftRecommendation {
	hero: string;
	role: Role;
	roleName: string;
	score: number;
	teamPickRate: number;
	teamBanRate: number;
	leaguePresence: number;
	tag: string;
}

export function draftRecommendations(
	data: Dataset,
	teamId: number,
	side: 'blue' | 'red',
	action: 'ban' | 'pick',
	unavailableHeroNames: Set<string>,
	teamFilledRoles: Set<Role>,
	opts: ScopeOptions = {}
): DraftRecommendation[]
```

* Filters out all unavailable heroes (already picked or banned).
* **For Bans**: Recommends the opponent team's top signatures and league meta must-bans.
* **For Picks**: Prioritizes heroes whose primary role is still unfilled on the team, weighted by team comfort pick frequency and league meta presence.

---

### 3. Real-Time Draft Evaluation (`draftEvaluation`)

```typescript
export interface SideEvaluation {
	picks: { hero: string; role: Role; roleName: string }[];
	bans: string[];
	filledRoles: Set<Role>;
	missingRoles: Role[];
	isComplete: boolean;
	draftHhi: number;
	hhiClassification: string; // "Versatile Draft" | "Balanced" | "High Predictability"
	signatureCount: number;
}

export function evaluateSideDraft(
	data: Dataset,
	teamId: number,
	picks: string[],
	bans: string[],
	opts: ScopeOptions = {}
): SideEvaluation
```

* Computes 5-lane coverage (`missingRoles.length === 0`).
* Calculates dynamic HHI of the 5-hero composition based on team historical pick shares.
* Identifies how many signature comfort picks were secured.

---

## UI Components & Screen Structure (`/sandbox/+page.svelte`)

### 1. Header & Sandbox Controls Bar
- Page title & tagline.
- **Control Mode Switcher**: `[ 👤 Vs Simulated Opponent ]` vs `[ 👥 Dual Coach (Manual) ]`.
- **Side Team Selectors**: Dual dropdowns for Blue Team & Red Team with a central `⇄ Swap Sides` button.
- **Action Buttons**: `↶ Undo Last`, `🔄 Reset Draft`, `⚡ Auto-Pick Turn`, `📋 Copy Draft Summary`.

### 2. Main Arena (Dual-Sided Live Draft Board)
- **Blue Side Board (First Pick)**:
  - Team logo & name with First Pick badge.
  - 5 Ban slots (Phase 1: 3, Phase 2: 2).
  - 5 Pick slots with hero portraits, assigned role badges, and active glowing outline if currently drafting.
  - Role Coverage checklist (EXP, JGL, MID, GOLD, ROAM) and draft HHI score.
- **Center Turn HUD**:
  - Current step badge (*"Turn 7/20: Blue Pick 1 (First Pick)"*).
  - AI Recommendations drawer: Top 5 ranked suggestions with one-click `[Lock In]` buttons.
- **Red Side Board (Counter-Pick)**:
  - Team logo & name with Counter-Pick badge.
  - 5 Ban slots.
  - 5 Pick slots.
  - Role Coverage checklist and draft HHI score.

### 3. Hero Selection Pool (Bottom Grid)
- Search input with instant filtering.
- Lane filter pills (`All`, `EXP`, `Jungle`, `Mid`, `Gold`, `Roam`).
- Responsive hero card grid: Available heroes clickable to lock in; unavailable heroes (picked/banned) greyed out with status overlay.

---

## Plain Language & Terminology Guidelines

| Technical Term | Public Display Label | Tooltip / Description |
| :--- | :--- | :--- |
| **First Pick** | **First Pick (Blue)** | Blue side's opening pick to secure the top meta power hero. |
| **Counter-Pick** | **Final Counter-Pick (Red)** | Red side's last pick (slot 5) to directly counter the enemy draft. |
| **HHI Score** | **Draft Predictability** | Indicates whether the composition relies on standard comfort picks or surprise flexes. |
| **Role Coverage** | **5-Lane Checklist** | Verifies that EXP, Jungle, Mid, Gold, and Roam lanes are all covered. |

---

## Testing & Quality Gates

1. **Unit Tests (`frontend/src/lib/metrics.spec.ts`)**:
   - `draftRecommendations`: Verifies ban vs pick ranking, role matching, and unavailable exclusions.
   - `evaluateSideDraft`: Verifies lane completion checking and dynamic HHI scoring.
2. **Component Tests (`frontend/src/routes/sandbox/sandbox-page.svelte.spec.ts`)**:
   - Verifies turn advancement, hero locking, undoing, resetting, auto-picking, and copying.
3. **Build & Type Checking**:
   - `npm run check` passes with 0 errors.
   - `npm test` passes 100% of tests.
   - `npm run build` static prerender succeeds cleanly.
4. **Changelog**:
   - Update `CHANGELOG.md` and in-app `/changelog` with release notes.
