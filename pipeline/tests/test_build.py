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
    assert by_name["RRQ Tora"] == "RRQ"

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


from mlbb_pipeline.build import insert_game
from mlbb_pipeline.parser import parse_map

RAW_MAP = (
    "{{Map|team1side=blue|team2side=red|length=21:59|winner=1"
    "|t1h1=sora|t1h2=guin|t1h3=zhuxin|t1h4=granger|t1h5=chou"
    "|t2h1=phoveus|t2h2=leomord|t2h3=yve|t2h4=harith|t2h5=khaleed"
    "|t1b1=baxia|t1b2=valen|t1b3=kalea|t1b4=suyou|t1b5=harley"
    "|t2b1=freya|t2b2=marcel|t2b3=fanny|t2b4=gloo|t2b5=claude}}"
)


def _sample_game():
    return parse_map(
        RAW_MAP,
        series_id="MPLMYS17W1_M1",
        season="17",
        stage="regular_season",
        team1_raw="Selangor Red Giants",
        team2_raw="Team Vamos",
        played_at="April 3, 2026 - 17:00",
        game_number_in_series=1,
    )


def test_insert_game_writes_one_match_row():
    conn = _conn()
    seed_reference_tables(conn)

    match_id = insert_game(conn, _sample_game())

    row = conn.execute(
        "SELECT series_id, team1_id, team2_id, winner_id, game_length "
        "FROM matches WHERE id = ?",
        (match_id,),
    ).fetchone()
    srg_id, vamos_id = conn.execute(
        "SELECT id FROM teams WHERE canonical_name IN "
        "('Selangor Red Giants', 'Team Vamos') ORDER BY canonical_name"
    ).fetchall()
    srg_id, vamos_id = srg_id[0], vamos_id[0]
    assert row == ("MPLMYS17W1_M1", srg_id, vamos_id, srg_id, "21:59")


def test_insert_game_writes_twenty_draft_rows():
    conn = _conn()
    seed_reference_tables(conn)

    match_id = insert_game(conn, _sample_game())

    count = conn.execute(
        "SELECT COUNT(*) FROM drafts WHERE match_id = ?", (match_id,)
    ).fetchone()[0]
    assert count == 20

    guin_pick = conn.execute(
        """SELECT h.canonical_name FROM drafts d
           JOIN heroes h ON h.id = d.hero_id
           WHERE d.match_id = ? AND d.slot = 2 AND d.is_ban = 0
           AND d.team_id = (SELECT id FROM teams WHERE canonical_name = 'Selangor Red Giants')""",
        (match_id,),
    ).fetchone()[0]
    assert guin_pick == "guinevere"


from pathlib import Path

from mlbb_pipeline.build import discover_snapshots


def test_discover_snapshots_finds_regular_season_and_playoffs_only(tmp_path: Path):
    s17 = tmp_path / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text("a", encoding="utf-8")
    (s17 / "playoffs.wiki").write_text("b", encoding="utf-8")
    (s17 / "statistics.wiki").write_text("c", encoding="utf-8")
    stats = s17 / "statistics"
    stats.mkdir()
    (stats / "regular-season.wiki").write_text("d", encoding="utf-8")

    s18 = tmp_path / "mpl" / "malaysia" / "season-18"
    s18.mkdir(parents=True)
    (s18 / "regular-season.wiki").write_text("e", encoding="utf-8")

    found = discover_snapshots(tmp_path)

    assert sorted((season, stage) for _, season, stage in found) == [
        ("17", "playoffs"),
        ("17", "regular_season"),
        ("18", "regular_season"),
    ]


from mlbb_pipeline.build import build_database

RAW_MATCH = (
    "{{Match|bestof=3"
    "|opponent1={{TeamOpponent|Selangor Red Giants}}"
    "|opponent2={{TeamOpponent|Team Vamos}}"
    "|date=April 3, 2026 - 17:00 {{Abbr/MYT}}"
    "|map1=" + RAW_MAP + "}}"
)


