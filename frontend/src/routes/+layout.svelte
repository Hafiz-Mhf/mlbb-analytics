<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { selectedTeam } from '$lib/teamSelection';
	import { mockDataset, generatedAt } from '$lib/data';
	import { teamSlug } from '$lib/teams';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	let showBackToTop = $state(false);

	onMount(() => {
		const onScroll = () => {
			showBackToTop = window.scrollY > 400;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	const navLinks = $derived([
		{ href: resolve('/team/[slug]', { slug: $selectedTeam }), label: 'Team Scouting' },
		{ href: resolve('/matchup'), label: 'Matchup' },
		{ href: resolve('/sides'), label: 'Side Priority' },
		{ href: resolve('/league'), label: 'League Overview' },
		{ href: resolve('/roles'), label: 'Roles & Flex' },
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

	const footerLinks = [
		{ href: resolve('/about'), label: 'About' },
		{ href: resolve('/contact'), label: 'Contact' },
		{ href: resolve('/privacy'), label: 'Privacy' },
		{ href: resolve('/terms'), label: 'Terms' },
		{ href: resolve('/changelog'), label: 'Changelog' }
	];

	function scrollToTop(e: MouseEvent) {
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
		(e.currentTarget as HTMLElement).blur();
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<a href="#main-content" class="skip-link">Skip to main content</a>

<header
	class="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70"
>
	<div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
		<a href={resolve('/')} class="group inline-flex shrink-0 items-center gap-2">
			<span class="h-5 w-1.5 rounded-full bg-gradient-to-b from-primary to-gold"></span>
			<span
				class="font-display text-lg tracking-wide text-ink transition-colors group-hover:text-primary"
				>MLBB ANALYTICS</span
			>
		</a>

		<nav class="hidden items-center gap-1 xl:flex" aria-label="Primary">
			{#each navLinks as link (link.href)}
				<a
					href={link.href}
					class={page.url.pathname === link.href
						? 'shrink-0 whitespace-nowrap rounded-full bg-surface-2 px-3 py-1.5 font-display text-xs tracking-wide text-primary uppercase'
						: 'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-display text-xs tracking-wide text-muted uppercase transition-colors hover:text-ink'}
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<div class="flex shrink-0 items-center gap-3">
			{#if page.url.pathname.startsWith('/team')}
				<select
					aria-label="Switch scouted team"
					value={$selectedTeam}
					onchange={onTeamChange}
					class="min-h-11 shrink-0 rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs text-ink focus-visible:border-primary"
				>
					{#each teamOptions as team (team.slug)}
						<option value={team.slug}>{team.name}</option>
					{/each}
				</select>
			{/if}
		</div>
	</div>

	<nav
		class="flex items-center gap-1 overflow-x-auto border-t border-line px-6 py-2 xl:hidden"
		aria-label="Primary"
	>
		{#each navLinks as link (link.href)}
			<a
				href={link.href}
				class={page.url.pathname === link.href
					? 'shrink-0 whitespace-nowrap rounded-full bg-surface-2 px-3 py-1.5 font-display text-xs tracking-wide text-primary uppercase'
					: 'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-display text-xs tracking-wide text-muted uppercase transition-colors hover:text-ink'}
			>
				{link.label}
			</a>
		{/each}
	</nav>
</header>

<div class="mx-auto max-w-6xl px-6 pt-8 pb-16 sm:pb-20">
	<main id="main-content" tabindex="-1">
		{@render children()}
	</main>
</div>

<footer class="border-t border-line">
	<div class="mx-auto max-w-6xl px-6 py-10">
		<div class="flex flex-col gap-8 sm:flex-row sm:justify-between">
			<div class="max-w-sm space-y-2">
				<a href={resolve('/')} class="inline-flex items-center gap-2">
					<span class="h-4 w-1 rounded-full bg-gradient-to-b from-primary to-gold"></span>
					<span class="font-display text-sm tracking-wide text-ink">MLBB ANALYTICS</span>
				</a>
				<p class="font-mono text-xs text-muted">
					Draft prep for MPL Malaysia. Every number sits next to its league baseline, so it can't
					lie on its own.
				</p>
			</div>

			<div class="flex flex-wrap gap-10 sm:gap-16">
				<div class="space-y-2">
					<p class="font-display text-xs tracking-wide text-muted uppercase">Explore</p>
					<ul class="space-y-1.5 font-mono text-xs">
						{#each navLinks as link (link.href)}
							<li>
								<a href={link.href} class="text-muted transition-colors hover:text-ink"
									>{link.label}</a
								>
							</li>
						{/each}
					</ul>
				</div>
				<div class="space-y-2">
					<p class="font-display text-xs tracking-wide text-muted uppercase">Data</p>
					<ul class="space-y-1.5 font-mono text-xs text-muted">
						<li>Source: Liquipedia wikitext</li>
						<li><FreshnessIndicator {generatedAt} /></li>
					</ul>
				</div>
			</div>
		</div>

		<div
			class="mt-8 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between"
		>
			<div class="space-y-1 font-mono text-xs text-muted">
				<p>© {new Date(generatedAt).getFullYear()} MLBB Analytics. Unofficial fan project.</p>
				<p>
					Not affiliated with or endorsed by MPL, Moonton, or the teams shown. Logos and hero art
					are property of their respective owners.
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-muted">
				{#each footerLinks as link (link.href)}
					<a href={link.href} class="transition-colors hover:text-ink">{link.label}</a>
				{/each}
			</div>
		</div>
	</div>
</footer>

<button
	type="button"
	onclick={scrollToTop}
	aria-label="Back to top"
	aria-hidden={!showBackToTop}
	tabindex={showBackToTop ? 0 : -1}
	class="fixed right-5 bottom-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface/90 text-muted shadow-lg backdrop-blur transition-all duration-200 hover:border-primary hover:text-primary supports-[backdrop-filter]:bg-surface/70 sm:right-8 sm:bottom-8 {showBackToTop
		? 'translate-y-0 opacity-100'
		: 'pointer-events-none translate-y-2 opacity-0'}"
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="18"
		height="18"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="m18 15-6-6-6 6" />
	</svg>
</button>
