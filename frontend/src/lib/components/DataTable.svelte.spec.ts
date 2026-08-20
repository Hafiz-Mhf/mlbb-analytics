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

	it('links the first cell of each row when rowHref is given', async () => {
		render(DataTable, {
			columns: [
				{ key: 'series', label: 'Series' },
				{ key: 'winner', label: 'Winner' }
			],
			rows: [{ series: 'M1', winner: 'SRG' }],
			rowHref: (row: Record<string, unknown>) => `/series/${row.series}`
		});
		const link = page.getByRole('link', { name: 'M1' });
		await expect.element(link).toBeInTheDocument();
		await expect.element(link).toHaveAttribute('href', '/series/M1');
	});

	it('sorts rows numerically when a column header is clicked, and reverses on a second click', async () => {
		const screen = render(DataTable, {
			columns: [{ key: 'length', label: 'Length' }],
			rows: [{ length: 30 }, { length: 5 }, { length: 15 }]
		});
		const cells = () => screen.container.querySelectorAll('tbody td');
		const header = screen.getByRole('button', { name: /Length/ });

		await header.click();
		let values = Array.from(cells()).map((c) => c.textContent?.trim());
		expect(values).toEqual(['5', '15', '30']);

		await header.click();
		values = Array.from(cells()).map((c) => c.textContent?.trim());
		expect(values).toEqual(['30', '15', '5']);
	});
});
