from __future__ import annotations

from pathlib import Path

from .fetcher import MediaWikiClient, fetch_and_snapshot_season

SEASON_TITLE_TEMPLATE = "MPL/Malaysia/Season {season}"


def backfill_season(client: MediaWikiClient, season: str, root: Path) -> list[Path]:
    """Fetch and snapshot every subpage of MPL Malaysia's given season
    number (e.g. '17', '18'). Thin wrapper turning a season number into
    the wiki page title fetch_and_snapshot_season expects."""
    season_title = SEASON_TITLE_TEMPLATE.format(season=season)
    return fetch_and_snapshot_season(client, season_title, root)
