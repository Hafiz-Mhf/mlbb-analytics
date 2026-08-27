import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SandboxPage from './+page.svelte';

describe('SandboxPage', () => {
	it('renders header, mode toggles, action buttons, and draft boards', async () => {
		render(SandboxPage);
		await expect.element(page.getByRole('heading', { level: 1, name: /Interactive Draft Sandbox/i })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /Dual Coach/i })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /Vs Simulated AI/i })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /Auto-Pick Turn/i })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
		await expect.element(page.getByText(/Hero Selection Pool/i)).toBeInTheDocument();
	});

	it('advances draft steps when heroes are locked in', async () => {
		render(SandboxPage);
		const autoPickBtn = page.getByRole('button', { name: /Auto-Pick Turn/i });
		await autoPickBtn.click();
		// Should advance to turn 2
		await expect.element(page.getByText(/Turn 2\/20/i)).toBeInTheDocument();
	});

	it('shows full-width post-draft outcome prediction section when all 20 steps are completed', async () => {
		render(SandboxPage);
		const autoPickBtn = page.getByRole('button', { name: /Auto-Pick Turn/i });
		// Complete all 20 draft turns
		for (let i = 0; i < 20; i++) {
			await autoPickBtn.click();
		}

		await expect.element(page.getByText(/Draft Complete/i)).toBeInTheDocument();
		await expect.element(page.getByRole('heading', { level: 2, name: /Post-Draft Win Predictability/i })).toBeInTheDocument();
		await expect.element(page.getByText(/5-Lane Head-to-Head Edges/i)).toBeInTheDocument();
		await expect.element(page.getByText(/Key Strategic Advantages/i)).toBeInTheDocument();
	});
});
