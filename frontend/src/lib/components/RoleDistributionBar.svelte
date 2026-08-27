<script lang="ts">
	import type { RoleDistribution } from '$lib/metrics';

	let {
		roles = []
	}: {
		roles: RoleDistribution[];
	} = $props();

	const ROLE_COLORS: Record<number, string> = {
		1: 'bg-amber-500',
		2: 'bg-emerald-500',
		3: 'bg-sky-500',
		4: 'bg-purple-500',
		5: 'bg-rose-500'
	};
</script>

<div class="space-y-1.5">
	<div class="flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
		{#each roles as r (r.role)}
			<div
				class="{ROLE_COLORS[r.role] ?? 'bg-primary'} transition-all"
				style="width: {(r.share * 100).toFixed(1)}%"
				title="{r.roleName}: {r.picks} picks ({(r.share * 100).toFixed(1)}%)"
			></div>
		{/each}
	</div>
	<div class="flex flex-wrap gap-2 text-xs font-mono text-muted">
		{#each roles as r (r.role)}
			<span class="flex items-center gap-1">
				<span class="inline-block h-2 w-2 rounded-full {ROLE_COLORS[r.role] ?? 'bg-primary'}"></span>
				<span class="text-ink">{r.roleName}</span>
				<span>{r.picks} ({(r.share * 100).toFixed(0)}%)</span>
			</span>
		{/each}
	</div>
</div>
