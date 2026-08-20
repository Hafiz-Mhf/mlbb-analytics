<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import { resolve } from '$app/paths';
	import DataTable from '$lib/components/DataTable.svelte';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import { logTeamFilter, logStageFilter } from '$lib/logFilters';

	const teamName = new Map(mockDataset.teams.map((t) => [t.id, t.canonicalName]));

	const rows = $derived(
		mockDataset.matches
			.filter(
				(m) =>
					$logTeamFilter === 'all' ||
					m.team1Id === Number($logTeamFilter) ||
					m.team2Id === Number($logTeamFilter)
			)
			.filter((m) => $logStageFilter === 'all' || m.stage === $logStageFilter)
			.map((m) => ({
				id: m.id,
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
		<h1 class="font-display text-2xl tracking-wide text-ink">Match Log</h1>
		<FreshnessIndicator {generatedAt} />
	</div>

	<div class="flex flex-wrap gap-4 font-mono text-sm">
		<label class="flex items-center gap-2">
			<span class="text-muted">Team:</span>
			<select
				bind:value={$logTeamFilter}
				class="min-h-11 rounded-full border border-line bg-surface px-3 py-1 text-primary focus-visible:border-primary"
			>
				<option value="all">All</option>
				{#each mockDataset.teams as team (team.id)}
					<option value={String(team.id)}>{team.canonicalName}</option>
				{/each}
			</select>
		</label>
		<label class="flex items-center gap-2">
			<span class="text-muted">Stage:</span>
			<select
				bind:value={$logStageFilter}
				class="min-h-11 rounded-full border border-line bg-surface px-3 py-1 text-primary focus-visible:border-primary"
			>
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
		rowHref={(row) => resolve('/match/[id]', { id: String(row.id) })}
	/>
</div>
