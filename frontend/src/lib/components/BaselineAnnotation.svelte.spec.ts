import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BaselineAnnotation from './BaselineAnnotation.svelte';

describe('BaselineAnnotation', () => {
	it('shows the raw value and the league baseline together', async () => {
		render(BaselineAnnotation, { value: 0.78, baseline: 0.847 });

		await expect.element(page.getByText('78.0%')).toBeInTheDocument();
		await expect.element(page.getByText(/league avg/i)).toBeInTheDocument();
		await expect.element(page.getByText('84.7%')).toBeInTheDocument();
	});

	it('accepts a custom formatter', async () => {
		render(BaselineAnnotation, { value: 0.12, baseline: 0.2, format: (n: number) => n.toFixed(3) });

		await expect.element(page.getByText('0.120')).toBeInTheDocument();
		await expect.element(page.getByText('0.200')).toBeInTheDocument();
	});
});
