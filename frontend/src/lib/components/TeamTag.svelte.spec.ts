import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TeamTag from './TeamTag.svelte';

describe('TeamTag', () => {
	it('shows the short code and a color swatch', async () => {
		render(TeamTag, { name: 'Selangor Red Giants' });
		await expect.element(page.getByText('SRG')).toBeInTheDocument();
	});

	it('falls back to the full name when no short code exists', async () => {
		render(TeamTag, { name: 'RRQ Tora' });
		await expect.element(page.getByText('RRQ Tora')).toBeInTheDocument();
	});
});
