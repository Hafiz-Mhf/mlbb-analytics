import pytest

from mlbb_pipeline.aliases import (
    UnknownHeroError,
    UnknownTeamError,
    known_hero_aliases,
    known_team_aliases,
    resolve_hero,
    resolve_team,
)


def test_resolve_hero_normalizes_full_name_casing():
    assert resolve_hero("Guinevere") == "guinevere"
    assert resolve_hero("Hanzo") == "hanzo"
    assert resolve_hero("Aurora") == "aurora"
    assert resolve_hero("Cecilion") == "cecilion"
    assert resolve_hero("Minotaur") == "minotaur"


def test_resolve_hero_normalizes_documented_short_forms():
    assert resolve_hero("guin") == "guinevere"
    assert resolve_hero("yz") == "yu zhong"
    assert resolve_hero("yss") == "yi sun-shin"
    assert resolve_hero("phove") == "phoveus"


def test_resolve_hero_strips_whitespace():
    assert resolve_hero("  valen  ") == "valentina"


def test_resolve_hero_unknown_string_halts():
    with pytest.raises(UnknownHeroError):
        resolve_hero("totally-not-a-hero")


def test_resolve_team_normalizes_case_variants():
    assert resolve_team("Bigetron MY by VIT") == "Bigetron MY by VIT"
    assert resolve_team("bigetron my by vit") == "Bigetron MY by VIT"
    assert resolve_team("Bigetron MY by Vit") == "Bigetron MY by VIT"


def test_resolve_team_normalizes_short_forms():
    assert resolve_team("ig") == "Invictus Gaming"
    assert resolve_team("All Combo") == "AC Esports"


def test_resolve_team_unknown_string_halts():
    with pytest.raises(UnknownTeamError):
        resolve_team("Definitely Not A Team")


def test_known_hero_aliases_contains_documented_short_forms():
    table = known_hero_aliases()
    assert table["guin"] == "guinevere"
    assert table["guinevere"] == "guinevere"


def test_known_team_aliases_contains_all_eight_teams():
    table = known_team_aliases()
    assert table["srg"] == "Selangor Red Giants"
    assert len(set(table.values())) == 8
