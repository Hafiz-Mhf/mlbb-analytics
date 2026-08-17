export type Stage = 'regular_season' | 'playoffs';

export interface Team {
	id: number;
	canonicalName: string;
	shortCode: string | null;
}

export interface Hero {
	id: number;
	canonicalName: string;
}

export interface MatchRow {
	id: number;
	seriesId: string;
	season: string;
	stage: Stage;
	team1Id: number;
	team2Id: number;
	team1Side: 'blue' | 'red';
	winnerId: number;
	gameLength: string;
	gameNumberInSeries: number;
	playedAt: string | null;
}

export interface DraftRow {
	id: number;
	matchId: number;
	teamId: number;
	slot: number; // role (1=EXP..5=Roam) for picks, ban order for bans — database.md
	heroId: number;
	isBan: boolean;
}

export interface MockDataset {
	teams: Team[];
	heroes: Hero[];
	matches: MatchRow[];
	drafts: DraftRow[];
}
