// Mirrors pipeline/src/mlbb_pipeline/metrics.py exactly. Same formulas,
// same league-scope doubling — see that file's docstrings for why.
import type { DraftRow, MatchRow, Dataset } from './types';

export interface ScopeOptions {
	teamId?: number;
	season?: string;
}

function scopedMatches(data: Dataset, opts: ScopeOptions): MatchRow[] {
	return data.matches.filter((m) => {
		if (opts.season !== undefined && m.season !== opts.season) return false;
		if (opts.teamId !== undefined && m.team1Id !== opts.teamId && m.team2Id !== opts.teamId)
			return false;
		return true;
	});
}

function instanceCount(data: Dataset, opts: ScopeOptions): number {
	const matches = scopedMatches(data, opts);
	return opts.teamId !== undefined ? matches.length : matches.length * 2;
}

function scopedDrafts(
	data: Dataset,
	opts: ScopeOptions & { picksOnly?: boolean; bansOnly?: boolean; role?: number }
): DraftRow[] {
	const matchIds = new Set(scopedMatches(data, opts).map((m) => m.id));
	return data.drafts.filter((d) => {
		if (!matchIds.has(d.matchId)) return false;
		if (opts.teamId !== undefined && d.teamId !== opts.teamId) return false;
		if (opts.picksOnly && d.isBan) return false;
		if (opts.bansOnly && !d.isBan) return false;
		if (opts.role !== undefined && d.slot !== opts.role) return false;
		return true;
	});
}

function countByHero(data: Dataset, drafts: DraftRow[]): Record<string, number> {
	const heroName = new Map(data.heroes.map((h) => [h.id, h.canonicalName]));
	const counts: Record<string, number> = {};
	for (const d of drafts) {
		const name = heroName.get(d.heroId)!;
		counts[name] = (counts[name] ?? 0) + 1;
	}
	return counts;
}

export function presence(data: Dataset, opts: ScopeOptions = {}): Record<string, number> {
	const denominator = instanceCount(data, opts);
	if (denominator === 0) return {};
	const counts = countByHero(data, scopedDrafts(data, opts));
	return Object.fromEntries(Object.entries(counts).map(([h, c]) => [h, c / denominator]));
}

export function pickRate(data: Dataset, opts: ScopeOptions = {}): Record<string, number> {
	const denominator = instanceCount(data, opts);
	if (denominator === 0) return {};
	const counts = countByHero(data, scopedDrafts(data, { ...opts, picksOnly: true }));
	return Object.fromEntries(Object.entries(counts).map(([h, c]) => [h, c / denominator]));
}

export function banRate(data: Dataset, opts: ScopeOptions = {}): Record<string, number> {
	const denominator = instanceCount(data, opts);
	if (denominator === 0) return {};
	const counts = countByHero(data, scopedDrafts(data, { ...opts, bansOnly: true }));
	return Object.fromEntries(Object.entries(counts).map(([h, c]) => [h, c / denominator]));
}

export function pickRateByRole(
	data: Dataset,
	role: number,
	opts: ScopeOptions = {}
): Record<string, number> {
	const denominator = instanceCount(data, opts);
	if (denominator === 0) return {};
	const counts = countByHero(data, scopedDrafts(data, { ...opts, picksOnly: true, role }));
	return Object.fromEntries(Object.entries(counts).map(([h, c]) => [h, c / denominator]));
}

function hhiFromCounts(counts: Record<string, number>): number {
	const total = Object.values(counts).reduce((a, b) => a + b, 0);
	if (total === 0) return 0;
	return Object.values(counts).reduce((sum, c) => sum + (c / total) ** 2, 0);
}

export function hhi(data: Dataset, opts: ScopeOptions = {}): number {
	return hhiFromCounts(countByHero(data, scopedDrafts(data, { ...opts, picksOnly: true })));
}

export function hhiByRole(data: Dataset, role: number, opts: ScopeOptions = {}): number {
	return hhiFromCounts(
		countByHero(data, scopedDrafts(data, { ...opts, picksOnly: true, role }))
	);
}

export interface RollingHhiPoint {
	matchId: number;
	playedAt: string | null;
	hhi: number;
}

const DEFAULT_ROLLING_WINDOW = 10;

function parsePlayedAt(playedAt: string | null): number | null {
	if (!playedAt) return null;
	const t = new Date(playedAt.replace(' - ', ' ')).getTime();
	return Number.isNaN(t) ? null : t;
}

function teamGamesSorted(data: Dataset, teamId: number): MatchRow[] {
	const games = data.matches.filter((m) => m.team1Id === teamId || m.team2Id === teamId);
	return games.slice().sort((a, b) => {
		const ta = parsePlayedAt(a.playedAt);
		const tb = parsePlayedAt(b.playedAt);
		if (ta !== null && tb !== null) return ta - tb;
		return a.id - b.id;
	});
}

function draftsInMatches(
	data: Dataset,
	teamId: number,
	matchIds: Set<number>,
	picksOnly: boolean
): DraftRow[] {
	return data.drafts.filter(
		(d) => d.teamId === teamId && matchIds.has(d.matchId) && (!picksOnly || !d.isBan)
	);
}

export function rollingHhi(
	data: Dataset,
	teamId: number,
	windowSize: number = DEFAULT_ROLLING_WINDOW
): RollingHhiPoint[] {
	const games = teamGamesSorted(data, teamId);
	return games.map((game, i) => {
		const window = games.slice(Math.max(0, i - windowSize + 1), i + 1);
		const matchIds = new Set(window.map((m) => m.id));
		const counts = countByHero(data, draftsInMatches(data, teamId, matchIds, true));
		return { matchId: game.id, playedAt: game.playedAt, hhi: hhiFromCounts(counts) };
	});
}

export interface WinRateDelta {
	hero: string;
	delta: number;
	games: number;
}

const MIN_SAMPLE = 5;

function teamWinRate(
	data: Dataset,
	teamId: number,
	matchIds?: Set<number>
): { wins: number; games: number; rate: number } {
	const games = data.matches.filter(
		(m) => (m.team1Id === teamId || m.team2Id === teamId) && (!matchIds || matchIds.has(m.id))
	);
	const wins = games.filter((m) => m.winnerId === teamId).length;
	return { wins, games: games.length, rate: games.length === 0 ? 0 : wins / games.length };
}

