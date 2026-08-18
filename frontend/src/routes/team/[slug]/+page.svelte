<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import { hhi, pickWinRateDelta, presence, presenceDelta, rollingHhi } from '$lib/metrics';
	import BaselineAnnotation from '$lib/components/BaselineAnnotation.svelte';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import StatBlock from '$lib/components/StatBlock.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';
	import TrendChart from '$lib/components/TrendChart.svelte';
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
	const trend = $derived(rollingHhi(mockDataset, team.id));
	const pickDeltas = $derived(pickWinRateDelta(mockDataset, team.id));
	const banDeltas = $derived(pickWinRateDelta(mockDataset, team.id, { isBan: true }));
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
	const seasonDeltas = $derived(
		presenceDelta(mockDataset, '17', '18', { teamId: team.id }).slice(0, 15)
	);

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

	<StatBlock
		label="Draft predictability"
		labelTooltip="How concentrated this team's hero picks are. Higher = more predictable, always picks the same heroes. Lower = more varied. (Hero Herfindahl-Hirschman Index, HHI)"
		value={teamHhi}
		baseline={leagueHhi}
	/>

	<div>
		<h2 class="mb-2 font-[Syne] text-lg">Predictability trend, last 10 games</h2>
		<TrendChart
			values={trend.map((p) => p.hhi)}
			pointLabels={trend.map(
				(p) => `${(p.playedAt ?? 'unknown date').split(' - ')[0]} · ${p.hhi.toFixed(3)}`
			)}
			label={`${team.canonicalName} rolling HHI`}
		/>
	</div>

	<div>
		<h2 class="mb-2 font-[Syne] text-lg">Season 17 vs Season 18, by hero</h2>
		<p class="mb-3 font-mono text-sm text-[#8a8478]">
			Draft predictability: {teamHhiS17.toFixed(3)} ({s17Games} games) → {teamHhiS18.toFixed(3)} ({s18Games}
			games)
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

	{#snippet deltaTable(rows: { hero: string; delta: number; games: number }[])}
		{#if rows.length === 0}
			<p class="font-mono text-xs text-[#8a8478]">Not enough games yet.</p>
		{:else}
			<div class="overflow-x-auto">
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
							<tr class="border-b border-[#2a2620] hover:bg-[#221f19]">
								<td class="px-3 py-2">{row.hero}</td>
								<td class="px-3 py-2 {row.delta >= 0 ? 'text-[#8fbf8a]' : 'text-[#d98873]'}"
									>{row.delta >= 0 ? '+' : ''}{(row.delta * 100).toFixed(1)}%</td
								>
								<td class="px-3 py-2">{row.games}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/snippet}

	<div class="grid grid-cols-1 gap-8 sm:grid-cols-2">
		<div>
			<h2 class="mb-2 font-[Syne] text-lg">Picks that line up with winning</h2>
			{@render deltaTable(pickDeltas)}
		</div>
		<div>
			<h2 class="mb-2 font-[Syne] text-lg">Bans that line up with winning</h2>
			{@render deltaTable(banDeltas)}
		</div>
	</div>

	<div class="overflow-x-auto">
		<table class="w-full border-collapse font-mono text-sm">
			<thead>
				<tr class="border-b border-[#3a352c] text-left text-[#8a8478]">
					<th class="px-3 py-2 font-normal">Hero</th>
					<th class="px-3 py-2 font-normal">Pick/ban rate (vs. league average)</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.hero)}
					<tr class="border-b border-[#2a2620] hover:bg-[#221f19]">
						<td class="px-3 py-2">{row.hero}</td>
						<td class="px-3 py-2">
							<BaselineAnnotation value={row.value} baseline={row.baseline} />
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
