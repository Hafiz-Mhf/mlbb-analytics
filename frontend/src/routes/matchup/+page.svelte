<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import {
		headToHeadSummary,
		sidePerformance,
		heroClash,
		matchupRoleComparison,
		hhi,
		ROLE_NAMES,
		type ClashCategory
	} from '$lib/metrics';
	import { teamSlug } from '$lib/teams';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';
	import HeroTag from '$lib/components/HeroTag.svelte';
	import StatBlock from '$lib/components/StatBlock.svelte';

	const teams = mockDataset.teams;
	const heroName = new Map(mockDataset.heroes.map((h) => [h.id, h.canonicalName]));

	// Team options sorted by name
	const teamOptions = teams
		.map((t) => ({ slug: teamSlug(t.canonicalName), id: t.id, name: t.canonicalName, shortCode: t.shortCode }))
		.sort((a, b) => a.name.localeCompare(b.name));

	// Search params or sensible defaults (SRG vs Team Flash / next distinct team)
	const initialT1 = page.url.searchParams.get('t1') ?? 'srg';
	let defaultT2 = 'fl';
	if (initialT1 === defaultT2) {
		defaultT2 = teamOptions.find((t) => t.slug !== initialT1)?.slug ?? 'vms';
	}
	const initialT2 = page.url.searchParams.get('t2') ?? defaultT2;
	const initialSeason = page.url.searchParams.get('season') ?? 'all';

	let team1Slug = $state(initialT1);
	let team2Slug = $state(initialT2);
	let selectedSeason = $state(initialSeason);
	let clashTab = $state<ClashCategory>('contested');

	// Sync state when URL params change
	$effect(() => {
		const paramT1 = page.url.searchParams.get('t1');
		const paramT2 = page.url.searchParams.get('t2');
		const paramSeason = page.url.searchParams.get('season');

		if (paramT1 && paramT1 !== team1Slug) team1Slug = paramT1;
		if (paramT2 && paramT2 !== team2Slug) team2Slug = paramT2;
		if (paramSeason && paramSeason !== selectedSeason) selectedSeason = paramSeason;
	});

	function updateUrl(t1: string, t2: string, season: string) {
		const params = new URLSearchParams();
		params.set('t1', t1);
		params.set('t2', t2);
		if (season !== 'all') params.set('season', season);
		goto(`${resolve('/matchup')}?${params.toString()}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function handleTeam1Change(e: Event) {
		const newT1 = (e.target as HTMLSelectElement).value;
		let newT2 = team2Slug;
		if (newT1 === newT2) {
			newT2 = teamOptions.find((t) => t.slug !== newT1)?.slug ?? 'srg';
		}
		team1Slug = newT1;
		team2Slug = newT2;
		updateUrl(newT1, newT2, selectedSeason);
	}

	function handleTeam2Change(e: Event) {
		const newT2 = (e.target as HTMLSelectElement).value;
		let newT1 = team1Slug;
		if (newT2 === newT1) {
			newT1 = teamOptions.find((t) => t.slug !== newT2)?.slug ?? 'srg';
		}
		team1Slug = newT1;
		team2Slug = newT2;
		updateUrl(newT1, newT2, selectedSeason);
	}

	function swapTeams() {
		const prevT1 = team1Slug;
		const prevT2 = team2Slug;
		team1Slug = prevT2;
		team2Slug = prevT1;
		updateUrl(prevT2, prevT1, selectedSeason);
	}

	function setSeason(season: string) {
		selectedSeason = season;
		updateUrl(team1Slug, team2Slug, season);
	}

	const team1 = $derived(
		teamOptions.find((t) => t.slug === team1Slug) ?? teamOptions[0]
	);
	const team2 = $derived(
		teamOptions.find((t) => t.slug === team2Slug) ?? teamOptions[1]
	);

	const seasonOpts = $derived(
		selectedSeason === 'all' ? {} : { season: selectedSeason }
	);

	// Direct Head-to-Head summary
	const h2h = $derived(headToHeadSummary(mockDataset, team1.id, team2.id, seasonOpts));

	// Overall Team Performance in scope
	const t1Matches = $derived(
		mockDataset.matches.filter(
			(m) => (m.team1Id === team1.id || m.team2Id === team1.id) && (selectedSeason === 'all' || m.season === selectedSeason)
		)
	);
	const t2Matches = $derived(
		mockDataset.matches.filter(
			(m) => (m.team1Id === team2.id || m.team2Id === team2.id) && (selectedSeason === 'all' || m.season === selectedSeason)
		)
	);

	const t1Wins = $derived(t1Matches.filter((m) => m.winnerId === team1.id).length);
	const t2Wins = $derived(t2Matches.filter((m) => m.winnerId === team2.id).length);

	const t1WinRate = $derived(t1Matches.length > 0 ? t1Wins / t1Matches.length : 0);
	const t2WinRate = $derived(t2Matches.length > 0 ? t2Wins / t2Matches.length : 0);

	// Draft Predictability (HHI)
	const t1Hhi = $derived(hhi(mockDataset, { ...seasonOpts, teamId: team1.id }));
	const t2Hhi = $derived(hhi(mockDataset, { ...seasonOpts, teamId: team2.id }));
	const leagueHhi = $derived(hhi(mockDataset, seasonOpts));

	// Side Performance
	const t1Side = $derived(sidePerformance(mockDataset, team1.id, seasonOpts));
	const t2Side = $derived(sidePerformance(mockDataset, team2.id, seasonOpts));

	// Draft Clash & Hero Priority
	const clash = $derived(heroClash(mockDataset, team1.id, team2.id, seasonOpts));
	const activeClashList = $derived(
		clashTab === 'contested'
			? clash.contested
			: clashTab === 'team1_priority'
				? clash.team1Priority
				: clash.team2Priority
	);

	// Role Comparison
	const roleComparisons = $derived(matchupRoleComparison(mockDataset, team1.id, team2.id, seasonOpts));

	// Direct encounters games grouped by series
	const directSeriesList = $derived.by(() => {
		const directGames = mockDataset.matches.filter((m) => {
			if (selectedSeason !== 'all' && m.season !== selectedSeason) return false;
			return (
				(m.team1Id === team1.id && m.team2Id === team2.id) ||
				(m.team1Id === team2.id && m.team2Id === team1.id)
			);
		});

		const seriesMap = new Map<string, typeof directGames>();
		for (const g of directGames) {
			const arr = seriesMap.get(g.seriesId) ?? [];
			arr.push(g);
			seriesMap.set(g.seriesId, arr);
		}

		return [...seriesMap.entries()].map(([seriesId, games]) => {
			games.sort((a, b) => a.gameNumberInSeries - b.gameNumberInSeries);
			const t1WinsCount = games.filter((g) => g.winnerId === team1.id).length;
			const t2WinsCount = games.filter((g) => g.winnerId === team2.id).length;
			return {
				seriesId,
				season: games[0].season,
				stage: games[0].stage,
				date: games[0].playedAt?.split(' - ')[0] ?? 'Date unknown',
				t1WinsCount,
				t2WinsCount,
				games: games.map((g) => {
					const isT1MatchTeam1 = g.team1Id === team1.id;
					const t1SideColor = isT1MatchTeam1 ? g.team1Side : g.team1Side === 'blue' ? 'red' : 'blue';
					const t2SideColor = t1SideColor === 'blue' ? 'red' : 'blue';

					const t1Picks = mockDataset.drafts
						.filter((d) => d.matchId === g.id && d.teamId === team1.id && !d.isBan)
						.sort((a, b) => a.slot - b.slot)
						.map((d) => heroName.get(d.heroId)!);

					const t2Picks = mockDataset.drafts
						.filter((d) => d.matchId === g.id && d.teamId === team2.id && !d.isBan)
						.sort((a, b) => a.slot - b.slot)
						.map((d) => heroName.get(d.heroId)!);

					const t1Bans = mockDataset.drafts
						.filter((d) => d.matchId === g.id && d.teamId === team1.id && d.isBan)
						.map((d) => heroName.get(d.heroId)!);

					const t2Bans = mockDataset.drafts
						.filter((d) => d.matchId === g.id && d.teamId === team2.id && d.isBan)
						.map((d) => heroName.get(d.heroId)!);

					return {
						id: g.id,
						gameNumber: g.gameNumberInSeries,
						winnerId: g.winnerId,
						isT1Winner: g.winnerId === team1.id,
						gameLength: g.gameLength,
						t1Side: t1SideColor,
						t2Side: t2SideColor,
						t1Picks,
						t2Picks,
						t1Bans,
						t2Bans
					};
				})
			};
		});
	});

	function formatDuration(seconds: number): string {
		if (seconds <= 0) return '—';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}
</script>

<svelte:head>
	<title>{team1.name} vs {team2.name} | Head-to-Head Matchup — MLBB Analytics</title>
</svelte:head>

<div class="space-y-8">
	<!-- Page Header & Team Switcher -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="font-display text-2xl tracking-wide text-ink">Head-to-Head Matchup</h1>
			<p class="font-mono text-xs text-muted">
				Compare draft tendencies, contested hero battlegrounds, and side win rates between two teams.
			</p>
		</div>
		<FreshnessIndicator {generatedAt} />
	</div>

	<!-- Dual Team Selector & Season Controls -->
	<div class="card p-4 sm:p-5">
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<!-- Team Dropdowns & Swap -->
			<div class="flex flex-wrap items-center gap-3">
				<!-- Team 1 Selector -->
				<div class="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5">
					<TeamTag name={team1.name} size={24} />
					<select
						aria-label="Select Team 1"
						value={team1Slug}
						onchange={handleTeam1Change}
						class="bg-transparent font-display text-sm tracking-wide text-ink focus:outline-none"
					>
						{#each teamOptions as opt (opt.slug)}
							<option value={opt.slug} class="bg-bg text-ink">{opt.name}</option>
						{/each}
					</select>
				</div>

				<!-- Swap Button -->
				<button
					type="button"
					onclick={swapTeams}
					aria-label="Swap teams"
					title="Swap teams"
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted transition-all hover:border-primary hover:text-primary active:scale-95"
				>
					<span class="text-base font-bold">⇄</span>
				</button>

				<!-- Team 2 Selector -->
				<div class="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5">
					<TeamTag name={team2.name} size={24} />
					<select
						aria-label="Select Team 2"
						value={team2Slug}
						onchange={handleTeam2Change}
						class="bg-transparent font-display text-sm tracking-wide text-ink focus:outline-none"
					>
						{#each teamOptions as opt (opt.slug)}
							<option value={opt.slug} class="bg-bg text-ink">{opt.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Season Filter Tabs -->
			<div class="flex items-center gap-1 self-start rounded-full border border-line bg-surface p-1 md:self-auto">
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
		</div>
	</div>

	<!-- Matchup Summary Banner -->
	<div class="card relative overflow-hidden p-6">
		<div class="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-center">
			<!-- Team 1 Summary -->
			<div class="flex items-center gap-4">
				<TeamTag name={team1.name} size={48} />
				<div>
					<h2 class="font-display text-xl tracking-wide text-ink">{team1.name}</h2>
					<p class="font-mono text-xs text-muted">
						Overall: {t1Wins}W – {t1Matches.length - t1Wins}L ({(t1WinRate * 100).toFixed(1)}%)
					</p>
				</div>
			</div>

			<!-- Direct Series Score Centerpiece -->
			<div class="flex flex-col items-center justify-center rounded-xl border border-line bg-surface/60 py-4 px-6 text-center">
				<p class="font-display text-xs tracking-wider text-muted uppercase">Direct Series Record</p>
				<div class="my-1 flex items-baseline gap-3">
					<span class="font-display text-3xl font-bold {h2h.team1SeriesWins > h2h.team2SeriesWins ? 'text-primary' : 'text-ink'}">
						{h2h.team1SeriesWins}
					</span>
					<span class="font-display text-xl text-muted">—</span>
					<span class="font-display text-3xl font-bold {h2h.team2SeriesWins > h2h.team1SeriesWins ? 'text-primary' : 'text-ink'}">
						{h2h.team2SeriesWins}
					</span>
				</div>
				<p class="font-mono text-xs text-muted">
					{h2h.team1Wins}W – {h2h.team2Wins}L in {h2h.totalGames} direct {h2h.totalGames === 1 ? 'game' : 'games'}
				</p>
				{#if h2h.totalGames === 0}
					<span class="mt-1 rounded-full bg-surface-2 px-2.5 py-0.5 font-mono text-[10px] text-muted">
						No direct games in {selectedSeason === 'all' ? 'dataset' : `Season ${selectedSeason}`}
					</span>
				{/if}
			</div>

			<!-- Team 2 Summary -->
			<div class="flex items-center justify-start gap-4 md:justify-end">
				<div class="text-left md:text-right">
					<h2 class="font-display text-xl tracking-wide text-ink">{team2.name}</h2>
					<p class="font-mono text-xs text-muted">
						Overall: {t2Wins}W – {t2Matches.length - t2Wins}L ({(t2WinRate * 100).toFixed(1)}%)
					</p>
				</div>
				<TeamTag name={team2.name} size={48} />
			</div>
		</div>

		<!-- Secondary Comparative Metrics Grid -->
		<div class="mt-6 grid grid-cols-1 gap-4 border-t border-line pt-6 sm:grid-cols-3">
			<div class="rounded-xl border border-line bg-surface p-4">
				<p class="font-display text-xs tracking-wide text-muted uppercase">
					<abbr title="Herfindahl-Hirschman Index: Higher = narrower pool, always picks same heroes. Lower = flexible pool.">
						Draft Predictability
					</abbr>
				</p>
				<div class="mt-2 flex items-baseline justify-between">
					<div class="font-mono text-sm font-semibold text-ink">
						<span class="text-muted">{team1.shortCode ?? 'T1'}:</span> {t1Hhi.toFixed(3)}
					</div>
					<div class="font-mono text-xs text-muted">
						Avg: {leagueHhi.toFixed(3)}
					</div>
					<div class="font-mono text-sm font-semibold text-ink">
						<span class="text-muted">{team2.shortCode ?? 'T2'}:</span> {t2Hhi.toFixed(3)}
					</div>
				</div>
			</div>

			<div class="rounded-xl border border-line bg-surface p-4">
				<p class="font-display text-xs tracking-wide text-muted uppercase">Tournament Win Rate</p>
				<div class="mt-2 flex items-baseline justify-between">
					<div class="font-mono text-sm font-semibold {t1WinRate >= t2WinRate ? 'text-positive' : 'text-ink'}">
						{(t1WinRate * 100).toFixed(1)}%
					</div>
					<div class="font-mono text-xs text-muted">vs</div>
					<div class="font-mono text-sm font-semibold {t2WinRate >= t1WinRate ? 'text-positive' : 'text-ink'}">
						{(t2WinRate * 100).toFixed(1)}%
					</div>
				</div>
			</div>

			<div class="rounded-xl border border-line bg-surface p-4">
				<p class="font-display text-xs tracking-wide text-muted uppercase">Avg Direct Game Duration</p>
				<div class="mt-2 flex items-baseline justify-between">
					<div class="font-mono text-sm font-semibold text-ink">
						{formatDuration(h2h.avgGameLengthSeconds)}
					</div>
					<div class="font-mono text-xs text-muted">
						{h2h.totalGames} {h2h.totalGames === 1 ? 'game' : 'games'} sample
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Side Performance (Blue vs Red) Card -->
	<div class="card p-5 sm:p-6">
		<div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 class="font-display text-lg tracking-wide text-ink">
					Side Performance (Blue vs Red)
				</h2>
				<p class="font-mono text-xs text-muted">
					How both teams perform on First Pick (Blue) vs Counter-Pick (Red).
				</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<!-- Team 1 Side Breakdown -->
			<div class="space-y-3 rounded-xl border border-line bg-surface p-4">
				<div class="flex items-center gap-2">
					<TeamTag name={team1.name} size={20} />
					<span class="font-display text-sm text-ink">{team1.name}</span>
				</div>

				<div class="space-y-2">
					<div>
						<div class="flex justify-between font-mono text-xs">
							<span class="text-sky-400">Blue Side (First Pick)</span>
							<span class="text-ink font-semibold">{(t1Side.blueWinRate * 100).toFixed(1)}% ({t1Side.blueWins}/{t1Side.blueGames})</span>
						</div>
						<div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-2">
							<div class="h-full bg-sky-400 rounded-full" style="width: {t1Side.blueWinRate * 100}%"></div>
						</div>
					</div>

					<div>
						<div class="flex justify-between font-mono text-xs">
							<span class="text-rose-400">Red Side (Counter-Pick)</span>
							<span class="text-ink font-semibold">{(t1Side.redWinRate * 100).toFixed(1)}% ({t1Side.redWins}/{t1Side.redGames})</span>
						</div>
						<div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-2">
							<div class="h-full bg-rose-400 rounded-full" style="width: {t1Side.redWinRate * 100}%"></div>
						</div>
					</div>
				</div>
			</div>

			<!-- Team 2 Side Breakdown -->
			<div class="space-y-3 rounded-xl border border-line bg-surface p-4">
				<div class="flex items-center gap-2">
					<TeamTag name={team2.name} size={20} />
					<span class="font-display text-sm text-ink">{team2.name}</span>
				</div>

				<div class="space-y-2">
					<div>
						<div class="flex justify-between font-mono text-xs">
							<span class="text-sky-400">Blue Side (First Pick)</span>
							<span class="text-ink font-semibold">{(t2Side.blueWinRate * 100).toFixed(1)}% ({t2Side.blueWins}/{t2Side.blueGames})</span>
						</div>
						<div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-2">
							<div class="h-full bg-sky-400 rounded-full" style="width: {t2Side.blueWinRate * 100}%"></div>
						</div>
					</div>

					<div>
						<div class="flex justify-between font-mono text-xs">
							<span class="text-rose-400">Red Side (Counter-Pick)</span>
							<span class="text-ink font-semibold">{(t2Side.redWinRate * 100).toFixed(1)}% ({t2Side.redWins}/{t2Side.redGames})</span>
						</div>
						<div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-2">
							<div class="h-full bg-rose-400 rounded-full" style="width: {t2Side.redWinRate * 100}%"></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Draft Clash & Hero Priority Card -->
	<div class="card p-5 sm:p-6">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 class="font-display text-lg tracking-wide text-ink">
					Draft Clash & Hero Priority
				</h2>
				<p class="font-mono text-xs text-muted">
					Identify contested battleground heroes vs team-specific signature priorities.
				</p>
			</div>

			<!-- Sub-Tabs -->
			<div class="flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface p-1">
				<button
					type="button"
					onclick={() => (clashTab = 'contested')}
					class={clashTab === 'contested'
						? 'rounded-full bg-surface-2 px-3 py-1 font-display text-xs tracking-wide text-primary'
						: 'rounded-full px-3 py-1 font-display text-xs tracking-wide text-muted hover:text-ink'}
				>
					Contested ({clash.contested.length})
				</button>
				<button
					type="button"
					onclick={() => (clashTab = 'team1_priority')}
					class={clashTab === 'team1_priority'
						? 'rounded-full bg-surface-2 px-3 py-1 font-display text-xs tracking-wide text-primary'
						: 'rounded-full px-3 py-1 font-display text-xs tracking-wide text-muted hover:text-ink'}
				>
					{team1.shortCode ?? team1.name} Signatures ({clash.team1Priority.length})
				</button>
				<button
					type="button"
					onclick={() => (clashTab = 'team2_priority')}
					class={clashTab === 'team2_priority'
						? 'rounded-full bg-surface-2 px-3 py-1 font-display text-xs tracking-wide text-primary'
						: 'rounded-full px-3 py-1 font-display text-xs tracking-wide text-muted hover:text-ink'}
				>
					{team2.shortCode ?? team2.name} Signatures ({clash.team2Priority.length})
				</button>
			</div>
		</div>

		<!-- Clash Table -->
		<div class="mt-4 overflow-x-auto">
			{#if activeClashList.length === 0}
				<div class="py-8 text-center font-mono text-xs text-muted">
					No heroes in this category for the selected filter.
				</div>
			{:else}
				<table class="w-full border-collapse font-mono text-xs">
					<thead>
						<tr class="border-b border-line text-left font-display text-xs tracking-wide text-muted uppercase">
							<th class="py-2.5 pr-4">Hero</th>
							<th class="py-2.5 px-3 text-center">Primary Lane</th>
							<th class="py-2.5 px-3 text-right">{team1.shortCode ?? 'Team 1'} Pick/Ban</th>
							<th class="py-2.5 px-3 text-right">{team2.shortCode ?? 'Team 2'} Pick/Ban</th>
							<th class="py-2.5 pl-3 text-right">League Baseline</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-line/40">
						{#each activeClashList as item (item.hero)}
							<tr class="transition-colors hover:bg-surface/50">
								<td class="py-2.5 pr-4 font-semibold text-ink">
									<HeroTag name={item.hero} size={24} />
								</td>
								<td class="py-2.5 px-3 text-center">
									{#if item.primaryRole}
										<span class="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
											{ROLE_NAMES[item.primaryRole] ?? `Role ${item.primaryRole}`}
										</span>
									{:else}
										<span class="text-muted">—</span>
									{/if}
								</td>
								<td class="py-2.5 px-3 text-right">
									<span class="font-bold text-ink">{(item.team1Rate * 100).toFixed(1)}%</span>
									<span class="block text-[10px] text-muted">
										P: {(item.team1PickRate * 100).toFixed(0)}% · B: {(item.team1BanRate * 100).toFixed(0)}%
									</span>
								</td>
								<td class="py-2.5 px-3 text-right">
									<span class="font-bold text-ink">{(item.team2Rate * 100).toFixed(1)}%</span>
									<span class="block text-[10px] text-muted">
										P: {(item.team2PickRate * 100).toFixed(0)}% · B: {(item.team2BanRate * 100).toFixed(0)}%
									</span>
								</td>
								<td class="py-2.5 pl-3 text-right text-muted">
									{(item.leagueRate * 100).toFixed(1)}%
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>

	<!-- Lane-by-Lane Role Comparison Card -->
	<div class="card p-5 sm:p-6">
		<div class="mb-4">
			<h2 class="font-display text-lg tracking-wide text-ink">
				Lane-by-Lane Role Comparison
			</h2>
			<p class="font-mono text-xs text-muted">
				Role predictability scores and top comfort picks across all 5 lanes.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-5">
			{#each roleComparisons as role (role.role)}
				<div class="flex flex-col justify-between rounded-xl border border-line bg-surface p-4">
					<div>
						<!-- Role Header -->
						<div class="flex items-center justify-between border-b border-line pb-2">
							<span class="rounded bg-surface-2 px-2 py-0.5 font-display text-xs text-primary uppercase">
								{role.roleName}
							</span>
							<span class="font-mono text-[10px] text-muted" title="League Baseline Predictability">
								Avg: {role.leagueHhi.toFixed(3)}
							</span>
						</div>

						<!-- Predictability comparison -->
						<div class="my-3 space-y-1 font-mono text-xs">
							<div class="flex justify-between">
								<span class="text-muted">{team1.shortCode ?? 'T1'}:</span>
								<span class="font-semibold text-ink">{role.team1Hhi.toFixed(3)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted">{team2.shortCode ?? 'T2'}:</span>
								<span class="font-semibold text-ink">{role.team2Hhi.toFixed(3)}</span>
							</div>
						</div>
					</div>

					<!-- Comfort Picks -->
					<div class="space-y-2 border-t border-line/60 pt-3">
						<div>
							<p class="font-mono text-[10px] text-muted uppercase">{team1.shortCode ?? 'T1'} Comfort</p>
							<div class="mt-1 space-y-1">
								{#each role.team1TopPicks as p (p.hero)}
									<div class="flex items-center justify-between text-xs">
										<HeroTag name={p.hero} size={18} showName={true} />
										<span class="font-mono text-[10px] text-muted">{p.picks}g</span>
									</div>
								{:else}
									<span class="font-mono text-[10px] text-muted">No picks recorded</span>
								{/each}
							</div>
						</div>

						<div class="mt-2 pt-2 border-t border-line/40">
							<p class="font-mono text-[10px] text-muted uppercase">{team2.shortCode ?? 'T2'} Comfort</p>
							<div class="mt-1 space-y-1">
								{#each role.team2TopPicks as p (p.hero)}
									<div class="flex items-center justify-between text-xs">
										<HeroTag name={p.hero} size={18} showName={true} />
										<span class="font-mono text-[10px] text-muted">{p.picks}g</span>
									</div>
								{:else}
									<span class="font-mono text-[10px] text-muted">No picks recorded</span>
								{/each}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Direct Encounters History -->
	<div class="card p-5 sm:p-6">
		<div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 class="font-display text-lg tracking-wide text-ink">
					Direct Encounters History
				</h2>
				<p class="font-mono text-xs text-muted">
					Past match series between {team1.name} and {team2.name}.
				</p>
			</div>
		</div>

		{#if directSeriesList.length === 0}
			<div class="rounded-xl border border-line bg-surface py-8 text-center font-mono text-xs text-muted">
				No direct matches found between {team1.name} and {team2.name} in the selected season scope.
			</div>
		{:else}
			<div class="space-y-4">
				{#each directSeriesList as s (s.seriesId)}
					<div class="rounded-xl border border-line bg-surface overflow-hidden">
						<!-- Series Header -->
						<div class="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/40 px-4 py-3">
							<div class="flex items-center gap-3">
								<span class="rounded bg-surface px-2 py-0.5 font-mono text-xs text-muted uppercase">
									Season {s.season} · {s.stage.replace('_', ' ')}
								</span>
								<span class="font-mono text-xs text-muted">{s.date}</span>
							</div>

							<div class="flex items-center gap-3 font-display text-sm tracking-wide">
								<span class="{s.t1WinsCount > s.t2WinsCount ? 'text-primary font-bold' : 'text-ink'}">{team1.shortCode ?? team1.name} {s.t1WinsCount}</span>
								<span class="text-muted">—</span>
								<span class="{s.t2WinsCount > s.t1WinsCount ? 'text-primary font-bold' : 'text-ink'}">{s.t2WinsCount} {team2.shortCode ?? team2.name}</span>
								<a
									href={resolve('/series/[seriesId]', { seriesId: s.seriesId })}
									class="ml-2 inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-xs text-primary transition-colors hover:border-primary"
								>
									View Series Draft →
								</a>
							</div>
						</div>

						<!-- Game Rows in Series -->
						<div class="divide-y divide-line/40 p-3">
							{#each s.games as game (game.id)}
								<div class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between text-xs font-mono">
									<div class="flex items-center gap-3">
										<span class="font-bold {game.isT1Winner ? 'text-positive' : 'text-negative'}">
											Game {game.gameNumber}: {game.isT1Winner ? `${team1.shortCode ?? 'T1'} Win` : `${team2.shortCode ?? 'T2'} Win`}
										</span>
										<span class="text-muted">({game.gameLength})</span>
									</div>

									<!-- Picks comparison -->
									<div class="flex flex-wrap items-center gap-4">
										<div class="flex items-center gap-1">
											<span class="text-[10px] text-muted mr-1">{team1.shortCode}:</span>
											{#each game.t1Picks as hero}
												<HeroTag name={hero} size={20} showName={false} />
											{/each}
										</div>
										<span class="text-muted">vs</span>
										<div class="flex items-center gap-1">
											<span class="text-[10px] text-muted mr-1">{team2.shortCode}:</span>
											{#each game.t2Picks as hero}
												<HeroTag name={hero} size={20} showName={false} />
											{/each}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
