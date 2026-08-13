# Doc Structure

What's in this folder and why, so it doesn't need re-explaining every session.

| File | What it answers |
|---|---|
| ../CLAUDE.md | Context primer for any AI assistant picking this project up — read this first |
| current-context.md | What's true right now, as of the last update |
| planning.md | What this is in plain words, and what's in or out of scope per phase |
| data-source.md | What Liquipedia actually provides, measured. Field map, hazards, and what it will never have. Effectively the parser spec. |
| stack.md | Every technology decision, including the deliberate exclusions |
| roadmap.md | When things happen, anchored to Season 18's calendar |
| database.md | Schema and build strategy |
| frontend.md | SvelteKit structure — routes, data flow, components, deploy |
| design.md | Why the tool looks and behaves the way it does (the reasoning, not the tokens) |
| design-direction-v1.md | The actual v1 tokens and screens (the execution) |
| uiux.md | Navigation, screens, interaction patterns |
| security.md | Threat model, Liquipedia API obligations, what's deferred |

## Reading order for someone new

1. **planning.md** — what this is, in plain words
2. **data-source.md** — what the data can and cannot support
3. **stack.md** — how it's built
4. **current-context.md** — where it actually stands today

## Update discipline

**current-context.md** is the one file expected to go stale fast. Update it whenever something material changes — a phase ships, a decision reverses, Season 18 status changes. The others should only need edits when the underlying decision changes, not every session.

**A standing warning, learned the hard way.** These docs previously asserted as settled fact that a validated parser and a loaded dataset existed. Neither did, and every downstream doc inherited the error until it was caught on 13 Aug 2026. Mark aspirations as aspirations. If a doc states a number, it should be traceable to something measured — data-source.md exists to be that anchor.
