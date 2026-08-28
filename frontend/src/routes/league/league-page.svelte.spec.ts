import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LeaguePage from './+page.svelte';

describe('LeaguePage', () => {
	it('renders header, tournament standings table, and draft predictability section', async () => {
		render(LeaguePage);
		await expect.element(page.getByRole('heading', { name: 'League Overview' })).toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'Tournament Standings' })).toBeInTheDocument();
		await expect.element(page.getByText('Official regular-season match records')).toBeInTheDocument();
	});

	it('renders standings season filter buttons and switches scope', async () => {
		render(LeaguePage);
		const s18Button = page.getByRole('button', { name: /Season 18/i });
		const s17Button = page.getByRole('button', { name: /Season 17/i });
		const allButton = page.getByRole('button', { name: /All Time/i });

		await expect.element(s18Button).toBeInTheDocument();
		await expect.element(s17Button).toBeInTheDocument();
		await expect.element(allButton).toBeInTheDocument();

		await s17Button.click();
		await expect.element(page.getByRole('link', { name: /Selangor Red Giants/i })).toBeInTheDocument();
	});
});
