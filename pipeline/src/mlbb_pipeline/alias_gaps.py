from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .aliases import known_hero_aliases, known_team_aliases
from .parser import find_template_calls, params_dict, split_top_level, strip_comments


@dataclass(frozen=True)
class AliasGaps:
    """Every hero/team string found in a set of snapshots that has no
    entry in the alias tables. A triage report, not a resolver — nothing
    here is fed back into the real parser, which still halts on unknowns
    (data-source.md Hazard 1, Hazard 3)."""

    heroes: frozenset[str]
    teams: frozenset[str]


def scan_unknown_aliases(root: Path) -> AliasGaps:
    """Walk every '*.wiki' snapshot under root and collect every hero/team
    string with no entry in the alias tables, in one pass. Unlike
    resolve_hero/resolve_team, this never raises — it exists precisely so
    a human can see every gap at once before extending the alias tables,
    rather than discovering them one halt at a time."""
    hero_table = known_hero_aliases()
    team_table = known_team_aliases()
    unknown_heroes: set[str] = set()
    unknown_teams: set[str] = set()

    for path in sorted(root.rglob("*.wiki")):
        text = strip_comments(path.read_text(encoding="utf-8"))

        for body in find_template_calls(text, "Map"):
            params = params_dict(split_top_level(body))
            if params.get("finished") == "skip":
                continue
            for team_slot in (1, 2):
                for slot in range(1, 6):
                    for prefix in ("h", "b"):
                        raw = params.get(f"t{team_slot}{prefix}{slot}")
                        if raw is None:
                            continue
                        key = raw.strip().lower()
                        if key not in hero_table:
                            unknown_heroes.add(key)

        for body in find_template_calls(text, "TeamOpponent"):
            parts = split_top_level(body)
            if not parts or "=" in parts[0]:
                continue
            key = " ".join(parts[0].strip().lower().split())
            if key not in team_table:
                unknown_teams.add(key)

    return AliasGaps(heroes=frozenset(unknown_heroes), teams=frozenset(unknown_teams))
