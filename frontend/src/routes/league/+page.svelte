<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import { hhi, presence, presenceDelta } from '$lib/metrics';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import StatBlock from '$lib/components/StatBlock.svelte';
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
	const totalGames = $derived(mockDataset.matches.length);
	const seasonDeltas = $derived(presenceDelta(mockDataset, '17', '18').slice(0, 15));
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="font-[Syne] text-2xl">League Overview</h1>
		<FreshnessIndicator {generatedAt} />
	</div>

	<StatBlock
		label="League-wide draft predictability"
		labelTooltip="How concentrated a team's hero picks are. Higher = more predictable, always picks the same heroes. Lower = more varied. (Hero Herfindahl-Hirschman Index, HHI)"
		value={leagueHhiValue}
		context={`${totalGames} games, all 8 teams`}
	/>

	<div class="overflow-x-auto">
		<table class="w-full border-collapse font-mono text-sm">
			<thead>
				<tr class="border-b border-[#3a352c] text-left text-[#8a8478]">
					<th class="px-3 py-2 font-normal">Team</th>
					<th class="px-3 py-2 font-normal">Draft predictability</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.team.id)}
					<tr class="border-b border-[#2a2620] hover:bg-[#221f19]">
						<td class="px-3 py-2"><TeamTag name={row.team.canonicalName} size={22} /></td>
						<td class="px-3 py-2">{row.teamHhi.toFixed(3)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<h2 class="pt-4 font-[Syne] text-lg">Most picked & banned heroes (top 10)</h2>
	<div class="overflow-x-auto">
		<table class="w-full border-collapse font-mono text-sm">
			<thead>
				<tr class="border-b border-[#3a352c] text-left text-[#8a8478]">
					<th class="px-3 py-2 font-normal">Hero</th>
					<th class="px-3 py-2 font-normal">Pick/ban rate</th>
				</tr>
			</thead>
			<tbody>
				{#each Object.entries(leaguePresence)
					.sort(([, a], [, b]) => b - a)
					.slice(0, 10) as [hero, rate] (hero)}
					<tr class="border-b border-[#2a2620] hover:bg-[#221f19]">
						<td class="px-3 py-2">{hero}</td>
						<td class="px-3 py-2">{(rate * 100).toFixed(1)}%</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<h2 class="pt-4 font-[Syne] text-lg">Season 17 vs Season 18, biggest swings</h2>
	<p class="mb-3 font-mono text-sm text-[#8a8478]">
		League draft predictability: {leagueHhiS17.toFixed(3)} ({s17Games} games) → {leagueHhiS18.toFixed(
			3
		)} ({s18Games} games)
	</p>
	<div class="overflow-x-auto">
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
					<tr class="border-b border-[#2a2620] hover:bg-[#221f19]">
						<td class="px-3 py-2">{row.hero}</td>
						<td class="px-3 py-2">{(row.before * 100).toFixed(1)}%</td>
						<td class="px-3 py-2">{(row.after * 100).toFixed(1)}%</td>
						<td class="px-3 py-2 {row.delta >= 0 ? 'text-[#8fbf8a]' : 'text-[#d98873]'}"
							>{row.delta >= 0 ? '+' : ''}{(row.delta * 100).toFixed(1)}%</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
