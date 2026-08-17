<script lang="ts">
	interface Column {
		key: string;
		label: string;
	}
	interface Props {
		columns: Column[];
		rows: Record<string, unknown>[];
	}
	let { columns, rows }: Props = $props();
</script>

<table class="w-full border-collapse font-mono text-sm">
	<thead>
		<tr class="border-b border-[#3a352c] text-left text-[#8a8478]">
			{#each columns as col (col.key)}
				<th class="px-3 py-2 font-normal">{col.label}</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each rows as row, i (i)}
			<tr class="border-b border-[#2a2620]">
				{#each columns as col (col.key)}
					<td class="px-3 py-2">{row[col.key]}</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
