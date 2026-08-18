<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { selectedTeam } from '$lib/teamSelection';
	import { mockDataset } from '$lib/data';
	import { teamSlug } from '$lib/teams';

	let { children } = $props();

	const navLinks = $derived([
		{ href: resolve('/team/[slug]', { slug: $selectedTeam }), label: 'Team Scouting' },
		{ href: resolve('/league'), label: 'League Overview' },
		{ href: resolve('/log'), label: 'Match Log' }
	]);

	const teamOptions = mockDataset.teams
		.map((t) => ({ slug: teamSlug(t.canonicalName), name: t.canonicalName }))
		.sort((a, b) => a.name.localeCompare(b.name));

	function onTeamChange(e: Event) {
		const slug = (e.target as HTMLSelectElement).value;
		selectedTeam.set(slug);
		goto(resolve('/team/[slug]', { slug }));
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<header
		class="mb-8 flex flex-col gap-4 border-b border-[#3a352c] pb-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<div>
			<a
				href={resolve('/')}
				class="font-[Syne] text-lg tracking-wide text-[#e8e4dc] hover:text-[--color-amber]"
			>
				MLBB Analytics
			</a>
			<p class="mt-1 font-mono text-xs text-[#8a8478]">
				What a team will likely pick and ban — and whether that's unusual, or just what everyone
				does.
			</p>
		</div>
		<nav class="flex flex-wrap items-center gap-4 text-sm sm:gap-6">
			{#each navLinks as link (link.href)}
				<a
					href={link.href}
					class={page.url.pathname === link.href
						? 'text-[--color-amber]'
						: 'text-[#8a8478] transition-colors hover:text-[--color-amber]'}
				>
					{link.label}
				</a>
			{/each}
			<select
				aria-label="Switch scouted team"
				value={$selectedTeam}
				onchange={onTeamChange}
				class="max-w-full border border-[#3a352c] bg-transparent px-2 py-1 font-mono text-xs text-[#e8e4dc]"
			>
				{#each teamOptions as team (team.slug)}
					<option value={team.slug}>{team.name}</option>
				{/each}
			</select>
		</nav>
	</header>
	{@render children()}
</div>
