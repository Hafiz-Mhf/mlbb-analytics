// Team selector persists across views (uiux.md) — localStorage is the
// source of truth when no route param overrides it.
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'mlbb-analytics:selected-team';

function createSelectedTeam() {
	const initial = browser ? (localStorage.getItem(STORAGE_KEY) ?? 'srg') : 'srg';
	const { subscribe, set } = writable(initial);
	return {
		subscribe,
		set(slug: string) {
			if (browser) localStorage.setItem(STORAGE_KEY, slug);
			set(slug);
		}
	};
}

export const selectedTeam = createSelectedTeam();
