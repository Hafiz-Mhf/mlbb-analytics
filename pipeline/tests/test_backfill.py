from pathlib import Path

import httpx

from mlbb_pipeline.backfill import backfill_season
from mlbb_pipeline.fetcher import MediaWikiClient

ALLPAGES_RESPONSE = {
    "query": {
        "allpages": [
            {"pageid": 1, "ns": 0, "title": "MPL/Malaysia/Season 17/Regular Season"},
        ]
    }
}

REVISION_RESPONSE = {
    "query": {
        "pages": {
            "1": {
                "title": "MPL/Malaysia/Season 17/Regular Season",
                "revisions": [{"slots": {"main": {"*": "{{Matchlist|id=X}}"}}}],
            }
        }
    }
}


def test_backfill_season_builds_title_from_season_number(tmp_path: Path):
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        if request.url.params.get("list") == "allpages":
            return httpx.Response(200, json=ALLPAGES_RESPONSE)
        return httpx.Response(200, json=REVISION_RESPONSE)

    client = MediaWikiClient(transport=httpx.MockTransport(handler), sleep_fn=lambda s: None)
    paths = backfill_season(client, "17", tmp_path)

    assert len(paths) == 1
    assert paths[0].read_text(encoding="utf-8") == "{{Matchlist|id=X}}"
    discover_request = captured[0]
    assert discover_request.url.params["apprefix"] == "MPL/Malaysia/Season 17/"
