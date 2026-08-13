# Security

## Threat model for v1 is small — say so explicitly
Everything in v1 is derived from public data (Liquipedia match records) and has no user accounts. There's no private data to leak and no auth surface to attack. Don't over-build security for a problem this doesn't have yet — but do get the few things that matter right.

## What actually matters for v1
- **Respect Liquipedia as a source**: cache parsed data locally (SQLite) as the dashboard's source of truth; never have the live dashboard scrape Liquipedia on-demand per page load. The weekly refresh job is the only thing that talks to Liquipedia, with a reasonable request rate and a clear User-Agent.
- **Validate before publish**: a bad parse (from a Liquipedia formatting change, e.g.) should never silently reach the live dashboard — the refresh job's validation check (same pattern as the original S17 spot-check) is a security-adjacent correctness gate, not just a QA nicety, because wrong numbers handed to a real analyst before a real draft is the actual harm model here.
- **No PII**: only public team/player/match data is stored — no personal contact info, no accounts, nothing that triggers real privacy obligations at this stage.

## Explicitly deferred, not forgotten
If Phase 2/3 ever adds accounts (e.g., a team wants private notes layered on top of the public data), that reopens auth, per-team data isolation, and access control as real requirements — flag this file for a rewrite at that point rather than bolting auth on ad hoc.
