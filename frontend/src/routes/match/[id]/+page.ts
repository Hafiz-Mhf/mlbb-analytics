import { error } from '@sveltejs/kit';
import { mockDataset } from '$lib/data';

export const prerender = true;

export function entries() {
	return mockDataset.matches.map((m) => ({ id: String(m.id) }));
}

export function load({ params }: { params: { id: string } }) {
	const match = mockDataset.matches.find((m) => m.id === Number(params.id));
	if (!match) throw error(404, `Unknown match id: ${params.id}`);
	return { match };
}
