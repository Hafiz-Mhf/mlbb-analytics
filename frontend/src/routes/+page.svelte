<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<!-- Redirects to the last-selected team (mirrors teamSelection.ts's STORAGE_KEY)
	     without waiting on hydration, so a slow connection doesn't sit on "Loading…". -->
	<script>
		(function () {
			try {
				var slug = localStorage.getItem('mlbb-analytics:selected-team') || 'srg';
				location.replace('/team/' + slug);
			} catch (e) {
				location.replace('/team/srg');
			}
		})();
	</script>
</svelte:head>

<noscript>
	<p class="font-mono text-sm text-muted">
		This page needs JavaScript to redirect automatically.
		<a href={resolve('/league')} class="text-primary hover:underline">View League Overview</a> instead.
	</p>
</noscript>
<p class="font-mono text-sm text-muted">Redirecting…</p>
