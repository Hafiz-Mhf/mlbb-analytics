// Match Log's team/stage filters live here instead of local component state,
// so returning from /series/[seriesId] via the back link lands on the same filtered view.
import { writable } from 'svelte/store';

export const logTeamFilter = writable<string>('all');
export const logStageFilter = writable<'all' | 'regular_season' | 'playoffs'>('all');
