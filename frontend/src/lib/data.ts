import dataset from './data/dataset.json';
import type { Dataset } from './types';

export const mockDataset = dataset as Dataset;
export const generatedAt = mockDataset.generatedAt;
