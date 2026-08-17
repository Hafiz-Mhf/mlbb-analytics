// Colors are this plan's own judgment call, not sourced from real team
// branding — eight evenly-spaced hues chosen to stay clear of amber's
// hue range (~35-45°) so a team swatch is never mistaken for the
// baseline-annotation accent (design-direction-v1.md's open question).
// Short codes copied from pipeline/src/mlbb_pipeline/build.py's
// TEAM_SHORT_CODES so both sides agree — RRQ Tora's is genuinely
// unknown (a documented cosmetic gap, not a bug).
export const TEAM_COLORS: Record<string, string> = {
	'AC Esports': '#e5484d',
	'Bigetron MY by VIT': '#12a594',
	'Invictus Gaming': '#3e63dd',
	'RRQ Tora': '#e93d82',
	'Selangor Red Giants': '#46a758',
	'Team Flash': '#6e56cf',
	'Team Rey': '#00a2c7',
	'Team Vamos': '#ab4aba'
};

export const TEAM_SHORT_CODES: Record<string, string | null> = {
	'AC Esports': 'AC',
	'Bigetron MY by VIT': 'BTRM',
	'Invictus Gaming': 'IG',
	'RRQ Tora': null,
	'Selangor Red Giants': 'SRG',
	'Team Flash': 'FL',
	'Team Rey': 'REY',
	'Team Vamos': 'VMS'
};
