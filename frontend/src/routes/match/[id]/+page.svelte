<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import { presence } from '$lib/metrics';
	import BaselineAnnotation from '$lib/components/BaselineAnnotation.svelte';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';

	let { data } = $props();
	const match = $derived(data.match);

	const teamName = new Map(mockDataset.teams.map((t) => [t.id, t.canonicalName]));
	const heroName = new Map(mockDataset.heroes.map((h) => [h.id, h.canonicalName]));
	const leaguePresence = $derived(presence(mockDataset));

	function sideRows(teamId: number) {
		const teamPresence = presence(mockDataset, { teamId });
		return mockDataset.drafts
			.filter((d) => d.matchId === match.id && d.teamId === teamId)
			.sort((a, b) => Number(a.isBan) - Number(b.isBan) || a.slot - b.slot)
			.map((d) => {
				const hero = heroName.get(d.heroId)!;
				return {
					hero,
					kind: d.isBan ? 'Ban' : 'Pick',
					value: teamPresence[hero] ?? 0,
					baseline: leaguePresence[hero] ?? 0
				};
			});
	}

	const team1Rows = $derived(sideRows(match.team1Id));
	const team2Rows = $derived(sideRows(match.team2Id));
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="font-[Syne] text-2xl">{match.seriesId} — Game {match.gameNumberInSeries}</h1>
		<FreshnessIndicator {generatedAt} />
	</div>

	<div class="font-mono text-sm text-[#8a8478]">
		{match.stage} · Season {match.season} · {match.gameLength} · winner {teamName.get(
			match.winnerId
		)}
	</div>

	<div class="grid grid-cols-1 gap-8 sm:grid-cols-2">
		<div>
			<h2 class="mb-2 flex items-center gap-2 font-[Syne] text-lg">
				<TeamTag name={teamName.get(match.team1Id)!} />
				{teamName.get(match.team1Id)}
			</h2>
			{#each team1Rows as row (row.kind + row.hero)}
				<div
					class="flex items-center justify-between border-b border-[#2a2620] py-2 font-mono text-sm"
				>
					<span>{row.kind}: {row.hero}</span>
					<BaselineAnnotation value={row.value} baseline={row.baseline} />
				</div>
			{/each}
		</div>
		<div>
			<h2 class="mb-2 flex items-center gap-2 font-[Syne] text-lg">
				<TeamTag name={teamName.get(match.team2Id)!} />
				{teamName.get(match.team2Id)}
			</h2>
			{#each team2Rows as row (row.kind + row.hero)}
				<div
					class="flex items-center justify-between border-b border-[#2a2620] py-2 font-mono text-sm"
				>
					<span>{row.kind}: {row.hero}</span>
					<BaselineAnnotation value={row.value} baseline={row.baseline} />
				</div>
			{/each}
		</div>
	</div>
</div>
