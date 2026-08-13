import httpx
import pytest

from mlbb_pipeline.fetcher import USER_AGENT, MediaWikiClient, PageNotFoundError


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
