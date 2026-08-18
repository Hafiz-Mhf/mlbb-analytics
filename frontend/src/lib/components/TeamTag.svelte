<script lang="ts">
	import { TEAM_SHORT_CODES, teamLogo } from '../teams';

	interface Props {
		name: string;
		size?: number;
	}
	let { name, size = 16 }: Props = $props();
	const label = $derived(TEAM_SHORT_CODES[name] ?? name);
	let logoFailed = $state(false);
</script>

<span class="inline-flex items-center gap-1.5 font-mono text-sm">
	{#if !logoFailed}
		<img
			src={teamLogo(name)}
			alt=""
			width={size}
			height={size}
			style={`width:${size}px;height:${size}px`}
			class="object-contain"
			onerror={() => (logoFailed = true)}
		/>
	{/if}
	{label}
</span>
