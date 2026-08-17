import { describe, it, expect } from 'vitest';
import { generateMockDataset } from './generator';

describe('generateMockDataset', () => {
	it('is deterministic for a given seed', () => {
		const a = generateMockDataset(1);
		const b = generateMockDataset(1);
		expect(a.matches.length).toBe(b.matches.length);
		expect(a.drafts).toEqual(b.drafts);
	});

	it('produces all eight teams', () => {
		const data = generateMockDataset(1);
		expect(data.teams.length).toBe(8);
	});

	it('every game has exactly 20 draft rows (10 picks + 10 bans)', () => {
		const data = generateMockDataset(1);
		for (const match of data.matches) {
			const rows = data.drafts.filter((d) => d.matchId === match.id);
			expect(rows.filter((r) => !r.isBan).length).toBe(10);
			expect(rows.filter((r) => r.isBan).length).toBe(10);
		}
	});

	it('no hero repeats within a single game', () => {
		const data = generateMockDataset(1);
		for (const match of data.matches) {
			const heroIds = data.drafts.filter((d) => d.matchId === match.id).map((d) => d.heroId);
			expect(new Set(heroIds).size).toBe(heroIds.length);
		}
	});

	it('shapes team 0 as high-HHI (predictable) and team 1 as low-HHI (flexible)', () => {
		const data = generateMockDataset(1);
		const distinctHeroesPicked = (teamId: number) =>
			new Set(
				data.drafts
					.filter((d) => d.teamId === teamId && !d.isBan)
					.map((d) => d.heroId)
			).size;
		// team 0 (AC Esports) draws from a 6-hero signature pool;
		// team 1 (Bigetron) draws from the full ~26-hero pool
		expect(distinctHeroesPicked(data.teams[0].id)).toBeLessThanOrEqual(6);
		expect(distinctHeroesPicked(data.teams[1].id)).toBeGreaterThan(10);
	});
});
