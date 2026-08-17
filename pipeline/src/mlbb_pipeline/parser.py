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
    unplayed: either finished=skip (unfinished series' placeholder) or a
    scheduled future match, which Liquipedia leaves as an empty template
    with no `finished` param and a blank `winner` instead."""
    bodies = find_template_calls(raw_value, "Map")
    if not bodies:
        raise ValueError(f"no Map template found in {raw_value!r}")
    params = params_dict(split_top_level(bodies[0]))

    if params.get("finished") == "skip" or not params.get("winner"):
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


DATE_TEMPLATE_SUFFIX = re.compile(r"\s*\{\{[^{}]*\}\}\s*$")


def strip_date_template_suffix(raw_date: str) -> str:
    """'April 3, 2026 - 17:00 {{Abbr/MYT}}' -> 'April 3, 2026 - 17:00'
    (data-source.md: 'template suffix must be stripped')."""
    previous = None
    current = raw_date
    while previous != current:
        previous = current
        current = DATE_TEMPLATE_SUFFIX.sub("", current)
    return current.strip()


def parse_team_opponent(raw_value: str) -> str:
    """raw_value looks like '{{TeamOpponent|Selangor Red Giants|substitutes=...}}'.
    Returns the raw (unresolved) team name string — call resolve_team() on it."""
    bodies = find_template_calls(raw_value, "TeamOpponent")
    if not bodies:
        raise ValueError(f"no TeamOpponent template found in {raw_value!r}")
    parts = split_top_level(bodies[0])
    if not parts or "=" in parts[0]:
        raise ValueError(f"TeamOpponent has no positional team name: {raw_value!r}")
    return parts[0].strip()


def parse_match(
    raw_value: str,
    *,
    series_id: str,
    season: str,
    stage: Literal["regular_season", "playoffs"],
) -> list[ParsedGame]:
    """Parse one '{{Match|...}}' template into its played games (finished=skip
    maps are dropped by parse_map)."""
    bodies = find_template_calls(raw_value, "Match")
    if not bodies:
        raise ValueError(f"no Match template found in {raw_value!r}")
    params = params_dict(split_top_level(bodies[0]))

    team1_raw = parse_team_opponent(params["opponent1"])
    team2_raw = parse_team_opponent(params["opponent2"])
    played_at = strip_date_template_suffix(params["date"]) if "date" in params else None

    map_keys = sorted(
        (k for k in params if re.fullmatch(r"map\d+", k)),
        key=lambda k: int(k[3:]),
    )

    games: list[ParsedGame] = []
    for key in map_keys:
        game_number = int(key[3:])
        game = parse_map(
            params[key],
            series_id=series_id,
            season=season,
            stage=stage,
            team1_raw=team1_raw,
            team2_raw=team2_raw,
            played_at=played_at,
            game_number_in_series=game_number,
        )
        if game is not None:
            games.append(game)
    return games


def _parse_series_container(
    text: str,
    *,
    template_name: str,
    series_key_pattern: str,
    sort_key,
    season: str,
    stage: Literal["regular_season", "playoffs"],
) -> list[ParsedGame]:
    """Shared logic for both series-container templates: find every
    top-level `template_name` call, pull out its series keys (matching
    series_key_pattern), and parse each series' {{Match}} body."""
    text = strip_comments(text)
    games: list[ParsedGame] = []
    for body in find_template_calls(text, template_name):
        params = params_dict(split_top_level(body))
        container_id = params.get("id", "unknown")
        series_keys = sorted(
            (k for k in params if re.fullmatch(series_key_pattern, k)),
            key=sort_key,
        )
        for key in series_keys:
            series_id = f"{container_id}_{key}"
            games.extend(
                parse_match(params[key], series_id=series_id, season=season, stage=stage)
            )
    return games


def parse_matchlist(
    text: str,
    *,
    season: str,
    stage: Literal["regular_season", "playoffs"],
) -> list[ParsedGame]:
    """Parse every '{{Matchlist|...}}' template in a page's wikitext into
    played games across all its series. Public entry point for round-robin
    pages (regular season)."""
    return _parse_series_container(
        text,
        template_name="Matchlist",
        series_key_pattern=r"M\d+",
        sort_key=lambda k: int(k[1:]),
        season=season,
        stage=stage,
    )


def parse_bracket(
    text: str,
    *,
    season: str,
    stage: Literal["regular_season", "playoffs"],
) -> list[ParsedGame]:
    """Parse every '{{Bracket|...}}' template in a page's wikitext into
    played games across all its series. Public entry point for elimination
    bracket pages (playoffs) — same {{Match}} bodies as Matchlist, but
    keyed 'R{round}M{match}' instead of 'M{n}'."""
    return _parse_series_container(
        text,
        template_name="Bracket",
        series_key_pattern=r"R\d+M\d+",
        sort_key=lambda k: tuple(int(n) for n in re.findall(r"\d+", k)),
        season=season,
        stage=stage,
    )
