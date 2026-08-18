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

<div class="border border-[#3a352c] bg-[#221f19] px-6 py-5">
	<p class="mb-1 font-mono text-xs text-[#8a8478]">
		{#if labelTooltip}
			<abbr title={labelTooltip} class="no-underline">{label}</abbr>
		{:else}
			{label}
		{/if}
	</p>
	<div class="flex items-baseline gap-3">
		<span class="font-[Syne] text-4xl text-[#e8e4dc]">{format(value)}</span>
		{#if baseline !== undefined}
			<span class="font-mono text-sm text-[#8a8478]"
				><abbr title="Average across all 8 MPL Malaysia teams" class="no-underline">league avg</abbr
				>
				{format(baseline)}</span
			>
		{:else if context}
			<span class="font-mono text-sm text-[#8a8478]">{context}</span>
		{/if}
	</div>
</div>
