from __future__ import annotations

import time
from typing import Callable

import httpx

DEFAULT_BASE_URL = "https://liquipedia.net"
API_PATH = "/mobilelegends/api.php"
# Terms compliance (data-source.md): generic agents like python-requests/curl
# are explicitly called out as likely to be blocked. Identify the project and
# a contact address instead.
USER_AGENT = (
    "mlbb-analytics/0.1 (https://github.com/Hafiz-Mhf/mlbb-analytics; "
    "hafizfaruqi27@gmail.com)"
)
MIN_REQUEST_INTERVAL = 2.0  # seconds; data-source.md terms compliance


class PageNotFoundError(ValueError):
    """Raised when a requested wiki page title does not exist."""


class MediaWikiClient:
    """Throttled client for Liquipedia's MediaWiki action API
    (https://liquipedia.net/mobilelegends/api.php). httpx.Client sends
    'Accept-Encoding: gzip, deflate' and reuses connections by default,
    satisfying the other two terms-compliance requirements with no extra
    code (data-source.md)."""

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_BASE_URL,
        transport: httpx.BaseTransport | None = None,
        min_interval: float = MIN_REQUEST_INTERVAL,
        sleep_fn: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url, headers={"User-Agent": USER_AGENT}, transport=transport
        )
        self._min_interval = min_interval
        self._sleep_fn = sleep_fn
        self._clock = clock
        self._last_request_at: float | None = None

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "MediaWikiClient":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()

    def _throttle(self) -> None:
        if self._last_request_at is not None:
            elapsed = self._clock() - self._last_request_at
            remaining = self._min_interval - elapsed
            if remaining > 0:
                self._sleep_fn(remaining)
        self._last_request_at = self._clock()

    def _get(self, params: dict[str, str]) -> dict:
        self._throttle()
        response = self._client.get(API_PATH, params=params)
        response.raise_for_status()
        return response.json()

    def fetch_wikitext(self, title: str) -> str:
        """Fetch the raw wikitext of the current revision of `title`.
        Uses action=query&prop=revisions (2s limit), never action=parse
        (30s limit) — data-source.md."""
        data = self._get(
            {
                "action": "query",
                "prop": "revisions",
                "rvprop": "content",
                "rvslots": "main",
                "format": "json",
                "titles": title,
            }
        )
        pages = data["query"]["pages"]
        page = next(iter(pages.values()))
        if "missing" in page:
            raise PageNotFoundError(f"page not found: {title!r}")
        return page["revisions"][0]["slots"]["main"]["*"]
