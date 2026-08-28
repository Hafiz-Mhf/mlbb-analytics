from __future__ import annotations

import sqlite3
from pathlib import Path
import pytest

from mlbb_pipeline.schema import create_schema
from mlbb_pipeline.standings import (
    StandingsMismatchError,
    TeamStanding,
    parse_standings_html,
    validate_standings,
)

SAMPLE_GROUPTABLE_HTML = """
<div class="table-responsive">
<table class="wikitable wikitable-bordered" style="width:550px;margin:0px">
<tbody>
<tr><th>#</th><th>Team</th><th>Match</th><th>Game</th><th>Diff</th><th>Pts</th></tr>
<tr data-toggle-area-content="1">
  <th>1.</th>
  <td class="grouptableslot">
    <span class="team-template-team-standard" data-highlighting-class="Selangor Red Giants">
      <span class="team-template-text"><a href="/mobilelegends/Selangor_Red_Giants" title="Selangor Red Giants">Selangor Red Giants</a></span>
    </span>
  </td>
  <td align="center"><b>2-0</b></td>
  <td align="center">4-1</td>
  <td align="center"><i>+3</i></td>
  <td align="center"><b>2p</b></td>
</tr>
<tr data-toggle-area-content="1">
  <th>2.</th>
  <td class="grouptableslot">
    <span class="team-template-team-standard" data-highlighting-class="Team Vamos">
      <span class="team-template-text"><a href="/mobilelegends/Team_Vamos" title="Team Vamos">Team Vamos</a></span>
    </span>
  </td>
  <td align="center"><b>0-2</b></td>
  <td align="center">1-4</td>
  <td align="center"><i>-3</i></td>
  <td align="center"><b>0p</b></td>
</tr>
</tbody>
</table>
</div>
"""


def test_parse_standings_html_minimal() -> None:
    standings = parse_standings_html(SAMPLE_GROUPTABLE_HTML)
    assert len(standings) == 2
    assert standings[0] == TeamStanding(
        team="Selangor Red Giants",
        series_w=2,
        series_l=0,
        games_w=4,
        games_l=1,
    )
    assert standings[1] == TeamStanding(
        team="Team Vamos",
        series_w=0,
        series_l=2,
        games_w=1,
        games_l=4,
    )


def test_parse_standings_html_s17_snapshot() -> None:
    snapshot_path = (
        Path(__file__).resolve().parents[2]
        / "data"
        / "raw"
        / "mpl"
        / "malaysia"
        / "season-17"
        / "standings.html"
    )
    assert snapshot_path.exists()
    html = snapshot_path.read_text(encoding="utf-8")
    standings = parse_standings_html(html)
    assert len(standings) == 8

    by_team = {s.team: s for s in standings}
    assert by_team["Selangor Red Giants"] == TeamStanding(
        team="Selangor Red Giants", series_w=12, series_l=2, games_w=25, games_l=8
    )
    assert by_team["Invictus Gaming"] == TeamStanding(
        team="Invictus Gaming", series_w=9, series_l=5, games_w=21, games_l=13
    )
    assert by_team["Team Vamos"] == TeamStanding(
        team="Team Vamos", series_w=9, series_l=5, games_w=20, games_l=12
    )
    assert by_team["Team Rey"] == TeamStanding(
        team="Team Rey", series_w=8, series_l=6, games_w=18, games_l=16
    )
    assert by_team["Bigetron MY by VIT"] == TeamStanding(
        team="Bigetron MY by VIT", series_w=6, series_l=8, games_w=17, games_l=17
    )
    assert by_team["RRQ Tora"] == TeamStanding(
        team="RRQ Tora", series_w=6, series_l=8, games_w=12, games_l=18
    )
    assert by_team["AC Esports"] == TeamStanding(
        team="AC Esports", series_w=5, series_l=9, games_w=14, games_l=21
    )
    assert by_team["Team Flash"] == TeamStanding(
        team="Team Flash", series_w=1, series_l=13, games_w=5, games_l=27
    )


def test_parse_standings_html_empty() -> None:
    assert parse_standings_html("") == []
    assert parse_standings_html("<div>No table here</div>") == []


def _create_mock_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    create_schema(conn)
    # Insert teams
    cur = conn.cursor()
    cur.execute("INSERT INTO teams (canonical_name, short_code) VALUES ('Selangor Red Giants', 'SRG')")
    srg_id = cur.lastrowid
    cur.execute("INSERT INTO teams (canonical_name, short_code) VALUES ('Team Vamos', 'VMS')")
    vms_id = cur.lastrowid

    # Insert 2 matches for regular season: SRG vs VMS (SRG 2 - 0 VMS) -> Series 1
    # match 1
    cur.execute(
        """INSERT INTO matches (series_id, season, stage, team1_id, team2_id, team1_side, winner_id, game_length, game_number_in_series, played_at)
           VALUES ('s1', '17', 'regular_season', ?, ?, 'blue', ?, '15:00', 1, '2026-04-03 17:00:00')""",
        (srg_id, vms_id, srg_id),
    )
    # match 2
    cur.execute(
        """INSERT INTO matches (series_id, season, stage, team1_id, team2_id, team1_side, winner_id, game_length, game_number_in_series, played_at)
           VALUES ('s1', '17', 'regular_season', ?, ?, 'red', ?, '16:00', 2, '2026-04-03 17:30:00')""",
        (srg_id, vms_id, srg_id),
    )
    conn.commit()
    return conn


def test_validate_standings_success() -> None:
    conn = _create_mock_db()
    published = [
        TeamStanding(team="Selangor Red Giants", series_w=1, series_l=0, games_w=2, games_l=0),
        TeamStanding(team="Team Vamos", series_w=0, series_l=1, games_w=0, games_l=2),
    ]
    validate_standings(conn, "17", published)
    conn.close()


def test_validate_standings_mismatch_raises() -> None:
    conn = _create_mock_db()
    # Wrong games_w for SRG (1 instead of 2)
    wrong_published = [
        TeamStanding(team="Selangor Red Giants", series_w=1, series_l=0, games_w=1, games_l=1),
        TeamStanding(team="Team Vamos", series_w=0, series_l=1, games_w=0, games_l=2),
    ]
    with pytest.raises(StandingsMismatchError, match="standings mismatch for season 17"):
        validate_standings(conn, "17", wrong_published)
    conn.close()


def test_validate_standings_missing_team_in_db_raises() -> None:
    conn = _create_mock_db()
    published_with_extra = [
        TeamStanding(team="Selangor Red Giants", series_w=1, series_l=0, games_w=2, games_l=0),
        TeamStanding(team="Team Vamos", series_w=0, series_l=1, games_w=0, games_l=2),
        TeamStanding(team="Nonexistent Team", series_w=0, series_l=0, games_w=0, games_l=0),
    ]
    with pytest.raises(StandingsMismatchError, match="not found in database"):
        validate_standings(conn, "17", published_with_extra)
    conn.close()
