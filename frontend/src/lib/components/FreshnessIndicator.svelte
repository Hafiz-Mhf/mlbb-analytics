<script lang="ts">
	interface Props {
		generatedAt: string;
	}
	let { generatedAt }: Props = $props();
	const formatted = $derived(new Date(generatedAt).toLocaleString());
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-muted"
>
	<span class="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden="true"></span>
	Updated {formatted}
</span>
