<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<div class="card mx-auto max-w-md space-y-4 px-8 py-12 text-center">
	<p class="font-display text-4xl text-ink">{page.status}</p>
	<p class="font-mono text-sm text-muted">{page.error?.message ?? 'Something went wrong.'}</p>
	<p>
		<a href={resolve('/log')} class="font-mono text-sm text-primary hover:underline">
			&larr; Back to Match Log
		</a>
	</p>
</div>
