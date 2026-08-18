import { error } from '@sveltejs/kit';
import { mockDataset } from '$lib/data';
import { teamSlug } from '$lib/teams';

export const prerender = true;

export function entries() {
	return mockDataset.teams.map((t) => ({ slug: teamSlug(t.canonicalName) }));
}

export function load({ params }: { params: { slug: string } }) {
	const team = mockDataset.teams.find((t) => teamSlug(t.canonicalName) === params.slug);
	if (!team) throw error(404, `Unknown team slug: ${params.slug}`);
	return { team };
}
