from __future__ import annotations

import re
from pathlib import Path

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify_segment(segment: str) -> str:
    return _SLUG_RE.sub("-", segment.strip().lower()).strip("-")


def snapshot_path(root: Path, title: str) -> Path:
    """Map a wiki page title to a filesystem path under `root`, one
    directory per '/' segment, lowercased and hyphenated.
    'MPL/Malaysia/Season 17/Regular Season' ->
    root/mpl/malaysia/season-17/regular-season.wiki"""
    segments = [_slugify_segment(s) for s in title.split("/")]
    return root.joinpath(*segments[:-1], f"{segments[-1]}.wiki")


def write_snapshot(root: Path, title: str, wikitext: str) -> Path:
    """Write `wikitext` to its snapshot path under `root`, creating parent
    directories as needed. Overwrites any existing snapshot at that path —
    the committed file's git history is the archive, not multiple copies
    (stack.md: raw wikitext snapshots, reparseable forever)."""
    path = snapshot_path(root, title)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(wikitext, encoding="utf-8")
    return path


def read_snapshot(root: Path, title: str) -> str:
    """Read back a previously written snapshot."""
    return snapshot_path(root, title).read_text(encoding="utf-8")
