from __future__ import annotations

import re


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
