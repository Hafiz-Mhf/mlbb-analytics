from __future__ import annotations

import re
from typing import Literal

from .aliases import resolve_hero, resolve_team
from .models import DraftRecord, MatchRecord, ParsedGame


def strip_comments(text: str) -> str:
    """Remove HTML comments (e.g. '<!-- Hero picks -->') before template
    parsing — they contain no braces so they can't desync brace matching,
    but left in place they corrupt whichever param they trail."""
    return re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)


def find_matching_close(text: str, open_idx: int) -> int:
    """open_idx is the index of the first '{' of a '{{' pair. Returns the
    index of the *second* '}' of the matching '}}', tracking nested pairs."""
    depth = 0
    i = open_idx
    n = len(text)
    while i < n:
        pair = text[i:i + 2]
        if pair == "{{":
            depth += 1
            i += 2
            continue
        if pair == "}}":
            depth -= 1
            i += 2
            if depth == 0:
                return i - 1
            continue
        i += 1
    raise ValueError(f"unmatched '{{{{' starting at index {open_idx}")


def split_top_level(body: str) -> list[str]:
    """Split body on '|' characters that are not nested inside '{{ }}'."""
    parts: list[str] = []
    depth = 0
    buf: list[str] = []
    i = 0
    n = len(body)
    while i < n:
        pair = body[i:i + 2]
        if pair == "{{":
            depth += 1
            buf.append(pair)
            i += 2
            continue
        if pair == "}}":
            depth -= 1
            buf.append(pair)
            i += 2
            continue
        ch = body[i]
        if ch == "|" and depth == 0:
            parts.append("".join(buf))
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    parts.append("".join(buf))
    return parts


def params_dict(parts: list[str]) -> dict[str, str]:
    """Turn 'key=value' parts into a dict, keeping insertion order. Positional
    (no top-level '=') parts, e.g. a TeamOpponent's team name, are ignored."""
    params: dict[str, str] = {}
    for part in parts:
        if "=" not in part:
            continue
        key, _, value = part.partition("=")
        params[key.strip()] = value.strip()
    return params


def find_template_calls(text: str, name: str) -> list[str]:
    """Find every top-level '{{name|...}}' occurrence in text, brace-matched.
    Returns the raw body of each occurrence (leading '|' stripped), in order."""
    marker = "{{" + name
    lower_text = text.lower()
    lower_marker = marker.lower()
    bodies: list[str] = []
    i = 0
    while True:
        idx = lower_text.find(lower_marker, i)
        if idx == -1:
            break
        close = find_matching_close(text, idx)
        body = text[idx + len(marker):close - 1]
        if body.startswith("|"):
            body = body[1:]
        bodies.append(body)
        i = close + 1
    return bodies


def parse_map(
    raw_value: str,
    *,
    series_id: str,
    season: str,
    stage: Literal["regular_season", "playoffs"],
    team1_raw: str,
    team2_raw: str,
    played_at: str | None,
    game_number_in_series: int,
) -> ParsedGame | None:
    """Parse one '{{Map|...}}' template. Returns None if the game is
    finished=skip — an unplayed placeholder in an unfinished series
    (data-source.md field map) that must never be stored."""
    bodies = find_template_calls(raw_value, "Map")
    if not bodies:
        raise ValueError(f"no Map template found in {raw_value!r}")
    params = params_dict(split_top_level(bodies[0]))

    if params.get("finished") == "skip":
        return None

    match = MatchRecord(
        series_id=series_id,
        season=season,
        stage=stage,
        team1=resolve_team(team1_raw),
        team2=resolve_team(team2_raw),
        team1_side=params["team1side"],
        winner=int(params["winner"]),
        game_length=params["length"],
        game_number_in_series=game_number_in_series,
        played_at=played_at,
    )

    drafts: list[DraftRecord] = []
    for team_slot in (1, 2):
        for slot in range(1, 6):
            raw_hero = params.get(f"t{team_slot}h{slot}")
            if raw_hero:
                drafts.append(
                    DraftRecord(
                        team_slot=team_slot,
                        slot=slot,
                        hero=resolve_hero(raw_hero),
                        is_ban=False,
                    )
                )
        for slot in range(1, 6):
            raw_hero = params.get(f"t{team_slot}b{slot}")
            if raw_hero:
                drafts.append(
                    DraftRecord(
                        team_slot=team_slot,
                        slot=slot,
                        hero=resolve_hero(raw_hero),
                        is_ban=True,
                    )
                )

    return ParsedGame(match=match, drafts=drafts)
