import pytest

from mlbb_pipeline.aliases import UnknownHeroError
from mlbb_pipeline.parser import parse_map

RAW_MAP = (
    "{{Map|team1side=blue|team2side=red|length=21:59|winner=1"
    "|t1h1=sora|t1h2=guin|t1h3=zhuxin|t1h4=granger|t1h5=chou"
    "|t2h1=phoveus|t2h2=leomord|t2h3=yve|t2h4=harith|t2h5=khaleed"
    "|t1b1=baxia|t1b2=valen|t1b3=kalea|t1b4=suyou|t1b5=harley"
    "|t2b1=freya|t2b2=marcel|t2b3=fanny|t2b4=gloo|t2b5=claude}}"
)


def _kwargs(**overrides):
    base = dict(
        series_id="MPLMYS17W1_M1",
        season="17",
        stage="regular_season",
        team1_raw="Selangor Red Giants",
        team2_raw="Team Vamos",
        played_at="April 3, 2026 - 17:00",
        game_number_in_series=1,
    )
    base.update(overrides)
    return base


def test_parse_map_returns_none_for_finished_skip():
    game = parse_map("{{Map|finished=skip}}", **_kwargs())
    assert game is None


def test_parse_map_builds_match_record():
    game = parse_map(RAW_MAP, **_kwargs())
    assert game is not None
    assert game.match.team1 == "Selangor Red Giants"
    assert game.match.team1_side == "blue"
    assert game.match.winner == 1
    assert game.match.game_length == "21:59"


def test_parse_map_normalizes_hero_short_forms():
    game = parse_map(RAW_MAP, **_kwargs())
    picks = {(d.team_slot, d.slot): d.hero for d in game.drafts if not d.is_ban}
    bans = {(d.team_slot, d.slot): d.hero for d in game.drafts if d.is_ban}
    assert picks[(1, 2)] == "guinevere"
    assert bans[(1, 2)] == "valentina"
    assert len(picks) == 10
    assert len(bans) == 10


def test_parse_map_halts_on_unknown_hero():
    bad_map = RAW_MAP.replace("t1h1=sora", "t1h1=not-a-real-hero")
    with pytest.raises(UnknownHeroError):
        parse_map(bad_map, **_kwargs())