export function pickWinRateDelta(
	data: Dataset,
	teamId: number,
	opts: { isBan?: boolean } = {}
): WinRateDelta[] {
	const isBan = opts.isBan ?? false;
	const overall = teamWinRate(data, teamId);
	const heroName = new Map(data.heroes.map((h) => [h.id, h.canonicalName]));
	const matchIdsByHero = new Map<number, Set<number>>();
	for (const d of data.drafts) {
		if (d.teamId !== teamId || d.isBan !== isBan) continue;
		if (!matchIdsByHero.has(d.heroId)) matchIdsByHero.set(d.heroId, new Set());
		matchIdsByHero.get(d.heroId)!.add(d.matchId);
	}
	const results: WinRateDelta[] = [];
	for (const [heroId, matchIds] of matchIdsByHero) {
		if (matchIds.size < MIN_SAMPLE) continue;
		const withHero = teamWinRate(data, teamId, matchIds);
		results.push({
			hero: heroName.get(heroId)!,
			delta: withHero.rate - overall.rate,
			games: withHero.games
		});
	}
	return results.sort((a, b) => b.delta - a.delta);
}

export interface PresenceDelta {
	hero: string;
	before: number;
	after: number;
	delta: number;
}

export function presenceDelta(
	data: Dataset,
	beforeSeason: string,
	afterSeason: string,
	opts: { teamId?: number } = {}
): PresenceDelta[] {
	const before = presence(data, { ...opts, season: beforeSeason });
	const after = presence(data, { ...opts, season: afterSeason });
	const heroes = new Set([...Object.keys(before), ...Object.keys(after)]);
	return [...heroes]
		.map((hero) => {
			const b = before[hero] ?? 0;
			const a = after[hero] ?? 0;
			return { hero, before: b, after: a, delta: a - b };
		})
		.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}

export const ROLE_NAMES: Record<number, string> = {
	1: 'EXP',
	2: 'JGL',
	3: 'MID',
	4: 'GOLD',
	5: 'ROAM'
};

export interface RoleDistribution {
	role: number;
	roleName: string;
	picks: number;
	share: number;
}

export interface FlexHero {
	hero: string;
	totalPicks: number;
	primaryRole: RoleDistribution;
	secondaryRoles: RoleDistribution[];
	roles: RoleDistribution[];
	flexRate: number;
}

export interface TeamRoleMatrixRow {
	teamId: number;
	teamName: string;
	overallHhi: number;
	roleHhi: Record<number, number>;
}

export function flexHeroes(data: Dataset, opts: ScopeOptions = {}): FlexHero[] {
	const drafts = scopedDrafts(data, { ...opts, picksOnly: true });
	const heroName = new Map(data.heroes.map((h) => [h.id, h.canonicalName]));
	const roleCountsByHero = new Map<string, Map<number, number>>();

	for (const d of drafts) {
		const name = heroName.get(d.heroId)!;
		if (!roleCountsByHero.has(name)) {
			roleCountsByHero.set(name, new Map());
		}
		const roleMap = roleCountsByHero.get(name)!;
		roleMap.set(d.slot, (roleMap.get(d.slot) ?? 0) + 1);
	}

	const result: FlexHero[] = [];
	for (const [hero, roleMap] of roleCountsByHero.entries()) {
		if (roleMap.size < 2) continue; // Not flexed
		const totalPicks = Array.from(roleMap.values()).reduce((a, b) => a + b, 0);
		const roles: RoleDistribution[] = Array.from(roleMap.entries())
			.map(([role, picks]) => ({
				role,
				roleName: ROLE_NAMES[role] ?? `Role ${role}`,
				picks,
				share: picks / totalPicks
			}))
			.sort((a, b) => b.picks - a.picks);

		const primaryRole = roles[0];
		const secondaryRoles = roles.slice(1);
		const flexRate = (totalPicks - primaryRole.picks) / totalPicks;

		result.push({
			hero,
			totalPicks,
			primaryRole,
			secondaryRoles,
			roles,
			flexRate
		});
	}

	return result.sort((a, b) => b.totalPicks - a.totalPicks || b.flexRate - a.flexRate);
}

export function rolePredictabilityMatrix(
	data: Dataset,
	opts: ScopeOptions = {}
): { teams: TeamRoleMatrixRow[]; league: Record<number, number> } {
	const teams = data.teams.map((team) => {
		const teamOpts = { ...opts, teamId: team.id };
		const roleHhi: Record<number, number> = {};
		for (let role = 1; role <= 5; role++) {
			roleHhi[role] = hhiByRole(data, role, teamOpts);
		}
		return {
			teamId: team.id,
			teamName: team.canonicalName,
			overallHhi: hhi(data, teamOpts),
			roleHhi
		};
	});

	const league: Record<number, number> = {};
	for (let role = 1; role <= 5; role++) {
		league[role] = hhiByRole(data, role, opts);
	}

	return { teams, league };
}

export interface HeadToHeadSummary {
	team1Wins: number;
	team2Wins: number;
	totalGames: number;
	team1SeriesWins: number;
	team2SeriesWins: number;
	totalSeries: number;
	directMatchIds: number[];
	avgGameLengthSeconds: number;
}

export function headToHeadSummary(
	data: Dataset,
	team1Id: number,
	team2Id: number,
	opts: ScopeOptions = {}
): HeadToHeadSummary {
	const directMatches = data.matches.filter((m) => {
		if (opts.season !== undefined && m.season !== opts.season) return false;
		return (
			(m.team1Id === team1Id && m.team2Id === team2Id) ||
			(m.team1Id === team2Id && m.team2Id === team1Id)
		);
	});

	if (directMatches.length === 0) {
		return {
			team1Wins: 0,
			team2Wins: 0,
			totalGames: 0,
			team1SeriesWins: 0,
			team2SeriesWins: 0,
			totalSeries: 0,
			directMatchIds: [],
			avgGameLengthSeconds: 0
		};
	}

	let team1Wins = 0;
	let team2Wins = 0;
	let totalSeconds = 0;
	let durationCount = 0;

	for (const m of directMatches) {
		if (m.winnerId === team1Id) team1Wins++;
		else if (m.winnerId === team2Id) team2Wins++;

		if (m.gameLength) {
			const parts = m.gameLength.split(':').map((p) => parseInt(p, 10));
			if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
				totalSeconds += parts[0] * 60 + parts[1];
				durationCount++;
			}
		}
	}

	// Series score
	const seriesMap = new Map<string, { t1Wins: number; t2Wins: number }>();
	for (const m of directMatches) {
		if (!seriesMap.has(m.seriesId)) {
			seriesMap.set(m.seriesId, { t1Wins: 0, t2Wins: 0 });
		}
		const s = seriesMap.get(m.seriesId)!;
		if (m.winnerId === team1Id) s.t1Wins++;
		else if (m.winnerId === team2Id) s.t2Wins++;
	}

	let team1SeriesWins = 0;
	let team2SeriesWins = 0;
	for (const s of seriesMap.values()) {
		if (s.t1Wins > s.t2Wins) team1SeriesWins++;
		else if (s.t2Wins > s.t1Wins) team2SeriesWins++;
	}

	return {
		team1Wins,
		team2Wins,
		totalGames: directMatches.length,
		team1SeriesWins,
		team2SeriesWins,
		totalSeries: seriesMap.size,
		directMatchIds: directMatches.map((m) => m.id),
		avgGameLengthSeconds: durationCount > 0 ? Math.round(totalSeconds / durationCount) : 0
	};
}

