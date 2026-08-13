# Fetcher + Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a throttled MediaWiki action API client that discovers a season's subpages and fetches their wikitext, plus a snapshot writer that archives that wikitext to `data/raw/` — the two roadmap checklist items that follow the already-merged parser foundation.

**Architecture:** Two new modules in the existing `mlbb_pipeline` package. `fetcher.py` wraps `httpx.Client` with a custom User-Agent and a 2-second throttle, exposing `fetch_wikitext(title)` and `discover_season_subpages(season_title)`, plus an orchestration function `fetch_and_snapshot_season()` that composes both with the snapshot writer. `snapshot.py` maps a wiki page title to a deterministic filesystem path under a root directory and reads/writes wikitext there. All HTTP is exercised in tests via `httpx.MockTransport` — no real network calls run in the test suite, both to keep tests deterministic and to avoid burning real requests against Liquipedia's rate limit during CI.

**Tech Stack:** Python 3.12, `uv`, `httpx` (new dependency), pytest. Builds on `mlbb_pipeline.parser`/`models`/`aliases` from the merged parser-foundation plan but does not modify them.

**Spec:** `docs/data-source.md` (Access, Terms compliance, Page layout sections), `docs/stack.md` (pipeline shape, httpx choice), `docs/database.md` (Build strategy step 1-2), `docs/roadmap.md` (Pipeline checklist)

## Global Constraints

- Custom `User-Agent` identifying the project and a contact address — generic agents (`python-requests`, `curl`) are explicitly called out as likely to be blocked (data-source.md).
- Throttle to 1 request per 2 seconds. Use `action=query&prop=revisions` (2s limit), never `action=parse` (30s limit) (data-source.md).
- Send `Accept-Encoding: gzip` and reuse connections — `httpx.Client` does both by default, so no extra code is required, only a test proving it (data-source.md).
- Stay unauthenticated (data-source.md).
- The parser must discover subpages from the season page rather than assume stage names, since bracket stages vary between seasons (data-source.md, Page layout).
- Endpoint: `https://liquipedia.net/mobilelegends/api.php` (data-source.md).
- Raw wikitext is snapshotted to `data/raw/`, committed, reparseable forever without refetching (stack.md).
- Python 3.12, `uv` for venv/deps/lockfile — no pip/poetry (stack.md).
- No backend server; this is build-time code, never a service (stack.md).

---

## File Structure

```
pipeline/
  pyproject.toml                          # add httpx dependency
  src/mlbb_pipeline/
    fetcher.py       # MediaWikiClient (throttle, UA), fetch_wikitext, discover_season_subpages,
                      # fetch_and_snapshot_season (orchestration)
    snapshot.py       # snapshot_path, write_snapshot, read_snapshot
  tests/
    test_fetcher.py
    test_snapshot.py
```

`fetcher.py` imports from `snapshot.py` for the orchestration function; `snapshot.py` has no dependency on `fetcher.py`, so there's no cycle.

---

### Task 1: `MediaWikiClient` core — User-Agent, throttling, generic GET

**Files:**
- Modify: `pipeline/pyproject.toml` (add `httpx` dependency)
- Create: `pipeline/src/mlbb_pipeline/fetcher.py`
- Test: `pipeline/tests/test_fetcher.py`

**Interfaces:**
- Consumes: nothing (leaf module besides `httpx`).
- Produces: `USER_AGENT: str`, `DEFAULT_BASE_URL: str`, `API_PATH: str`, `MediaWikiClient(*, base_url=DEFAULT_BASE_URL, transport=None, min_interval=2.0, sleep_fn=time.sleep, clock=time.monotonic)` with `._get(params: dict[str, str]) -> dict` and `.close()` — used by Tasks 2, 3, 5.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_fetcher.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_fetcher.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mlbb_pipeline.fetcher'` (and `httpx` is not yet a dependency, so even the `import httpx` at the top of the test file will fail until Step 3 adds it and `uv sync` runs).

- [ ] **Step 3: Write minimal implementation**

Add `httpx` to `pipeline/pyproject.toml`:

```toml
[project]
name = "mlbb-pipeline"
version = "0.1.0"
description = "Build-time pipeline: Liquipedia wikitext -> SQLite -> JSON for MLBB Analytics"
requires-python = ">=3.12"
dependencies = [
    "pydantic>=2.7",
    "httpx>=0.27",
]
```

Run `uv sync --project pipeline` to install it.

```python
# pipeline/src/mlbb_pipeline/fetcher.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_fetcher.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/pyproject.toml pipeline/uv.lock pipeline/src/mlbb_pipeline/fetcher.py pipeline/tests/test_fetcher.py
git commit -m "feat: throttled MediaWiki API client with custom User-Agent"
```

---

### Task 2: `fetch_wikitext` — fetch a page's current revision content

