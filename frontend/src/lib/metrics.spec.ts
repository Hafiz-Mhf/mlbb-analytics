import { describe, it, expect } from 'vitest';
import {
	hhi,
	hhiByRole,
	pickRateByRole,
	pickWinRateDelta,
	presence,
	presenceDelta,
	rollingHhi
} from './metrics';
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

function seasonSpanningFixture(): Dataset {
	const teams = [
		{ id: 1, canonicalName: 'Selangor Red Giants', shortCode: 'SRG' },
		{ id: 2, canonicalName: 'Team Vamos', shortCode: 'VMS' }
	];
	const heroes = [
		{ id: 1, canonicalName: 'freya' },
		{ id: 2, canonicalName: 'guinevere' }
	];
	// Ids are deliberately out of chronological order (20, 5, 10) so a test
	// that passes only by sorting on `playedAt` — not on `id` — proves the
	// function actually reads the date, not just happens to agree with it.
	const matches: Dataset['matches'] = [
		{ id: 20, seriesId: 'S17M1', season: '17', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: 'June 1, 2026 - 15:00' },
		{ id: 5, seriesId: 'S17M2', season: '17', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 2, gameLength: '10:00', gameNumberInSeries: 1, playedAt: 'June 8, 2026 - 15:00' },
		{ id: 10, seriesId: 'S18M1', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: 'August 14, 2026 - 15:00' }
	];
	const drafts: Dataset['drafts'] = [
		{ id: 1, matchId: 20, teamId: 1, slot: 1, heroId: 1, isBan: false }, // freya
		{ id: 2, matchId: 5, teamId: 1, slot: 1, heroId: 2, isBan: false }, // guinevere
		{ id: 3, matchId: 10, teamId: 1, slot: 1, heroId: 1, isBan: false } // freya again
	];
	return { teams, heroes, matches, drafts };
}

describe('rollingHhi', () => {
	it('returns an empty list for a team with no games', () => {
		const data = seasonSpanningFixture();
		expect(rollingHhi(data, 999)).toEqual([]);
	});

	it('sorts by playedAt (not id) and keeps accumulating across the season boundary', () => {
		const data = seasonSpanningFixture();
		const points = rollingHhi(data, 1, 10);
		expect(points.map((p) => p.matchId)).toEqual([20, 5, 10]);
		expect(points[0].hhi).toBeCloseTo(1, 10); // just freya
		expect(points[1].hhi).toBeCloseTo(0.5, 10); // freya + guinevere, 50/50
		expect(points[2].hhi).toBeCloseTo(5 / 9, 10); // freya x2, guinevere x1 across all 3
	});

	it('drops the oldest game once the window is full', () => {
		const data = seasonSpanningFixture();
		const points = rollingHhi(data, 1, 2);
		expect(points[2].hhi).toBeCloseTo(0.5, 10); // window is just [id 5, id 10]: one freya, one guinevere
	});
});

function winRateFixture(): Dataset {
	const teams = [
		{ id: 1, canonicalName: 'Selangor Red Giants', shortCode: 'SRG' },
		{ id: 2, canonicalName: 'Team Vamos', shortCode: 'VMS' }
	];
	const heroes = [
		{ id: 1, canonicalName: 'sora' },
		{ id: 2, canonicalName: 'guinevere' },
		{ id: 3, canonicalName: 'freya' }
	];
	const heroId = (name: string) => heroes.find((h) => h.canonicalName === name)!.id;

	// Team 1 plays 9 games: wins games 1-5, loses games 6-9.
	const winners = [1, 1, 1, 1, 1, 2, 2, 2, 2];
	const matches: Dataset['matches'] = winners.map((winnerId, i) => ({
		id: i + 1,
		seriesId: `M${i + 1}`,
		season: '18',
		stage: 'regular_season' as const,
		team1Id: 1,
		team2Id: 2,
		team1Side: 'blue' as const,
		winnerId,
		gameLength: '10:00',
		gameNumberInSeries: 1,
		playedAt: null
	}));

	const drafts: Dataset['drafts'] = [];
	let id = 1;
	const pick = (matchId: number, hero: string) =>
		drafts.push({ id: id++, matchId, teamId: 1, slot: 1, heroId: heroId(hero), isBan: false });

	// sora: picked in all 5 wins only -> 5 games, 100% win rate (well above team's 5/9 overall).
	for (let g = 1; g <= 5; g++) pick(g, 'sora');
	// freya: picked in the 5 wins plus 1 loss -> 6 games, 5/6 win rate (still above overall, smaller edge).
	for (let g = 1; g <= 5; g++) pick(g, 'freya');
	pick(6, 'freya');
	// guinevere: picked only in the 4 losses -> 4 games, below the 5-game threshold, must be excluded.
	pick(6, 'guinevere');
	pick(7, 'guinevere');
	pick(8, 'guinevere');
	pick(9, 'guinevere');

	return { teams, heroes, matches, drafts };
}

