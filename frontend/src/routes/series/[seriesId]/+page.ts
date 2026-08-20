import { error } from '@sveltejs/kit';
import { mockDataset } from '$lib/data';

export const prerender = true;

export function entries() {
	const seriesIds = new Set(mockDataset.matches.map((m) => m.seriesId));
	return [...seriesIds].map((seriesId) => ({ seriesId }));
}

export function load({ params }: { params: { seriesId: string } }) {
	const games = mockDataset.matches
		.filter((m) => m.seriesId === params.seriesId)
		.sort((a, b) => a.gameNumberInSeries - b.gameNumberInSeries);
	if (games.length === 0) throw error(404, `Unknown series id: ${params.seriesId}`);
	return { games };
}
