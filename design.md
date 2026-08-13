# Design Philosophy

## Reuse, don't reinvent
This project doesn't need its own visual identity from scratch. It fits naturally under the existing hub-and-subdomain plan for hafizfaruqi.my — this reads like the "lab" subdomain's first real occupant. Reusing the established Audit Trail system (dark charcoal base, amber accent, terminal/log aesthetic) instead of inventing a new one saves real design time and gives the portfolio a coherent thread across projects, since draft/ban data is, literally, a log — the same conceptual fit that made Audit Trail work for a QA-background portfolio applies directly to a "log of every pick and ban" tool.

## Principles
- **Numbers first, decoration second.** An analyst opening this before a draft wants the answer in seconds — dense, scannable data tables and clear hierarchy beat illustration or motion.
- **Every number earns its place with a baseline.** If a stat can be misread without context (see: Fanny's ban rate), the UI shows the baseline next to it, not just the raw figure.
- **Monospace for data, not just labels.** Draft rows, hero names, timestamps — anything that reads like a log entry — uses the mono type family already established (JetBrains Mono) to reinforce the "audit trail" framing.
- **Public and current beats polished and stale.** Given the distribution plan (organic discovery during a live season), a slightly rougher v1 that's correct and updated weekly beats a beautiful v1 that's frozen at S17.

_If this framing doesn't feel right for a data tool vs. a personal portfolio, the one thing worth reconsidering is the amber accent's intensity — a data-dense dashboard may need it dialed back so it doesn't fight with hero/team color-coding. Flagged in design-direction-v1.md._