export interface SideStats {
	blueGames: number;
	blueWins: number;
	blueWinRate: number;
	redGames: number;
	redWins: number;
	redWinRate: number;
}

export function sidePerformance(
	data: Dataset,
	teamId: number,
	opts: ScopeOptions = {}
): SideStats {
	const teamMatches = data.matches.filter((m) => {
		if (opts.season !== undefined && m.season !== opts.season) return false;
		return m.team1Id === teamId || m.team2Id === teamId;
	});

	let blueGames = 0;
	let blueWins = 0;
	let redGames = 0;
	let redWins = 0;

	for (const m of teamMatches) {
		const isTeam1 = m.team1Id === teamId;
		const teamSide = isTeam1 ? m.team1Side : m.team1Side === 'blue' ? 'red' : 'blue';
		const won = m.winnerId === teamId;

		if (teamSide === 'blue') {
			blueGames++;
			if (won) blueWins++;
		} else {
			redGames++;
			if (won) redWins++;
		}
	}

	return {
		blueGames,
		blueWins,
		blueWinRate: blueGames > 0 ? blueWins / blueGames : 0,
		redGames,
		redWins,
		redWinRate: redGames > 0 ? redWins / redGames : 0
	};
}

export type ClashCategory = 'contested' | 'team1_priority' | 'team2_priority';

export interface HeroClashItem {
	hero: string;
	team1Rate: number;
	team2Rate: number;
	leagueRate: number;
	team1PickRate: number;
	team1BanRate: number;
	team2PickRate: number;
	team2BanRate: number;
	category: ClashCategory;
	primaryRole?: number;
}

export interface HeroClashResult {
	contested: HeroClashItem[];
	team1Priority: HeroClashItem[];
	team2Priority: HeroClashItem[];
}

export function heroClash(
	data: Dataset,
	team1Id: number,
	team2Id: number,
	opts: ScopeOptions = {}
): HeroClashResult {
	const t1Pres = presence(data, { ...opts, teamId: team1Id });
	const t1Picks = pickRate(data, { ...opts, teamId: team1Id });
	const t1Bans = banRate(data, { ...opts, teamId: team1Id });

	const t2Pres = presence(data, { ...opts, teamId: team2Id });
	const t2Picks = pickRate(data, { ...opts, teamId: team2Id });
	const t2Bans = banRate(data, { ...opts, teamId: team2Id });

	const leaguePres = presence(data, opts);

	// Find primary role for each hero
	const heroPrimaryRole = new Map<string, number>();
	const heroNameMap = new Map(data.heroes.map((h) => [h.id, h.canonicalName]));
	const heroRolePicks = new Map<string, Map<number, number>>();

	for (const d of data.drafts) {
		if (d.isBan) continue;
		const name = heroNameMap.get(d.heroId)!;
		if (!heroRolePicks.has(name)) heroRolePicks.set(name, new Map());
		const rMap = heroRolePicks.get(name)!;
		rMap.set(d.slot, (rMap.get(d.slot) ?? 0) + 1);
	}

	for (const [name, rMap] of heroRolePicks.entries()) {
		let bestRole = 1;
		let maxPicks = -1;
		for (const [r, cnt] of rMap.entries()) {
			if (cnt > maxPicks) {
				maxPicks = cnt;
				bestRole = r;
			}
		}
		heroPrimaryRole.set(name, bestRole);
	}

	const allHeroes = new Set([...Object.keys(t1Pres), ...Object.keys(t2Pres)]);
	const items: HeroClashItem[] = [];

	for (const hero of allHeroes) {
		const t1 = t1Pres[hero] ?? 0;
		const t2 = t2Pres[hero] ?? 0;
		const lg = leaguePres[hero] ?? 0;

		let category: ClashCategory | null = null;
		if (t1 >= 0.25 && t2 >= 0.25) {
			category = 'contested';
		} else if (t1 >= 0.25 && t2 < 0.2) {
			category = 'team1_priority';
		} else if (t2 >= 0.25 && t1 < 0.2) {
			category = 'team2_priority';
		} else if (t1 + t2 >= 0.4) {
			category = 'contested';
		}

		if (category) {
			items.push({
				hero,
				team1Rate: t1,
				team2Rate: t2,
				leagueRate: lg,
				team1PickRate: t1Picks[hero] ?? 0,
				team1BanRate: t1Bans[hero] ?? 0,
				team2PickRate: t2Picks[hero] ?? 0,
				team2BanRate: t2Bans[hero] ?? 0,
				category,
				primaryRole: heroPrimaryRole.get(hero)
			});
		}
	}

	return {
		contested: items
			.filter((i) => i.category === 'contested')
			.sort((a, b) => b.team1Rate + b.team2Rate - (a.team1Rate + a.team2Rate)),
		team1Priority: items
			.filter((i) => i.category === 'team1_priority')
			.sort((a, b) => b.team1Rate - a.team1Rate),
		team2Priority: items
			.filter((i) => i.category === 'team2_priority')
			.sort((a, b) => b.team2Rate - a.team2Rate)
	};
}

export interface RoleMatchupItem {
	role: number;
	roleName: string;
	team1Hhi: number;
	team2Hhi: number;
	leagueHhi: number;
	team1TopPicks: Array<{ hero: string; rate: number; picks: number }>;
	team2TopPicks: Array<{ hero: string; rate: number; picks: number }>;
}

