import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SidesPage from './+page.svelte';

describe('SidesPage', () => {
	it('renders header, tournament side balance banner, and team asymmetry matrix', async () => {
		render(SidesPage);
		await expect.element(page.getByRole('heading', { level: 1, name: /Side Priority Analysis/i })).toBeInTheDocument();
		await expect.element(page.getByText(/Tournament Side Balance/i)).toBeInTheDocument();
		await expect.element(page.getByText(/Team Side Asymmetry Matrix/i)).toBeInTheDocument();
		await expect.element(page.getByText(/Side-Specific Hero Priorities/i)).toBeInTheDocument();
	});

	it('renders season filter tabs and priority sub-tabs', async () => {
		render(SidesPage);
		await expect.element(page.getByRole('button', { name: /All Seasons/i })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /Season 18/i })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /Season 17/i })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /First-Pick Priority/i })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /Counter-Pick Priority/i })).toBeInTheDocument();
	});
});
