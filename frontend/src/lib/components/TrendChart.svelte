<script lang="ts">
	import { sparklinePoints } from '$lib/sparkline';

	interface Props {
		values: number[];
		label: string;
		pointLabels?: string[];
		width?: number;
		height?: number;
	}
	let { values, label, pointLabels, width = 160, height = 40 }: Props = $props();
	const coords = $derived(sparklinePoints(values, width, height));
	const points = $derived(
		values.map((v, i) => {
			const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
			const y = height - v * height;
			return { x, y, tooltip: pointLabels?.[i] ?? v.toFixed(3) };
		})
	);
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
		{#each points as p, i (i)}
			<circle
				cx={p.x}
				cy={p.y}
				r="2.5"
				fill="var(--color-amber)"
				class="opacity-40 transition-opacity duration-150 hover:opacity-100"
			>
				<title>{p.tooltip}</title>
			</circle>
		{/each}
	</svg>
{/if}