export function matchupRoleComparison(
	data: Dataset,
	team1Id: number,
	team2Id: number,
	opts: ScopeOptions = {}
): RoleMatchupItem[] {
	const result: RoleMatchupItem[] = [];

	for (let role = 1; role <= 5; role++) {
		const t1Hhi = hhiByRole(data, role, { ...opts, teamId: team1Id });
		const t2Hhi = hhiByRole(data, role, { ...opts, teamId: team2Id });
		const lgHhi = hhiByRole(data, role, opts);

		const t1PicksMap = pickRateByRole(data, role, { ...opts, teamId: team1Id });
		const t2PicksMap = pickRateByRole(data, role, { ...opts, teamId: team2Id });

		const t1TopPicks = Object.entries(t1PicksMap)
			.map(([hero, rate]) => ({
				hero,
				rate,
				picks: Math.round(rate * instanceCount(data, { ...opts, teamId: team1Id }))
			}))
			.sort((a, b) => b.rate - a.rate)
			.slice(0, 3);

		const t2TopPicks = Object.entries(t2PicksMap)
			.map(([hero, rate]) => ({
				hero,
				rate,
				picks: Math.round(rate * instanceCount(data, { ...opts, teamId: team2Id }))
			}))
			.sort((a, b) => b.rate - a.rate)
			.slice(0, 3);

		result.push({
			role,
			roleName: ROLE_NAMES[role],
			team1Hhi: t1Hhi,
			team2Hhi: t2Hhi,
			leagueHhi: lgHhi,
			team1TopPicks: t1TopPicks,
			team2TopPicks: t2TopPicks
		});
	}

	return result;
}

export interface LeagueSideStats {
	totalMatches: number;
	blueWins: number;
	blueWinRate: number;
	redWins: number;
	redWinRate: number;
	avgBlueGameDurationSeconds: number;
	avgRedGameDurationSeconds: number;
}

export function leagueSidePerformance(
	data: Dataset,
	opts: ScopeOptions = {}
): LeagueSideStats {
	const matches = scopedMatches(data, opts);
	if (matches.length === 0) {
		return {
			totalMatches: 0,
			blueWins: 0,
			blueWinRate: 0,
			redWins: 0,
			redWinRate: 0,
			avgBlueGameDurationSeconds: 0,
			avgRedGameDurationSeconds: 0
		};
	}

	let blueWins = 0;
	let redWins = 0;
	let blueSecs = 0;
	let blueSecsCount = 0;
	let redSecs = 0;
	let redSecsCount = 0;

	for (const m of matches) {
		const winningSide = m.winnerId === m.team1Id ? m.team1Side : m.team1Side === 'blue' ? 'red' : 'blue';
		let dur = 0;
		if (m.gameLength) {
			const parts = m.gameLength.split(':').map((p) => parseInt(p, 10));
			if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
				dur = parts[0] * 60 + parts[1];
			}
		}

		if (winningSide === 'blue') {
			blueWins++;
			if (dur > 0) {
				blueSecs += dur;
				blueSecsCount++;
			}
		} else {
			redWins++;
			if (dur > 0) {
				redSecs += dur;
				redSecsCount++;
			}
		}
	}

	return {
		totalMatches: matches.length,
		blueWins,
		blueWinRate: matches.length > 0 ? blueWins / matches.length : 0,
		redWins,
		redWinRate: matches.length > 0 ? redWins / matches.length : 0,
		avgBlueGameDurationSeconds: blueSecsCount > 0 ? Math.round(blueSecs / blueSecsCount) : 0,
		avgRedGameDurationSeconds: redSecsCount > 0 ? Math.round(redSecs / redSecsCount) : 0
	};
}

export type SideReliance = 'blue_reliant' | 'balanced' | 'red_reliant';

export interface TeamSideRow {
	teamId: number;
	teamName: string;
	shortCode: string | null;
	blueGames: number;
	blueWins: number;
	blueWinRate: number;
	redGames: number;
	redWins: number;
	redWinRate: number;
	sideDelta: number;
	reliance: SideReliance;
}

export function teamSideMatrix(
	data: Dataset,
	opts: ScopeOptions = {}
): TeamSideRow[] {
	return data.teams.map((t) => {
		const side = sidePerformance(data, t.id, opts);
		const sideDelta = side.blueWinRate - side.redWinRate;
		let reliance: SideReliance = 'balanced';
		if (side.blueGames >= 2 && side.redGames >= 2) {
			if (sideDelta >= 0.15) reliance = 'blue_reliant';
			else if (sideDelta <= -0.15) reliance = 'red_reliant';
		}
		return {
			teamId: t.id,
			teamName: t.canonicalName,
			shortCode: t.shortCode,
			blueGames: side.blueGames,
			blueWins: side.blueWins,
			blueWinRate: side.blueWinRate,
			redGames: side.redGames,
			redWins: side.redWins,
			redWinRate: side.redWinRate,
			sideDelta,
			reliance
		};
	});
}

export interface HeroSideStat {
	hero: string;
	bluePresence: number;
	bluePickRate: number;
	blueBanRate: number;
	blueWins: number;
	blueGames: number;
	blueWinRate: number;
	redPresence: number;
	redPickRate: number;
	redBanRate: number;
	redWins: number;
	redGames: number;
	redWinRate: number;
	presenceDelta: number;
	winRateDelta: number;
}

export interface HeroSidePrioritiesResult {
	bluePriority: HeroSideStat[];
	redPriority: HeroSideStat[];
	winRateSwings: HeroSideStat[];
}

