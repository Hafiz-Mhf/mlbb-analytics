import sqlite3

from mlbb_pipeline.schema import create_schema


def _table_names(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    return {row[0] for row in rows}


def test_create_schema_creates_all_seven_tables():
    conn = sqlite3.connect(":memory:")
    create_schema(conn)
    assert _table_names(conn) == {
        "teams",
        "team_names",
        "team_aliases",
        "heroes",
        "hero_aliases",
        "matches",
        "drafts",
    }


def test_create_schema_enforces_unique_canonical_names():
    conn = sqlite3.connect(":memory:")
    create_schema(conn)
    conn.execute("INSERT INTO teams (canonical_name) VALUES ('Selangor Red Giants')")
    try:
        conn.execute("INSERT INTO teams (canonical_name) VALUES ('Selangor Red Giants')")
        assert False, "expected UNIQUE constraint violation"
    except sqlite3.IntegrityError:
        pass
