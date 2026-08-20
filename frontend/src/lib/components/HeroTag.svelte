<script lang="ts">
	import { heroIcon } from '../heroes';

	interface Props {
		name: string;
		size?: number;
		showName?: boolean;
		notable?: boolean;
	}
	let { name, size = 16, showName = true, notable = false }: Props = $props();
	let iconFailed = $state(false);
</script>

<span class="inline-flex items-center gap-1.5 font-mono text-sm" title={showName ? undefined : name}>
	{#if !iconFailed}
		<span
			class="inline-flex shrink-0 items-center justify-center rounded-full border bg-surface-2 {notable
				? 'border-gold ring-2 ring-gold/50'
				: 'border-line'}"
			style={`width:${size + 6}px;height:${size + 6}px`}
		>
			<img
				src={heroIcon(name)}
				alt={showName ? '' : name}
				width={size}
				height={size}
				style={`width:${size}px;height:${size}px`}
				class="rounded-full object-cover"
				onerror={() => (iconFailed = true)}
			/>
		</span>
	{:else if !showName}
		<span class="whitespace-nowrap text-ink">{name}</span>
	{/if}
	{#if showName}
		<span class="whitespace-nowrap text-ink">{name}</span>
	{/if}
</span>
