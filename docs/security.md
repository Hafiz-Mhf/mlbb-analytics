# Security

## Threat model for v1 is small — say so explicitly
Everything in v1 is derived from public data (Liquipedia match records) and has no user accounts. There's no private data to leak and no auth surface to attack. Don't over-build security for a problem this doesn't have yet — but do get the few things that matter right.

## What actually matters for v1
- **Respect Liquipedia as a source.** The weekly pipeline is the only thing that ever talks to Liquipedia. The published dashboard cannot scrape it even by accident — it is prerendered static output with no server and no runtime fetch (stack.md). Their API terms are binding, not advisory; violations trigger automatic IP bans:
  - Custom `User-Agent` naming the project and a contact address. Generic agents (`python-requests`, `curl`) are explicitly listed as likely to be blocked.
  - Maximum 1 request per 2 seconds. Avoid `action=parse` entirely — it is capped at 1 per 30 seconds, and `action=query&prop=revisions` returns what we need.
  - Send `Accept-Encoding: gzip`, reuse connections, stay unauthenticated.
  - Full detail in data-source.md.
- **Archive rather than re-fetch.** Raw wikitext snapshots are committed to the repo, and SQLite is rebuilt from those, not from the network. A parser fix reprocesses all history with zero additional requests. This is politeness and resilience in the same move — it also means a Liquipedia outage or page deletion cannot destroy the dataset.
- **Validate before publish**: a bad parse (from a Liquipedia formatting change, e.g.) should never silently reach the live dashboard — the refresh job's validation check (same pattern as the original S17 spot-check) is a security-adjacent correctness gate, not just a QA nicety, because wrong numbers handed to a real analyst before a real draft is the actual harm model here.
- **No PII**: only public team/player/match data is stored — no personal contact info, no accounts, nothing that triggers real privacy obligations at this stage.

## Explicitly deferred, not forgotten
If Phase 2/3 ever adds accounts (e.g., a team wants private notes layered on top of the public data), that reopens auth, per-team data isolation, and access control as real requirements — flag this file for a rewrite at that point rather than bolting auth on ad hoc.
