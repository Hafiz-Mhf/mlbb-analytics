import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DataTable from './DataTable.svelte';

describe('DataTable', () => {
	it('renders a header per column and a row per data item', async () => {
		render(DataTable, {
			columns: [
				{ key: 'hero', label: 'Hero' },
				{ key: 'rate', label: 'Presence' }
			],
			rows: [
				{ hero: 'guinevere', rate: '45%' },
				{ hero: 'freya', rate: '49%' }
			]
		});
		await expect.element(page.getByText('Hero')).toBeInTheDocument();
		await expect.element(page.getByText('guinevere')).toBeInTheDocument();
		await expect.element(page.getByText('freya')).toBeInTheDocument();
	});
});