describe('pickWinRateDelta', () => {
	it('excludes heroes below the 5-game threshold, includes at and above it, sorted best first', () => {
		const data = winRateFixture();
		const deltas = pickWinRateDelta(data, 1);
		expect(deltas.map((d) => d.hero)).toEqual(['sora', 'freya']);
		expect(deltas[0].games).toBe(5);
		expect(deltas[0].delta).toBeCloseTo(1 - 5 / 9, 10);
		expect(deltas[1].games).toBe(6);
		expect(deltas[1].delta).toBeCloseTo(5 / 6 - 5 / 9, 10);
	});

	it('scopes to bans only when isBan is set, and returns nothing when there are none', () => {
		const data = winRateFixture();
		expect(pickWinRateDelta(data, 1, { isBan: true })).toEqual([]);
	});
});

function seasonPresenceFixture(): Dataset {
	const teams = [
		{ id: 1, canonicalName: 'Selangor Red Giants', shortCode: 'SRG' },
		{ id: 2, canonicalName: 'Team Vamos', shortCode: 'VMS' }
	];
	const heroes = [
		{ id: 1, canonicalName: 'freya' },
		{ id: 2, canonicalName: 'guinevere' },
		{ id: 3, canonicalName: 'chou' },
		{ id: 4, canonicalName: 'kalea' }
	];
	const heroId = (name: string) => heroes.find((h) => h.canonicalName === name)!.id;

	// Team 1 plays 4 games in S17, 2 in S18. Team 2 plays alongside them in
	// every game (so league-scoped denominators differ from team-scoped
	// ones) but only ever touches kalea, never the three heroes under test.
	const matches: Dataset['matches'] = [
		{ id: 1, seriesId: 'S17M1', season: '17', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 2, seriesId: 'S17M2', season: '17', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 3, seriesId: 'S17M3', season: '17', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 4, seriesId: 'S17M4', season: '17', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 5, seriesId: 'S18M1', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 6, seriesId: 'S18M2', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '10:00', gameNumberInSeries: 1, playedAt: null }
	];

	const drafts: Dataset['drafts'] = [];
	let id = 1;
	const pick = (matchId: number, teamId: number, hero: string) =>
		drafts.push({ id: id++, matchId, teamId, slot: 1, heroId: heroId(hero), isBan: false });

	// Team 1, S17: freya in all 4 games, chou in 1 of 4.
	pick(1, 1, 'freya');
	pick(2, 1, 'freya');
	pick(3, 1, 'freya');
	pick(4, 1, 'freya');
	pick(1, 1, 'chou');
	// Team 1, S18: freya in 1 of 2, guinevere (new) in both.
	pick(5, 1, 'freya');
	pick(5, 1, 'guinevere');
	pick(6, 1, 'guinevere');
	// Team 2: kalea in every game, both seasons — never touches the other three heroes.
	for (const matchId of [1, 2, 3, 4, 5, 6]) pick(matchId, 2, 'kalea');

	return { teams, heroes, matches, drafts };
}

describe('presenceDelta', () => {
	it('computes before/after/delta per hero, filling 0 for a season a hero never appeared in, sorted by |delta| descending', () => {
		const data = seasonPresenceFixture();
		const deltas = presenceDelta(data, '17', '18', { teamId: 1 });
		expect(deltas.map((d) => d.hero)).toEqual(['guinevere', 'freya', 'chou']);

		expect(deltas[0]).toMatchObject({ before: 0, after: 1, delta: 1 }); // guinevere: new in S18
		expect(deltas[1].before).toBeCloseTo(1, 10); // freya: 4/4 in S17
		expect(deltas[1].after).toBeCloseTo(0.5, 10); // freya: 1/2 in S18
		expect(deltas[1].delta).toBeCloseTo(-0.5, 10);
		expect(deltas[2]).toMatchObject({ after: 0 }); // chou: absent from S18 entirely
		expect(deltas[2].before).toBeCloseTo(0.25, 10); // chou: 1/4 in S17
	});

	it('scopes to one team when teamId is given, and to the whole league when it is omitted', () => {
		const data = seasonPresenceFixture();
		const teamScoped = presenceDelta(data, '17', '18', { teamId: 1 });
		const leagueScoped = presenceDelta(data, '17', '18');
		const teamFreya = teamScoped.find((d) => d.hero === 'freya')!;
		const leagueFreya = leagueScoped.find((d) => d.hero === 'freya')!;
		expect(teamFreya.before).toBeCloseTo(1, 10); // 4 of team 1's own 4 games
		expect(leagueFreya.before).toBeCloseTo(0.5, 10); // 4 of 8 league team-instances (denominator doubles)
	});
});
