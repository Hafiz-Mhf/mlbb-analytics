<script lang="ts">
	interface Props {
		label: string;
		labelTooltip?: string;
		value: number;
		baseline?: number;
		context?: string;
		format?: (n: number) => string;
	}

	const defaultFormat = (n: number) => n.toFixed(3);
	let { label, labelTooltip, value, baseline, context, format = defaultFormat }: Props = $props();
</script>

<div class="card relative overflow-hidden px-6 py-6">
	<div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-gold to-primary"></div>
	<p class="mb-2 font-mono text-xs tracking-widest text-muted uppercase">
		{#if labelTooltip}
			<abbr title={labelTooltip} class="no-underline">{label}</abbr>
		{:else}
			{label}
		{/if}
	</p>
	<div class="flex flex-wrap items-baseline gap-3">
		<span
			class="font-display text-5xl text-ink"
			style="text-shadow: 0 0 28px rgba(56, 189, 248, 0.3)">{format(value)}</span
		>
		{#if baseline !== undefined}
			<span
				class="rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-muted"
			>
				<abbr title="Average across all 8 MPL Malaysia teams" class="no-underline">league avg</abbr>
				{format(baseline)}
			</span>
		{:else if context}
			<span class="font-mono text-sm text-muted">{context}</span>
		{/if}
	</div>
</div>
