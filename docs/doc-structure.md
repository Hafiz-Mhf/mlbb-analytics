# Doc Structure

What's in this folder and why, so it doesn't need re-explaining every session.

| File | What it answers |
|---|---|
| claude.md | Context primer for any AI assistant picking this project up — read this first |
| current-context.md | What's true right now, as of the last update |
| planning.md | What problem this solves, what's in/out of scope per phase |
| roadmap.md | When things happen, anchored to Season 18's calendar |
| database.md | Backend schema and refresh strategy |
| frontend.md | SvelteKit structure — routes, data flow, components, deploy |
| design.md | Why the tool looks/behaves the way it does (the reasoning, not the tokens) |
| design-direction-v1.md | The actual v1 tokens/screens (the execution) |
| uiux.md | Navigation, screens, interaction patterns |
| security.md | Threat model and what's deferred |

## Update discipline
current-context.md is the one file expected to go stale fast — update it whenever something material changes (a phase ships, a decision reverses, Season 18 status changes). The others should only need edits when the actual decision changes, not on every session.
