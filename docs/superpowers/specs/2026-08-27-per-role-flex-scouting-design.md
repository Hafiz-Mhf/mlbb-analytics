# Per-Role & Flex Scouting — Design Spec

_Written 27 Aug 2026. Roadmap: docs/roadmap.md "Still open" list ("flex-rate UI, per-role breakdowns wired into the Team Scouting screen")._

## What this is, in plain words

In competitive MLBB, drafting is deeply role-dependent: a team might have an unpredictable Jungle pool but an extremely rigid, one-trick Gold lane. Furthermore, certain high-priority heroes (e.g. Gloo, Yi Sun-shin, Julian, Chou) are "flex picks" drafted across multiple lanes (e.g. EXP vs Roam or Jungle vs Gold) to hide lane assignments during pick/ban phase.

This feature adds:
1. **Per-Role Filtering & Predictability**: Filter pick tables and view role-specific predictability ($HHI$) on both Team Scouting (`/team/[slug]`) and League Overview (`/league`).
2. **Team Flex Picks Card**: Surface multi-role heroes per team with visual role distribution breakdown bars.
3. **Dedicated Role Intelligence Screen (`/roles`)**:
   - **Team Role Predictability Matrix**: Side-by-side comparison of all 8 teams' draft concentration across all 5 roles.
   - **League Flex Matrix**: Complete list of tournament flex heroes, their primary vs secondary lane distributions, and role-specific win rates.

---

## Role Slot Ground Truth

Verified over all S17 and S18 games (CLAUDE.md & data-source.md):
- `slot = 1` ➔ **EXP Lane**
- `slot = 2` ➔ **Jungle**
- `slot = 3` ➔ **Mid Lane**
- `slot = 4` ➔ **Gold Lane**
- `slot = 5` ➔ **Roam**

*(Note: Bans are ordered chronologically, not by role. Per-role metrics apply strictly to picks where `is_ban = 0`).*

---

## Metric Calculations (`frontend/src/lib/metrics.ts`)

### Existing Functions
- `pickRateByRole(data, role, opts)`: Hero pick frequency in a given role slot.
- `hhiByRole(data, role, opts)`: Draft concentration within a single role slot.

### New Functions & Interfaces

```typescript
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
	share: number; // picks / totalHeroPicks
}

export interface FlexHero {
	hero: string;
	totalPicks: number;
	primaryRole: RoleDistribution;
	secondaryRoles: RoleDistribution[];
	roles: RoleDistribution[];
	flexRate: number; // (totalPicks - primaryRole.picks) / totalPicks
}

export interface TeamRoleMatrixRow {
	teamId: number;
	teamName: string;
	overallHhi: number;
	roleHhi: Record<number, number>; // role slot (1..5) -> HHI
}
```

1. `flexHeroes(data: Dataset, opts: ScopeOptions = {}): FlexHero[]`
   - Groups picks by hero and role slot.
   - Filters to heroes with picks in $\ge 2$ distinct roles within scope.
   - Returns list sorted by total picks and flex rate.

2. `rolePredictabilityMatrix(data: Dataset, opts: ScopeOptions = {}): { teams: TeamRoleMatrixRow[], league: Record<number, number> }`
   - Computes `hhiByRole` for each of the 8 teams across slots 1..5.
   - Computes league baseline `hhiByRole` for slots 1..5.

---

## UI Components & Screens

### 1. Reusable Components
* **`RoleFilter.svelte`**:
  * Clean pill tab selector: `All`, `EXP`, `JGL`, `MID`, `GOLD`, `ROAM`.
  * Keyboard navigable, accessible (`role="tablist"`).
* **`RoleDistributionBar.svelte`**:
  * Compact segmented horizontal bar displaying primary and secondary role proportions with role badges and tooltips.

### 2. Header Navigation (`+layout.svelte`)
* Add `ROLES` to nav pill bar linking to `/roles`.

### 3. Team Scouting Screen (`/team/[slug]`)
* **Role Filter on Main Hero Table**:
  * Selecting a role filters table to picks in that lane.
  * Shows role predictability callout (e.g. *SRG Jungle Predictability: 0.078 vs League 0.045*).
* **Flex Picks Card**:
  * Renders list of flex heroes for this team using `RoleDistributionBar`.

### 4. League Overview Screen (`/league`)
* Role filter pills on **Meta Draft** section to view top-10 heroes per specific role.

### 5. New Dedicated Screen (`/roles/+page.svelte`)
* **Team Role Predictability Matrix Card**:
  * 8-row table with 5 role columns.
  * Highlights high concentration (rigid champion pools) vs low concentration (flexible).
* **Tournament Flex Picks Matrix Card**:
  * Table of all tournament flex picks with role split bars and win rates.

---

## Testing & Verification Plan

1. **Unit Tests (`frontend/src/lib/metrics.spec.ts`)**:
   - `flexHeroes`: Multi-role detection, single-role exclusion, percentage math, team/season scoping.
   - `rolePredictabilityMatrix`: Matches individual `hhiByRole` calls across 8 teams and 5 roles.
2. **Component Tests**:
   - `RoleFilter.svelte.spec.ts`: Tab selection, event dispatching, aria attributes.
   - `RoleDistributionBar.svelte.spec.ts`: Segment width styling and role labels.
3. **Build & Quality Gates**:
   - `npm run check`: 0 TypeScript and Svelte errors.
   - `npm test`: All test suites pass.
   - `npm run build`: Static prerender succeeds including `/roles`.

---

## Explicitly Not in Scope

- Ban role assignment (bans do not have role slots in Liquipedia wikitext).
- In-game role swap detection (data source records draft slots, not player swaps).
