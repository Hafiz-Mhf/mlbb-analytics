<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import { presence } from '$lib/metrics';
	import { resolve } from '$app/paths';
	import BaselineAnnotation from '$lib/components/BaselineAnnotation.svelte';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import HeroTag from '$lib/components/HeroTag.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';

	let { data } = $props();
	const games = $derived(data.games);
	const first = $derived(games[0]);
	const team1Id = $derived(first.team1Id);
	const team2Id = $derived(first.team2Id);

	const teamName = new Map(mockDataset.teams.map((t) => [t.id, t.canonicalName]));
	const heroName = new Map(mockDataset.heroes.map((h) => [h.id, h.canonicalName]));
	const leaguePresence = $derived(presence(mockDataset));

	const team1Wins = $derived(games.filter((g) => g.winnerId === team1Id).length);
	const team2Wins = $derived(games.filter((g) => g.winnerId === team2Id).length);
	const bestOf = $derived(2 * Math.max(team1Wins, team2Wins) - 1);
	const date = $derived(first.playedAt?.split(' - ')[0] ?? null);

	function draftRows(matchId: number, teamId: number, isBan: boolean) {
		return mockDataset.drafts
			.filter((d) => d.matchId === matchId && d.teamId === teamId && d.isBan === isBan)
			.sort((a, b) => a.slot - b.slot)
			.map((d) => heroName.get(d.heroId)!);
	}

	function detailRows(matchId: number, teamId: number) {
		const teamPresence = presence(mockDataset, { teamId });
		return mockDataset.drafts
			.filter((d) => d.matchId === matchId && d.teamId === teamId)
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
</script>

{#snippet heroRow(names: string[])}
	<div class="flex gap-1">
		{#each names as name (name)}
			<HeroTag {name} size={22} showName={false} />
		{/each}
	</div>
{/snippet}

{#snippet detailCard(teamId: number, matchId: number)}
	{@const rows = detailRows(matchId, teamId)}
	<div class="card p-5 {games.find((g) => g.id === matchId)?.winnerId === teamId ? 'ring-1 ring-gold/60' : ''}">
		<h3 class="mb-3 flex items-center justify-between gap-2 font-display text-base tracking-wide text-ink">
			<span class="flex items-center gap-2">
				<TeamTag name={teamName.get(teamId)!} size={18} />
				{teamName.get(teamId)}
			</span>
			{#if games.find((g) => g.id === matchId)?.winnerId === teamId}
				<span class="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-xs text-gold">Winner</span>
			{/if}
		</h3>
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
			{first.stage === 'playoffs' ? 'Playoffs' : 'Regular Season'} · Season {first.season}
		</h1>
		<FreshnessIndicator {generatedAt} />
	</div>

	<div class="card flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-center sm:gap-10">
		<span
			class="flex items-center gap-2 font-display text-lg tracking-wide text-ink {team1Wins > team2Wins
				? 'rounded-full ring-1 ring-gold/60'
				: ''} px-3 py-1"
		>
			<TeamTag name={teamName.get(team1Id)!} size={28} />
			{teamName.get(team1Id)}
		</span>
		<div class="text-center">
			<div class="font-display text-3xl text-ink">{team1Wins} : {team2Wins}</div>
			<div class="font-mono text-xs text-muted">Bo{bestOf}</div>
		</div>
		<span
			class="flex items-center gap-2 font-display text-lg tracking-wide text-ink {team2Wins > team1Wins
				? 'rounded-full ring-1 ring-gold/60'
				: ''} px-3 py-1"
		>
			<TeamTag name={teamName.get(team2Id)!} size={28} />
			{teamName.get(team2Id)}
		</span>
	</div>
	{#if date}
		<div class="text-center font-mono text-xs text-muted">{date}</div>
	{/if}

	<div class="space-y-3">
		{#each games as game (game.id)}
			{@const team1Picks = draftRows(game.id, team1Id, false)}
			{@const team2Picks = draftRows(game.id, team2Id, false)}
			{@const team1Bans = draftRows(game.id, team1Id, true)}
			{@const team2Bans = draftRows(game.id, team2Id, true)}
			<div class="card p-4">
				<div class="mb-2 flex items-center justify-between font-mono text-xs text-muted">
					<span>Game {game.gameNumberInSeries}</span>
					<span>{game.gameLength}</span>
				</div>
				<div class="flex items-center justify-between gap-3">
					<span
						class="w-5 shrink-0 text-center font-mono text-xs font-bold {game.winnerId === team1Id
							? 'text-positive'
							: 'text-negative'}">{game.winnerId === team1Id ? 'W' : 'L'}</span
					>
					<div
						class="rounded-md border p-1 {game.team1Side === 'blue'
							? 'border-sky-500/40'
							: 'border-rose-500/40'}"
					>
						{@render heroRow(team1Picks)}
					</div>
					<div
						class="rounded-md border p-1 {game.team1Side === 'blue'
							? 'border-rose-500/40'
							: 'border-sky-500/40'}"
					>
						{@render heroRow(team2Picks)}
					</div>
					<span
						class="w-5 shrink-0 text-center font-mono text-xs font-bold {game.winnerId === team2Id
							? 'text-positive'
							: 'text-negative'}">{game.winnerId === team2Id ? 'W' : 'L'}</span
					>
				</div>
				<div class="mt-2 flex items-center justify-between gap-3 border-t border-line/60 pt-2">
					{@render heroRow(team1Bans)}
					<span class="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted">Bans</span>
					{@render heroRow(team2Bans)}
				</div>
			</div>
		{/each}
	</div>

	<div class="space-y-6">
		{#each games as game (game.id)}
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
				{@render detailCard(team1Id, game.id)}
				{@render detailCard(team2Id, game.id)}
			</div>
		{/each}
	</div>
</div>
