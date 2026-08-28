from pathlib import Path

import httpx

from mlbb_pipeline.backfill import backfill_season, main
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


PARSE_HTML_RESPONSE = {
    "parse": {
        "title": "MPL/Malaysia/Season 17/Regular Season",
        "pageid": 12345,
        "text": {"*": "<table class=\"wikitable wikitable-bordered\">...</table>"},
    }
}


def test_backfill_season_builds_title_from_season_number(tmp_path: Path):
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        if request.url.params.get("list") == "allpages":
            return httpx.Response(200, json=ALLPAGES_RESPONSE)
        if request.url.params.get("action") == "parse":
            return httpx.Response(200, json=PARSE_HTML_RESPONSE)
        return httpx.Response(200, json=REVISION_RESPONSE)

    client = MediaWikiClient(transport=httpx.MockTransport(handler), sleep_fn=lambda s: None)
    paths = backfill_season(client, "17", tmp_path)

    assert len(paths) >= 1
    assert (tmp_path / "mpl" / "malaysia" / "season-17" / "regular-season.wiki").read_text(encoding="utf-8") == "{{Matchlist|id=X}}"
    discover_request = captured[0]
    assert discover_request.url.params["apprefix"] == "MPL/Malaysia/Season 17/"


def _fake_client_factory(handler):
    def factory() -> MediaWikiClient:
        return MediaWikiClient(transport=httpx.MockTransport(handler), sleep_fn=lambda s: None)

    return factory


def test_main_defaults_to_seasons_17_and_18(tmp_path: Path, capsys):
    requested_seasons: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        titles_param = request.url.params.get("titles", "")
        apprefix_param = request.url.params.get("apprefix", "")
        for season in ("17", "18"):
            marker = f"MPL/Malaysia/Season {season}/"
            if apprefix_param == marker and season not in requested_seasons:
                requested_seasons.append(season)
        if request.url.params.get("list") == "allpages":
            page_title = apprefix_param + "Regular Season"
            return httpx.Response(
                200,
                json={"query": {"allpages": [{"pageid": 1, "ns": 0, "title": page_title}]}},
            )
        if request.url.params.get("action") == "parse":
            return httpx.Response(200, json=PARSE_HTML_RESPONSE)
        return httpx.Response(
            200,
            json={
                "query": {
                    "pages": {
                        "1": {
                            "title": titles_param,
                            "revisions": [{"slots": {"main": {"*": "{{Matchlist}}"}}}],
                        }
                    }
                }
            },
        )

    main(
        ["--root", str(tmp_path)],
        client_factory=_fake_client_factory(handler),
    )

    assert requested_seasons == ["17", "18"]
    captured = capsys.readouterr()
    assert "season-17" in captured.out
    assert "season-18" in captured.out


def test_main_accepts_explicit_seasons(tmp_path: Path, capsys):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.params.get("list") == "allpages":
            apprefix_param = request.url.params["apprefix"]
            return httpx.Response(
                200,
                json={
                    "query": {
                        "allpages": [
                            {"pageid": 1, "ns": 0, "title": apprefix_param + "Playoffs"}
                        ]
                    }
                },
            )
        return httpx.Response(
            200,
            json={
                "query": {
                    "pages": {
                        "1": {
                            "title": request.url.params["titles"],
                            "revisions": [{"slots": {"main": {"*": "{{Matchlist}}"}}}],
                        }
                    }
                }
            },
        )

    main(
        ["--season", "17", "--root", str(tmp_path)],
        client_factory=_fake_client_factory(handler),
    )

    captured = capsys.readouterr()
    assert "season-17" in captured.out
    assert "season-18" not in captured.out
