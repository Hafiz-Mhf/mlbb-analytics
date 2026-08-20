<script lang="ts">
	interface Props {
		value: number;
		baseline: number;
		format?: (n: number) => string;
	}

	const defaultFormat = (n: number) => `${(n * 100).toFixed(1)}%`;
	let { value, baseline, format = defaultFormat }: Props = $props();
</script>

<span class="inline-flex items-baseline gap-2 font-mono">
	<span class="text-base font-medium text-ink">{format(value)}</span>
	<span class="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs text-muted">
		<abbr title="Average across all 8 MPL Malaysia teams" class="no-underline">league avg</abbr>
		{format(baseline)}
	</span>
</span>
