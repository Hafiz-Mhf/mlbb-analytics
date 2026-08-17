<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { selectedTeam } from '$lib/teamSelection';

	let { children } = $props();

	const navLinks = $derived([
		{ href: `/team/${$selectedTeam}`, label: 'Team Scouting' },
		{ href: '/league', label: 'League Overview' },
		{ href: '/log', label: 'Match Log' }
	]);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<header class="mb-8 flex items-center justify-between border-b border-[#3a352c] pb-4">
		<span class="font-[Syne] text-lg tracking-wide text-[#e8e4dc]">MLBB Analytics</span>
		<nav class="flex gap-6 text-sm">
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
		</nav>
	</header>
	{@render children()}
</div>