**Files:**
- Modify: `pipeline/src/mlbb_pipeline/fetcher.py` (append `PageNotFoundError`, `MediaWikiClient.fetch_wikitext`)
- Modify: `pipeline/tests/test_fetcher.py` (append tests)

**Interfaces:**
- Consumes: `MediaWikiClient._get` (Task 1).
- Produces: `PageNotFoundError(ValueError)`, `MediaWikiClient.fetch_wikitext(title: str) -> str` — used by `fetch_and_snapshot_season` (Task 5).

- [ ] **Step 1: Write the failing test**

```python
# appended to pipeline/tests/test_fetcher.py
import pytest

from mlbb_pipeline.fetcher import PageNotFoundError

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_fetcher.py -v`
Expected: FAIL — `ImportError: cannot import name 'PageNotFoundError' from 'mlbb_pipeline.fetcher'`

- [ ] **Step 3: Write minimal implementation**

Append to `pipeline/src/mlbb_pipeline/fetcher.py`:

```python
class PageNotFoundError(ValueError):
    """Raised when a requested wiki page title does not exist."""
```

Add as a method on `MediaWikiClient` (after `_get`):

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_fetcher.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/fetcher.py pipeline/tests/test_fetcher.py
git commit -m "feat: fetch_wikitext for a page's current revision content"
```

---

### Task 3: `discover_season_subpages` — list a season's subpages by prefix

**Files:**
- Modify: `pipeline/src/mlbb_pipeline/fetcher.py` (append `MediaWikiClient.discover_season_subpages`)
- Modify: `pipeline/tests/test_fetcher.py` (append tests)

**Interfaces:**
- Consumes: `MediaWikiClient._get` (Task 1).
- Produces: `MediaWikiClient.discover_season_subpages(season_title: str) -> list[str]` — used by `fetch_and_snapshot_season` (Task 5).

- [ ] **Step 1: Write the failing test**

```python
# appended to pipeline/tests/test_fetcher.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_fetcher.py -v`
Expected: FAIL — `AttributeError: 'MediaWikiClient' object has no attribute 'discover_season_subpages'`

- [ ] **Step 3: Write minimal implementation**

Add as a method on `MediaWikiClient` (after `fetch_wikitext`):

```python
    def discover_season_subpages(self, season_title: str) -> list[str]:
        """List subpages of `season_title` (e.g. 'MPL/Malaysia/Season 17')
        by prefix — e.g. '.../Regular Season', '.../Playoffs'. Discovered
        rather than hardcoded, since bracket stage names vary between
        seasons (data-source.md, Page layout)."""
        prefix = f"{season_title}/"
        data = self._get(
            {
                "action": "query",
                "list": "allpages",
                "apprefix": prefix,
                "aplimit": "max",
                "format": "json",
            }
        )
        return [page["title"] for page in data["query"]["allpages"]]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_fetcher.py -v`
