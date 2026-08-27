<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import { flexHeroes, rolePredictabilityMatrix, ROLE_NAMES } from '$lib/metrics';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import HeroTag from '$lib/components/HeroTag.svelte';
	import RoleDistributionBar from '$lib/components/RoleDistributionBar.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';

	let seasonFilter = $state<string | undefined>(undefined);

	const matrix = $derived(
		rolePredictabilityMatrix(mockDataset, { season: seasonFilter })
	);

	const tournamentFlex = $derived(
		flexHeroes(mockDataset, { season: seasonFilter })
	);

	const s17Games = $derived(mockDataset.matches.filter((m) => m.season === '17').length);
	const s18Games = $derived(mockDataset.matches.filter((m) => m.season === '18').length);
	const totalGames = $derived(mockDataset.matches.length);
</script>

<div class="space-y-8">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="font-display text-2xl tracking-wide text-ink">Roles & Flex Intelligence</h1>
			<p class="mt-1 font-mono text-xs text-muted">
				Role-specific draft concentration and multi-lane flex hero distribution.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<div class="flex items-center gap-1 rounded-md border border-line bg-surface p-1">
				<button
					type="button"
					onclick={() => (seasonFilter = undefined)}
					class="rounded px-2.5 py-1 font-mono text-xs transition-colors {seasonFilter === undefined
						? 'bg-surface-2 text-primary font-semibold'
						: 'text-muted hover:text-ink'}"
				>
					All ({totalGames})
				</button>
				<button
					type="button"
					onclick={() => (seasonFilter = '18')}
					class="rounded px-2.5 py-1 font-mono text-xs transition-colors {seasonFilter === '18'
						? 'bg-surface-2 text-primary font-semibold'
						: 'text-muted hover:text-ink'}"
				>
					S18 ({s18Games})
				</button>
				<button
					type="button"
					onclick={() => (seasonFilter = '17')}
					class="rounded px-2.5 py-1 font-mono text-xs transition-colors {seasonFilter === '17'
						? 'bg-surface-2 text-primary font-semibold'
						: 'text-muted hover:text-ink'}"
				>
					S17 ({s17Games})
				</button>
			</div>
			<FreshnessIndicator {generatedAt} />
		</div>
	</div>

	<div class="card p-5">
		<div class="mb-4">
			<h2 class="font-display text-lg tracking-wide text-ink">
				Team Role Predictability Matrix (HHI)
			</h2>
			<p class="mt-1 font-mono text-xs text-muted">
				Hero concentration within each specific lane. Higher = narrow one-trick pool. Lower = wide champion pool.
			</p>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full border-collapse font-mono text-sm">
				<thead>
					<tr class="border-b border-line text-left text-muted">
						<th class="px-3 py-2 font-normal">Team</th>
						<th class="px-3 py-2 font-normal text-right">Overall</th>
						<th class="px-3 py-2 font-normal text-right">{ROLE_NAMES[1]} (EXP)</th>
						<th class="px-3 py-2 font-normal text-right">{ROLE_NAMES[2]} (JGL)</th>
						<th class="px-3 py-2 font-normal text-right">{ROLE_NAMES[3]} (MID)</th>
						<th class="px-3 py-2 font-normal text-right">{ROLE_NAMES[4]} (GOLD)</th>
						<th class="px-3 py-2 font-normal text-right">{ROLE_NAMES[5]} (ROAM)</th>
					</tr>
				</thead>
				<tbody>
					{#each matrix.teams as row (row.teamId)}
						<tr class="border-b border-line/60 hover:bg-surface-2">
							<td class="px-3 py-2.5">
								<TeamTag name={row.teamName} size={20} />
							</td>
							<td class="px-3 py-2.5 text-right font-medium text-ink">
								{row.overallHhi.toFixed(3)}
							</td>
							{#each [1, 2, 3, 4, 5] as role}
								{@const val = row.roleHhi[role] ?? 0}
								<td
									class="px-3 py-2.5 text-right {val > (matrix.league[role] ?? 0) * 1.3
										? 'text-primary font-semibold'
										: 'text-muted'}"
								>
									{val.toFixed(3)}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="border-t-2 border-line bg-surface-2/50 font-semibold text-ink">
						<td class="px-3 py-2.5">League Average</td>
						<td class="px-3 py-2.5 text-right">
							{(
								matrix.teams.reduce((sum, t) => sum + t.overallHhi, 0) / matrix.teams.length
							).toFixed(3)}
						</td>
						{#each [1, 2, 3, 4, 5] as role}
							<td class="px-3 py-2.5 text-right text-primary">
								{(matrix.league[role] ?? 0).toFixed(3)}
							</td>
						{/each}
					</tr>
				</tfoot>
			</table>
		</div>
	</div>

	<div class="card p-5">
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h2 class="font-display text-lg tracking-wide text-ink">Tournament Flex Picks Matrix</h2>
				<p class="mt-1 font-mono text-xs text-muted">
					Heroes drafted in multiple lane assignments.
				</p>
			</div>
			<span class="font-mono text-xs text-muted">
				{tournamentFlex.length} {tournamentFlex.length === 1 ? 'hero' : 'heroes'} flexed
			</span>
		</div>

		{#if tournamentFlex.length === 0}
			<p class="py-6 text-center font-mono text-xs text-muted">
				No multi-role flex picks found for the selected scope.
			</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full border-collapse font-mono text-sm">
					<thead>
						<tr class="border-b border-line text-left text-muted">
							<th class="px-3 py-2 font-normal">Hero</th>
							<th class="px-3 py-2 font-normal text-right">Picks</th>
							<th class="px-3 py-2 font-normal">Primary Role</th>
							<th class="px-3 py-2 font-normal">Secondary Role(s)</th>
							<th class="px-3 py-2 font-normal">Distribution Breakdown</th>
						</tr>
					</thead>
					<tbody>
						{#each tournamentFlex as flex (flex.hero)}
							<tr class="border-b border-line/60 hover:bg-surface-2">
								<td class="px-3 py-3">
									<HeroTag name={flex.hero} />
								</td>
								<td class="px-3 py-3 text-right font-medium text-ink">
									{flex.totalPicks}
								</td>
								<td class="px-3 py-3">
									<span class="text-ink font-semibold">{flex.primaryRole.roleName}</span>
									<span class="text-muted text-xs">
										({flex.primaryRole.picks}p · {(flex.primaryRole.share * 100).toFixed(0)}%)
									</span>
								</td>
								<td class="px-3 py-3">
									<div class="flex flex-wrap gap-1.5">
										{#each flex.secondaryRoles as sec (sec.role)}
											<span class="rounded bg-surface-3 px-1.5 py-0.5 text-xs text-muted">
												<span class="text-ink">{sec.roleName}</span>
												<span>{(sec.share * 100).toFixed(0)}%</span>
											</span>
										{/each}
									</div>
								</td>
								<td class="px-3 py-3 min-w-48">
									<RoleDistributionBar roles={flex.roles} />
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
