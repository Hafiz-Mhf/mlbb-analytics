<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import { banRate, hhi, pickRate, pickRateByRole, presenceDelta, ROLE_NAMES } from '$lib/metrics';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import HeroTag from '$lib/components/HeroTag.svelte';
	import RoleFilter from '$lib/components/RoleFilter.svelte';
	import StatBlock from '$lib/components/StatBlock.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';

	let selectedRole = $state<number | null>(null);

	const leagueHhiValue = $derived(hhi(mockDataset));

	function topN(rates: Record<string, number>, n = 10) {
		return Object.entries(rates)
			.sort(([, a], [, b]) => b - a)
			.slice(0, n);
	}

	const rows = $derived(
		mockDataset.teams
			.map((team) => ({ team, teamHhi: hhi(mockDataset, { teamId: team.id }) }))
			.sort((a, b) => b.teamHhi - a.teamHhi)
	);

	const leagueHhiS17 = $derived(hhi(mockDataset, { season: '17' }));
	const leagueHhiS18 = $derived(hhi(mockDataset, { season: '18' }));
	const s17Games = $derived(mockDataset.matches.filter((m) => m.season === '17').length);
	const s18Games = $derived(mockDataset.matches.filter((m) => m.season === '18').length);
	const totalGames = $derived(mockDataset.matches.length);
	const seasonDeltas = $derived(presenceDelta(mockDataset, '17', '18').slice(0, 15));

	const s17Picks = $derived(
		selectedRole === null
			? topN(pickRate(mockDataset, { season: '17' }))
			: topN(pickRateByRole(mockDataset, selectedRole, { season: '17' }))
	);
	const s17Bans = $derived(topN(banRate(mockDataset, { season: '17' })));
	const s18Picks = $derived(
		selectedRole === null
			? topN(pickRate(mockDataset, { season: '18' }))
			: topN(pickRateByRole(mockDataset, selectedRole, { season: '18' }))
	);
	const s18Bans = $derived(topN(banRate(mockDataset, { season: '18' })));
</script>

<div class="space-y-8">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="font-display text-2xl tracking-wide text-ink">League Overview</h1>
		<FreshnessIndicator {generatedAt} />
	</div>

	<StatBlock
		label="League-wide draft predictability"
		labelTooltip="How concentrated a team's hero picks are. Higher = more predictable, always picks the same heroes. Lower = more varied. (Hero Herfindahl-Hirschman Index, HHI)"
		value={leagueHhiValue}
		context={`${totalGames} games, all 8 teams`}
	/>

	<div class="card p-5">
		<h2 class="mb-3 font-display text-lg tracking-wide text-ink">Draft predictability by team</h2>
		<div class="overflow-x-auto">
			<table class="w-full border-collapse font-mono text-sm">
				<thead>
					<tr class="border-b border-line text-left text-muted">
						<th class="px-3 py-2 font-normal">Team</th>
						<th class="px-3 py-2 font-normal">Draft predictability</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.team.id)}
						<tr class="border-b border-line/60 hover:bg-surface-2">
							<td class="px-3 py-2"><TeamTag name={row.team.canonicalName} size={22} /></td>
							<td class="px-3 py-2 text-ink">{row.teamHhi.toFixed(3)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	{#snippet rateTable(title: string, rows: [string, number][])}
		<div>
			<h3 class="mb-2 font-mono text-sm text-muted">{title}</h3>
			<table class="w-full border-collapse font-mono text-sm">
				<tbody>
					{#each rows as [hero, rate] (hero)}
						<tr class="border-b border-line/60 hover:bg-surface-2">
							<td class="px-3 py-2"><HeroTag name={hero} /></td>
							<td class="px-3 py-2">{(rate * 100).toFixed(1)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/snippet}

	<div class="card p-5">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<h2 class="font-display text-lg tracking-wide text-ink">
				{selectedRole === null
					? 'Meta Draft (top 10)'
					: `${ROLE_NAMES[selectedRole]} Meta (top 10)`}
			</h2>
			<RoleFilter selected={selectedRole} onchange={(r) => (selectedRole = r)} />
		</div>
		<div class="grid gap-6 md:grid-cols-2">
			<div>
				<p class="mb-3 font-mono text-sm text-muted">Season 17 ({s17Games} games)</p>
				<div class="grid gap-4 sm:grid-cols-2">
					{@render rateTable(selectedRole === null ? 'Most picked' : `Most picked ${ROLE_NAMES[selectedRole]}`, s17Picks)}
					{@render rateTable('Most banned (all)', s17Bans)}
				</div>
			</div>
			<div>
				<p class="mb-3 font-mono text-sm text-muted">Season 18, to date ({s18Games} games)</p>
				<div class="grid gap-4 sm:grid-cols-2">
					{@render rateTable(selectedRole === null ? 'Most picked' : `Most picked ${ROLE_NAMES[selectedRole]}`, s18Picks)}
					{@render rateTable('Most banned (all)', s18Bans)}
				</div>
			</div>
		</div>
	</div>

	<div class="card p-5">
		<h2 class="mb-1 font-display text-lg tracking-wide text-ink">
			Season 17 vs Season 18, biggest swings
		</h2>
		<p class="mb-3 font-mono text-sm text-muted">
			League draft predictability: {leagueHhiS17.toFixed(3)} ({s17Games} games) → {leagueHhiS18.toFixed(
				3
			)} ({s18Games} games)
		</p>
		<div class="overflow-x-auto">
			<table class="w-full border-collapse font-mono text-sm">
				<thead>
					<tr class="border-b border-line text-left text-muted">
						<th class="px-3 py-2 font-normal">Hero</th>
						<th class="px-3 py-2 font-normal">S17</th>
						<th class="px-3 py-2 font-normal">S18</th>
						<th class="px-3 py-2 font-normal">Change</th>
					</tr>
				</thead>
				<tbody>
					{#each seasonDeltas as row (row.hero)}
						<tr class="border-b border-line/60 hover:bg-surface-2">
							<td class="px-3 py-2"><HeroTag name={row.hero} /></td>
							<td class="px-3 py-2">{(row.before * 100).toFixed(1)}%</td>
							<td class="px-3 py-2">{(row.after * 100).toFixed(1)}%</td>
							<td class="px-3 py-2 {row.delta >= 0 ? 'text-positive' : 'text-negative'}"
								>{row.delta >= 0 ? '+' : ''}{(row.delta * 100).toFixed(1)}%</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
