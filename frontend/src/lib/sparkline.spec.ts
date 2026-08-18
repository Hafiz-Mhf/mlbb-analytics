import { describe, it, expect } from 'vitest';
import { sparklinePoints } from './sparkline';

describe('sparklinePoints', () => {
	it('returns an empty string for no values', () => {
		expect(sparklinePoints([], 100, 40)).toBe('');
	});

	it('centers a single value horizontally, at its own height', () => {
		expect(sparklinePoints([0.5], 100, 40)).toBe('50,20');
	});

	it('spans the full width for multiple values; low values sit near the bottom', () => {
		expect(sparklinePoints([0, 1], 100, 40)).toBe('0,40 100,0');
	});
});