export function heroSidePriorities(
	data: Dataset,
	opts: ScopeOptions = {}
): HeroSidePrioritiesResult {
	const matches = scopedMatches(data, opts);
	const matchIds = new Set(matches.map((m) => m.id));
	const matchSideMap = new Map<number, { blueTeamId: number; redTeamId: number; winnerId: number }>();

	for (const m of matches) {
		const blueTeamId = m.team1Side === 'blue' ? m.team1Id : m.team2Id;
		const redTeamId = m.team1Side === 'blue' ? m.team2Id : m.team1Id;
		matchSideMap.set(m.id, { blueTeamId, redTeamId, winnerId: m.winnerId });
	}

	const heroName = new Map(data.heroes.map((h) => [h.id, h.canonicalName]));
	const totalGames = matches.length;

	interface SideAccumulator {
		bluePicks: number;
		blueBans: number;
		blueWins: number;
		redPicks: number;
		redBans: number;
		redWins: number;
	}

	const statsMap = new Map<string, SideAccumulator>();

	for (const h of data.heroes) {
		statsMap.set(h.canonicalName, {
			bluePicks: 0,
			blueBans: 0,
			blueWins: 0,
			redPicks: 0,
			redBans: 0,
			redWins: 0
		});
	}

	for (const d of data.drafts) {
		if (!matchIds.has(d.matchId)) continue;
		const mInfo = matchSideMap.get(d.matchId);
		if (!mInfo) continue;

		const name = heroName.get(d.heroId)!;
		const acc = statsMap.get(name)!;
		const isBlue = d.teamId === mInfo.blueTeamId;
		const won = d.teamId === mInfo.winnerId;

		if (isBlue) {
			if (d.isBan) acc.blueBans++;
			else {
				acc.bluePicks++;
				if (won) acc.blueWins++;
			}
		} else {
			if (d.isBan) acc.redBans++;
			else {
				acc.redPicks++;
				if (won) acc.redWins++;
			}
		}
	}

	const allStats: HeroSideStat[] = [];

	for (const [hero, acc] of statsMap.entries()) {
		const bluePres = totalGames > 0 ? (acc.bluePicks + acc.blueBans) / totalGames : 0;
		const redPres = totalGames > 0 ? (acc.redPicks + acc.redBans) / totalGames : 0;
		const bluePick = totalGames > 0 ? acc.bluePicks / totalGames : 0;
		const blueBan = totalGames > 0 ? acc.blueBans / totalGames : 0;
		const redPick = totalGames > 0 ? acc.redPicks / totalGames : 0;
		const redBan = totalGames > 0 ? acc.redBans / totalGames : 0;

		const blueWR = acc.bluePicks > 0 ? acc.blueWins / acc.bluePicks : 0;
		const redWR = acc.redPicks > 0 ? acc.redWins / acc.redPicks : 0;

		if (bluePres > 0 || redPres > 0) {
			allStats.push({
				hero,
				bluePresence: bluePres,
				bluePickRate: bluePick,
				blueBanRate: blueBan,
				blueWins: acc.blueWins,
				blueGames: acc.bluePicks,
				blueWinRate: blueWR,
				redPresence: redPres,
				redPickRate: redPick,
				redBanRate: redBan,
				redWins: acc.redWins,
				redGames: acc.redPicks,
				redWinRate: redWR,
				presenceDelta: bluePres - redPres,
				winRateDelta: blueWR - redWR
			});
		}
	}

	return {
		bluePriority: allStats
			.slice()
			.sort((a, b) => b.bluePresence - a.bluePresence || b.presenceDelta - a.presenceDelta),
		redPriority: allStats
			.slice()
			.sort((a, b) => b.redPresence - a.redPresence || a.presenceDelta - b.presenceDelta),
		winRateSwings: allStats
			.filter((s) => s.blueGames + s.redGames >= 5 && s.blueGames >= 1 && s.redGames >= 1)
			.sort((a, b) => Math.abs(b.winRateDelta) - Math.abs(a.winRateDelta))
	};
}

export interface DraftStep {
	stepIndex: number;
	phase: 1 | 2;
	action: 'ban' | 'pick';
	side: 'blue' | 'red';
	slotIndex: number;
	label: string;
}

export const OFFICIAL_DRAFT_SEQUENCE: DraftStep[] = [
	{ stepIndex: 0, phase: 1, action: 'ban', side: 'blue', slotIndex: 0, label: 'Blue Ban 1' },
	{ stepIndex: 1, phase: 1, action: 'ban', side: 'red',  slotIndex: 0, label: 'Red Ban 1' },
	{ stepIndex: 2, phase: 1, action: 'ban', side: 'blue', slotIndex: 1, label: 'Blue Ban 2' },
	{ stepIndex: 3, phase: 1, action: 'ban', side: 'red',  slotIndex: 1, label: 'Red Ban 2' },
	{ stepIndex: 4, phase: 1, action: 'ban', side: 'blue', slotIndex: 2, label: 'Blue Ban 3' },
	{ stepIndex: 5, phase: 1, action: 'ban', side: 'red',  slotIndex: 2, label: 'Red Ban 3' },
	{ stepIndex: 6, phase: 1, action: 'pick', side: 'blue', slotIndex: 0, label: 'Blue Pick 1 (First Pick)' },
	{ stepIndex: 7, phase: 1, action: 'pick', side: 'red',  slotIndex: 0, label: 'Red Pick 1' },
	{ stepIndex: 8, phase: 1, action: 'pick', side: 'red',  slotIndex: 1, label: 'Red Pick 2' },
	{ stepIndex: 9, phase: 1, action: 'pick', side: 'blue', slotIndex: 1, label: 'Blue Pick 2' },
	{ stepIndex: 10, phase: 1, action: 'pick', side: 'blue', slotIndex: 2, label: 'Blue Pick 3' },
	{ stepIndex: 11, phase: 1, action: 'pick', side: 'red',  slotIndex: 2, label: 'Red Pick 3' },
	{ stepIndex: 12, phase: 2, action: 'ban', side: 'red',  slotIndex: 3, label: 'Red Ban 4' },
	{ stepIndex: 13, phase: 2, action: 'ban', side: 'blue', slotIndex: 3, label: 'Blue Ban 4' },
	{ stepIndex: 14, phase: 2, action: 'ban', side: 'red',  slotIndex: 4, label: 'Red Ban 5' },
	{ stepIndex: 15, phase: 2, action: 'ban', side: 'blue', slotIndex: 4, label: 'Blue Ban 5' },
	{ stepIndex: 16, phase: 2, action: 'pick', side: 'red',  slotIndex: 3, label: 'Red Pick 4' },
	{ stepIndex: 17, phase: 2, action: 'pick', side: 'blue', slotIndex: 3, label: 'Blue Pick 4' },
	{ stepIndex: 18, phase: 2, action: 'pick', side: 'blue', slotIndex: 4, label: 'Blue Pick 5' },
	{ stepIndex: 19, phase: 2, action: 'pick', side: 'red',  slotIndex: 4, label: 'Red Pick 5 (Counter-Pick)' }
];

export type Role = 1 | 2 | 3 | 4 | 5;

export interface DraftRecommendation {
	hero: string;
	role: Role;
	roleName: string;
	score: number;
	teamPickRate: number;
	teamBanRate: number;
	leaguePresence: number;
	tag: string;
}

