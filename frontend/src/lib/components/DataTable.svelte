<script lang="ts">
	interface Column {
		key: string;
		label: string;
	}
	interface Props {
		columns: Column[];
		rows: Record<string, unknown>[];
		rowHref?: (row: Record<string, unknown>) => string;
	}
	let { columns, rows, rowHref }: Props = $props();
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
				{#each columns as col, ci (col.key)}
					<td class="px-3 py-2">
						{#if rowHref && ci === 0}
							<a href={rowHref(row)} class="text-[--color-amber] hover:underline">{row[col.key]}</a>
						{:else}
							{row[col.key]}
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
