import { error } from '@sveltejs/kit';
import { mockDataset } from '$lib/data';
import { TEAM_SHORT_CODES } from '$lib/teams';

export const prerender = true;

function slugFor(teamName: string): string {
	return (TEAM_SHORT_CODES[teamName] ?? teamName).toLowerCase().replace(/\s+/g, '-');
}

export function entries() {
	return mockDataset.teams.map((t) => ({ slug: slugFor(t.canonicalName) }));
}

export function load({ params }: { params: { slug: string } }) {
	const team = mockDataset.teams.find((t) => slugFor(t.canonicalName) === params.slug);
	if (!team) throw error(404, `Unknown team slug: ${params.slug}`);
	return { team };
}
