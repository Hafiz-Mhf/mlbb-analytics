# Stack

_Settled 13 Aug 2026. Includes the deliberate exclusions — if something is listed as "no" here, it was considered and rejected, not forgotten._

## The shape of the system

**There is no backend server.** Python is a build-time pipeline, not a service.

```
Liquipedia (weekly, in CI)
  → fetch wikitext          httpx, 2s throttle, custom UA
  → snapshot to repo        raw wikitext committed, reparseable forever
  → parse                   ~100 lines of regex + brace matching
  → normalize + validate    alias table; invariants HALT on failure
  → SQLite                  committed archive, ad-hoc SQL surface
  → emit typed JSON         into frontend/src/lib/data/
  → commit + push           triggers Vercel rebuild
                              → SvelteKit prerenders against that JSON
```

### Why no server

The data is read-only and changes once a week. A season is low thousands of draft rows — a few hundred KB of JSON. Sorting and filtering that client-side is instant. [frontend.md](frontend.md) already noted the views are prerender-friendly.

Running FastAPI would add a second deploy target, a hosting bill, CORS, and ongoing solo maintenance, in exchange for nothing v1 needs. It also does not compose with the original plan: Vercel functions have an ephemeral read-only filesystem, so a SQLite file there cannot be written to, and the weekly write job would have nowhere to go. That contradiction is what forced this decision.

FastAPI returns in Phase 3, when the live in-draft assistant needs genuine runtime queries — which [frontend.md](frontend.md) already expects to need a different architecture anyway.

## Choices

| Layer | Choice | Reasoning |
|---|---|---|
| Pipeline language | Python 3.12 | The analysis code is Python. No rewrite. |
| Python tooling | `uv` | One tool for venv + deps + lockfile. Faster than poetry, less ceremony than pip + requirements.txt. |
| HTTP | `httpx` | gzip and connection reuse by default, both required by Liquipedia's terms. |
| Raw archive | Wikitext snapshots committed to `data/raw/` | Lets a parser bug be fixed retroactively across all history without refetching. Also a permanent hedge against Liquipedia changing or removing pages. |
| Store | SQLite, committed | Build-time archive and ad-hoc SQL surface. Not a runtime dependency. See [database.md](database.md). |
| Metrics | Python, emitting typed JSON | One definition of presence / HHI / baseline, in one language. |
| Frontend | SvelteKit + Tailwind | Per [frontend.md](frontend.md). Unchanged by the no-server decision. |
| Type safety across the boundary | Pydantic models → generated TypeScript types | The pipeline emits JSON, the frontend consumes it. Generating TS from the Pydantic schema means a field rename breaks the frontend build instead of rendering `undefined`. |
| Testing | pytest (pipeline) + Vitest (components) | See below — this is the load-bearing part. |
| Scheduling | GitHub Actions cron, weekly during season | Free, already where the code lives, and a failed run is a visible red X rather than a silent cron on a laptop. |
| Deploy | Vercel, single target | Static output. Subdomain under hafizfaruqi.my. |
| Repo | Monorepo — `pipeline/` `frontend/` `data/` | One version of truth, one CI, one PR per change. Two repos would let the JSON contract drift between them. |

## Correctness layer

This is the project's actual differentiator, so it is specified rather than left to habit. See [planning.md](planning.md) — a plain table with right numbers beats a beautiful one with wrong numbers, and this is the machinery that enforces it.

**Golden-file tests.** A committed wikitext fixture with hand-checked expected output. Catches parser logic regressions.

**Pipeline invariants that halt the build.** Not warnings. The run fails and nothing publishes:

- Any hero string not in the alias table → halt. A new hero or a new editor shortcut must break loudly, never silently create a phantom hero. See [data-source.md](data-source.md), Hazard 1.
- Any played game without exactly 10 picks and 10 bans → halt.
- Aggregate team records not matching the published standings → halt.
- Game or series counts moving in an impossible direction between runs → halt.

**Unit tests on every metric function.** Presence and HHI are the product; a formula bug that keeps totals internally consistent would otherwise never surface.

The rule: **a failed validation never publishes.** Stale-but-correct always beats fresh-but-wrong, because the harm model is a real analyst carrying a wrong number into a real draft.

## Deliberate exclusions

Considered and rejected for v1. Reopen only with a stated reason.

**Docker — no.** Nothing runs long enough to need containing. GitHub Actions provides Python and Node natively; the pipeline is a script, not a service. Revisit only if Phase 3 introduces a server.

**FastAPI — not in v1.** Deferred to Phase 3. See above.

**Postgres — no.** SQLite is not being outgrown; there is one writer, weekly, and no runtime reads at all.

**Charting library — no.** [uiux.md](uiux.md) is tables-first by design; an analyst scanning before a draft reads numbers faster than shapes. Add one only when a specific table demonstrably fails to communicate, not preemptively.

**Streamlit v0 — dropped.** Was floated as a fast-validation path. Unnecessary once the backend disappeared: prerendered SvelteKit against static JSON is not meaningfully slower to build than Streamlit, and it is not throwaway.

**Auth / accounts — no.** No private data exists to gate. See [security.md](security.md).

**Mobile-first — no.** Analysts work at a desk pre-draft. Phase 3's sideline assistant may need a tablet; that is a Phase 3 decision.
