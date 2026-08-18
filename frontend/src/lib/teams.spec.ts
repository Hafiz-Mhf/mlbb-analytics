import { describe, it, expect } from 'vitest';
import { TEAM_COLORS, TEAM_SHORT_CODES } from './teams';

const EIGHT_TEAMS = [
	'AC Esports',
	'Bigetron MY by VIT',
	'Invictus Gaming',
	'RRQ Tora',
	'Selangor Red Giants',
	'Team Flash',
	'Team Rey',
	'Team Vamos'
];

describe('teams', () => {
	it('has a color and a short-code entry for all eight teams', () => {
		for (const name of EIGHT_TEAMS) {
			expect(TEAM_COLORS[name]).toMatch(/^#[0-9a-f]{6}$/i);
			expect(name in TEAM_SHORT_CODES).toBe(true);
		}
	});

	it('every color is distinct', () => {
		const values = Object.values(TEAM_COLORS);
		expect(new Set(values).size).toBe(values.length);
	});

	it('matches the pipeline short codes exactly (build.py TEAM_SHORT_CODES)', () => {
		expect(TEAM_SHORT_CODES['Selangor Red Giants']).toBe('SRG');
		expect(TEAM_SHORT_CODES['RRQ Tora']).toBe('RRQ');
	});
});
