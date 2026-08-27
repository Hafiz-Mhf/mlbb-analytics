import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RoleFilter from './RoleFilter.svelte';

describe('RoleFilter', () => {
	it('renders all role options and triggers onchange on click', async () => {
		let clickedRole: number | null = -1;
		const screen = render(RoleFilter, {
			selected: null,
			onchange: (role: number | null) => {
				clickedRole = role;
			}
		});

		const jglButton = screen.getByRole('tab', { name: 'JGL' });
		await expect.element(jglButton).toBeVisible();
		await jglButton.click();
		expect(clickedRole).toBe(2);
	});
});
