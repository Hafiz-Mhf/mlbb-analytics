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
	const areaPath = $derived(
		points.length > 0
			? `M${points[0].x},${height} L${coords} L${points[points.length - 1].x},${height} Z`
			: ''
	);

	// Tooltip pad above the plot so a focused/hovered point's label has room to render.
	const tooltipPad = 16;
	let activeIndex = $state<number | null>(null);
	const gradientId = `trend-fill-${Math.random().toString(36).slice(2, 9)}`;
</script>

{#if values.length === 0}
	<span class="text-xs text-muted">Not enough games yet</span>
{:else}
	<svg
		{width}
		height={height + tooltipPad}
		viewBox={`0 0 ${width} ${height + tooltipPad}`}
		role="img"
		aria-label={label}
		class="overflow-visible"
	>
		<defs>
			<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.35" />
				<stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0" />
			</linearGradient>
		</defs>
		<g transform={`translate(0, ${tooltipPad})`}>
			<path d={areaPath} fill={`url(#${gradientId})`} />
			<polyline
				points={coords}
				fill="none"
				style="stroke: var(--color-primary); stroke-width: 1.5"
			/>
			{#each points as p, i (i)}
				<circle
					cx={p.x}
					cy={p.y}
					r="6"
					fill="var(--color-primary)"
					tabindex="0"
					role="button"
					aria-label={p.tooltip}
					class="opacity-50 transition-opacity duration-150 outline-none hover:opacity-100 focus-visible:opacity-100"
					onmouseenter={() => (activeIndex = i)}
					onmouseleave={() => (activeIndex = null)}
					onfocus={() => (activeIndex = i)}
					onblur={() => (activeIndex = null)}
				>
					<title>{p.tooltip}</title>
				</circle>
			{/each}
			{#if activeIndex !== null}
				{@const p = points[activeIndex]}
				{@const boxW = Math.max(40, p.tooltip.length * 4.6 + 8)}
				{@const tx = Math.min(Math.max(p.x, boxW / 2 + 1), width - boxW / 2 - 1)}
				<g transform={`translate(${tx}, ${p.y})`} class="pointer-events-none">
					<rect
						x={-boxW / 2}
						y="-24"
						width={boxW}
						height="14"
						rx="2"
						fill="var(--color-surface)"
						stroke="var(--color-line)"
					/>
					<text
						x="0"
						y="-14"
						text-anchor="middle"
						font-size="8"
						font-family="var(--font-mono)"
						fill="var(--color-ink)">{p.tooltip}</text
					>
				</g>
			{/if}
		</g>
	</svg>
{/if}
