import pytest
from pydantic import ValidationError

from mlbb_pipeline.models import DraftRecord, MatchRecord, ParsedGame


def _match(**overrides) -> MatchRecord:
    base = dict(
        series_id="MPLMYS17W1_M1",
        season="17",
        stage="regular_season",
        team1="Selangor Red Giants",
        team2="Team Vamos",
        team1_side="blue",
        winner=1,
        game_length="21:59",
        game_number_in_series=1,
        played_at="April 3, 2026 - 17:00",
    )
    base.update(overrides)
    return MatchRecord(**base)


def _draft(team_slot: int, slot: int, hero: str, is_ban: bool) -> DraftRecord:
    return DraftRecord(team_slot=team_slot, slot=slot, hero=hero, is_ban=is_ban)


def test_draft_record_rejects_slot_out_of_range():
    with pytest.raises(ValidationError):
        DraftRecord(team_slot=1, slot=6, hero="chou", is_ban=False)


def test_parsed_game_rejects_wrong_pick_or_ban_count():
    drafts = [_draft(1, 1, "sora", False)]  # only 1 pick, 0 bans
    with pytest.raises(ValidationError, match="10 picks and 10 bans"):
        ParsedGame(match=_match(), drafts=drafts)


def test_parsed_game_accepts_ten_picks_and_ten_bans():
    drafts = [_draft(1, s, f"pick-a-{s}", False) for s in range(1, 6)]
    drafts += [_draft(2, s, f"pick-b-{s}", False) for s in range(1, 6)]
    drafts += [_draft(1, s, f"ban-a-{s}", True) for s in range(1, 6)]
    drafts += [_draft(2, s, f"ban-b-{s}", True) for s in range(1, 6)]

    game = ParsedGame(match=_match(), drafts=drafts)

    assert len(game.drafts) == 20
