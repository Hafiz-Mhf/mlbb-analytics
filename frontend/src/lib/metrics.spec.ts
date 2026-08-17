import { describe, it, expect } from 'vitest';
import { hhi, hhiByRole, pickRateByRole, presence } from './metrics';
import type { Dataset } from './types';

// Same two-game fixture as pipeline/tests/test_metrics.py, translated —
// hand-computed expected values must match the Python side exactly.
function fixture(): Dataset {
	const teams = [
		{ id: 1, canonicalName: 'Selangor Red Giants', shortCode: 'SRG' },
		{ id: 2, canonicalName: 'Team Vamos', shortCode: 'VMS' }
	];
	const heroNames = [
		'sora', 'guinevere', 'zhuxin', 'granger', 'chou', 'lylia', 'selena', 'karrie',
		'atlas', 'phoveus', 'leomord', 'yve', 'harith', 'khaleed', 'baxia', 'valentina',
		'kalea', 'suyou', 'harley', 'freya', 'marcel', 'fanny', 'gloo', 'claude'
	];
	const heroes = heroNames.map((canonicalName, i) => ({ id: i + 1, canonicalName }));
	const heroId = (name: string) => heroes.find((h) => h.canonicalName === name)!.id;

	const matches = [
		{ id: 1, seriesId: 'M1', season: '17', stage: 'regular_season' as const, team1Id: 1, team2Id: 2, team1Side: 'blue' as const, winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 2, seriesId: 'M1', season: '17', stage: 'regular_season' as const, team1Id: 1, team2Id: 2, team1Side: 'red' as const, winnerId: 2, gameLength: '12:00', gameNumberInSeries: 2, playedAt: null }
	];

	const drafts: Dataset['drafts'] = [];
	let id = 1;
	const addPicks = (matchId: number, teamId: number, names: string[]) =>
		names.forEach((name, i) =>
			drafts.push({ id: id++, matchId, teamId, slot: i + 1, heroId: heroId(name), isBan: false })
		);
	const addBans = (matchId: number, teamId: number, names: string[]) =>
		names.forEach((name, i) =>
			drafts.push({ id: id++, matchId, teamId, slot: i + 1, heroId: heroId(name), isBan: true })
		);

	addPicks(1, 1, ['sora', 'guinevere', 'zhuxin', 'granger', 'chou']);
	addPicks(1, 2, ['phoveus', 'leomord', 'yve', 'harith', 'khaleed']);
	addBans(1, 1, ['baxia', 'valentina', 'kalea', 'suyou', 'harley']);
	addBans(1, 2, ['freya', 'marcel', 'fanny', 'gloo', 'claude']);

	addPicks(2, 1, ['guinevere', 'lylia', 'selena', 'karrie', 'atlas']);
	addPicks(2, 2, ['harith', 'leomord', 'yve', 'phoveus', 'khaleed']);
	addBans(2, 1, ['baxia', 'valentina', 'kalea', 'suyou', 'harley']);
	addBans(2, 2, ['freya', 'marcel', 'fanny', 'gloo', 'claude']);

	return { teams, heroes, matches, drafts };
}

describe('presence', () => {
	it('is picks+bans over games played, per team', () => {
		const data = fixture();
		const rates = presence(data, { teamId: 1 });
		expect(rates['guinevere']).toBe(1.0);
		expect(rates['baxia']).toBe(1.0);
		expect(rates['zhuxin']).toBe(0.5);
	});

	it('league scope doubles the denominator', () => {
		const data = fixture();
		const rates = presence(data);
		expect(rates['baxia']).toBe(0.5);
	});
});

describe('hhi', () => {
	it('is sum of squared pick shares, picks only', () => {
		const data = fixture();
		const expected = (2 / 10) ** 2 + 8 * (1 / 10) ** 2;
		expect(hhi(data, { teamId: 1 })).toBeCloseTo(expected, 10);
	});
});

describe('hhiByRole', () => {
	it('scopes to one slot only', () => {
		const data = fixture();
		expect(hhiByRole(data, 2, { teamId: 1 })).toBeCloseTo(0.5, 10);
	});
});

describe('pickRateByRole', () => {
	it('matches only that slot', () => {
		const data = fixture();
		const slot1 = pickRateByRole(data, 1, { teamId: 1 });
		expect(slot1['sora']).toBe(0.5);
		expect(slot1['guinevere']).toBe(0.5);
	});
});
