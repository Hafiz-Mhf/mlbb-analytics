import sqlite3

from mlbb_pipeline.build import seed_reference_tables
from mlbb_pipeline.schema import create_schema


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    create_schema(conn)
    return conn


def test_seed_reference_tables_inserts_eight_teams_with_aliases():
    conn = _conn()
    seed_reference_tables(conn)

    teams = conn.execute("SELECT canonical_name, short_code FROM teams").fetchall()
    assert len(teams) == 8
    by_name = dict(teams)
    assert by_name["Selangor Red Giants"] == "SRG"
    assert by_name["RRQ Tora"] is None  # short code not yet known (cosmetic gap)

    srg_id = conn.execute(
        "SELECT id FROM teams WHERE canonical_name = 'Selangor Red Giants'"
    ).fetchone()[0]
    alias_team_id = conn.execute(
        "SELECT team_id FROM team_aliases WHERE alias = 'srg'"
    ).fetchone()[0]
    assert alias_team_id == srg_id


def test_seed_reference_tables_inserts_heroes_with_aliases():
    conn = _conn()
    seed_reference_tables(conn)

    hero_count = conn.execute("SELECT COUNT(*) FROM heroes").fetchone()[0]
    assert hero_count > 60  # full roster, not just the golden-fixture short forms

    guinevere_id = conn.execute(
        "SELECT id FROM heroes WHERE canonical_name = 'guinevere'"
    ).fetchone()[0]
    alias_hero_id = conn.execute(
        "SELECT hero_id FROM hero_aliases WHERE alias = 'guin'"
    ).fetchone()[0]
    assert alias_hero_id == guinevere_id
