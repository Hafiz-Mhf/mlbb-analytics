<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<div class="space-y-4 py-12 text-center">
	<p class="font-[Syne] text-4xl text-[#e8e4dc]">{page.status}</p>
	<p class="font-mono text-sm text-[#8a8478]">{page.error?.message ?? 'Something went wrong.'}</p>
	<p>
		<a href={resolve('/log')} class="font-mono text-sm text-[--color-amber] hover:underline">
			&larr; Back to Match Log
		</a>
	</p>
</div>
