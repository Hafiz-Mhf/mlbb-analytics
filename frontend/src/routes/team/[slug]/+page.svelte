<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import {
		flexHeroes,
		hhi,
		hhiByRole,
		pickRateByRole,
		pickWinRateDelta,
		presence,
		presenceDelta,
		ROLE_NAMES,
		rollingHhi
	} from '$lib/metrics';
	import BaselineAnnotation from '$lib/components/BaselineAnnotation.svelte';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import HeroTag from '$lib/components/HeroTag.svelte';
	import RoleDistributionBar from '$lib/components/RoleDistributionBar.svelte';
	import RoleFilter from '$lib/components/RoleFilter.svelte';
	import StatBlock from '$lib/components/StatBlock.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';
	import TrendChart from '$lib/components/TrendChart.svelte';
	import { selectedTeam } from '$lib/teamSelection';
	import { page } from '$app/state';

	let { data } = $props();
	const team = $derived(data.team);
	let selectedRole = $state<number | null>(null);

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

	const teamFlexHeroes = $derived(flexHeroes(mockDataset, { teamId: team.id }));

	const roleHhiTeam = $derived(
		selectedRole !== null ? hhiByRole(mockDataset, selectedRole, { teamId: team.id }) : null
	);
	const roleHhiLeague = $derived(
		selectedRole !== null ? hhiByRole(mockDataset, selectedRole) : null
	);

	const rows = $derived(
		selectedRole === null
			? Object.entries(teamPresence)
					.sort(([, a], [, b]) => b - a)
					.slice(0, 15)
					.map(([hero, rate]) => ({ hero, value: rate, baseline: leaguePresence[hero] ?? 0 }))
			: Object.entries(pickRateByRole(mockDataset, selectedRole, { teamId: team.id }))
					.sort(([, a], [, b]) => b - a)
					.slice(0, 15)
					.map(([hero, rate]) => ({
						hero,
						value: rate,
						baseline: pickRateByRole(mockDataset, selectedRole!)[hero] ?? 0
					}))
	);
</script>

