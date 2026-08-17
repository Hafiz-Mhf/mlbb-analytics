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
	<span class="text-base text-[#e8e4dc]">{format(value)}</span>
	<span class="text-xs text-[#8a8478]">baseline {format(baseline)}</span>
</span>
