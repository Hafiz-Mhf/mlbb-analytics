<script lang="ts">
	const entries = [
		{
			date: '2026-08-27',
			items: [
				'Draft Sandbox (/sandbox) Hero Selection Pool Role Filtering: filter hero pool by lane (EXP, JGL, MID, GOLD, ROAM, and Flex Picks) plus role badges on hero cards',
				'Draft Sandbox (/sandbox) Post-Draft Win Predictability & Composition Analysis: live outcome probability meter, strategic key advantages, 5-lane head-to-head edges, and clipboard export integration upon draft completion',
				'Draft Sandbox (/sandbox) Season 18 Recency Prioritization: 3x weighting on S18 matches for AI suggestions and lane slot detection, plus header Season Scope switcher (Season 18, All Time, Season 17)',
				'Draft Sandbox (/sandbox) Smart Auto-Flex Engine & Interactive Role Selector: automatic multi-role assignment for flex picks (e.g. Paquito EXP→JGL flex) to maximize 5-lane coverage, plus coach role dropdown overrides',
				'Interactive Draft Sandbox (/sandbox) launched with 20-step official tournament draft simulator, Dual Coach and Solo vs AI modes, real-time scouting recommendations, and live role coverage checklist',
				'Side Priority Analysis (/sides) dashboard launched with Blue vs Red tournament win rates, 8-team asymmetry matrix, and First-Pick vs Counter-Pick hero priorities',
				'Head-to-Head Matchup Tool (/matchup) with dual-team selectors, direct series scores, draft clash categorization, and lane comfort pick comparisons',
				'Per-Role & Flex Scouting (/roles) dashboard with 8-team lane predictability matrix and tournament flex pick intelligence',
				'Fixed header navigation text wrapping and tuned responsive breakpoints across desktop and tablet viewports'
			]
		},
		{
			date: '2026-08-20',
			items: [
				'Match Log redesigned into per-series pages, Liquipedia/VLR-style, split by season',
				'Notable picks and bans highlighted directly in the draft view',
				'League Overview meta split into pick/ban top 10 by season',
				'Real landing page with the project pitch and a team grid, replacing the old auto-redirect'
			]
		},
		{
			date: '2026-08-18',
			items: [
				'Esports visual identity applied across every screen, plus an accessibility pass',
				'Team switcher added, using real team logos and confirmed short codes',
				'Season 17 vs Season 18 comparison panels on Team Scouting and League Overview',
				'Per-game draft breakdown pages, linked from Match Log',
				'Draft-predictability trend sparkline and pick/ban win-rate deltas on Team Scouting'
			]
		},
		{
			date: '2026-08-17',
			items: [
				'Data pipeline went live: Liquipedia wikitext parsed into a validated SQLite archive',
				'Hero and team name aliases normalized, with an unknown string halting the build',
				'Presence and HHI metrics computed overall and per role',
				'Weekly automatic refresh wired up via GitHub Actions'
			]
		},
		{
			date: '2026-08-13',
			items: ['Project started: throttled Liquipedia client and wikitext parser foundations']
		}
	];
</script>

<div class="max-w-2xl space-y-8">
	<div class="space-y-3">
		<h1 class="font-display text-2xl tracking-wide text-ink">Changelog</h1>
		<p class="font-mono text-sm text-muted">What's shipped, most recent first.</p>
	</div>

	{#each entries as entry (entry.date)}
		<div class="card space-y-3 p-5">
			<p class="font-display text-xs tracking-wide text-primary uppercase">{entry.date}</p>
			<ul class="list-disc space-y-1.5 pl-4 font-mono text-sm text-muted">
				{#each entry.items as item (item)}
					<li>{item}</li>
				{/each}
			</ul>
		</div>
	{/each}
</div>
