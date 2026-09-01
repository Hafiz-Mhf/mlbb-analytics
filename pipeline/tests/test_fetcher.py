from pathlib import Path

import httpx
import pytest

from mlbb_pipeline.fetcher import (
    USER_AGENT,
    MediaWikiClient,
    PageNotFoundError,
    fetch_and_snapshot_season,
)


def test_client_sends_custom_user_agent_and_gzip_accept_encoding():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"query": {"pages": {}}})

    client = MediaWikiClient(transport=httpx.MockTransport(handler), sleep_fn=lambda s: None)
    client._get({"action": "query"})

    assert len(captured) == 1
    request = captured[0]
    assert request.headers["user-agent"] == USER_AGENT
    assert "gzip" in request.headers["accept-encoding"]
    assert request.url.path == "/mobilelegends/api.php"
    assert request.url.params["action"] == "query"


def test_client_does_not_throttle_the_first_request():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"query": {"pages": {}}})

    sleeps: list[float] = []
    client = MediaWikiClient(
        transport=httpx.MockTransport(handler), sleep_fn=sleeps.append, clock=lambda: 0.0
    )

    client._get({"action": "query"})

    assert sleeps == []


def test_client_throttles_a_second_immediate_request():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"query": {"pages": {}}})

    sleeps: list[float] = []
    client = MediaWikiClient(
        transport=httpx.MockTransport(handler), sleep_fn=sleeps.append, clock=lambda: 0.0
    )

    client._get({"action": "query"})
    client._get({"action": "query"})

    assert sleeps == [2.0]


def test_client_retries_timeout_then_succeeds():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise httpx.ReadTimeout("timed out", request=request)
        return httpx.Response(200, json={"query": {"pages": {}}})

    sleeps: list[float] = []
    client = MediaWikiClient(
        transport=httpx.MockTransport(handler),
        min_interval=0.0,
        max_retries=2,
        retry_backoff_seconds=0.5,
        sleep_fn=sleeps.append,
    )

    data = client._get({"action": "query"})

    assert data == {"query": {"pages": {}}}
    assert attempts == 2
    assert sleeps == [0.5]


def test_client_raises_timeout_after_retry_limit():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.ReadTimeout("timed out", request=request)

    sleeps: list[float] = []
    client = MediaWikiClient(
        transport=httpx.MockTransport(handler),
        min_interval=0.0,
        max_retries=2,
        retry_backoff_seconds=0.25,
        sleep_fn=sleeps.append,
    )

    with pytest.raises(httpx.ReadTimeout):
        client._get({"action": "query"})

    assert attempts == 3
    assert sleeps == [0.25, 0.5]


REVISION_RESPONSE = {
    "query": {
        "pages": {
            "12345": {
                "pageid": 12345,
                "title": "MPL/Malaysia/Season 17/Regular Season",
                "revisions": [
                    {"slots": {"main": {"*": "{{Matchlist|id=MPLMYS17W1}}"}}}
                ],
            }
        }
    }
}

MISSING_PAGE_RESPONSE = {
    "query": {"pages": {"-1": {"title": "Not A Real Page", "missing": ""}}}
}


def test_fetch_wikitext_returns_revision_content():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=REVISION_RESPONSE)

    client = MediaWikiClient(transport=httpx.MockTransport(handler), sleep_fn=lambda s: None)
    text = client.fetch_wikitext("MPL/Malaysia/Season 17/Regular Season")

    assert text == "{{Matchlist|id=MPLMYS17W1}}"


def test_fetch_wikitext_sends_correct_query_params():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=REVISION_RESPONSE)

    client = MediaWikiClient(transport=httpx.MockTransport(handler), sleep_fn=lambda s: None)
    client.fetch_wikitext("MPL/Malaysia/Season 17/Regular Season")

    params = captured[0].url.params
    assert params["action"] == "query"
    assert params["prop"] == "revisions"
    assert params["rvprop"] == "content"
    assert params["rvslots"] == "main"
    assert params["titles"] == "MPL/Malaysia/Season 17/Regular Season"


def test_fetch_wikitext_raises_on_missing_page():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=MISSING_PAGE_RESPONSE)

    client = MediaWikiClient(transport=httpx.MockTransport(handler), sleep_fn=lambda s: None)

    with pytest.raises(PageNotFoundError):
        client.fetch_wikitext("Not A Real Page")


ALLPAGES_RESPONSE = {
    "query": {
        "allpages": [
            {"pageid": 1, "ns": 0, "title": "MPL/Malaysia/Season 17/Regular Season"},
            {"pageid": 2, "ns": 0, "title": "MPL/Malaysia/Season 17/Playoffs"},
        ]
    }
}


def test_discover_season_subpages_returns_titles_in_order():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=ALLPAGES_RESPONSE)

    client = MediaWikiClient(transport=httpx.MockTransport(handler), sleep_fn=lambda s: None)
    titles = client.discover_season_subpages("MPL/Malaysia/Season 17")

    assert titles == [
        "MPL/Malaysia/Season 17/Regular Season",
        "MPL/Malaysia/Season 17/Playoffs",
    ]


