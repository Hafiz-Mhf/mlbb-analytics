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

<a href="#main-content" class="skip-link">Skip to main content</a>

<header
	class="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70"
>
	<div
		class="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<div>
			<a href={resolve('/')} class="group inline-flex items-center gap-2">
				<span class="h-5 w-1.5 rounded-full bg-gradient-to-b from-primary to-gold"></span>
				<span
					class="font-display text-lg tracking-wide text-ink transition-colors group-hover:text-primary"
					>MLBB ANALYTICS</span
				>
			</a>
			<p class="mt-1 max-w-md font-mono text-xs text-muted">
				What a team will likely pick and ban — and whether that's unusual, or just what everyone
				does.
			</p>
		</div>
		<nav class="flex flex-wrap items-center gap-5 text-sm sm:gap-6">
			{#each navLinks as link (link.href)}
				<a
					href={link.href}
					class={page.url.pathname === link.href
						? 'border-b-2 border-primary pb-0.5 font-medium text-primary'
						: 'border-b-2 border-transparent pb-0.5 text-muted transition-colors hover:text-ink'}
				>
					{link.label}
				</a>
			{/each}
			<select
				aria-label="Switch scouted team"
				value={$selectedTeam}
				onchange={onTeamChange}
				class="min-h-11 max-w-full rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs text-ink focus-visible:border-primary"
			>
				{#each teamOptions as team (team.slug)}
					<option value={team.slug}>{team.name}</option>
				{/each}
			</select>
		</nav>
	</div>
</header>

<div class="mx-auto max-w-6xl px-6 py-8">
	<main id="main-content" tabindex="-1">
		{@render children()}
	</main>
</div>
