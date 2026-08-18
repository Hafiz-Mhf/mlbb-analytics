<script lang="ts">
	import type { ResolvedPathname } from '$app/types';

	interface Column {
		key: string;
		label: string;
	}
	interface Props {
		columns: Column[];
		rows: Record<string, unknown>[];
		rowHref?: (row: Record<string, unknown>) => ResolvedPathname;
	}
	let { columns, rows, rowHref }: Props = $props();

	let sortKey = $state<string | null>(null);
	let sortDir = $state<'asc' | 'desc'>('asc');

	function toggleSort(key: string) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	function compareValues(a: unknown, b: unknown): number {
		const an = Number(a);
		const bn = Number(b);
		if (a !== '' && b !== '' && !Number.isNaN(an) && !Number.isNaN(bn)) {
			return an - bn;
		}
		return String(a).localeCompare(String(b));
	}

	const sortedRows = $derived.by(() => {
		if (!sortKey) return rows;
		const key = sortKey;
		const dir = sortDir === 'asc' ? 1 : -1;
		return rows.slice().sort((a, b) => compareValues(a[key], b[key]) * dir);
	});
</script>

<div class="overflow-x-auto">
	<table class="w-full border-collapse font-mono text-sm">
		<thead>
			<tr class="border-b border-[#3a352c] text-left text-[#8a8478]">
				{#each columns as col (col.key)}
					<th
						class="px-3 py-2 font-normal"
						aria-sort={sortKey === col.key
							? sortDir === 'asc'
								? 'ascending'
								: 'descending'
							: 'none'}
					>
						<button
							type="button"
							onclick={() => toggleSort(col.key)}
							class="flex items-center gap-1 font-mono text-inherit hover:text-[--color-amber]"
						>
							{col.label}
							{#if sortKey === col.key}
								<span class="text-[--color-amber]">{sortDir === 'asc' ? '^' : 'v'}</span>
							{/if}
						</button>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if sortedRows.length === 0}
				<tr>
					<td class="px-3 py-6 text-center text-[#8a8478]" colspan={columns.length}>
						No rows match the current filters.
					</td>
				</tr>
			{:else}
				{#each sortedRows as row, i (i)}
					<tr class="border-b border-[#2a2620] hover:bg-[#221f19]">
						{#each columns as col, ci (col.key)}
							<td class="px-3 py-2">
								{#if rowHref && ci === 0}
									<a href={rowHref(row)} class="text-[--color-amber] hover:underline"
										>{row[col.key]}</a
									>
								{:else}
									{row[col.key]}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