Expected: PASS (8 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/fetcher.py pipeline/tests/test_fetcher.py
git commit -m "feat: discover season subpages by prefix instead of hardcoding stage names"
```

---

### Task 4: Snapshot writer — title-to-path mapping, write, read

**Files:**
- Create: `pipeline/src/mlbb_pipeline/snapshot.py`
- Test: `pipeline/tests/test_snapshot.py`

**Interfaces:**
- Consumes: nothing (leaf module — filesystem only).
- Produces: `snapshot_path(root: Path, title: str) -> Path`, `write_snapshot(root: Path, title: str, wikitext: str) -> Path`, `read_snapshot(root: Path, title: str) -> str` — used by `fetch_and_snapshot_season` (Task 5).

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_snapshot.py
from pathlib import Path

from mlbb_pipeline.snapshot import read_snapshot, snapshot_path, write_snapshot


def test_snapshot_path_slugifies_title_segments(tmp_path: Path):
    path = snapshot_path(tmp_path, "MPL/Malaysia/Season 17/Regular Season")
    assert path == tmp_path / "mpl" / "malaysia" / "season-17" / "regular-season.wiki"


def test_write_snapshot_creates_parent_dirs_and_writes_content(tmp_path: Path):
    path = write_snapshot(tmp_path, "MPL/Malaysia/Season 17/Playoffs", "{{Matchlist}}")

    assert path == tmp_path / "mpl" / "malaysia" / "season-17" / "playoffs.wiki"
    assert path.read_text(encoding="utf-8") == "{{Matchlist}}"


def test_write_snapshot_overwrites_existing_file(tmp_path: Path):
    write_snapshot(tmp_path, "MPL/Malaysia/Season 17/Playoffs", "old content")
    write_snapshot(tmp_path, "MPL/Malaysia/Season 17/Playoffs", "new content")

    assert read_snapshot(tmp_path, "MPL/Malaysia/Season 17/Playoffs") == "new content"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_snapshot.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mlbb_pipeline.snapshot'`

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/src/mlbb_pipeline/snapshot.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_snapshot.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/snapshot.py pipeline/tests/test_snapshot.py
git commit -m "feat: snapshot writer mapping wiki titles to data/raw/ paths"
```

---

### Task 5: `fetch_and_snapshot_season` — compose fetcher and snapshot end-to-end

**Files:**
- Modify: `pipeline/src/mlbb_pipeline/fetcher.py` (append import + `fetch_and_snapshot_season`)
- Modify: `pipeline/tests/test_fetcher.py` (append integration test)

**Interfaces:**
- Consumes: `MediaWikiClient.discover_season_subpages`, `MediaWikiClient.fetch_wikitext` (Tasks 2, 3), `write_snapshot` (Task 4).
- Produces: `fetch_and_snapshot_season(client: MediaWikiClient, season_title: str, root: Path) -> list[Path]` — the public entry point a future backfill/CLI script (Phase 2, not this plan) calls per season.

- [ ] **Step 1: Write the failing test**

```python
# appended to pipeline/tests/test_fetcher.py
from pathlib import Path

from mlbb_pipeline.fetcher import fetch_and_snapshot_season


def test_fetch_and_snapshot_season_writes_every_discovered_subpage(tmp_path: Path):
    wikitext_by_title = {
        "MPL/Malaysia/Season 17/Regular Season": "{{Matchlist|id=REG}}",
        "MPL/Malaysia/Season 17/Playoffs": "{{Matchlist|id=PO}}",
    }

    def handler(request: httpx.Request) -> httpx.Response:
        params = request.url.params
        if params.get("list") == "allpages":
            return httpx.Response(200, json=ALLPAGES_RESPONSE)
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

    assert len(paths) == 2
    assert paths[0].read_text(encoding="utf-8") == "{{Matchlist|id=REG}}"
    assert paths[1].read_text(encoding="utf-8") == "{{Matchlist|id=PO}}"
    # 3 requests total (1 discover + 2 fetch); throttled before requests 2 and 3.
    assert sleeps == [2.0, 2.0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project pipeline pytest pipeline/tests/test_fetcher.py -v`
Expected: FAIL — `ImportError: cannot import name 'fetch_and_snapshot_season' from 'mlbb_pipeline.fetcher'`

- [ ] **Step 3: Write minimal implementation**

Add near the top of `pipeline/src/mlbb_pipeline/fetcher.py`, with the other imports:

```python
from pathlib import Path

from .snapshot import write_snapshot
```

Append at the end of the file:

```python
def fetch_and_snapshot_season(
    client: MediaWikiClient, season_title: str, root: Path
) -> list[Path]:
    """Discover `season_title`'s subpages, fetch each one's wikitext, and
    write it to a snapshot under `root`. Returns the written paths, in
    discovery order — the whole fetch+snapshot chain end-to-end."""
    subpage_titles = client.discover_season_subpages(season_title)
    paths: list[Path] = []
    for title in subpage_titles:
        wikitext = client.fetch_wikitext(title)
        paths.append(write_snapshot(root, title, wikitext))
    return paths
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --project pipeline pytest pipeline/tests/test_fetcher.py -v`
Expected: PASS (9 passed)

- [ ] **Step 5: Run the full test suite**

Run: `uv run --project pipeline pytest pipeline/tests -v`
Expected: All tests from this plan plus the parser-foundation plan pass (approx. 40 passed), pristine output, no warnings.

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/mlbb_pipeline/fetcher.py pipeline/tests/test_fetcher.py
git commit -m "feat: compose fetch and snapshot into one per-season entry point"
```

---

## Not in this plan — Phase 2

Deliberately excluded, per the Scope Check (this plan is one independent, self-testable subsystem — season title in, snapshot files on disk out):

- **Live fetch against the real Liquipedia wiki.** Every test in this plan runs against `httpx.MockTransport`; no test makes a real network call, both for determinism and to avoid spending real requests against a 1-req/2s budget in CI. The first real run happens manually or as part of the backfill script below.
- **A CLI entry point / GitHub Actions weekly cron** that calls `fetch_and_snapshot_season` on a schedule (roadmap.md, stack.md).
- **Backfill Season 17, then Season 18-to-date** — the actual data-populating run using this plan's functions (roadmap.md). This plan builds the mechanism; backfill is its own roadmap checklist item.
- **Validation invariants that require multiple runs or external data** — team records vs. published standings, counts moving plausibly between runs (stack.md correctness layer).
- **SQLite build, metrics, JSON emission** — unchanged from the parser-foundation plan's exclusions (database.md, stack.md).
- **Filling out the remaining hero/team alias strings** beyond what's already in `data/aliases/*.json` — surfaces naturally as `UnknownHeroError`/`UnknownTeamError` when the fetcher runs against the live wiki during backfill.

Once this plan is merged, the next plan picks up at "Backfill Season 17" in roadmap.md's Pipeline checklist, or at the SQLite build if a smaller step is preferred first.