<div class="space-y-8">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="flex items-center gap-3 font-display text-2xl tracking-wide text-ink">
			<TeamTag name={team.canonicalName} size={22} />
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

	<div class="card p-5">
		<h2 class="mb-3 font-display text-lg tracking-wide text-ink">
			Predictability trend, 10-game rolling average
		</h2>
		<TrendChart
			values={trend.map((p) => p.hhi)}
			pointLabels={trend.map(
				(p) => `${(p.playedAt ?? 'unknown date').split(' - ')[0]} · ${p.hhi.toFixed(3)}`
			)}
			label={`${team.canonicalName} rolling HHI`}
		/>
	</div>

	<div class="card p-5">
		<h2 class="mb-1 font-display text-lg tracking-wide text-ink">Season 17 vs Season 18, by hero</h2>
		<p class="mb-3 font-mono text-sm text-muted">
			Draft predictability: {teamHhiS17.toFixed(3)} ({s17Games} games) → {teamHhiS18.toFixed(3)} ({s18Games}
			games)
		</p>
		<div class="overflow-x-auto">
			<table class="w-full border-collapse font-mono text-sm">
				<thead>
					<tr class="border-b border-line text-left text-muted">
						<th class="px-3 py-2 font-normal">Hero</th>
						<th class="px-3 py-2 font-normal">S17</th>
						<th class="px-3 py-2 font-normal">S18</th>
						<th class="px-3 py-2 font-normal">Change</th>
					</tr>
				</thead>
				<tbody>
					{#each seasonDeltas as row (row.hero)}
						<tr class="border-b border-line/60 hover:bg-surface-2">
							<td class="px-3 py-2"><HeroTag name={row.hero} /></td>
							<td class="px-3 py-2">{(row.before * 100).toFixed(1)}%</td>
							<td class="px-3 py-2">{(row.after * 100).toFixed(1)}%</td>
							<td class="px-3 py-2 {row.delta >= 0 ? 'text-positive' : 'text-negative'}"
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
			<p class="font-mono text-xs text-muted">Not enough games yet.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full border-collapse font-mono text-sm">
					<thead>
						<tr class="border-b border-line text-left text-muted">
							<th class="px-3 py-2 font-normal">Hero</th>
							<th class="px-3 py-2 font-normal">Win rate vs. normal</th>
							<th class="px-3 py-2 font-normal">Games</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row (row.hero)}
							<tr class="border-b border-line/60 hover:bg-surface-2">
								<td class="px-3 py-2"><HeroTag name={row.hero} /></td>
								<td class="px-3 py-2 {row.delta >= 0 ? 'text-positive' : 'text-negative'}"
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

	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
		<div class="card p-5">
			<h2 class="mb-3 font-display text-lg tracking-wide text-ink">Picks that line up with winning</h2>
			{@render deltaTable(pickDeltas)}
		</div>
		<div class="card p-5">
			<h2 class="mb-3 font-display text-lg tracking-wide text-ink">Bans that line up with winning</h2>
			{@render deltaTable(banDeltas)}
		</div>
	</div>

	<div class="card p-5">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 class="font-display text-lg tracking-wide text-ink">
					{selectedRole === null
						? 'Pick/ban rate, top 15'
						: `${ROLE_NAMES[selectedRole]} picks, top 15`}
				</h2>
				{#if selectedRole !== null && roleHhiTeam !== null && roleHhiLeague !== null}
					<p class="mt-1 font-mono text-xs text-muted">
						{ROLE_NAMES[selectedRole]} lane predictability:
						<span class="text-ink font-semibold">{roleHhiTeam.toFixed(3)}</span>
						(League avg: {roleHhiLeague.toFixed(3)})
					</p>
				{/if}
			</div>
			<RoleFilter selected={selectedRole} onchange={(r) => (selectedRole = r)} />
		</div>
		<div class="overflow-x-auto">
			<table class="w-full border-collapse font-mono text-sm">
				<thead>
					<tr class="border-b border-line text-left text-muted">
						<th class="px-3 py-2 font-normal">Hero</th>
						<th class="px-3 py-2 font-normal">
							{selectedRole === null ? 'Pick/ban rate' : `${ROLE_NAMES[selectedRole]} pick rate`} (vs. league average)
						</th>
					</tr>
				</thead>
				<tbody>
					{#if rows.length === 0}
						<tr>
							<td colspan="2" class="px-3 py-4 text-center font-mono text-xs text-muted">
								No picks recorded for this role.
							</td>
						</tr>
					{:else}
						{#each rows as row (row.hero)}
							<tr class="border-b border-line/60 hover:bg-surface-2">
								<td class="px-3 py-2"><HeroTag name={row.hero} /></td>
								<td class="px-3 py-2">
									<BaselineAnnotation value={row.value} baseline={row.baseline} />
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>

	<div class="card p-5">
		<div class="mb-3 flex items-center justify-between gap-2">
			<h2 class="font-display text-lg tracking-wide text-ink">Flex Picks</h2>
			<span class="font-mono text-xs text-muted">{teamFlexHeroes.length} multi-role heroes</span>
		</div>
		<p class="mb-4 font-mono text-xs text-muted">
			Heroes drafted across multiple lane assignments by {team.canonicalName}.
		</p>
		{#if teamFlexHeroes.length === 0}
			<p class="font-mono text-xs text-muted">No multi-role flex picks recorded for this team.</p>
		{:else}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#each teamFlexHeroes as flex (flex.hero)}
					<div class="rounded-lg border border-line bg-surface-2 p-3.5 space-y-2.5">
						<div class="flex items-center justify-between">
							<HeroTag name={flex.hero} />
							<span class="font-mono text-xs text-muted">
								{flex.totalPicks} {flex.totalPicks === 1 ? 'pick' : 'picks'}
							</span>
						</div>
						<RoleDistributionBar roles={flex.roles} />
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