export function draftRecommendations(
	data: Dataset,
	teamId: number,
	side: 'blue' | 'red',
	action: 'ban' | 'pick',
	unavailableHeroNames: Set<string>,
	teamFilledRoles: Set<Role>,
	opts: ScopeOptions = {}
): DraftRecommendation[] {
	const matchSeason = new Map(data.matches.map((m) => [m.id, m.season]));
	const heroSlotCounts = new Map<number, Map<number, number>>();

	for (const d of data.drafts) {
		if (d.isBan || d.slot === null) continue;
		const s = matchSeason.get(d.matchId);
		if (opts.season && s !== opts.season) continue;
		let m = heroSlotCounts.get(d.heroId);
		if (!m) {
			m = new Map();
			heroSlotCounts.set(d.heroId, m);
		}
		// Weight Season 18 3x higher when aggregating across all seasons
		const weight = !opts.season && s === '18' ? 3 : 1;
		m.set(d.slot, (m.get(d.slot) ?? 0) + weight);
	}

	const teamPicks = pickRate(data, { ...opts, teamId });
	const teamBans = banRate(data, { ...opts, teamId });
	const lgPres = presence(data, opts);

	// Check latest Season 18 presence for recency boost
	const lgPresS18 = presence(data, { ...opts, season: '18' });
	const teamPicksS18 = pickRate(data, { ...opts, teamId, season: '18' });
	const teamBansS18 = banRate(data, { ...opts, teamId, season: '18' });

	const recommendations: DraftRecommendation[] = [];

	for (const h of data.heroes) {
		if (unavailableHeroNames.has(h.canonicalName)) continue;

		// Modal role determination
		const m = heroSlotCounts.get(h.id);
		let primaryRole: Role = 1;
		if (m) {
			let bestCount = -1;
			for (const [slot, count] of m.entries()) {
				if (count > bestCount && slot >= 1 && slot <= 5) {
					bestCount = count;
					primaryRole = slot as Role;
				}
			}
		}

		const s18Pick = teamPicksS18[h.canonicalName] ?? 0;
		const s18Ban = teamBansS18[h.canonicalName] ?? 0;
		const s18Pres = lgPresS18[h.canonicalName] ?? 0;

		const tPick = teamPicks[h.canonicalName] ?? 0;
		const tBan = teamBans[h.canonicalName] ?? 0;
		const pres = lgPres[h.canonicalName] ?? 0;

		const effectivePick = opts.season === '18' ? tPick : s18Pick * 0.7 + tPick * 0.3;
		const effectiveBan = opts.season === '18' ? tBan : s18Ban * 0.7 + tBan * 0.3;
		const effectivePres = opts.season === '18' ? pres : s18Pres * 0.7 + pres * 0.3;

		if (action === 'ban') {
			let tag = 'Meta Ban';
			if (s18Pres > 0.4 || s18Ban > 0.3) tag = 'S18 Priority Ban';
			else if (effectiveBan > 0.25) tag = 'Frequent Team Ban';
			else if (effectivePres > 0.5) tag = 'Meta Must-Ban';
			else if (effectivePick > 0.2) tag = 'Opponent Signature';

			const score = effectiveBan * 2.8 + effectivePres * 1.8 + effectivePick * 1.2;
			recommendations.push({
				hero: h.canonicalName,
				role: primaryRole,
				roleName: ROLE_NAMES[primaryRole],
				score,
				teamPickRate: tPick,
				teamBanRate: tBan,
				leaguePresence: pres,
				tag
			});
		} else {
			const fillsOpen = !teamFilledRoles.has(primaryRole);
			let tag = 'Meta Pick';
			if (s18Pres > 0.35 && fillsOpen) tag = `S18 Priority ${ROLE_NAMES[primaryRole]}`;
			else if (s18Pres > 0.35) tag = 'S18 Meta Pick';
			else if (effectivePick > 0.2 && fillsOpen) tag = `Fills Open ${ROLE_NAMES[primaryRole]}`;
			else if (effectivePick > 0.2) tag = 'Team Comfort';
			else if (fillsOpen) tag = `Open ${ROLE_NAMES[primaryRole]} Pick`;
			else if (effectivePres > 0.4) tag = 'Meta Power Pick';

			const score = effectivePick * 3.2 + effectivePres * 1.5 + (fillsOpen ? 2.0 : 0);
			recommendations.push({
				hero: h.canonicalName,
				role: primaryRole,
				roleName: ROLE_NAMES[primaryRole],
				score,
				teamPickRate: tPick,
				teamBanRate: tBan,
				leaguePresence: pres,
				tag
			});
		}
	}

	return recommendations.sort((a, b) => b.score - a.score || b.leaguePresence - a.leaguePresence);
}

export interface PickDetail {
	hero: string;
	role: Role;
	roleName: string;
	isFlex: boolean;
	availableRoles: Role[];
}

export interface SideEvaluation {
	picks: PickDetail[];
	bans: string[];
	filledRoles: Set<Role>;
	missingRoles: Role[];
	isComplete: boolean;
	draftHhi: number;
	hhiClassification: string;
	signatureCount: number;
}

