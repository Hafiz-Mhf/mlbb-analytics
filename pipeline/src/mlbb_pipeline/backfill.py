from __future__ import annotations

import argparse
from pathlib import Path
from typing import Callable

from .fetcher import MediaWikiClient, fetch_and_snapshot_season

SEASON_TITLE_TEMPLATE = "MPL/Malaysia/Season {season}"

# data/raw/ lives at the repo root, sibling to pipeline/ (stack.md), same
# convention as aliases.py's DATA_DIR: parents[3] from this file is the repo root.
DEFAULT_DATA_ROOT = Path(__file__).resolve().parents[3] / "data" / "raw"
DEFAULT_SEASONS = ["17", "18"]


def backfill_season(client: MediaWikiClient, season: str, root: Path) -> list[Path]:
    """Fetch and snapshot every subpage of MPL Malaysia's given season
    number (e.g. '17', '18'). Thin wrapper turning a season number into
    the wiki page title fetch_and_snapshot_season expects."""
    season_title = SEASON_TITLE_TEMPLATE.format(season=season)
    return fetch_and_snapshot_season(client, season_title, root)


def main(
    argv: list[str] | None = None,
    *,
    client_factory: Callable[[], MediaWikiClient] = MediaWikiClient,
) -> None:
    """CLI entry point: fetch and snapshot each requested season.
    `client_factory` is overridable so tests never touch the real network."""
    parser = argparse.ArgumentParser(description="Backfill MPL Malaysia season snapshots.")
    parser.add_argument(
        "--season",
        action="append",
        dest="seasons",
        help="Season number to backfill (repeatable). Defaults to 17 and 18.",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=DEFAULT_DATA_ROOT,
        help="Snapshot root directory. Defaults to data/raw/ at the repo root.",
    )
    args = parser.parse_args(argv)
    seasons = args.seasons or DEFAULT_SEASONS

    client = client_factory()
    try:
        for season in seasons:
            for path in backfill_season(client, season, args.root):
                print(path)
    finally:
        client.close()


if __name__ == "__main__":
    main()
