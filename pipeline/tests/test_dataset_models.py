import pytest
from pydantic import ValidationError

from mlbb_pipeline.dataset_models import Dataset


VALID = {
    "teams": [{"id": 1, "canonicalName": "Selangor Red Giants", "shortCode": "SRG"}],
    "heroes": [{"id": 1, "canonicalName": "freya"}],
    "matches": [
        {
            "id": 1, "seriesId": "MPLMYS17W1_M1", "season": "17",
            "stage": "regular_season", "team1Id": 1, "team2Id": 1,
            "team1Side": "blue", "winnerId": 1, "gameLength": "21:59",
            "gameNumberInSeries": 1, "playedAt": None,
        }
    ],
    "drafts": [{"id": 1, "matchId": 1, "teamId": 1, "slot": 1, "heroId": 1, "isBan": False}],
}


def test_valid_dataset_round_trips():
    Dataset.model_validate(VALID)


def test_unknown_field_on_team_is_rejected():
    bad = {**VALID, "teams": [{**VALID["teams"][0], "extraField": "x"}]}
    with pytest.raises(ValidationError):
        Dataset.model_validate(bad)


def test_missing_field_is_rejected():
    bad = {**VALID, "matches": [{k: v for k, v in VALID["matches"][0].items() if k != "winnerId"}]}
    with pytest.raises(ValidationError):
        Dataset.model_validate(bad)


def test_bad_stage_literal_is_rejected():
    bad = {**VALID, "matches": [{**VALID["matches"][0], "stage": "grand_final"}]}
    with pytest.raises(ValidationError):
        Dataset.model_validate(bad)