def test_discover_season_subpages_sends_prefix_query():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=ALLPAGES_RESPONSE)

    client = MediaWikiClient(transport=httpx.MockTransport(handler), sleep_fn=lambda s: None)
    client.discover_season_subpages("MPL/Malaysia/Season 17")

    params = captured[0].url.params
    assert params["action"] == "query"
    assert params["list"] == "allpages"
    assert params["apprefix"] == "MPL/Malaysia/Season 17/"


def test_fetch_and_snapshot_season_writes_every_discovered_subpage(tmp_path: Path):
    wikitext_by_title = {
        "MPL/Malaysia/Season 17/Regular Season": "{{Matchlist|id=REG}}",
        "MPL/Malaysia/Season 17/Playoffs": "{{Matchlist|id=PO}}",
    }

    def handler(request: httpx.Request) -> httpx.Response:
        params = request.url.params
        if params.get("list") == "allpages":
            return httpx.Response(200, json=ALLPAGES_RESPONSE)
        if params.get("action") == "parse":
            return httpx.Response(200, json=PARSE_HTML_RESPONSE)
        title = params["titles"]
        return httpx.Response(
            200,
            json={
                "query": {
                    "pages": {
                        "1": {
                            "title": title,
                            "revisions": [
                                {"slots": {"main": {"*": wikitext_by_title[title]}}}
                            ],
                        }
                    }
                }
            },
        )

    sleeps: list[float] = []
    client = MediaWikiClient(
        transport=httpx.MockTransport(handler), sleep_fn=sleeps.append, clock=lambda: 0.0
    )

    paths = fetch_and_snapshot_season(client, "MPL/Malaysia/Season 17", tmp_path)

    assert len(paths) >= 2
    assert (tmp_path / "mpl" / "malaysia" / "season-17" / "regular-season.wiki").read_text(encoding="utf-8") == "{{Matchlist|id=REG}}"
    assert (tmp_path / "mpl" / "malaysia" / "season-17" / "playoffs.wiki").read_text(encoding="utf-8") == "{{Matchlist|id=PO}}"


PARSE_HTML_RESPONSE = {
    "parse": {
        "title": "MPL/Malaysia/Season 17/Regular Season",
        "pageid": 12345,
        "text": {"*": "<table class=\"wikitable wikitable-bordered\">...</table>"},
    }
}


def test_fetch_parsed_html_returns_rendered_html():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["action"] == "parse"
        assert request.url.params["page"] == "MPL/Malaysia/Season 17/Regular Season"
        assert request.url.params["prop"] == "text"
        return httpx.Response(200, json=PARSE_HTML_RESPONSE)

    client = MediaWikiClient(transport=httpx.MockTransport(handler), sleep_fn=lambda s: None)
    html = client.fetch_parsed_html("MPL/Malaysia/Season 17/Regular Season")

    assert html == "<table class=\"wikitable wikitable-bordered\">...</table>"


def test_fetch_parsed_html_raises_on_missing():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"error": {"code": "missingtitle", "info": "The page you specified doesn't exist."}})

    client = MediaWikiClient(transport=httpx.MockTransport(handler), sleep_fn=lambda s: None)
    with pytest.raises(PageNotFoundError):
        client.fetch_parsed_html("Not A Real Page")


def test_fetch_and_snapshot_season_snapshots_standings_html(tmp_path: Path):
    wikitext_by_title = {
        "MPL/Malaysia/Season 17/Regular Season": "{{Matchlist|id=REG}}",
        "MPL/Malaysia/Season 17/Playoffs": "{{Matchlist|id=PO}}",
    }

    def handler(request: httpx.Request) -> httpx.Response:
        params = request.url.params
        if params.get("list") == "allpages":
            return httpx.Response(200, json=ALLPAGES_RESPONSE)
        if params.get("action") == "parse":
            return httpx.Response(200, json=PARSE_HTML_RESPONSE)
        title = params["titles"]
        return httpx.Response(
            200,
            json={
                "query": {
                    "pages": {
                        "1": {
                            "title": title,
                            "revisions": [
                                {"slots": {"main": {"*": wikitext_by_title[title]}}}
                            ],
                        }
                    }
                }
            },
        )

    client = MediaWikiClient(
        transport=httpx.MockTransport(handler), sleep_fn=lambda s: None, clock=lambda: 0.0
    )

    paths = fetch_and_snapshot_season(client, "MPL/Malaysia/Season 17", tmp_path)
    standings_file = tmp_path / "mpl" / "malaysia" / "season-17" / "standings.html"
    assert standings_file.exists()
    assert standings_file.read_text(encoding="utf-8") == "<table class=\"wikitable wikitable-bordered\">...</table>"
