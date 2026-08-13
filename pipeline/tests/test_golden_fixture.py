from pathlib import Path

from mlbb_pipeline.parser import parse_matchlist

FIXTURE = Path(__file__).parent / "fixtures" / "s17_w1_sample.wiki"


def test_parses_fixture_into_one_played_game_with_normalized_drafts():
    text = FIXTURE.read_text(encoding="utf-8")
    games = parse_matchlist(text, season="17", stage="regular_season")

    assert len(games) == 1
    game = games[0]

    assert game.match.series_id == "MPLMYS17W1_M1"
    assert game.match.team1 == "Selangor Red Giants"
    assert game.match.team2 == "Team Vamos"
    assert game.match.team1_side == "blue"
    assert game.match.winner == 1
    assert game.match.game_length == "21:59"
    assert game.match.game_number_in_series == 1
    assert game.match.played_at == "April 3, 2026 - 17:00"

    picks = {(d.team_slot, d.slot): d.hero for d in game.drafts if not d.is_ban}
    bans = {(d.team_slot, d.slot): d.hero for d in game.drafts if d.is_ban}

    assert picks[(1, 1)] == "sora"
    assert picks[(1, 2)] == "guinevere"  # normalized from short form 'guin'
    assert picks[(2, 3)] == "yve"
    assert bans[(1, 2)] == "valentina"   # normalized from short form 'valen'
    assert bans[(2, 5)] == "claude"
    assert len(picks) == 10
    assert len(bans) == 10


def test_finished_skip_maps_are_filtered_out():
    text = FIXTURE.read_text(encoding="utf-8")
    games = parse_matchlist(text, season="17", stage="regular_season")
    # map2 and map3 in the fixture are finished=skip; only map1 should surface.
    assert all(g.match.game_number_in_series == 1 for g in games)
