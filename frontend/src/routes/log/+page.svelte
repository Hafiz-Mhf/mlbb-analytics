<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import { resolve } from '$app/paths';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';
	import { logTeamFilter, logStageFilter } from '$lib/logFilters';

	const teamName = new Map(mockDataset.teams.map((t) => [t.id, t.canonicalName]));

	const seriesRows = $derived.by(() => {
		const filtered = mockDataset.matches
			.filter(
				(m) =>
					$logTeamFilter === 'all' ||
					m.team1Id === Number($logTeamFilter) ||
					m.team2Id === Number($logTeamFilter)
			)
			.filter((m) => $logStageFilter === 'all' || m.stage === $logStageFilter);

		const bySeries = new Map<string, typeof filtered>();
		for (const m of filtered) {
			const games = bySeries.get(m.seriesId) ?? [];
			games.push(m);
			bySeries.set(m.seriesId, games);
		}

		return [...bySeries.values()]
			.map((games) => {
				games.sort((a, b) => a.gameNumberInSeries - b.gameNumberInSeries);
				const first = games[0];
				const team1Wins = games.filter((g) => g.winnerId === first.team1Id).length;
				const team2Wins = games.filter((g) => g.winnerId === first.team2Id).length;
				return {
					seriesId: first.seriesId,
					season: first.season,
					stage: first.stage,
					team1: teamName.get(first.team1Id)!,
					team2: teamName.get(first.team2Id)!,
					team1Wins,
					team2Wins,
					bestOf: 2 * Math.max(team1Wins, team2Wins) - 1,
					date: first.playedAt?.split(' - ')[0] ?? null,
					minId: Math.min(...games.map((g) => g.id))
				};
			})
			.sort((a, b) => a.minId - b.minId);
	});

	// Grouped by season so S17/S18 (and future international events) never mix in one list.
	const seasonGroups = $derived.by(() => {
		const bySeason = new Map<string, (typeof seriesRows)[number][]>();
		for (const s of seriesRows) {
			const rows = bySeason.get(s.season) ?? [];
			rows.push(s);
			bySeason.set(s.season, rows);
		}
		return [...bySeason.entries()].sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }));
	});
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
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

	{#if seriesRows.length === 0}
		<p class="card px-4 py-6 text-center font-mono text-sm text-muted">
			No series match the current filters.
		</p>
	{:else}
		{#each seasonGroups as [season, rows] (season)}
			<div class="space-y-2">
				<h2 class="font-display text-lg tracking-wide text-ink">Season {season}</h2>
				<div class="card divide-y divide-line/60">
					{#each rows as s (s.seriesId)}
						<a
							href={resolve('/series/[seriesId]', { seriesId: s.seriesId })}
							class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
						>
							<div class="flex items-center gap-2 font-mono text-sm text-ink">
								<TeamTag name={s.team1} size={18} />
								<span class="text-muted">vs</span>
								<TeamTag name={s.team2} size={18} />
							</div>
							<div class="justify-self-end font-display text-lg tracking-wide sm:justify-self-center">
								<span class={s.team1Wins > s.team2Wins ? 'text-gold' : 'text-ink'}>{s.team1Wins}</span>
								<span class="text-muted">:</span>
								<span class={s.team2Wins > s.team1Wins ? 'text-gold' : 'text-ink'}>{s.team2Wins}</span>
							</div>
							<div class="col-span-2 text-right font-mono text-xs text-muted sm:col-span-1">
								<div>
									{s.stage === 'playoffs' ? 'Playoffs' : 'Regular Season'} · Bo{s.bestOf}
								</div>
								{#if s.date}
									<div>{s.date}</div>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
