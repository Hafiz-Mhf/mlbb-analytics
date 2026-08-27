<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import {
		leagueSidePerformance,
		teamSideMatrix,
		heroSidePriorities
	} from '$lib/metrics';
	import { teamSlug } from '$lib/teams';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';
	import HeroTag from '$lib/components/HeroTag.svelte';

	let selectedSeason = $state('all');
	let heroTab = $state<'blue' | 'red' | 'swings'>('blue');

	// Sync state from URL params in browser
	$effect(() => {
		if (!browser) return;
		const paramSeason = page.url.searchParams.get('season');
		if (paramSeason && paramSeason !== selectedSeason) selectedSeason = paramSeason;
	});

	function setSeason(season: string) {
		selectedSeason = season;
		const params = new URLSearchParams();
		if (season !== 'all') params.set('season', season);
		const qs = params.toString() ? `?${params.toString()}` : '';
		goto(`${resolve('/sides')}${qs}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	const seasonOpts = $derived(
		selectedSeason === 'all' ? {} : { season: selectedSeason }
	);

	const league = $derived(leagueSidePerformance(mockDataset, seasonOpts));
	const teamMatrix = $derived(teamSideMatrix(mockDataset, seasonOpts));
	const heroPriorities = $derived(heroSidePriorities(mockDataset, seasonOpts));

	const activeHeroList = $derived(
		heroTab === 'blue'
			? heroPriorities.bluePriority.slice(0, 20)
			: heroTab === 'red'
				? heroPriorities.redPriority.slice(0, 20)
				: heroPriorities.winRateSwings.slice(0, 20)
	);

	function formatDuration(seconds: number): string {
		if (seconds <= 0) return '—';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}
</script>

<svelte:head>
	<title>Side Priority Analysis (Blue vs Red) — MLBB Analytics</title>
</svelte:head>

<div class="space-y-8">
	<!-- Header & Season Filter -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="font-display text-2xl tracking-wide text-ink">Side Priority Analysis</h1>
			<p class="font-mono text-xs text-muted">
				Compare how draft priorities and win rates shift between First Pick (Blue Side) and Counter-Pick (Red Side).
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<div class="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
				<button
					type="button"
					onclick={() => setSeason('all')}
					class={selectedSeason === 'all'
						? 'rounded-full bg-surface-2 px-3 py-1 font-display text-xs tracking-wide text-primary'
						: 'rounded-full px-3 py-1 font-display text-xs tracking-wide text-muted hover:text-ink'}
				>
					All Seasons
				</button>
				<button
					type="button"
					onclick={() => setSeason('18')}
					class={selectedSeason === '18'
						? 'rounded-full bg-surface-2 px-3 py-1 font-display text-xs tracking-wide text-primary'
						: 'rounded-full px-3 py-1 font-display text-xs tracking-wide text-muted hover:text-ink'}
				>
					Season 18
				</button>
				<button
					type="button"
					onclick={() => setSeason('17')}
					class={selectedSeason === '17'
						? 'rounded-full bg-surface-2 px-3 py-1 font-display text-xs tracking-wide text-primary'
						: 'rounded-full px-3 py-1 font-display text-xs tracking-wide text-muted hover:text-ink'}
				>
					Season 17
				</button>
			</div>
			<FreshnessIndicator {generatedAt} />
		</div>
	</div>

	<!-- League Side Meta Split Banner -->
	<div class="card p-6">
		<div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 class="font-display text-lg tracking-wide text-ink">Tournament Side Balance</h2>
				<p class="font-mono text-xs text-muted">
					Overall win rate split between Blue Side (First Pick) and Red Side (Second Pick).
				</p>
			</div>
			<div class="font-mono text-xs text-muted">
				{league.totalMatches} matches analyzed
			</div>
		</div>

		<!-- Segmented Split Bar -->
		<div class="space-y-2">
			<div class="flex justify-between font-mono text-sm font-semibold">
				<span class="flex items-center gap-2 text-sky-400">
					<span class="h-2.5 w-2.5 rounded-full bg-sky-400"></span>
					Blue Side: {(league.blueWinRate * 100).toFixed(1)}% ({league.blueWins}W)
				</span>
				<span class="flex items-center gap-2 text-rose-400">
					Red Side: {(league.redWinRate * 100).toFixed(1)}% ({league.redWins}W)
					<span class="h-2.5 w-2.5 rounded-full bg-rose-400"></span>
				</span>
			</div>

			<div class="h-4 w-full overflow-hidden rounded-full bg-surface-2 flex">
				<div
					class="h-full bg-sky-400 transition-all duration-300"
					style="width: {league.blueWinRate * 100}%"
					title="Blue Side: {(league.blueWinRate * 100).toFixed(1)}%"
				></div>
				<div
					class="h-full bg-rose-400 transition-all duration-300"
					style="width: {league.redWinRate * 100}%"
					title="Red Side: {(league.redWinRate * 100).toFixed(1)}%"
				></div>
			</div>
		</div>

		<!-- Comparative Key Metrics -->
		<div class="mt-6 grid grid-cols-1 gap-4 border-t border-line pt-6 sm:grid-cols-3">
			<div class="rounded-xl border border-line bg-surface p-4">
				<p class="font-display text-xs tracking-wide text-muted uppercase">
					<abbr title="Difference between Blue side win rate and Red side win rate. Positive indicates first-pick advantage.">
						First-Pick Advantage
					</abbr>
				</p>
				<p class="mt-2 font-mono text-2xl font-bold {league.blueWinRate >= league.redWinRate ? 'text-sky-400' : 'text-rose-400'}">
					{league.blueWinRate >= league.redWinRate ? '+' : ''}{((league.blueWinRate - league.redWinRate) * 100).toFixed(1)}%
				</p>
				<p class="font-mono text-xs text-muted">
					{league.blueWinRate >= league.redWinRate ? 'Blue side favored' : 'Red side favored'}
				</p>
			</div>

			<div class="rounded-xl border border-line bg-surface p-4">
				<p class="font-display text-xs tracking-wide text-muted uppercase">Blue Win Avg Duration</p>
				<p class="mt-2 font-mono text-2xl font-bold text-ink">
					{formatDuration(league.avgBlueGameDurationSeconds)}
				</p>
				<p class="font-mono text-xs text-muted">Average game length when Blue wins</p>
			</div>

			<div class="rounded-xl border border-line bg-surface p-4">
				<p class="font-display text-xs tracking-wide text-muted uppercase">Red Win Avg Duration</p>
				<p class="mt-2 font-mono text-2xl font-bold text-ink">
					{formatDuration(league.avgRedGameDurationSeconds)}
				</p>
				<p class="font-mono text-xs text-muted">Average game length when Red wins</p>
			</div>
		</div>
	</div>

	<!-- 8-Team Side Asymmetry Matrix Card -->
	<div class="card p-5 sm:p-6">
		<div class="mb-4">
			<h2 class="font-display text-lg tracking-wide text-ink">Team Side Asymmetry Matrix</h2>
			<p class="font-mono text-xs text-muted">
				Side win rates, gap delta, and reliance classifications for all 8 MPL teams.
			</p>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full border-collapse font-mono text-xs">
				<thead>
					<tr class="border-b border-line text-left font-display text-xs tracking-wide text-muted uppercase">
						<th class="py-2.5 pr-4">Team</th>
						<th class="py-2.5 px-3 text-right">Blue Record (WR)</th>
						<th class="py-2.5 px-3 text-right">Red Record (WR)</th>
						<th class="py-2.5 px-3 text-right">
							<abbr title="Blue Win Rate minus Red Win Rate">Side Gap</abbr>
						</th>
						<th class="py-2.5 pl-3 text-center">Side Reliance</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-line/40">
					{#each teamMatrix as row (row.teamId)}
						<tr class="transition-colors hover:bg-surface/50">
							<td class="py-2.5 pr-4 font-semibold text-ink">
								<a
									href={resolve('/team/[slug]', { slug: teamSlug(row.teamName) })}
									class="inline-flex items-center gap-2 hover:text-primary transition-colors"
								>
									<TeamTag name={row.teamName} size={22} />
									<span>{row.teamName}</span>
								</a>
							</td>
							<td class="py-2.5 px-3 text-right">
								<span class="font-bold text-sky-400">{(row.blueWinRate * 100).toFixed(1)}%</span>
								<span class="text-muted ml-1">({row.blueWins}W–{row.blueGames - row.blueWins}L)</span>
							</td>
							<td class="py-2.5 px-3 text-right">
								<span class="font-bold text-rose-400">{(row.redWinRate * 100).toFixed(1)}%</span>
								<span class="text-muted ml-1">({row.redWins}W–{row.redGames - row.redWins}L)</span>
							</td>
							<td class="py-2.5 px-3 text-right font-bold {row.sideDelta > 0 ? 'text-sky-400' : row.sideDelta < 0 ? 'text-rose-400' : 'text-muted'}">
								{row.sideDelta > 0 ? '+' : ''}{(row.sideDelta * 100).toFixed(1)}%
							</td>
							<td class="py-2.5 pl-3 text-center">
								{#if row.reliance === 'blue_reliant'}
									<span class="inline-block rounded-full bg-sky-950/60 border border-sky-800/60 px-2.5 py-0.5 text-[10px] font-semibold text-sky-300">
										Blue-Reliant
									</span>
								{:else if row.reliance === 'red_reliant'}
									<span class="inline-block rounded-full bg-rose-950/60 border border-rose-800/60 px-2.5 py-0.5 text-[10px] font-semibold text-rose-300">
										Red-Reliant
									</span>
								{:else}
									<span class="inline-block rounded-full bg-surface-2 px-2.5 py-0.5 text-[10px] text-muted">
										Balanced
									</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Side-Specific Hero Priorities Card -->
	<div class="card p-5 sm:p-6">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 class="font-display text-lg tracking-wide text-ink">
					Side-Specific Hero Priorities
				</h2>
				<p class="font-mono text-xs text-muted">
					Compare which heroes dominate Blue Side first-picks vs Red Side counter-picks.
				</p>
			</div>

			<!-- Sub-Tabs -->
			<div class="flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface p-1">
				<button
					type="button"
					onclick={() => (heroTab = 'blue')}
					class={heroTab === 'blue'
						? 'rounded-full bg-surface-2 px-3 py-1 font-display text-xs tracking-wide text-sky-400'
						: 'rounded-full px-3 py-1 font-display text-xs tracking-wide text-muted hover:text-ink'}
				>
					First-Pick Priority (Blue)
				</button>
				<button
					type="button"
					onclick={() => (heroTab = 'red')}
					class={heroTab === 'red'
						? 'rounded-full bg-surface-2 px-3 py-1 font-display text-xs tracking-wide text-rose-400'
						: 'rounded-full px-3 py-1 font-display text-xs tracking-wide text-muted hover:text-ink'}
				>
					Counter-Pick Priority (Red)
				</button>
				<button
					type="button"
					onclick={() => (heroTab = 'swings')}
					class={heroTab === 'swings'
						? 'rounded-full bg-surface-2 px-3 py-1 font-display text-xs tracking-wide text-primary'
						: 'rounded-full px-3 py-1 font-display text-xs tracking-wide text-muted hover:text-ink'}
				>
					Side Win-Rate Swings
				</button>
			</div>
		</div>

		<!-- Table -->
		<div class="mt-4 overflow-x-auto">
			{#if activeHeroList.length === 0}
				<div class="py-8 text-center font-mono text-xs text-muted">
					No heroes meet the sample criteria for this category.
				</div>
			{:else}
				<table class="w-full border-collapse font-mono text-xs">
					<thead>
						<tr class="border-b border-line text-left font-display text-xs tracking-wide text-muted uppercase">
							<th class="py-2.5 pr-4">Hero</th>
							<th class="py-2.5 px-3 text-right">Blue Presence</th>
							<th class="py-2.5 px-3 text-right">Blue Win Rate</th>
							<th class="py-2.5 px-3 text-right">Red Presence</th>
							<th class="py-2.5 px-3 text-right">Red Win Rate</th>
							<th class="py-2.5 pl-3 text-right">
								{heroTab === 'swings' ? 'WR Delta' : 'Presence Delta'}
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-line/40">
						{#each activeHeroList as item (item.hero)}
							<tr class="transition-colors hover:bg-surface/50">
								<td class="py-2.5 pr-4 font-semibold text-ink">
									<HeroTag name={item.hero} size={24} />
								</td>
								<td class="py-2.5 px-3 text-right">
									<span class="font-bold text-sky-400">{(item.bluePresence * 100).toFixed(1)}%</span>
									<span class="block text-[10px] text-muted">
										P: {(item.bluePickRate * 100).toFixed(0)}% · B: {(item.blueBanRate * 100).toFixed(0)}%
									</span>
								</td>
								<td class="py-2.5 px-3 text-right">
									{#if item.blueGames > 0}
										<span class="font-bold text-ink">{(item.blueWinRate * 100).toFixed(1)}%</span>
										<span class="block text-[10px] text-muted">{item.blueWins}/{item.blueGames}g</span>
									{:else}
										<span class="text-muted">—</span>
									{/if}
								</td>
								<td class="py-2.5 px-3 text-right">
									<span class="font-bold text-rose-400">{(item.redPresence * 100).toFixed(1)}%</span>
									<span class="block text-[10px] text-muted">
										P: {(item.redPickRate * 100).toFixed(0)}% · B: {(item.redBanRate * 100).toFixed(0)}%
									</span>
								</td>
								<td class="py-2.5 px-3 text-right">
									{#if item.redGames > 0}
										<span class="font-bold text-ink">{(item.redWinRate * 100).toFixed(1)}%</span>
										<span class="block text-[10px] text-muted">{item.redWins}/{item.redGames}g</span>
									{:else}
										<span class="text-muted">—</span>
									{/if}
								</td>
								<td class="py-2.5 pl-3 text-right font-bold">
									{#if heroTab === 'swings'}
										<span class={item.winRateDelta > 0 ? 'text-sky-400' : item.winRateDelta < 0 ? 'text-rose-400' : 'text-muted'}>
											{item.winRateDelta > 0 ? '+' : ''}{(item.winRateDelta * 100).toFixed(1)}%
										</span>
									{:else}
										<span class={item.presenceDelta > 0 ? 'text-sky-400' : item.presenceDelta < 0 ? 'text-rose-400' : 'text-muted'}>
											{item.presenceDelta > 0 ? '+' : ''}{(item.presenceDelta * 100).toFixed(1)}%
										</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>
</div>
