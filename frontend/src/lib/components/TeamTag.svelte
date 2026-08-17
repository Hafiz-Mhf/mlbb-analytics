<script lang="ts">
	import { TEAM_COLORS, TEAM_SHORT_CODES } from '../teams';

	interface Props {
		name: string;
	}
	let { name }: Props = $props();
	const color = $derived(TEAM_COLORS[name] ?? '#8a8478');
	const label = $derived(TEAM_SHORT_CODES[name] ?? name);
</script>

<span class="inline-flex items-center gap-1.5 font-mono text-sm">
	<span class="inline-block h-2.5 w-2.5 rounded-full" style:background-color={color}></span>
	{label}
</span>
