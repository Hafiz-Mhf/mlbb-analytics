import pytest

from mlbb_pipeline.aliases import UnknownHeroError, resolve_hero


def test_resolve_hero_normalizes_full_name_casing():
    assert resolve_hero("Guinevere") == "guinevere"


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
