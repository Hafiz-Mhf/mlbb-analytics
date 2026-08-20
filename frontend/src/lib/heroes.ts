export function heroSlug(canonicalName: string): string {
	return canonicalName.replace(/\s+/g, '-');
}

// Icons live at static/heroes/<slug>.webp, sourced from Liquipedia's
// Module:CharacterIcon/Data (same wiki the pipeline already fetches
// wikitext from) — see docs/data-source.md.
export function heroIcon(canonicalName: string): string {
	return `/heroes/${heroSlug(canonicalName)}.webp`;
}
