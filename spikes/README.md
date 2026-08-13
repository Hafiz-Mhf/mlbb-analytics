# Spikes

Throwaway probes, kept as evidence rather than as tooling.

These are the scripts that produced the numbers cited in `docs/data-source.md`. They are here so a claim in the docs can be traced to the code that measured it — the project's whole thesis is "validate before you publish", and that should apply to its own documentation first.

**They are not runnable as-is.** Paths point at a session scratchpad that no longer exists, and the alias table is hardcoded rather than sourced. When the real pipeline exists, these become obsolete and should be deleted; the pipeline's own tests replace them.

| File | What it measured |
|---|---|
| `hazard2.py` | Whether pick slots are role-ordered. Compares modal-slot concentration for picks against bans as a control group. Produced the 95.7% vs 44.8% figure. |
| `hazard2b.py` | Whether the 4.5% of off-modal picks cluster by team (editor error) or by hero (genuine role flex). Produced the per-team spread and the flex-hero list. |
