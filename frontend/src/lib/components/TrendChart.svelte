<script lang="ts">
	import { sparklinePoints } from '$lib/sparkline';

	interface Props {
		values: number[];
		label: string;
		width?: number;
		height?: number;
	}
	let { values, label, width = 160, height = 40 }: Props = $props();
	const coords = $derived(sparklinePoints(values, width, height));
</script>

{#if values.length === 0}
	<span class="text-xs text-[#8a8478]">Not enough games yet</span>
{:else}
	<svg
		{width}
		{height}
		viewBox={`0 0 ${width} ${height}`}
		role="img"
		aria-label={label}
		class="overflow-visible"
	>
		<polyline points={coords} fill="none" style="stroke: var(--color-amber); stroke-width: 1.5" />
	</svg>
{/if}
