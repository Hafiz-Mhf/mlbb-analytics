import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TrendChart from './TrendChart.svelte';

describe('TrendChart', () => {
	it('shows a fallback message when there is no history yet', async () => {
		render(TrendChart, { values: [], label: 'HHI trend' });
		await expect.element(page.getByText(/not enough games/i)).toBeInTheDocument();
	});

	it('renders a labeled chart when there is history', async () => {
		render(TrendChart, { values: [0.2, 0.5, 0.8], label: 'HHI trend' });
		await expect.element(page.getByRole('img', { name: 'HHI trend' })).toBeInTheDocument();
	});
});
