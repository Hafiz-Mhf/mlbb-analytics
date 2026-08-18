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
	opts: ScopeOptions & { picksOnly?: boolean; role?: number }
): DraftRow[] {
	const matchIds = new Set(scopedMatches(data, opts).map((m) => m.id));
	return data.drafts.filter((d) => {
		if (!matchIds.has(d.matchId)) return false;
		if (opts.teamId !== undefined && d.teamId !== opts.teamId) return false;
		if (opts.picksOnly && d.isBan) return false;
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
