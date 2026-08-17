from __future__ import annotations

import json
from pathlib import Path

# data/aliases/*.json live at the repo root, sibling to pipeline/ (stack.md monorepo
# layout). These are seed tables: they cover the golden fixture plus every alias
# documented in data-source.md. Extend them during the Season 17 backfill (Phase 2).
DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "aliases"


class UnknownHeroError(ValueError):
    """Raised when a wikitext hero string has no entry in hero_aliases.json.
    Never catch this to silently invent a new hero — add the string to the
    alias table instead (data-source.md Hazard 1)."""


class UnknownTeamError(ValueError):
    """Raised when a wikitext team string has no entry in team_aliases.json.
    Same rule as UnknownHeroError, one level up (data-source.md Hazard 3)."""


def _load_alias_table(filename: str) -> dict[str, str]:
    path = DATA_DIR / filename
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


_hero_aliases_cache: dict[str, str] | None = None
_team_aliases_cache: dict[str, str] | None = None


def _hero_aliases() -> dict[str, str]:
    global _hero_aliases_cache
    if _hero_aliases_cache is None:
        _hero_aliases_cache = _load_alias_table("hero_aliases.json")
    return _hero_aliases_cache


def _team_aliases() -> dict[str, str]:
    global _team_aliases_cache
    if _team_aliases_cache is None:
        _team_aliases_cache = _load_alias_table("team_aliases.json")
    return _team_aliases_cache


def resolve_hero(raw: str) -> str:
    key = raw.strip().lower()
    table = _hero_aliases()
    if key not in table:
        raise UnknownHeroError(
            f"unrecognized hero string {raw!r} — add it to data/aliases/hero_aliases.json, "
            "never invent a new hero silently"
        )
    return table[key]


def known_hero_aliases() -> dict[str, str]:
    """Read-only view of the loaded hero alias table, for tooling that
    needs to check membership without triggering resolve_hero's halt
    (e.g. alias_gaps.py's triage scanner)."""
    return dict(_hero_aliases())


def known_team_aliases() -> dict[str, str]:
    """Same as known_hero_aliases(), one level up."""
    return dict(_team_aliases())


def resolve_team(raw: str) -> str:
    key = " ".join(raw.strip().lower().split())
    table = _team_aliases()
    if key not in table:
        raise UnknownTeamError(
            f"unrecognized team string {raw!r} — add it to data/aliases/team_aliases.json, "
            "never invent a new team silently"
        )
    return table[key]
