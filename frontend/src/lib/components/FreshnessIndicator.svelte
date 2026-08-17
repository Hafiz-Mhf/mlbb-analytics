<script lang="ts">
	interface Props {
		generatedAt: string;
	}
	let { generatedAt }: Props = $props();
	const formatted = $derived(new Date(generatedAt).toLocaleString());
</script>

<span class="text-xs text-[#8a8478]">Updated {formatted}</span>
