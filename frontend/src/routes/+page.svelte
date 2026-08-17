<script lang="ts">
	import { goto } from '$app/navigation';
	import { selectedTeam } from '$lib/teamSelection';
	import { onMount } from 'svelte';

	onMount(() => {
		goto(`/team/${$selectedTeam}`);
	});
</script>

<p class="font-mono text-sm text-[#8a8478]">Loading…</p>
