<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import { hhi, presence, presenceDelta } from '$lib/metrics';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';

	const leaguePresence = $derived(presence(mockDataset));
	const leagueHhiValue = $derived(hhi(mockDataset));

	const rows = $derived(
		mockDataset.teams
			.map((team) => ({ team, teamHhi: hhi(mockDataset, { teamId: team.id }) }))
			.sort((a, b) => b.teamHhi - a.teamHhi)
	);

	const leagueHhiS17 = $derived(hhi(mockDataset, { season: '17' }));
	const leagueHhiS18 = $derived(hhi(mockDataset, { season: '18' }));
	const s17Games = $derived(mockDataset.matches.filter((m) => m.season === '17').length);
	const s18Games = $derived(mockDataset.matches.filter((m) => m.season === '18').length);
	const seasonDeltas = $derived(presenceDelta(mockDataset, '17', '18').slice(0, 15));
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
</div>
