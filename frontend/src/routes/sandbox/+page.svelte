<script lang="ts">
	import { mockDataset, generatedAt } from '$lib/data';
	import {
		OFFICIAL_DRAFT_SEQUENCE,
		draftRecommendations,
		evaluateSideDraft,
		ROLE_NAMES,
		type Role
	} from '$lib/metrics';
	import { teamSlug } from '$lib/teams';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import FreshnessIndicator from '$lib/components/FreshnessIndicator.svelte';
	import TeamTag from '$lib/components/TeamTag.svelte';
	import HeroTag from '$lib/components/HeroTag.svelte';

	// Team options
	const teamOptions = mockDataset.teams
		.map((t) => ({ id: t.id, name: t.canonicalName, slug: teamSlug(t.canonicalName) }))
		.sort((a, b) => a.name.localeCompare(b.name));

	let blueTeamId = $state(teamOptions[0]?.id ?? 1);
	let redTeamId = $state(teamOptions[1]?.id ?? 2);
	let draftMode = $state<'dual' | 'solo'>('dual');
	let userSide = $state<'blue' | 'red'>('blue');

	// Step history
	interface HistoryItem {
		stepIndex: number;
		hero: string;
		action: 'ban' | 'pick';
		side: 'blue' | 'red';
	}

	let currentStepIndex = $state(0);
	let history = $state<HistoryItem[]>([]);
	let blueBans = $state<string[]>([]);
	let redBans = $state<string[]>([]);
	let bluePicks = $state<string[]>([]);
	let redPicks = $state<string[]>([]);

	let searchQuery = $state('');
	let selectedRoleFilter = $state<Role | 0>(0);
	let toastMessage = $state<string | null>(null);
	let isSimulating = $state(false);

	// URL params sync
	$effect(() => {
		if (!browser) return;
		const bSlug = page.url.searchParams.get('blue');
		const rSlug = page.url.searchParams.get('red');
		if (bSlug) {
			const t = teamOptions.find((x) => x.slug === bSlug);
			if (t) blueTeamId = t.id;
		}
		if (rSlug) {
			const t = teamOptions.find((x) => x.slug === rSlug);
			if (t) redTeamId = t.id;
		}
	});

	const isComplete = $derived(currentStepIndex >= OFFICIAL_DRAFT_SEQUENCE.length);
	const currentStep = $derived(
		isComplete ? null : OFFICIAL_DRAFT_SEQUENCE[currentStepIndex]
	);

	const activeTeamId = $derived(
		currentStep ? (currentStep.side === 'blue' ? blueTeamId : redTeamId) : 0
	);

	const blueTeam = $derived(teamOptions.find((t) => t.id === blueTeamId));
	const redTeam = $derived(teamOptions.find((t) => t.id === redTeamId));

	const unavailableHeroes = $derived(
		new Set([...blueBans, ...redBans, ...bluePicks, ...redPicks])
	);

	const blueEvaluation = $derived(
		evaluateSideDraft(mockDataset, blueTeamId, bluePicks, blueBans)
	);
	const redEvaluation = $derived(
		evaluateSideDraft(mockDataset, redTeamId, redPicks, redBans)
	);

	const recommendations = $derived(
		currentStep
			? draftRecommendations(
					mockDataset,
					activeTeamId,
					currentStep.side,
					currentStep.action,
					unavailableHeroes,
					currentStep.side === 'blue'
						? blueEvaluation.filledRoles
						: redEvaluation.filledRoles
				).slice(0, 5)
			: []
	);

	// Filtered hero catalog
	const heroCatalog = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		return mockDataset.heroes
			.map((h) => ({
				id: h.id,
				name: h.canonicalName,
				isUnavailable: unavailableHeroes.has(h.canonicalName),
				isBanned: blueBans.includes(h.canonicalName) || redBans.includes(h.canonicalName),
				isPicked: bluePicks.includes(h.canonicalName) || redPicks.includes(h.canonicalName)
			}))
			.filter((h) => {
				if (q && !h.name.toLowerCase().includes(q)) return false;
				return true;
			})
			.sort((a, b) => {
				if (a.isUnavailable !== b.isUnavailable) return a.isUnavailable ? 1 : -1;
				return a.name.localeCompare(b.name);
			});
	});

	function lockHero(heroName: string) {
		if (isComplete || !currentStep || unavailableHeroes.has(heroName)) return;

		const step = currentStep;
		history.push({
			stepIndex: currentStepIndex,
			hero: heroName,
			action: step.action,
			side: step.side
		});

		if (step.action === 'ban') {
			if (step.side === 'blue') blueBans.push(heroName);
			else redBans.push(heroName);
		} else {
			if (step.side === 'blue') bluePicks.push(heroName);
			else redPicks.push(heroName);
		}

		currentStepIndex++;

		// Solo mode check: if next turn belongs to opponent, auto-simulate after 400ms
		if (draftMode === 'solo' && !isComplete && currentStep) {
			const isOpponentTurn = currentStep.side !== userSide;
			if (isOpponentTurn) {
				isSimulating = true;
				setTimeout(() => {
					if (isComplete || !currentStep) {
						isSimulating = false;
						return;
					}
					const recs = draftRecommendations(
						mockDataset,
						currentStep.side === 'blue' ? blueTeamId : redTeamId,
						currentStep.side,
						currentStep.action,
						unavailableHeroes,
						currentStep.side === 'blue'
							? blueEvaluation.filledRoles
							: redEvaluation.filledRoles
					);
					const topHero = recs[0]?.hero;
					isSimulating = false;
					if (topHero) lockHero(topHero);
				}, 400);
			}
		}
	}

	function autoPickTurn() {
		if (recommendations.length > 0) {
			lockHero(recommendations[0].hero);
		}
	}

	function undoLast() {
		if (history.length === 0) return;
		const last = history.pop()!;
		currentStepIndex = last.stepIndex;

		if (last.action === 'ban') {
			if (last.side === 'blue') blueBans = blueBans.filter((h) => h !== last.hero);
			else redBans = redBans.filter((h) => h !== last.hero);
		} else {
			if (last.side === 'blue') bluePicks = bluePicks.filter((h) => h !== last.hero);
			else redPicks = redPicks.filter((h) => h !== last.hero);
		}
	}

	function resetDraft() {
		currentStepIndex = 0;
		history = [];
		blueBans = [];
		redBans = [];
		bluePicks = [];
		redPicks = [];
	}

	function swapSides() {
		const temp = blueTeamId;
		blueTeamId = redTeamId;
		redTeamId = temp;
		resetDraft();
	}

	function copyDraftSummary() {
		const text = `MLBB Draft Sandbox:
Blue Side (${blueTeam?.name}):
- Bans: ${blueBans.join(', ') || 'None'}
- Picks: ${bluePicks.join(', ') || 'None'} (${blueEvaluation.hhiClassification}, HHI: ${blueEvaluation.draftHhi.toFixed(3)})

Red Side (${redTeam?.name}):
- Bans: ${redBans.join(', ') || 'None'}
- Picks: ${redPicks.join(', ') || 'None'} (${redEvaluation.hhiClassification}, HHI: ${redEvaluation.draftHhi.toFixed(3)})`;

		if (browser && navigator.clipboard) {
			navigator.clipboard.writeText(text);
			toastMessage = 'Draft summary copied to clipboard!';
			setTimeout(() => {
				toastMessage = null;
			}, 3000);
		}
	}