export function evaluateSideDraft(
	data: Dataset,
	teamId: number,
	picks: string[],
	bans: string[],
	opts: ScopeOptions = {},
	manualRoleOverrides?: (Role | null)[]
): SideEvaluation {
	const matchSeason = new Map(data.matches.map((m) => [m.id, m.season]));
	const heroSlotCounts = new Map<number, Map<number, number>>();
	const heroByName = new Map(data.heroes.map((h) => [h.canonicalName, h]));

	for (const d of data.drafts) {
		if (d.isBan || d.slot === null) continue;
		const s = matchSeason.get(d.matchId);
		if (opts.season && s !== opts.season) continue;
		let m = heroSlotCounts.get(d.heroId);
		if (!m) {
			m = new Map();
			heroSlotCounts.set(d.heroId, m);
		}
		const weight = !opts.season && s === '18' ? 3 : 1;
		m.set(d.slot, (m.get(d.slot) ?? 0) + weight);
	}

	const teamPicks = pickRate(data, { ...opts, teamId });
	const N = picks.length;

	interface HeroRoleProfile {
		heroName: string;
		heroId?: number;
		modalRole: Role;
		availableRoles: Role[];
		manualOverride?: Role | null;
	}

	const profiles: HeroRoleProfile[] = picks.map((name, i) => {
		const h = heroByName.get(name);
		let modal: Role = 1;
		const avail: Role[] = [];
		if (h) {
			const m = heroSlotCounts.get(h.id);
			if (m) {
				let bestCount = -1;
				for (const [slot, count] of m.entries()) {
					if (slot >= 1 && slot <= 5) {
						avail.push(slot as Role);
						if (count > bestCount) {
							bestCount = count;
							modal = slot as Role;
						}
					}
				}
			}
		}
		if (avail.length === 0) avail.push(1, 2, 3, 4, 5);
		return {
			heroName: name,
			heroId: h?.id,
			modalRole: modal,
			availableRoles: avail,
			manualOverride: manualRoleOverrides && manualRoleOverrides[i] ? manualRoleOverrides[i] : null
		};
	});

	// Generate all combinations of assigning roles [1..5] to N picks
	const allRoles: Role[] = [1, 2, 3, 4, 5];
	let bestAssignment: Role[] = profiles.map((p) => p.manualOverride ?? p.modalRole);
	let bestScore = -Infinity;

	function evaluateCandidate(assigned: Role[]) {
		const distinctCount = new Set(assigned).size;
		let score = distinctCount * 100000;

		for (let i = 0; i < N; i++) {
			const p = profiles[i];
			const r = assigned[i];
			const hId = p.heroId;
			const count = hId ? (heroSlotCounts.get(hId)?.get(r) ?? 0) : 0;
			const isModal = r === p.modalRole;

			if (count > 0) {
				score += 2000 + count * 10;
			}
			if (isModal) {
				score += 500;
			}
		}

		if (score > bestScore) {
			bestScore = score;
			bestAssignment = assigned.slice();
		}
	}

	function search(idx: number, current: Role[]) {
		if (idx === N) {
			evaluateCandidate(current);
			return;
		}

		const p = profiles[idx];
		if (p.manualOverride) {
			current.push(p.manualOverride);
			search(idx + 1, current);
			current.pop();
			return;
		}

		// Try all 5 roles for optimal flex matching
		for (const r of allRoles) {
			current.push(r);
			search(idx + 1, current);
			current.pop();
		}
	}

	if (N > 0) {
		search(0, []);
	}

	const pickDetails: PickDetail[] = [];
	const filledRoles = new Set<Role>();
	let sigCount = 0;
	const rawPickRates: number[] = [];

	for (let i = 0; i < N; i++) {
		const p = profiles[i];
		const assignedRole = bestAssignment[i] ?? p.modalRole;
		filledRoles.add(assignedRole);

		pickDetails.push({
			hero: p.heroName,
			role: assignedRole,
			roleName: ROLE_NAMES[assignedRole],
			isFlex: assignedRole !== p.modalRole,
			availableRoles: p.availableRoles
		});

		const pRate = teamPicks[p.heroName] ?? 0;
		rawPickRates.push(pRate);
		if (pRate >= 0.15) sigCount++;
	}

	const missingRoles = allRoles.filter((r) => !filledRoles.has(r));

	// Compute draft HHI
	let draftHhi = 0;
	const sumRates = rawPickRates.reduce((a, b) => a + b, 0);
	if (sumRates > 0) {
		const shares = rawPickRates.map((r) => r / sumRates);
		draftHhi = shares.reduce((acc, s) => acc + s * s, 0);
	}

	let hhiClassification = 'Balanced Draft';
	if (draftHhi < 0.22) hhiClassification = 'Versatile Draft';
	else if (draftHhi > 0.32) hhiClassification = 'High Predictability';

	return {
		picks: pickDetails,
		bans,
		filledRoles,
		missingRoles,
		isComplete: picks.length === 5 && missingRoles.length === 0,
		draftHhi,
		hhiClassification,
		signatureCount: sigCount
	};
}

export interface LaneMatchup {
	role: Role;
	roleName: string;
	blueHero: string;
	redHero: string;
	blueHeroWinRate: number;
	redHeroWinRate: number;
	edge: 'blue' | 'red' | 'even';
	edgeMargin: number;
	reason: string;
}

export interface DraftOutcomePrediction {
	blueWinProb: number;
	redWinProb: number;
	favoredSide: 'blue' | 'red' | 'even';
	edgeDescription: string;
	blueSideWinRate: number;
	redSideWinRate: number;
	blueComfortScore: number;
	redComfortScore: number;
	blueMetaStrength: number;
	redMetaStrength: number;
	laneMatchups: LaneMatchup[];
	blueKeyAdvantage: string;
	redKeyAdvantage: string;
}

