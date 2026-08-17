<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/mock/data';
	import { hhi, presence } from '$lib/mock/metrics';
	import BaselineAnnotation from '$lib/components/BaselineAnnotation.svelte';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';
	import { selectedTeam } from '$lib/teamSelection';
	import { page } from '$app/state';

	let { data } = $props();
	const team = $derived(data.team);

	$effect(() => {
		selectedTeam.set(page.params.slug!);
	});

	const teamPresence = $derived(presence(mockDataset, { teamId: team.id }));
	const leaguePresence = $derived(presence(mockDataset));
	const teamHhi = $derived(hhi(mockDataset, { teamId: team.id }));
	const leagueHhi = $derived(hhi(mockDataset));

	const rows = $derived(
		Object.entries(teamPresence)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 15)
			.map(([hero, rate]) => ({ hero, value: rate, baseline: leaguePresence[hero] ?? 0 }))
	);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="flex items-center gap-3 font-[Syne] text-2xl">
			<TeamTag name={team.canonicalName} />
			{team.canonicalName}
		</h1>
		<FreshnessIndicator {generatedAt} />
	</div>

	<div class="font-mono text-sm text-[#8a8478]">
		Team HHI: <BaselineAnnotation value={teamHhi} baseline={leagueHhi} format={(n) => n.toFixed(3)} />
	</div>

	<table class="w-full border-collapse font-mono text-sm">
		<thead>
			<tr class="border-b border-[#3a352c] text-left text-[#8a8478]">
				<th class="px-3 py-2 font-normal">Hero</th>
				<th class="px-3 py-2 font-normal">Presence (vs. baseline)</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.hero)}
				<tr class="border-b border-[#2a2620]">
					<td class="px-3 py-2">{row.hero}</td>
					<td class="px-3 py-2">
						<BaselineAnnotation value={row.value} baseline={row.baseline} />
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
