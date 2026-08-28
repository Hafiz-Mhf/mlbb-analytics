from __future__ import annotations

from dataclasses import dataclass
import re
import sqlite3

from .aliases import resolve_team


@dataclass(frozen=True)
class TeamStanding:
    """Published regular season standing row from Liquipedia GroupTableLeague."""

    team: str
    series_w: int
    series_l: int
    games_w: int
    games_l: int


class StandingsMismatchError(RuntimeError):
    """Raised when a team's computed W-L records from matches in SQLite do
    not match the published standings from Liquipedia's regular season table.
    stack.md's build-halting invariant: a failed validation never publishes."""


def parse_standings_html(html: str) -> list[TeamStanding]:
    """Parse the final or active round of Liquipedia's GroupTableLeague HTML
    into normalized TeamStanding objects."""
    table_match = re.search(
        r'<table class="wikitable wikitable-bordered"[^>]*>(.*?)</table>',
        html,
        re.DOTALL,
    )
    if not table_match:
        return []

    table_content = table_match.group(1)

    rounds = re.findall(r'data-toggle-area-content="(\d+)"', table_content)
    target_round = str(max(map(int, rounds))) if rounds else None

    rows = re.findall(r'<tr([^>]*)>(.*?)</tr>', table_content, re.DOTALL)
    standings: list[TeamStanding] = []

    for tr_attrs, tr_body in rows:
        if target_round and f'data-toggle-area-content="{target_round}"' not in tr_attrs:
            continue

        team_match = re.search(r'data-highlighting-class="([^"]+)"', tr_body)
        if not team_match:
            team_match = re.search(
                r'<span class="team-template-text"><a[^>]*>([^<]+)</a></span>',
                tr_body,
            )
        if not team_match:
            continue

        team_raw = team_match.group(1).strip()
        team_canonical = resolve_team(team_raw)

        tds = re.findall(r'<td[^>]*>(.*?)</td>', tr_body, re.DOTALL)
        if len(tds) >= 3:
            s_match = re.search(r'(\d+)-(\d+)', tds[1])
            g_match = re.search(r'(\d+)-(\d+)', tds[2])
            if s_match and g_match:
                standings.append(
                    TeamStanding(
                        team=team_canonical,
                        series_w=int(s_match.group(1)),
                        series_l=int(s_match.group(2)),
                        games_w=int(g_match.group(1)),
                        games_l=int(g_match.group(2)),
                    )
                )

    return standings


def validate_standings(
    conn: sqlite3.Connection, season: str, published: list[TeamStanding]
) -> None:
    """Validate that computed regular-season records for `season` in SQLite
    match the `published` standings. Raises StandingsMismatchError on any discrepancy."""
    discrepancies: list[str] = []

    for standing in published:
        team_name = standing.team
        team_row = conn.execute(
            "SELECT id FROM teams WHERE canonical_name = ?", (team_name,)
        ).fetchone()

        if team_row is None:
            discrepancies.append(f"Team {team_name!r} not found in database")
            continue

        team_id = team_row[0]

        series_rows = conn.execute(
            """
            SELECT series_id,
                   SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as team_wins,
                   SUM(CASE WHEN winner_id != ? THEN 1 ELSE 0 END) as opp_wins
            FROM matches
            WHERE season = ? AND stage = 'regular_season' AND (team1_id = ? OR team2_id = ?)
            GROUP BY series_id
            """,
            (team_id, team_id, season, team_id, team_id),
        ).fetchall()

        db_series_w = sum(1 for _, tw, ow in series_rows if tw > ow)
        db_series_l = sum(1 for _, tw, ow in series_rows if tw < ow)
        db_games_w = sum(tw for _, tw, ow in series_rows)
        db_games_l = sum(ow for _, tw, ow in series_rows)

        if (
            db_series_w != standing.series_w
            or db_series_l != standing.series_l
            or db_games_w != standing.games_w
            or db_games_l != standing.games_l
        ):
            discrepancies.append(
                f"{team_name}: published series={standing.series_w}-{standing.series_l}, "
                f"games={standing.games_w}-{standing.games_l} vs computed series={db_series_w}-{db_series_l}, "
                f"games={db_games_w}-{db_games_l}"
            )

    if discrepancies:
        raise StandingsMismatchError(
            f"standings mismatch for season {season}:\n"
            + "\n".join(f"  - {d}" for d in discrepancies)
        )
