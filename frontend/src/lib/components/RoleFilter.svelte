<script lang="ts">
	import { ROLE_NAMES } from '$lib/metrics';

	let {
		selected = null,
		onchange
	}: {
		selected?: number | null;
		onchange?: (role: number | null) => void;
	} = $props();

	const roleOptions = [
		{ id: null, label: 'All Roles' },
		{ id: 1, label: ROLE_NAMES[1] },
		{ id: 2, label: ROLE_NAMES[2] },
		{ id: 3, label: ROLE_NAMES[3] },
		{ id: 4, label: ROLE_NAMES[4] },
		{ id: 5, label: ROLE_NAMES[5] }
	];
</script>

<div class="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by role">
	{#each roleOptions as opt (opt.id)}
		{@const isActive = selected === opt.id}
		<button
			type="button"
			role="tab"
			aria-selected={isActive}
			onclick={() => onchange?.(opt.id)}
			class="rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors {isActive
				? 'bg-primary text-black font-semibold'
				: 'bg-surface-2 text-muted hover:bg-surface-3 hover:text-ink'}"
		>
			{opt.label}
		</button>
	{/each}
</div>
