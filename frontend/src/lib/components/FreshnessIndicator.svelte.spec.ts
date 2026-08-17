import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FreshnessIndicator from './FreshnessIndicator.svelte';

describe('FreshnessIndicator', () => {
	it('shows a last-updated label', async () => {
		render(FreshnessIndicator, { generatedAt: '2026-08-17T00:00:00Z' });
		await expect.element(page.getByText(/updated/i)).toBeInTheDocument();
	});
});
