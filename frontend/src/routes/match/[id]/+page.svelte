<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import { presence } from '$lib/metrics';
	import { resolve } from '$app/paths';
	import BaselineAnnotation from '$lib/components/BaselineAnnotation.svelte';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import HeroTag from '$lib/components/HeroTag.svelte';
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

{#snippet sideCard(teamId: number, rows: ReturnType<typeof sideRows>)}
	<div class="card p-5 {match.winnerId === teamId ? 'ring-1 ring-gold/60' : ''}">
		<h2 class="mb-3 flex items-center justify-between gap-2 font-display text-lg tracking-wide text-ink">
			<span class="flex items-center gap-2">
				<TeamTag name={teamName.get(teamId)!} size={20} />
				{teamName.get(teamId)}
			</span>
			{#if match.winnerId === teamId}
				<span class="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-xs text-gold">Winner</span>
			{/if}
		</h2>
		{#each rows as row (row.kind + row.hero)}
			<div class="flex items-center justify-between border-b border-line/60 py-2 font-mono text-sm">
				<span class="flex items-center gap-2">
					<span class={row.kind === 'Ban' ? 'text-negative' : 'text-positive'}>{row.kind}</span>
					<HeroTag name={row.hero} />
				</span>
				<BaselineAnnotation value={row.value} baseline={row.baseline} />
			</div>
		{/each}
	</div>
{/snippet}

<div class="space-y-6">
	<a
		href={resolve('/log')}
		class="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-primary"
	>
		<svg
			width="10"
			height="10"
			viewBox="0 0 10 10"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M6.5 2 3.5 5 6.5 8" />
		</svg>
		Back to Match Log
	</a>
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="font-display text-2xl tracking-wide text-ink">
			{match.seriesId} — Game {match.gameNumberInSeries}
		</h1>
		<FreshnessIndicator {generatedAt} />
	</div>

	<div class="font-mono text-sm text-muted">
		{match.stage} · Season {match.season} · {match.gameLength} · winner {teamName.get(
			match.winnerId
		)}
	</div>

	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
		{@render sideCard(match.team1Id, team1Rows)}
		{@render sideCard(match.team2Id, team2Rows)}
	</div>
</div>
