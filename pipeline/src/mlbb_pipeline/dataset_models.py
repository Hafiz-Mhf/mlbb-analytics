"""Wire-format models for frontend/src/lib/data/dataset.json.

Field names are camelCase, matching the JSON exactly, not Python
convention — these models exist purely to describe the boundary
frontend/src/lib/types.ts consumes (gen_ts.py generates that file
from these). extra="forbid" on every model so a renamed or removed
field halts the build (emit.py) rather than silently changing shape.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Stage = Literal["regular_season", "playoffs"]


class Team(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    canonicalName: str
    shortCode: str | None


class Hero(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    canonicalName: str


class MatchRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    seriesId: str
    season: str
    stage: Stage
    team1Id: int
    team2Id: int
    team1Side: Literal["blue", "red"]
    winnerId: int
    gameLength: str
    gameNumberInSeries: int
    playedAt: str | None


class DraftRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    matchId: int
    teamId: int
    slot: int = Field(
        description="role (1=EXP..5=Roam) for picks, ban order for bans — database.md"
    )
    heroId: int
    isBan: bool


class Dataset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    teams: list[Team]
    heroes: list[Hero]
    matches: list[MatchRow]
    drafts: list[DraftRow]