def test_build_database_parses_regular_season_and_playoffs(tmp_path: Path):
    root = tmp_path / "raw"
    s17 = root / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text(
        "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    (s17 / "playoffs.wiki").write_text(
        "{{Bracket|Bracket/4L2DSU2L1D|id=MPLMYS17PL|R1M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    db_path = tmp_path / "mlbb.db"

    counts = build_database(root, db_path)

    assert counts == {"games": 2, "series": 2}
    conn = sqlite3.connect(db_path)
    stages = {
        row[0]
        for row in conn.execute("SELECT DISTINCT stage FROM matches").fetchall()
    }
    assert stages == {"regular_season", "playoffs"}


import pytest

from mlbb_pipeline.build import RegressionError, check_no_regression


def test_check_no_regression_passes_when_no_previous_db(tmp_path: Path):
    check_no_regression(tmp_path / "does-not-exist.db", {"games": 0, "series": 0})


def test_check_no_regression_passes_when_counts_hold_or_grow(tmp_path: Path):
    root = tmp_path / "raw"
    s17 = root / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text(
        "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    db_path = tmp_path / "mlbb.db"
    counts = build_database(root, db_path)

    check_no_regression(db_path, counts)  # same counts against itself


def test_check_no_regression_halts_on_fewer_games(tmp_path: Path):
    root = tmp_path / "raw"
    s17 = root / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text(
        "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    db_path = tmp_path / "mlbb.db"
    build_database(root, db_path)

    with pytest.raises(RegressionError):
        check_no_regression(db_path, {"games": 0, "series": 0})


from mlbb_pipeline.build import main


def test_main_builds_db_and_prints_summary(tmp_path: Path, capsys):
    root = tmp_path / "raw"
    s17 = root / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text(
        "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    db_path = tmp_path / "mlbb.db"
    json_path = tmp_path / "dataset.json"

    main(["--root", str(root), "--db", str(db_path), "--json", str(json_path)])

    assert db_path.exists()
    captured = capsys.readouterr()
    assert "games=1" in captured.out
    assert "series=1" in captured.out


def test_main_halts_and_leaves_committed_db_untouched_on_regression(
    tmp_path: Path, capsys
):
    root = tmp_path / "raw"
    s17 = root / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text(
        "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    db_path = tmp_path / "mlbb.db"
    json_path = tmp_path / "dataset.json"
    main(["--root", str(root), "--db", str(db_path), "--json", str(json_path)])
    before = db_path.read_bytes()

    (s17 / "regular-season.wiki").write_text("{{Matchlist|id=MPLMYS17W1}}", encoding="utf-8")
    with pytest.raises(RegressionError):
        main(["--root", str(root), "--db", str(db_path), "--json", str(json_path)])

    assert db_path.read_bytes() == before


import json


def test_main_also_emits_json(tmp_path: Path, capsys):
    root = tmp_path / "raw"
    s17 = root / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text(
        "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    db_path = tmp_path / "mlbb.db"
    json_path = tmp_path / "dataset.json"

    main(["--root", str(root), "--db", str(db_path), "--json", str(json_path)])

    dataset = json.loads(json_path.read_text(encoding="utf-8"))
    assert len(dataset["matches"]) == 1
    assert len(dataset["drafts"]) == 20


from mlbb_pipeline.standings import StandingsMismatchError


def test_build_database_validates_standings_when_snapshot_present(tmp_path: Path):
    root = tmp_path / "raw"
    s17 = root / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text(
        "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    # RAW_MATCH has SRG 1 - 0 VMS (1 game played, SRG won)
    valid_standings_html = """
    <table class="wikitable wikitable-bordered">
      <tr data-toggle-area-content="1">
        <th>1.</th>
        <td class="grouptableslot"><span data-highlighting-class="Selangor Red Giants"></span></td>
        <td><b>1-0</b></td><td>1-0</td><td>+1</td><td>1p</td>
      </tr>
      <tr data-toggle-area-content="1">
        <th>2.</th>
        <td class="grouptableslot"><span data-highlighting-class="Team Vamos"></span></td>
        <td><b>0-1</b></td><td>0-1</td><td>-1</td><td>0p</td>
      </tr>
    </table>
    """
    (s17 / "standings.html").write_text(valid_standings_html, encoding="utf-8")
    db_path = tmp_path / "mlbb.db"

    counts = build_database(root, db_path)
    assert counts == {"games": 1, "series": 1}


def test_build_database_halts_on_standings_mismatch(tmp_path: Path):
    root = tmp_path / "raw"
    s17 = root / "mpl" / "malaysia" / "season-17"
    s17.mkdir(parents=True)
    (s17 / "regular-season.wiki").write_text(
        "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}",
        encoding="utf-8",
    )
    # Tampered standings claiming SRG was 0-1 and VMS was 1-0
    mismatched_standings_html = """
    <table class="wikitable wikitable-bordered">
      <tr data-toggle-area-content="1">
        <th>1.</th>
        <td class="grouptableslot"><span data-highlighting-class="Selangor Red Giants"></span></td>
        <td><b>0-1</b></td><td>0-1</td><td>-1</td><td>0p</td>
      </tr>
      <tr data-toggle-area-content="1">
        <th>2.</th>
        <td class="grouptableslot"><span data-highlighting-class="Team Vamos"></span></td>
        <td><b>1-0</b></td><td>1-0</td><td>+1</td><td>1p</td>
      </tr>
    </table>
    """
    (s17 / "standings.html").write_text(mismatched_standings_html, encoding="utf-8")
    db_path = tmp_path / "mlbb.db"

    with pytest.raises(StandingsMismatchError):
        build_database(root, db_path)

