import httpx

from mlbb_pipeline.fetcher import USER_AGENT, MediaWikiClient


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
