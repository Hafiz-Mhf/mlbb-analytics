import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RoleDistributionBar from './RoleDistributionBar.svelte';

describe('RoleDistributionBar', () => {
	it('renders distribution badges for each role', async () => {
		const screen = render(RoleDistributionBar, {
			roles: [
				{ role: 1, roleName: 'EXP', picks: 3, share: 0.75 },
				{ role: 5, roleName: 'ROAM', picks: 1, share: 0.25 }
			]
		});
		await expect.element(screen.getByText('EXP')).toBeVisible();
		await expect.element(screen.getByText('ROAM')).toBeVisible();
	});
});
