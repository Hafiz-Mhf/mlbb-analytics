import { TEAM_COLORS, TEAM_SHORT_CODES } from '../teams';
import type { DraftRow, Hero, MatchRow, MockDataset, Stage, Team } from '../types';
import { mulberry32 } from './rng';

const HERO_POOL = [
	'guinevere', 'freya', 'phoveus', 'harith', 'khaleed', 'leomord', 'yve', 'zhuxin',
	'granger', 'chou', 'sora', 'baxia', 'valentina', 'kalea', 'suyou', 'harley',
	'marcel', 'fanny', 'gloo', 'claude', 'lylia', 'selena', 'karrie', 'atlas',
	'esmeralda', 'fredrinn'
];

// Team 0's signature pool — deliberately small, so its HHI reads high
// and "predictable" (frontend.md's shaping requirement).
const PREDICTABLE_TEAM_POOL = HERO_POOL.slice(0, 6);

// The hero every team leans on banning regardless of who they're
// playing — demonstrates planning.md's core example directly: a raw
// per-team ban rate for this hero looks alarming until the league
// baseline shows everyone does it.
const UNIVERSALLY_BANNED_HERO = 'fanny';

function draw(rng: () => number, preferred: string[], used: Set<string>): string {
	const candidates = preferred.filter((h) => !used.has(h));
	const pool = candidates.length > 0 ? candidates : HERO_POOL.filter((h) => !used.has(h));
	const hero = pool[Math.floor(rng() * pool.length)];
	used.add(hero);
	return hero;
}

function teamPool(teamIndex: number): string[] {
	if (teamIndex === 0) return PREDICTABLE_TEAM_POOL; // predictable/high-HHI
	if (teamIndex === 1) return HERO_POOL; // flexible/low-HHI
	// every other team gets a fixed 10-hero slice of the pool, rotated
	// by team index, so each has its own moderate, distinct tendency
	const start = (teamIndex * 3) % HERO_POOL.length;
	return [...HERO_POOL.slice(start), ...HERO_POOL.slice(0, start)].slice(0, 10);
}

function generateGame(
	rng: () => number,
	heroIndex: Map<string, number>,
	team1Idx: number,
	team2Idx: number
): { picks: [number, number][]; bans: [number, number][] } {
	// [teamSlot, heroId][] — teamSlot 1 or 2, matching database.md
	const used = new Set<string>();
	const picks: [number, number][] = [];
	const bans: [number, number][] = [];

	// Picks are drawn before bans, deliberately not mirroring real draft
	// phase order (bans-then-picks), so a team's small signature pool
	// (the "predictable" shaping) is never crowded out by an unrelated
	// ban drawn from the full pool first. This is a mock-generation
	// detail, not a claim about real draft order (data-source.md: order
	// isn't even recorded).
	for (const [slot, teamIdx] of [
		[1, team1Idx],
		[2, team2Idx]
	] as const) {
		const pool = teamPool(teamIdx);
		for (let i = 0; i < 5; i++) {
			picks.push([slot, heroIndex.get(draw(rng, pool, used))!]);
		}
	}

	// Universal fanny-ban tendency: one side or the other bans her
	// first, 85% of the time (if she wasn't already picked this game).
	if (!used.has(UNIVERSALLY_BANNED_HERO) && rng() < 0.85) {
		const banningSlot = rng() < 0.5 ? 1 : 2;
		used.add(UNIVERSALLY_BANNED_HERO);
		bans.push([banningSlot, heroIndex.get(UNIVERSALLY_BANNED_HERO)!]);
	}

	// Remaining bans draw from the full pool, never a team's signature
	// pick pool — a "predictable" team's bans aren't what make it
	// predictable, its picks are.
	for (const [slot] of [[1], [2]] as const) {
		while (bans.filter(([s]) => s === slot).length < 5) {
			bans.push([slot, heroIndex.get(draw(rng, HERO_POOL, used))!]);
		}
	}

	return { picks, bans };
}

export function generateMockDataset(seed = 1): MockDataset {
	const rng = mulberry32(seed);

	const teams: Team[] = Object.keys(TEAM_COLORS).map((name, i) => ({
		id: i + 1,
		canonicalName: name,
		shortCode: TEAM_SHORT_CODES[name]
	}));
	const heroes: Hero[] = HERO_POOL.map((name, i) => ({ id: i + 1, canonicalName: name }));
	const heroIndex = new Map(heroes.map((h) => [h.canonicalName, h.id]));

	const matches: MatchRow[] = [];
	const drafts: DraftRow[] = [];
	let matchId = 1;
	let draftId = 1;

	const seasons: { season: string; stage: Stage; gamesPerPair: number }[] = [
		{ season: '17', stage: 'regular_season', gamesPerPair: 1 },
		{ season: '18', stage: 'regular_season', gamesPerPair: 1 }
	];

	for (const { season, stage, gamesPerPair } of seasons) {
		for (let i = 0; i < teams.length; i++) {
			for (let j = i + 1; j < teams.length; j++) {
				for (let g = 0; g < gamesPerPair; g++) {
					const { picks, bans } = generateGame(rng, heroIndex, i, j);
					const winnerSlot = rng() < 0.5 ? 1 : 2;
					const match: MatchRow = {
						id: matchId++,
						seriesId: `MOCK${season}_${teams[i].shortCode ?? i}${teams[j].shortCode ?? j}_${g}`,
						season,
						stage,
						team1Id: teams[i].id,
						team2Id: teams[j].id,
						team1Side: rng() < 0.5 ? 'blue' : 'red',
						winnerId: winnerSlot === 1 ? teams[i].id : teams[j].id,
						gameLength: `${10 + Math.floor(rng() * 10)}:${String(Math.floor(rng() * 60)).padStart(2, '0')}`,
						gameNumberInSeries: 1,
						playedAt: null
					};
					matches.push(match);

					const slotToTeamId = (slot: number) => (slot === 1 ? teams[i].id : teams[j].id);
					const roleCounters = new Map<number, number>();
					const banCounters = new Map<number, number>();
					for (const [slot, heroId] of picks) {
						const role = (roleCounters.get(slot) ?? 0) + 1;
						roleCounters.set(slot, role);
						drafts.push({
							id: draftId++,
							matchId: match.id,
							teamId: slotToTeamId(slot),
							slot: role,
							heroId,
							isBan: false
						});
					}
					for (const [slot, heroId] of bans) {
						const order = (banCounters.get(slot) ?? 0) + 1;
						banCounters.set(slot, order);
						drafts.push({
							id: draftId++,
							matchId: match.id,
							teamId: slotToTeamId(slot),
							slot: order,
							heroId,
							isBan: true
						});
					}
				}
			}
		}
	}

	return { teams, heroes, matches, drafts };
}
