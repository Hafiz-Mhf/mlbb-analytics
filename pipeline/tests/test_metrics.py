import sqlite3

from mlbb_pipeline.build import insert_game, seed_reference_tables
from mlbb_pipeline.metrics import _draft_counts, _instance_count, _pick_counts
from mlbb_pipeline.parser import parse_map
from mlbb_pipeline.schema import create_schema

# Two synthetic games between the same two teams so hand-computed expected
# values are simple. Game 1: SRG picks guinevere in slot 2 (jungle) and bans
# baxia; Vamos picks phoveus in slot 1 and bans freya. Game 2: SRG picks
# guinevere again but in slot 1 this time (off-modal, exercises the role
# filter); Vamos picks harith in slot 1.
GAME_1 = (
    "{{Map|team1side=blue|team2side=red|length=10:00|winner=1"
    "|t1h1=sora|t1h2=guin|t1h3=zhuxin|t1h4=granger|t1h5=chou"
    "|t2h1=phoveus|t2h2=leomord|t2h3=yve|t2h4=harith|t2h5=khaleed"
    "|t1b1=baxia|t1b2=valen|t1b3=kalea|t1b4=suyou|t1b5=harley"
    "|t2b1=freya|t2b2=marcel|t2b3=fanny|t2b4=gloo|t2b5=claude}}"
)
GAME_2 = (
    "{{Map|team1side=red|team2side=blue|length=12:00|winner=2"
    "|t1h1=guin|t1h2=lylia|t1h3=selena|t1h4=karrie|t1h5=atlas"
    "|t2h1=harith|t2h2=leomord|t2h3=yve|t2h4=phoveus|t2h5=khaleed"
    "|t1b1=baxia|t1b2=valen|t1b3=kalea|t1b4=suyou|t1b5=harley"
    "|t2b1=freya|t2b2=marcel|t2b3=fanny|t2b4=gloo|t2b5=claude}}"
)


def _conn_with_two_games() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    create_schema(conn)
    seed_reference_tables(conn)
    for i, raw in enumerate((GAME_1, GAME_2), start=1):
        game = parse_map(
            raw,
            series_id="MPLMYS17W1_M1",
            season="17",
            stage="regular_season",
            team1_raw="Selangor Red Giants",
            team2_raw="Team Vamos",
            played_at=None,
            game_number_in_series=i,
        )
        insert_game(conn, game)
    conn.commit()
    return conn


def _srg_id(conn: sqlite3.Connection) -> int:
    return conn.execute(
        "SELECT id FROM teams WHERE canonical_name = 'Selangor Red Giants'"
    ).fetchone()[0]


def test_instance_count_for_a_team_is_games_played():
    conn = _conn_with_two_games()
    assert _instance_count(conn, team_id=_srg_id(conn)) == 2


def test_instance_count_for_league_is_double_the_games():
    conn = _conn_with_two_games()
    assert _instance_count(conn) == 4  # 2 games x 2 team-instances each


def test_instance_count_respects_season_filter():
    conn = _conn_with_two_games()
    assert _instance_count(conn, season="17") == 4
    assert _instance_count(conn, season="18") == 0


def test_draft_counts_combines_picks_and_bans_for_one_team():
    conn = _conn_with_two_games()
    counts = _draft_counts(conn, team_id=_srg_id(conn))
    # guinevere: picked in both games (slot 2 then slot 1) = 2
    assert counts["guinevere"] == 2
    # baxia: banned in both games = 2
    assert counts["baxia"] == 2


def test_pick_counts_excludes_bans():
    conn = _conn_with_two_games()
    counts = _pick_counts(conn, team_id=_srg_id(conn))
    assert "baxia" not in counts  # baxia was only ever banned by SRG
    assert counts["guinevere"] == 2


def test_pick_counts_role_filter_matches_only_that_slot():
    conn = _conn_with_two_games()
    # guinevere was SRG's slot-2 pick in game 1, slot-1 pick in game 2
    slot_2 = _pick_counts(conn, team_id=_srg_id(conn), role=2)
    slot_1 = _pick_counts(conn, team_id=_srg_id(conn), role=1)
    assert slot_2["guinevere"] == 1
    assert slot_1["guinevere"] == 1


