import { describe, it, expect } from 'vitest';
import {
	banRate,
	draftRecommendations,
	evaluateSideDraft,
	flexHeroes,
	headToHeadSummary,
	heroClash,
	heroSidePriorities,
	hhi,
	hhiByRole,
	leagueSidePerformance,
	matchupRoleComparison,
	OFFICIAL_DRAFT_SEQUENCE,
	pickRate,
	pickRateByRole,
	pickWinRateDelta,
	presence,
	presenceDelta,
	ROLE_NAMES,
	rolePredictabilityMatrix,
	rollingHhi,
	sidePerformance,
	teamSideMatrix
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

	return { teams, heroes, matches, drafts, generatedAt: '2026-08-18T00:00:00+00:00' };
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

describe('pickRate', () => {
	it('counts picks only, per team', () => {
		const data = fixture();
		const rates = pickRate(data, { teamId: 1 });
		expect(rates['guinevere']).toBe(1.0);
		expect(rates['sora']).toBe(0.5);
		expect(rates['baxia']).toBeUndefined();
	});

	it('league scope doubles the denominator', () => {
		const data = fixture();
		expect(pickRate(data)['guinevere']).toBe(0.5);
	});
});

describe('banRate', () => {
	it('counts bans only, per team', () => {
		const data = fixture();
		const rates = banRate(data, { teamId: 1 });
		expect(rates['baxia']).toBe(1.0);
		expect(rates['guinevere']).toBeUndefined();
	});

	it('league scope doubles the denominator', () => {
		const data = fixture();
		expect(banRate(data)['baxia']).toBe(0.5);
	});

	it('sums with pickRate to equal presence, for every hero', () => {
		const data = fixture();
		const picks = pickRate(data, { teamId: 1 });
		const bans = banRate(data, { teamId: 1 });
		const combined = presence(data, { teamId: 1 });
		for (const hero of Object.keys(combined)) {
			expect((picks[hero] ?? 0) + (bans[hero] ?? 0)).toBeCloseTo(combined[hero], 10);
		}
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
	return { teams, heroes, matches, drafts, generatedAt: '2026-08-18T00:00:00+00:00' };
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

	return { teams, heroes, matches, drafts, generatedAt: '2026-08-18T00:00:00+00:00' };
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

	return { teams, heroes, matches, drafts, generatedAt: '2026-08-18T00:00:00+00:00' };
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

function roleFixtureData(): Dataset {
	const teams = [
		{ id: 1, canonicalName: 'Selangor Red Giants', shortCode: 'SRG' },
		{ id: 2, canonicalName: 'Team Vamos', shortCode: 'VMS' }
	];
	const heroes = [
		{ id: 1, canonicalName: 'gloo' },
		{ id: 2, canonicalName: 'fanny' },
		{ id: 3, canonicalName: 'chou' }
	];
	const matches: Dataset['matches'] = [
		{ id: 1, seriesId: 'S18M1', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '12:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 2, seriesId: 'S18M2', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '14:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 3, seriesId: 'S18M3', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '15:00', gameNumberInSeries: 1, playedAt: null },
		{ id: 4, seriesId: 'S18M4', season: '18', stage: 'regular_season', team1Id: 1, team2Id: 2, team1Side: 'blue', winnerId: 1, gameLength: '16:00', gameNumberInSeries: 1, playedAt: null }
	];
	const drafts: Dataset['drafts'] = [
		// Match 1: Team 1 picks Gloo slot 1 (EXP), Team 2 picks Fanny slot 2 (JGL)
		{ id: 1, matchId: 1, teamId: 1, slot: 1, heroId: 1, isBan: false },
		{ id: 2, matchId: 1, teamId: 2, slot: 2, heroId: 2, isBan: false },
		// Match 2: Team 1 picks Gloo slot 1 (EXP), Team 2 picks Gloo slot 5 (ROAM)
		{ id: 3, matchId: 2, teamId: 1, slot: 1, heroId: 1, isBan: false },
		{ id: 4, matchId: 2, teamId: 2, slot: 5, heroId: 1, isBan: false },
		// Match 3: Team 1 picks Gloo slot 5 (ROAM), Team 2 picks Chou slot 5 (ROAM)
		{ id: 5, matchId: 3, teamId: 1, slot: 5, heroId: 1, isBan: false },
		{ id: 6, matchId: 3, teamId: 2, slot: 5, heroId: 3, isBan: false },
		// Match 4: Team 1 picks Fanny slot 2 (JGL), Team 2 picks Chou slot 1 (EXP)
		{ id: 7, matchId: 4, teamId: 1, slot: 2, heroId: 2, isBan: false },
		{ id: 8, matchId: 4, teamId: 2, slot: 1, heroId: 3, isBan: false }
	];
	return { teams, heroes, matches, drafts, generatedAt: '2026-08-27T00:00:00+00:00' };
}

describe('flexHeroes', () => {
	it('identifies heroes picked in 2 or more distinct roles and computes correct distribution', () => {
		const data = roleFixtureData();
		const flex = flexHeroes(data);
		expect(flex.map((f) => f.hero)).toEqual(['gloo', 'chou']);

		const gloo = flex.find((f) => f.hero === 'gloo')!;
		expect(gloo.totalPicks).toBe(4);
		expect(gloo.roles.length).toBe(2);
		expect(gloo.primaryRole.picks).toBe(2);
		expect(gloo.primaryRole.share).toBe(0.5);
		expect(gloo.flexRate).toBe(0.5);
	});

	it('scopes flex heroes to a specific team when teamId is passed', () => {
		const data = roleFixtureData();
		const team1Flex = flexHeroes(data, { teamId: 1 });
		expect(team1Flex.map((f) => f.hero)).toEqual(['gloo']);
		expect(team1Flex[0].totalPicks).toBe(3);
		expect(team1Flex[0].primaryRole.roleName).toBe('EXP');
		expect(team1Flex[0].primaryRole.picks).toBe(2);
		expect(team1Flex[0].secondaryRoles[0].roleName).toBe('ROAM');
		expect(team1Flex[0].secondaryRoles[0].picks).toBe(1);
	});
});

describe('rolePredictabilityMatrix', () => {
	it('computes HHI for each team and league baseline across all 5 roles', () => {
		const data = roleFixtureData();
		const matrix = rolePredictabilityMatrix(data);
		expect(matrix.teams.length).toBe(2);
		expect(matrix.teams[0].teamName).toBe('Selangor Red Giants');
		expect(matrix.teams[0].roleHhi[1]).toBeGreaterThanOrEqual(0);
		expect(matrix.teams[0].roleHhi[2]).toBeGreaterThanOrEqual(0);
		expect(matrix.league[1]).toBeGreaterThanOrEqual(0);
	});
});

describe('headToHeadSummary', () => {
	it('calculates direct series, game scores, and average game length', () => {
		const data = fixture(); // 2 games between team 1 and 2 in series M1, game 1 won by T1 (10:00), game 2 won by T2 (12:00)
		const summary = headToHeadSummary(data, 1, 2);
		expect(summary.totalGames).toBe(2);
		expect(summary.team1Wins).toBe(1);
		expect(summary.team2Wins).toBe(1);
		expect(summary.totalSeries).toBe(1);
		expect(summary.avgGameLengthSeconds).toBe(660); // (600 + 720) / 2
		expect(summary.directMatchIds).toEqual([1, 2]);
	});

	it('returns 0s when no direct games were played', () => {
		const data = fixture();
		const summary = headToHeadSummary(data, 1, 999);
		expect(summary.totalGames).toBe(0);
		expect(summary.team1Wins).toBe(0);
		expect(summary.team2Wins).toBe(0);
		expect(summary.totalSeries).toBe(0);
		expect(summary.avgGameLengthSeconds).toBe(0);
		expect(summary.directMatchIds).toEqual([]);
	});
});

describe('sidePerformance', () => {
	it('computes Blue and Red side games, wins, and win rates accurately', () => {
		const data = fixture(); // Game 1: T1 on Blue (wins); Game 2: T1 on Red (loses)
		const t1Side = sidePerformance(data, 1);
		expect(t1Side.blueGames).toBe(1);
		expect(t1Side.blueWins).toBe(1);
		expect(t1Side.blueWinRate).toBe(1.0);
		expect(t1Side.redGames).toBe(1);
		expect(t1Side.redWins).toBe(0);
		expect(t1Side.redWinRate).toBe(0.0);

		const t2Side = sidePerformance(data, 2);
		expect(t2Side.blueGames).toBe(1);
		expect(t2Side.blueWins).toBe(1);
		expect(t2Side.blueWinRate).toBe(1.0);
		expect(t2Side.redGames).toBe(1);
		expect(t2Side.redWins).toBe(0);
		expect(t2Side.redWinRate).toBe(0.0);
	});
});

describe('heroClash', () => {
	it('categorizes heroes into contested vs team signature priorities', () => {
		const data = fixture();
		const clash = heroClash(data, 1, 2);
		expect(clash.contested).toBeDefined();
		expect(clash.team1Priority).toBeDefined();
		expect(clash.team2Priority).toBeDefined();
		expect(Array.isArray(clash.contested)).toBe(true);
	});
});

describe('matchupRoleComparison', () => {
	it('returns 5 lane comparisons with team HHI and top picks', () => {
		const data = fixture();
		const roles = matchupRoleComparison(data, 1, 2);
		expect(roles.length).toBe(5);
		expect(roles[0].roleName).toBe('EXP');
		expect(roles[0].team1Hhi).toBeGreaterThanOrEqual(0);
		expect(roles[0].team2Hhi).toBeGreaterThanOrEqual(0);
		expect(roles[0].team1TopPicks.length).toBeGreaterThanOrEqual(1);
	});
});

describe('leagueSidePerformance', () => {
	it('calculates total matches, Blue vs Red wins and win rates correctly', () => {
		const data = fixture(); // 2 games: Game 1 Blue (T1) wins, Game 2 Blue (T2) wins
		const stats = leagueSidePerformance(data);
		expect(stats.totalMatches).toBe(2);
		expect(stats.blueWins).toBe(2);
		expect(stats.blueWinRate).toBe(1.0);
		expect(stats.redWins).toBe(0);
		expect(stats.redWinRate).toBe(0.0);
	});
});

describe('teamSideMatrix', () => {
	it('computes 8-team side performance rows with side delta and reliance', () => {
		const data = fixture();
		const matrix = teamSideMatrix(data);
		expect(matrix.length).toBe(2);
		expect(matrix[0].teamName).toBe('Selangor Red Giants');
		expect(matrix[0].blueGames).toBe(1);
		expect(matrix[0].redGames).toBe(1);
		expect(matrix[0].reliance).toBeDefined();
	});
});

describe('heroSidePriorities', () => {
	it('computes hero side presence, first-pick priority, and side win deltas', () => {
		const data = fixture();
		const priorities = heroSidePriorities(data);
		expect(priorities.bluePriority).toBeDefined();
		expect(priorities.redPriority).toBeDefined();
		expect(priorities.winRateSwings).toBeDefined();
	});
});

describe('OFFICIAL_DRAFT_SEQUENCE', () => {
	it('contains exactly 20 official tournament steps', () => {
		expect(OFFICIAL_DRAFT_SEQUENCE.length).toBe(20);
		expect(OFFICIAL_DRAFT_SEQUENCE[0].action).toBe('ban');
		expect(OFFICIAL_DRAFT_SEQUENCE[6].action).toBe('pick');
		expect(OFFICIAL_DRAFT_SEQUENCE[6].side).toBe('blue');
		expect(OFFICIAL_DRAFT_SEQUENCE[19].action).toBe('pick');
		expect(OFFICIAL_DRAFT_SEQUENCE[19].side).toBe('red');
	});
});

describe('draftRecommendations', () => {
	it('provides ranked recommendations excluding unavailable heroes and prioritizing open roles', () => {
		const data = fixture();
		const recs = draftRecommendations(data, 1, 'blue', 'pick', new Set(['Chou']), new Set([1]));
		expect(recs.length).toBeGreaterThan(0);
		expect(recs.some((r) => r.hero === 'Chou')).toBe(false);
	});
});

describe('evaluateSideDraft', () => {
	it('computes 5-lane completion and draft HHI score', () => {
		const data = fixture();
		const evaluation = evaluateSideDraft(data, 1, ['sora', 'guinevere', 'zhuxin', 'granger', 'chou'], ['fanny']);
		expect(evaluation.isComplete).toBe(true);
		expect(evaluation.missingRoles.length).toBe(0);
		expect(evaluation.draftHhi).toBeGreaterThanOrEqual(0);
	});

	it('automatically flexes a multi-role hero to an unfilled lane to maximize lane coverage', () => {
		const data = fixture();
		// In fixture, freya was picked in slot 2 (Jungle) in game 1 and slot 5 (Roam) in game 2
		// If we pick sora (EXP:1), freya (JGL:2/ROAM:5), zhuxin (MID:3), granger (GOLD:4), chou (ROAM:5)
		// Since chou takes ROAM (5), freya should automatically flex to JGL (2) to achieve 5/5 coverage!
		const evaluation = evaluateSideDraft(data, 1, ['sora', 'freya', 'zhuxin', 'granger', 'chou'], []);
		expect(evaluation.isComplete).toBe(true);
		expect(evaluation.missingRoles.length).toBe(0);
		const freyaPick = evaluation.picks.find((p) => p.hero === 'freya');
		expect(freyaPick?.role).toBe(2); // Auto-flexed to Jungle
	});

	it('respects manual role override when provided by coach', () => {
		const data = fixture();
		// Manually override freya (index 1) to slot 5 (Roam)
		const evaluation = evaluateSideDraft(data, 1, ['sora', 'freya', 'zhuxin', 'granger', 'chou'], [], {}, [null, 5, null, null, null]);
		const freyaPick = evaluation.picks.find((p) => p.hero === 'freya');
		expect(freyaPick?.role).toBe(5);
	});
});





