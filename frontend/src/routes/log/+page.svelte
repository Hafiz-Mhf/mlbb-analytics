<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
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
