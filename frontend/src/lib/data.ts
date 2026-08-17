import dataset from './data/dataset.json';
import type { MockDataset } from './types';

export const mockDataset = dataset as MockDataset;
// Regenerated every mlbb-build run (stack.md: weekly during the season).
// A real freshness timestamp needs the pipeline to emit one alongside
// the dataset — tracked as a follow-up, not blocking this swap.
export const generatedAt = new Date().toISOString();
