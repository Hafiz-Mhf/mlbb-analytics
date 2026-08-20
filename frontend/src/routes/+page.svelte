<script lang="ts">
	import { resolve } from '$app/paths';
	import { mockDataset } from '$lib/data';
	import { teamSlug, teamLogo, TEAM_COLORS } from '$lib/teams';

	const teams = mockDataset.teams
		.map((t) => ({ name: t.canonicalName, slug: teamSlug(t.canonicalName) }))
		.sort((a, b) => a.name.localeCompare(b.name));
</script>

<div class="space-y-10">
	<div class="max-w-2xl space-y-3">
		<h1 class="font-display text-2xl tracking-wide text-ink">Draft prep for MPL Malaysia</h1>
		<p class="font-mono text-sm text-muted">
			A pick or ban rate means nothing alone — SRG banning Fanny in 78% of games sounds like fear,
			until you see the league average is 84.7%, meaning SRG respects her less than most. Every
			number here sits next to its league baseline. Pick a team to start scouting.
		</p>
	</div>

	<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
		{#each teams as team (team.slug)}
			<a
				href={resolve('/team/[slug]', { slug: team.slug })}
				class="card flex flex-col items-center gap-3 border-t-4 p-5 text-center transition-colors hover:bg-surface-2"
				style={`border-top-color:${TEAM_COLORS[team.name] ?? 'transparent'}`}
			>
				<img src={teamLogo(team.name)} alt="" width={40} height={40} class="h-10 w-10 object-contain" />
				<span class="font-display text-sm tracking-wide text-ink">{team.name}</span>
			</a>
		{/each}
	</div>
</div>