export function predictDraftOutcome(
	data: Dataset,
	blueTeamId: number,
	redTeamId: number,
	bluePicks: string[],
	redPicks: string[],
	blueRoleOverrides: (Role | null)[] = [null, null, null, null, null],
	redRoleOverrides: (Role | null)[] = [null, null, null, null, null],
	opts: ScopeOptions = {}
): DraftOutcomePrediction {
	const blueEval = evaluateSideDraft(data, blueTeamId, bluePicks, [], opts, blueRoleOverrides);
	const redEval = evaluateSideDraft(data, redTeamId, redPicks, [], opts, redRoleOverrides);

	const matchMap = new Map(data.matches.map((m) => [m.id, m]));

	// Calculate hero league win rates & team comfort
	const heroWins = new Map<string, { wins: number; games: number }>();
	const teamHeroWins = new Map<string, { wins: number; games: number }>();

	for (const d of data.drafts) {
		if (d.isBan) continue;
		const m = matchMap.get(d.matchId);
		if (!m) continue;
		if (opts.season && m.season !== opts.season) continue;

		const h = data.heroes.find((x) => x.id === d.heroId);
		if (!h) continue;

		const name = h.canonicalName;
		const won = d.teamId === m.winnerId;

		const cur = heroWins.get(name) ?? { wins: 0, games: 0 };
		cur.games++;
		if (won) cur.wins++;
		heroWins.set(name, cur);

		const tKey = `${d.teamId}:${name}`;
		const tCur = teamHeroWins.get(tKey) ?? { wins: 0, games: 0 };
		tCur.games++;
		if (won) tCur.wins++;
		teamHeroWins.set(tKey, tCur);
	}

	function getHeroWR(heroName: string): number {
		const stat = heroWins.get(heroName);
		if (!stat || stat.games === 0) return 0.5;
		return stat.wins / stat.games;
	}

	function getTeamHeroComfort(teamId: number, heroName: string): number {
		const tStat = teamHeroWins.get(`${teamId}:${heroName}`);
		const hStat = heroWins.get(heroName);
		if (tStat && tStat.games >= 2) {
			return (tStat.wins / tStat.games) * 0.7 + (hStat ? hStat.wins / hStat.games : 0.5) * 0.3;
		}
		return hStat && hStat.games > 0 ? hStat.wins / hStat.games : 0.5;
	}

	// 1. Meta Strength
	const blueMetaWRs = bluePicks.map(getHeroWR);
	const redMetaWRs = redPicks.map(getHeroWR);
	const blueMetaStrength =
		blueMetaWRs.length > 0 ? blueMetaWRs.reduce((a, b) => a + b, 0) / blueMetaWRs.length : 0.5;
	const redMetaStrength =
		redMetaWRs.length > 0 ? redMetaWRs.reduce((a, b) => a + b, 0) / redMetaWRs.length : 0.5;

	// 2. Team Comfort Scores
	const blueComforts = bluePicks.map((h) => getTeamHeroComfort(blueTeamId, h));
	const redComforts = redPicks.map((h) => getTeamHeroComfort(redTeamId, h));
	const blueComfortScore =
		blueComforts.length > 0 ? blueComforts.reduce((a, b) => a + b, 0) / blueComforts.length : 0.5;
	const redComfortScore =
		redComforts.length > 0 ? redComforts.reduce((a, b) => a + b, 0) / redComforts.length : 0.5;

	// 3. Side Baseline Performance
	let blueSideGames = 0;
	let blueSideWins = 0;
	let redSideGames = 0;
	let redSideWins = 0;

	for (const m of data.matches) {
		if (opts.season && m.season !== opts.season) continue;
		const mBlueId = m.team1Side === 'blue' ? m.team1Id : m.team2Id;
		const mRedId = m.team1Side === 'red' ? m.team1Id : m.team2Id;

		if (mBlueId === blueTeamId) {
			blueSideGames++;
			if (m.winnerId === blueTeamId) blueSideWins++;
		}
		if (mRedId === redTeamId) {
			redSideGames++;
			if (m.winnerId === redTeamId) redSideWins++;
		}
	}

	const blueSideWR = blueSideGames >= 3 ? blueSideWins / blueSideGames : 0.53;
	const redSideWR = redSideGames >= 3 ? redSideWins / redSideGames : 0.47;

	// 4. Lane Matchups
	const blueHeroByRole = new Map<Role, string>();
	for (const p of blueEval.picks) {
		blueHeroByRole.set(p.role, p.hero);
	}
	const redHeroByRole = new Map<Role, string>();
	for (const p of redEval.picks) {
		redHeroByRole.set(p.role, p.hero);
	}

	const laneMatchups: LaneMatchup[] = [];
	let blueLaneWins = 0;
	let redLaneWins = 0;

	for (const r of [1, 2, 3, 4, 5] as Role[]) {
		const bHero = blueHeroByRole.get(r) ?? '—';
		const rHero = redHeroByRole.get(r) ?? '—';
		const bWR = bHero !== '—' ? getTeamHeroComfort(blueTeamId, bHero) : 0.5;
		const rWR = rHero !== '—' ? getTeamHeroComfort(redTeamId, rHero) : 0.5;
		const diff = bWR - rWR;

		let edge: 'blue' | 'red' | 'even' = 'even';
		let reason = 'Balanced lane matchup';

		if (diff > 0.04) {
			edge = 'blue';
			blueLaneWins++;
			reason = `${bHero} holds comfort/win rate edge (+${(diff * 100).toFixed(1)}%)`;
		} else if (diff < -0.04) {
			edge = 'red';
			redLaneWins++;
			reason = `${rHero} holds comfort/win rate edge (+${(Math.abs(diff) * 100).toFixed(1)}%)`;
		}

		laneMatchups.push({
			role: r,
			roleName: ROLE_NAMES[r],
			blueHero: bHero,
			redHero: rHero,
			blueHeroWinRate: bWR,
			redHeroWinRate: rWR,
			edge,
			edgeMargin: Math.abs(diff),
			reason
		});
	}

	// 5. Probability Synthesis
	const deltaMeta = blueMetaStrength - redMetaStrength;
	const deltaComfort = blueComfortScore - redComfortScore;
	const deltaSide = blueSideWR - redSideWR;

	const logitDelta = deltaMeta * 2.2 + deltaComfort * 1.8 + deltaSide * 0.8;
	const prob = 1 / (1 + Math.exp(-logitDelta * 2.5));
	// Grounded realistic probability
	const blueWinProb = Math.min(0.68, Math.max(0.32, Math.round(prob * 1000) / 1000));
	const redWinProb = Math.round((1 - blueWinProb) * 1000) / 1000;

	let favoredSide: 'blue' | 'red' | 'even' = 'even';
	let edgeDescription = 'Even Draft Matchup';
	if (blueWinProb >= 0.52) {
		favoredSide = 'blue';
		const diff = (blueWinProb - 0.5) * 100;
		edgeDescription = `Blue Side Favored (+${diff.toFixed(1)}% edge)`;
	} else if (redWinProb >= 0.52) {
		favoredSide = 'red';
		const diff = (redWinProb - 0.5) * 100;
		edgeDescription = `Red Side Favored (+${diff.toFixed(1)}% edge)`;
	}

	let blueKeyAdvantage = 'First-Pick Priority & Early Lane Control';
	if (blueLaneWins > redLaneWins) {
		blueKeyAdvantage = `Controls ${blueLaneWins} of 5 lane matchups with higher comfort`;
	} else if (blueComfortScore > redComfortScore) {
		blueKeyAdvantage = 'Higher overall team hero comfort & signatures';
	}

	let redKeyAdvantage = 'Counter-Pick Flexibility & Late Composition Depth';
	if (redLaneWins > blueLaneWins) {
		redKeyAdvantage = `Controls ${redLaneWins} of 5 lane matchups with counter-picks`;
	} else if (redComfortScore > blueComfortScore) {
		redKeyAdvantage = 'Higher overall team hero comfort & signature depth';
	}

	return {
		blueWinProb,
		redWinProb,
		favoredSide,
		edgeDescription,
		blueSideWinRate: blueSideWR,
		redSideWinRate: redSideWR,
		blueComfortScore,
		redComfortScore,
		blueMetaStrength,
		redMetaStrength,
		laneMatchups,
		blueKeyAdvantage,
		redKeyAdvantage
	};
}





