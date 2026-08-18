export function sparklinePoints(values: number[], width: number, height: number): string {
	if (values.length === 0) return '';
	return values
		.map((v, i) => {
			const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
			const y = height - v * height;
			return `${x},${y}`;
		})
		.join(' ');
}
