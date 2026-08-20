<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import { banRate, pickRate } from '$lib/metrics';
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
	const leaguePickRate = $derived(pickRate(mockDataset));
	const leagueBanRate = $derived(banRate(mockDataset));

	const team1Wins = $derived(games.filter((g) => g.winnerId === team1Id).length);
	const team2Wins = $derived(games.filter((g) => g.winnerId === team2Id).length);
	const bestOf = $derived(2 * Math.max(team1Wins, team2Wins) - 1);
	const date = $derived(first.playedAt?.split(' - ')[0] ?? null);

	// A pick/ban is flagged notable when the team's rate for that hero diverges
	// from the league baseline by 15+ points — the threshold at which "SRG bans
	// Fanny a lot" starts to actually mean something rather than noise.
	const NOTABLE_DELTA = 0.15;

	function draftRows(matchId: number, teamId: number) {
		const teamPickRate = pickRate(mockDataset, { teamId });
		const teamBanRate = banRate(mockDataset, { teamId });
		return mockDataset.drafts
			.filter((d) => d.matchId === matchId && d.teamId === teamId)
			.sort((a, b) => Number(a.isBan) - Number(b.isBan) || a.slot - b.slot)
			.map((d) => {
				const hero = heroName.get(d.heroId)!;
				const rate = d.isBan ? teamBanRate : teamPickRate;
				const leagueRate = d.isBan ? leagueBanRate : leaguePickRate;
				const value = rate[hero] ?? 0;
				const baseline = leagueRate[hero] ?? 0;
				return {
					hero,
					isBan: d.isBan,
					kind: d.isBan ? 'Ban' : 'Pick',
					value,
					baseline,
					notable: Math.abs(value - baseline) >= NOTABLE_DELTA
				};
			});
	}
</script>

{#snippet heroRow(rows: { hero: string; notable: boolean }[])}
	<div class="flex flex-wrap gap-1">
		{#each rows as row (row.hero)}
			<HeroTag name={row.hero} size={22} showName={false} notable={row.notable} />
		{/each}
	</div>
{/snippet}

{#snippet detailRows(rows: { hero: string; kind: string; value: number; baseline: number; notable: boolean }[])}
	{#each rows as row (row.kind + row.hero)}
		<div
			class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line/60 py-2 font-mono text-sm {row.notable
				? 'bg-gold/5'
				: ''}"
		>
			<span class="flex items-center gap-2">
				<span class={row.kind === 'Ban' ? 'text-negative' : 'text-positive'}>{row.kind}</span>
				<HeroTag name={row.hero} notable={row.notable} />
			</span>
			<BaselineAnnotation value={row.value} baseline={row.baseline} />
		</div>
	{/each}
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

	<p class="font-mono text-xs text-muted">
		Gold ring marks a pick or ban 15+ points off this team's usual rate for that hero. Expand a
		game for the full breakdown against the league baseline.
	</p>

	<div class="space-y-3">
		{#each games as game, i (game.id)}
			{@const team1Rows = draftRows(game.id, team1Id)}
			{@const team2Rows = draftRows(game.id, team2Id)}
			{@const team1Picks = team1Rows.filter((r) => !r.isBan)}
			{@const team1Bans = team1Rows.filter((r) => r.isBan)}
			{@const team2Picks = team2Rows.filter((r) => !r.isBan)}
			{@const team2Bans = team2Rows.filter((r) => r.isBan)}
			{@const team1SideLabel = game.team1Side === 'blue' ? 'Blue' : 'Red'}
			{@const team2SideLabel = game.team1Side === 'blue' ? 'Red' : 'Blue'}
			<details class="card group" open={i === 0}>
				<summary
					class="flex cursor-pointer list-none flex-col gap-3 rounded-t-xl p-4 transition-colors hover:bg-surface-2/60 marker:content-none [&::-webkit-details-marker]:hidden"
				>
					<div class="flex items-center justify-between gap-3">
						<h2 class="font-display text-sm tracking-wide text-ink">Game {game.gameNumberInSeries}</h2>
						<span class="flex items-center gap-3 font-mono text-xs text-muted">
							{game.gameLength}
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
								class="shrink-0 transition-transform group-open:rotate-180"
							>
								<path d="M2 3.5 5 6.5 8 3.5" />
							</svg>
						</span>
					</div>

					<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
						<div class="flex items-center gap-2">
							<span
								class="w-5 shrink-0 text-center font-mono text-xs font-bold {game.winnerId ===
								team1Id
									? 'text-positive'
									: 'text-negative'}">{game.winnerId === team1Id ? 'W' : 'L'}</span
							>
							<div
								class="min-w-0 flex-1 rounded-md border p-1.5 {game.team1Side === 'blue'
									? 'border-sky-500/40'
									: 'border-rose-500/40'}"
							>
								<span class="mb-1 block font-mono text-[11px] uppercase tracking-wide text-muted"
									>{team1SideLabel} side · picks</span
								>
								{@render heroRow(team1Picks)}
							</div>
						</div>
						<div class="flex items-center gap-2 sm:flex-row-reverse">
							<span
								class="w-5 shrink-0 text-center font-mono text-xs font-bold {game.winnerId ===
								team2Id
									? 'text-positive'
									: 'text-negative'}">{game.winnerId === team2Id ? 'W' : 'L'}</span
							>
							<div
								class="min-w-0 flex-1 rounded-md border p-1.5 {game.team1Side === 'blue'
									? 'border-rose-500/40'
									: 'border-sky-500/40'}"
							>
								<span
									class="mb-1 block text-right font-mono text-[11px] uppercase tracking-wide text-muted"
									>{team2SideLabel} side · picks</span
								>
								{@render heroRow(team2Picks)}
							</div>
						</div>
					</div>

					<div
						class="flex flex-col items-center gap-2 border-t border-line/60 pt-2 sm:flex-row sm:justify-between sm:gap-3"
					>
						{@render heroRow(team1Bans)}
						<span class="shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted">Bans</span>
						{@render heroRow(team2Bans)}
					</div>
				</summary>

				<div class="grid grid-cols-1 gap-6 border-t border-line/60 p-4 sm:grid-cols-2">
					<div>
						<h3
							class="mb-3 flex items-center justify-between gap-2 font-display text-base tracking-wide text-ink"
						>
							<span class="flex items-center gap-2">
								<TeamTag name={teamName.get(team1Id)!} size={18} />
								{teamName.get(team1Id)}
							</span>
							{#if game.winnerId === team1Id}
								<span class="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-xs text-gold"
									>Winner</span
								>
							{/if}
						</h3>
						{@render detailRows(team1Rows)}
					</div>
					<div>
						<h3
							class="mb-3 flex items-center justify-between gap-2 font-display text-base tracking-wide text-ink"
						>
							<span class="flex items-center gap-2">
								<TeamTag name={teamName.get(team2Id)!} size={18} />
								{teamName.get(team2Id)}
							</span>
							{#if game.winnerId === team2Id}
								<span class="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-xs text-gold"
									>Winner</span
								>
							{/if}
						</h3>
						{@render detailRows(team2Rows)}
					</div>
				</div>
			</details>
		{/each}
	</div>
</div>
