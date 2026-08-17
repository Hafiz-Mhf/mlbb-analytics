from __future__ import annotations

import sqlite3


def _instance_count(
    conn: sqlite3.Connection,
    *,
    team_id: int | None = None,
    season: str | None = None,
) -> int:
    """Denominator for presence and pick_rate_by_role. A played game has
    two team-instances (each side's own picks/bans); league scope
    (team_id=None) counts both, so it is 2x the game count, not 1x."""
    if team_id is not None:
        row = conn.execute(
            "SELECT COUNT(*) FROM matches "
            "WHERE (team1_id = ? OR team2_id = ?) "
            "AND (? IS NULL OR season = ?)",
            (team_id, team_id, season, season),
        ).fetchone()
        return row[0]

    row = conn.execute(
        "SELECT COUNT(*) FROM matches WHERE (? IS NULL OR season = ?)",
        (season, season),
    ).fetchone()
    return row[0] * 2


def _draft_counts(
    conn: sqlite3.Connection,
    *,
    team_id: int | None = None,
    season: str | None = None,
) -> dict[str, int]:
    """Picks and bans combined, per hero — presence's numerator."""
    rows = conn.execute(
        """SELECT h.canonical_name, COUNT(*)
           FROM drafts d
           JOIN heroes h ON h.id = d.hero_id
           JOIN matches m ON m.id = d.match_id
           WHERE (? IS NULL OR d.team_id = ?)
           AND (? IS NULL OR m.season = ?)
           GROUP BY h.canonical_name""",
        (team_id, team_id, season, season),
    ).fetchall()
    return dict(rows)


def _pick_counts(
    conn: sqlite3.Connection,
    *,
    team_id: int | None = None,
    season: str | None = None,
    role: int | None = None,
) -> dict[str, int]:
    """Picks only (is_ban = 0), per hero — HHI's and pick_rate_by_role's
    numerator. role, if given, filters to that slot (role for picks only,
    per database.md — never call this with a role for ban rows)."""
    rows = conn.execute(
        """SELECT h.canonical_name, COUNT(*)
           FROM drafts d
           JOIN heroes h ON h.id = d.hero_id
           JOIN matches m ON m.id = d.match_id
           WHERE d.is_ban = 0
           AND (? IS NULL OR d.team_id = ?)
           AND (? IS NULL OR m.season = ?)
           AND (? IS NULL OR d.slot = ?)
           GROUP BY h.canonical_name""",
        (team_id, team_id, season, season, role, role),
    ).fetchall()
    return dict(rows)
