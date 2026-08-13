from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class Team(BaseModel):
    canonical_name: str
    short_code: str | None = None


class Hero(BaseModel):
    canonical_name: str


class DraftRecord(BaseModel):
    """One pick or ban. `slot` means role (1=EXP..5=Roam) when is_ban is False,
    and ban order (not role) when is_ban is True — see database.md."""

    team_slot: Literal[1, 2]
    slot: int = Field(ge=1, le=5)
    hero: str
    is_ban: bool


class MatchRecord(BaseModel):
    """One played game. `winner`/`team_slot` refer to opponent 1 or 2 as written
    in the wikitext; resolving them to real team ids happens at DB-build time,
    outside this plan's scope."""

    series_id: str
    season: str
    stage: Literal["regular_season", "playoffs"]
    team1: str
    team2: str
    team1_side: Literal["blue", "red"]
    winner: Literal[1, 2]
    game_length: str
    game_number_in_series: int = Field(ge=1)
    played_at: str | None = None


class ParsedGame(BaseModel):
    match: MatchRecord
    drafts: list[DraftRecord]

    @field_validator("drafts")
    @classmethod
    def must_have_ten_picks_and_ten_bans(cls, v: list[DraftRecord]) -> list[DraftRecord]:
        picks = [d for d in v if not d.is_ban]
        bans = [d for d in v if d.is_ban]
        if len(picks) != 10 or len(bans) != 10:
            raise ValueError(
                f"expected 10 picks and 10 bans, got {len(picks)} picks and {len(bans)} bans"
            )
        return v