from mlbb_pipeline.metrics import hhi, hhi_by_role, pick_rate_by_role, presence


def test_presence_is_picks_plus_bans_over_games_played():
    conn = _conn_with_two_games()
    srg_id = _srg_id(conn)
    rates = presence(conn, team_id=srg_id)
    # guinevere: picked twice, 2 games played -> 2/2 = 1.0
    assert rates["guinevere"] == 1.0
    # baxia: banned twice, 2 games played -> 2/2 = 1.0
    assert rates["baxia"] == 1.0
    # zhuxin: picked once (game 1 only) -> 1/2 = 0.5
    assert rates["zhuxin"] == 0.5


def test_presence_league_scope_pools_both_teams():
    conn = _conn_with_two_games()
    rates = presence(conn)  # team_id=None
    # baxia banned by SRG twice; never touched by Vamos -> 2 / (2 games x 2) = 0.5
    assert rates["baxia"] == 0.5


def test_presence_returns_empty_for_a_season_with_no_games():
    conn = _conn_with_two_games()
    assert presence(conn, season="18") == {}


def test_pick_rate_by_role_matches_slot_only():
    conn = _conn_with_two_games()
    srg_id = _srg_id(conn)
    slot_1_rates = pick_rate_by_role(conn, role=1, team_id=srg_id)
    # sora: SRG's slot-1 pick in game 1 only -> 1/2 = 0.5
    assert slot_1_rates["sora"] == 0.5
    # guinevere: SRG's slot-1 pick in game 2 only -> 1/2 = 0.5
    assert slot_1_rates["guinevere"] == 0.5


def test_hhi_is_sum_of_squared_pick_shares_picks_only():
    conn = _conn_with_two_games()
    srg_id = _srg_id(conn)
    # SRG's 10 picks across 2 games: guinevere x2 (picked both games),
    # the other 8 heroes x1 each (game 1: sora/zhuxin/granger/chou,
    # game 2: lylia/selena/karrie/atlas)
    expected = (2 / 10) ** 2 + 8 * (1 / 10) ** 2
    assert hhi(conn, team_id=srg_id) == expected


def test_hhi_by_role_is_scoped_to_that_slot_only():
    conn = _conn_with_two_games()
    srg_id = _srg_id(conn)
    # slot 2 across SRG's 2 games: guinevere (game1), lylia (game2) -> 1/2 each
    assert hhi_by_role(conn, role=2, team_id=srg_id) == 0.5


def test_hhi_returns_zero_when_no_picks_in_scope():
    conn = _conn_with_two_games()
    assert hhi(conn, season="18") == 0.0


from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
REAL_DB_PATH = REPO_ROOT / "data" / "mlbb.db"


def test_real_archive_presence_and_hhi_are_internally_consistent():
    conn = sqlite3.connect(REAL_DB_PATH)

    league_presence = presence(conn, season="17")
    # every rate is a valid fraction
    assert all(0.0 <= rate <= 1.0 for rate in league_presence.values())
    # Cross-checked against raw SQL: freya has the highest combined
    # presence in S17 (29 picks + 133 bans out of 328 team-instances =
    # 0.494), ahead of guinevere despite far fewer picks (47 vs freya's
    # 29) — she is banned almost every game. This is planning.md's whole
    # thesis in miniature: a raw pick count alone would have missed her
    # entirely, and picks-plus-bans is exactly why CLAUDE.md defines
    # presence that way rather than as a pick rate.
    assert league_presence["freya"] == max(league_presence.values())
    assert league_presence["guinevere"] > 0.4  # still clearly high, just not #1

    league_hhi = hhi(conn, season="17")
    # a valid HHI over ~80 heroes is a small positive fraction, nowhere
    # near 1.0 (that would mean one hero picked every single time)
    assert 0.0 < league_hhi < 0.2

    srg_id = conn.execute(
        "SELECT id FROM teams WHERE canonical_name = 'Selangor Red Giants'"
    ).fetchone()[0]
    srg_hhi = hhi(conn, team_id=srg_id, season="17")
    assert 0.0 < srg_hhi < 1.0
