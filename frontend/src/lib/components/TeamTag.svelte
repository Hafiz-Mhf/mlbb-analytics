<script lang="ts">
	import { TEAM_SHORT_CODES, teamLogo } from '../teams';

	interface Props {
		name: string;
	}
	let { name }: Props = $props();
	const label = $derived(TEAM_SHORT_CODES[name] ?? name);
	let logoFailed = $state(false);
</script>

<span class="inline-flex items-center gap-1.5 font-mono text-sm">
	{#if !logoFailed}
		<img
			src={teamLogo(name)}
			alt=""
			width="16"
			height="16"
			class="h-4 w-4 object-contain"
			onerror={() => (logoFailed = true)}
		/>
	{/if}
	{label}
</span>