</script>

<svelte:head>
	<title>Interactive Draft Sandbox — MLBB Analytics</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header & Control Bar -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="font-display text-2xl tracking-wide text-ink">Interactive Draft Sandbox</h1>
			<p class="font-mono text-xs text-muted">
				Simulate 5v5 tournament pick/ban sequences with real-time AI coach recommendations.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<!-- Mode Toggle -->
			<div class="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
				<button
					type="button"
					onclick={() => (draftMode = 'dual')}
					class={draftMode === 'dual'
						? 'rounded-full bg-surface-2 px-3 py-1 font-display text-xs tracking-wide text-primary'
						: 'rounded-full px-3 py-1 font-display text-xs tracking-wide text-muted hover:text-ink'}
				>
					👥 Dual Coach
				</button>
				<button
					type="button"
					onclick={() => (draftMode = 'solo')}
					class={draftMode === 'solo'
						? 'rounded-full bg-surface-2 px-3 py-1 font-display text-xs tracking-wide text-primary'
						: 'rounded-full px-3 py-1 font-display text-xs tracking-wide text-muted hover:text-ink'}
				>
					👤 Vs Simulated AI
				</button>
			</div>

			<FreshnessIndicator {generatedAt} />
		</div>
	</div>

	<!-- Team Matchup Bar & Action Controls -->
	<div class="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
		<!-- Teams Setup -->
		<div class="flex flex-wrap items-center gap-3">
			<div class="flex items-center gap-2">
				<span class="h-3 w-3 rounded-full bg-sky-400"></span>
				<span class="font-display text-xs tracking-wide text-sky-400 uppercase">Blue Team:</span>
				<select
					bind:value={blueTeamId}
					onchange={resetDraft}
					class="rounded-lg border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink focus-visible:border-primary"
				>
					{#each teamOptions as t (t.id)}
						<option value={t.id}>{t.name}</option>
					{/each}
				</select>
			</div>

			<button
				type="button"
				onclick={swapSides}
				class="rounded-lg border border-line bg-surface-2 px-2.5 py-1 font-mono text-xs text-muted transition-colors hover:text-primary"
				title="Swap sides and reset draft"
			>
				⇄ Swap Sides
			</button>

			<div class="flex items-center gap-2">
				<span class="h-3 w-3 rounded-full bg-rose-400"></span>
				<span class="font-display text-xs tracking-wide text-rose-400 uppercase">Red Team:</span>
				<select
					bind:value={redTeamId}
					onchange={resetDraft}
					class="rounded-lg border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink focus-visible:border-primary"
				>
					{#each teamOptions as t (t.id)}
						<option value={t.id}>{t.name}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={undoLast}
				disabled={history.length === 0}
				class="rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:text-ink disabled:opacity-40"
			>
				↶ Undo
			</button>
			<button
				type="button"
				onclick={autoPickTurn}
				disabled={isComplete || recommendations.length === 0 || isSimulating}
				class="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-xs font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
			>
				⚡ Auto-Pick Turn
			</button>
			<button
				type="button"
				onclick={resetDraft}
				class="rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:text-rose-400"
			>
				🔄 Reset
			</button>
			<button
				type="button"
				onclick={copyDraftSummary}
				class="rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:text-gold"
			>
				📋 Copy Summary
			</button>
		</div>
	</div>

	<!-- Toast Message -->
	{#if toastMessage}
		<div class="rounded-xl border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-xs text-gold">
			{toastMessage}
		</div>
	{/if}

	<!-- Main Draft Arena (Blue Board | Center Turn HUD | Red Board) -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
		<!-- BLUE SIDE (Left Column - 4 cols) -->
		<div class="card p-5 lg:col-span-4 {currentStep?.side === 'blue' ? 'border-sky-400/60 shadow-lg shadow-sky-500/10' : ''}">
			<!-- Header -->
			<div class="mb-4 flex items-center justify-between border-b border-line pb-3">
				<div class="flex items-center gap-2">
					<TeamTag name={blueTeam?.name ?? ''} size={28} />
					<div>
						<h2 class="font-display text-base tracking-wide text-ink">{blueTeam?.name}</h2>
						<span class="inline-block rounded bg-sky-950/60 border border-sky-800/60 px-1.5 py-0.2 text-[10px] font-semibold text-sky-400">
							Blue Side (First Pick)
						</span>
					</div>
				</div>
			</div>

			<!-- Bans Row -->
			<div class="mb-4">
				<p class="font-display text-[10px] tracking-wide text-muted uppercase">Bans (5 Max)</p>
				<div class="mt-1.5 flex gap-1.5">
					{#each [0, 1, 2, 3, 4] as i}
						<div class="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-2 overflow-hidden {currentStep?.side === 'blue' && currentStep?.action === 'ban' && currentStep?.slotIndex === i ? 'border-sky-400 ring-2 ring-sky-400/40' : ''}">
							{#if blueBans[i]}
								<HeroTag name={blueBans[i]} size={36} showName={false} />
							{:else}
								<span class="font-mono text-[10px] text-muted/40">B{i + 1}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- Picks List -->
			<div class="space-y-2">
				<p class="font-display text-[10px] tracking-wide text-muted uppercase">Picks (5 Team Composition)</p>
				{#each [0, 1, 2, 3, 4] as i}
					{@const pickName = bluePicks[i]}
					{@const detail = blueEvaluation.picks[i]}
					<div class="flex items-center justify-between rounded-xl border border-line bg-surface p-2.5 transition-all {currentStep?.side === 'blue' && currentStep?.action === 'pick' && currentStep?.slotIndex === i ? 'border-sky-400 ring-2 ring-sky-400/40 bg-sky-950/20' : ''}">
						<div class="flex items-center gap-3">
							<div class="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-2 font-mono text-xs font-bold text-muted overflow-hidden">
								{#if pickName}
									<HeroTag name={pickName} size={36} showName={false} />
								{:else}
									<span>P{i + 1}</span>
								{/if}
							</div>
							<div>
								{#if pickName}
									<p class="font-display text-xs tracking-wide text-ink">{pickName}</p>
									<span class="font-mono text-[10px] text-primary">{detail?.roleName ?? 'Flex'}</span>
								{:else}
									<p class="font-mono text-xs text-muted/50">Awaiting pick...</p>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Role Checklist & Draft Predictability -->
			<div class="mt-5 border-t border-line pt-4 space-y-3">
				<div>
					<p class="font-display text-[10px] tracking-wide text-muted uppercase">Lane Role Coverage</p>
					<div class="mt-1.5 flex gap-1.5">
						{#each ([1, 2, 3, 4, 5] as Role[]) as role}
							{@const isFilled = blueEvaluation.filledRoles.has(role)}
							<span class="rounded px-2 py-0.5 font-mono text-[10px] font-semibold {isFilled ? 'bg-positive/20 text-positive border border-positive/30' : 'bg-surface-2 text-muted border border-line'}">
								{ROLE_NAMES[role]} {isFilled ? '✓' : '—'}
							</span>
						{/each}
					</div>
				</div>

				<div class="flex items-center justify-between font-mono text-xs">
					<span class="text-muted">Draft Predictability:</span>
					<span class="font-bold text-sky-400">{blueEvaluation.draftHhi.toFixed(3)} ({blueEvaluation.hhiClassification})</span>
				</div>
			</div>
		</div>

		<!-- CENTER TURN HUD (Center Column - 4 cols) -->
		<div class="card flex flex-col justify-between p-5 lg:col-span-4">
			<!-- Turn Status Card -->
			<div>
				<div class="rounded-xl border border-line bg-surface p-4 text-center">
					{#if isComplete}
						<div class="space-y-1">
							<span class="inline-block rounded-full bg-positive/20 px-3 py-1 font-display text-xs tracking-wide text-positive">
								✓ Draft Complete
							</span>
							<p class="font-mono text-xs text-muted">All 20 picks and bans locked.</p>
						</div>
					{:else if isSimulating}
						<div class="space-y-1">
							<span class="inline-block rounded-full bg-surface-2 px-3 py-1 font-display text-xs tracking-wide text-primary animate-pulse">
								🤖 Simulating Opponent Turn...
							</span>
							<p class="font-mono text-xs text-muted">Calculating historical pick probability.</p>
						</div>
					{:else if currentStep}
						<div class="space-y-1">
							<span class="inline-block rounded-full px-3 py-1 font-display text-xs tracking-wide {currentStep.side === 'blue' ? 'bg-sky-950/80 border border-sky-800 text-sky-400' : 'bg-rose-950/80 border border-rose-800 text-rose-400'}">
								Turn {currentStep.stepIndex + 1}/20: {currentStep.label}
							</span>
							<p class="font-mono text-xs text-ink font-semibold">
								{currentStep.side === 'blue' ? blueTeam?.name : redTeam?.name} to {currentStep.action.toUpperCase()}
							</p>
						</div>
					{/if}
				</div>

				<!-- AI Recommendations Box -->
				{#if !isComplete && currentStep}
					<div class="mt-4 space-y-2">
						<div class="flex items-center justify-between">
							<p class="font-display text-xs tracking-wide text-ink">💡 AI Scouting Recommendations</p>
							<span class="font-mono text-[10px] text-muted">Top Historical Matches</span>
						</div>

						<div class="space-y-1.5">
							{#each recommendations as rec (rec.hero)}
								<div class="flex items-center justify-between rounded-xl border border-line bg-surface p-2.5 transition-colors hover:border-primary/40">
									<div class="flex items-center gap-2.5">
										<HeroTag name={rec.hero} size={28} showName={false} />
										<div>
											<p class="font-display text-xs tracking-wide text-ink">{rec.hero}</p>
											<span class="inline-block rounded bg-surface-2 px-1.5 py-0.2 font-mono text-[10px] text-primary">
												{rec.tag}
											</span>
										</div>
									</div>

									<button
										type="button"
										onclick={() => lockHero(rec.hero)}
										class="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary hover:bg-primary hover:text-bg transition-colors"
									>
										Lock In
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Quick Auto-Pick Footer -->
			{#if !isComplete && currentStep}
				<div class="mt-4 border-t border-line pt-4">
					<button
						type="button"
						onclick={autoPickTurn}
						class="w-full rounded-xl border border-line bg-surface py-2.5 font-display text-xs tracking-wide text-muted hover:text-ink transition-colors"
					>
						⚡ Quick Auto-Lock Top Choice
					</button>
				</div>
			{/if}
		</div>

		<!-- RED SIDE (Right Column - 4 cols) -->
		<div class="card p-5 lg:col-span-4 {currentStep?.side === 'red' ? 'border-rose-400/60 shadow-lg shadow-rose-500/10' : ''}">
			<!-- Header -->
			<div class="mb-4 flex items-center justify-between border-b border-line pb-3">
				<div class="flex items-center gap-2">
					<TeamTag name={redTeam?.name ?? ''} size={28} />
					<div>
						<h2 class="font-display text-base tracking-wide text-ink">{redTeam?.name}</h2>
						<span class="inline-block rounded bg-rose-950/60 border border-rose-800/60 px-1.5 py-0.2 text-[10px] font-semibold text-rose-400">
							Red Side (Counter-Pick)
						</span>
					</div>
				</div>
			</div>

			<!-- Bans Row -->
			<div class="mb-4">
				<p class="font-display text-[10px] tracking-wide text-muted uppercase">Bans (5 Max)</p>
				<div class="mt-1.5 flex gap-1.5">
					{#each [0, 1, 2, 3, 4] as i}
						<div class="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-2 overflow-hidden {currentStep?.side === 'red' && currentStep?.action === 'ban' && currentStep?.slotIndex === i ? 'border-rose-400 ring-2 ring-rose-400/40' : ''}">
							{#if redBans[i]}
								<HeroTag name={redBans[i]} size={36} showName={false} />
							{:else}
								<span class="font-mono text-[10px] text-muted/40">B{i + 1}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- Picks List -->
			<div class="space-y-2">
				<p class="font-display text-[10px] tracking-wide text-muted uppercase">Picks (5 Team Composition)</p>
				{#each [0, 1, 2, 3, 4] as i}
					{@const pickName = redPicks[i]}
					{@const detail = redEvaluation.picks[i]}
					<div class="flex items-center justify-between rounded-xl border border-line bg-surface p-2.5 transition-all {currentStep?.side === 'red' && currentStep?.action === 'pick' && currentStep?.slotIndex === i ? 'border-rose-400 ring-2 ring-rose-400/40 bg-rose-950/20' : ''}">
						<div class="flex items-center gap-3">
							<div class="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-2 font-mono text-xs font-bold text-muted overflow-hidden">
								{#if pickName}
									<HeroTag name={pickName} size={36} showName={false} />
								{:else}
									<span>P{i + 1}</span>
								{/if}
							</div>
							<div>
								{#if pickName}
									<p class="font-display text-xs tracking-wide text-ink">{pickName}</p>
									<span class="font-mono text-[10px] text-rose-400">{detail?.roleName ?? 'Flex'}</span>
								{:else}
									<p class="font-mono text-xs text-muted/50">Awaiting pick...</p>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Role Checklist & Draft Predictability -->
			<div class="mt-5 border-t border-line pt-4 space-y-3">
				<div>
					<p class="font-display text-[10px] tracking-wide text-muted uppercase">Lane Role Coverage</p>
					<div class="mt-1.5 flex gap-1.5">
						{#each ([1, 2, 3, 4, 5] as Role[]) as role}
							{@const isFilled = redEvaluation.filledRoles.has(role)}
							<span class="rounded px-2 py-0.5 font-mono text-[10px] font-semibold {isFilled ? 'bg-positive/20 text-positive border border-positive/30' : 'bg-surface-2 text-muted border border-line'}">
								{ROLE_NAMES[role]} {isFilled ? '✓' : '—'}
							</span>
						{/each}
					</div>
				</div>

				<div class="flex items-center justify-between font-mono text-xs">
					<span class="text-muted">Draft Predictability:</span>
					<span class="font-bold text-rose-400">{redEvaluation.draftHhi.toFixed(3)} ({redEvaluation.hhiClassification})</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Hero Selection Pool (Bottom Grid) -->
	<div class="card p-5 sm:p-6 space-y-4">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 class="font-display text-lg tracking-wide text-ink">Hero Selection Pool</h2>
				<p class="font-mono text-xs text-muted">
					Click any available hero to lock into the current draft slot.
				</p>
			</div>

			<!-- Search & Filter Controls -->
			<div class="flex flex-wrap items-center gap-2">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search hero..."
					class="rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs text-ink placeholder:text-muted focus-visible:border-primary"
				/>
			</div>
		</div>

		<!-- Hero Cards Grid -->
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 max-h-96 overflow-y-auto pr-1">
			{#each heroCatalog as hero (hero.id)}
				<button
					type="button"
					disabled={hero.isUnavailable || isComplete}
					onclick={() => lockHero(hero.name)}
					class="flex flex-col items-center justify-center rounded-xl border border-line bg-surface p-2.5 transition-all text-center group {hero.isUnavailable ? 'opacity-35 cursor-not-allowed bg-surface-2' : 'hover:border-primary hover:bg-surface-2'}"
				>
					<div class="relative">
						<HeroTag name={hero.name} size={40} showName={false} />
						{#if hero.isBanned}
							<span class="absolute inset-0 flex items-center justify-center rounded-full bg-rose-950/80 font-mono text-[9px] font-bold text-rose-400">
								BAN
							</span>
						{:else if hero.isPicked}
							<span class="absolute inset-0 flex items-center justify-center rounded-full bg-sky-950/80 font-mono text-[9px] font-bold text-sky-400">
								PICK
							</span>
						{/if}
					</div>
					<span class="mt-1.5 font-display text-[11px] tracking-wide text-ink group-hover:text-primary line-clamp-1">
						{hero.name}
					</span>
				</button>
			{/each}
		</div>
	</div>
</div>
