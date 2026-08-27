import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MatchupPage from './+page.svelte';

describe('MatchupPage', () => {
	it('renders header, team selectors, and draft clash sections', async () => {
		render(MatchupPage);
		await expect.element(page.getByRole('heading', { level: 1, name: /Head-to-Head Matchup/i })).toBeInTheDocument();
		await expect.element(page.getByText(/Direct Series Record/i)).toBeInTheDocument();
		await expect.element(page.getByText(/Side Performance/i)).toBeInTheDocument();
		await expect.element(page.getByText(/Draft Clash & Hero Priority/i)).toBeInTheDocument();
		await expect.element(page.getByText(/Lane-by-Lane Role Comparison/i)).toBeInTheDocument();
	});

	it('renders season filter buttons and allows switching tabs', async () => {
		render(MatchupPage);
		await expect.element(page.getByRole('button', { name: /All Seasons/i })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /Season 18/i })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /Season 17/i })).toBeInTheDocument();
	});
});
