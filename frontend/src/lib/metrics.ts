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



