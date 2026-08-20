import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Home from './+page.svelte';

describe('Home', () => {
	it('shows the value-prop pitch', async () => {
		render(Home);
		await expect.element(page.getByText(/league baseline/i)).toBeInTheDocument();
	});

	it('links each of the 8 teams to its scouting page', async () => {
		render(Home);
		await expect.element(page.getByRole('link', { name: /Selangor Red Giants/i })).toHaveAttribute(
			'href',
			'/team/srg'
		);
		await expect.element(page.getByRole('link', { name: /RRQ Tora/i })).toHaveAttribute(
			'href',
			'/team/rrq'
		);
	});
});
