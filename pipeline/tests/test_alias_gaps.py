from pathlib import Path

from mlbb_pipeline.alias_gaps import scan_unknown_aliases

WIKI_TEXT = """
{{Matchlist|id=X|M1={{Match
    |opponent1={{TeamOpponent|Selangor Red Giants}}
    |opponent2={{TeamOpponent|Totally New Team}}
    |map1={{Map|team1side=blue|team2side=red|length=10:00|winner=1
        |t1h1=sora |t1h2=guin |t1h3=brand-new-hero |t1h4=granger |t1h5=chou
        |t2h1=phoveus |t2h2=leomord |t2h3=yve |t2h4=harith |t2h5=khaleed
        |t1b1=baxia |t1b2=valen |t1b3=kalea |t1b4=suyou |t1b5=harley
        |t2b1=freya |t2b2=marcel |t2b3=fanny |t2b4=gloo |t2b5=claude
    }}
    |map2={{Map|finished=skip
        |t1h1=another-unseen-hero
    }}
}}}}
"""


def test_scan_unknown_aliases_finds_new_hero_and_team(tmp_path: Path):
    (tmp_path / "season-17").mkdir()
    (tmp_path / "season-17" / "regular-season.wiki").write_text(
        WIKI_TEXT, encoding="utf-8"
    )

    gaps = scan_unknown_aliases(tmp_path)

    assert gaps.heroes == frozenset({"brand-new-hero"})
    assert gaps.teams == frozenset({"totally new team"})


def test_scan_unknown_aliases_ignores_known_short_forms(tmp_path: Path):
    (tmp_path / "season-17").mkdir()
    (tmp_path / "season-17" / "regular-season.wiki").write_text(
        WIKI_TEXT, encoding="utf-8"
    )

    gaps = scan_unknown_aliases(tmp_path)

    assert "guin" not in gaps.heroes
    assert "selangor red giants" not in gaps.teams


def test_scan_unknown_aliases_skips_finished_skip_maps(tmp_path: Path):
    (tmp_path / "season-17").mkdir()
    (tmp_path / "season-17" / "regular-season.wiki").write_text(
        WIKI_TEXT, encoding="utf-8"
    )

    gaps = scan_unknown_aliases(tmp_path)

    assert "another-unseen-hero" not in gaps.heroes


def test_scan_unknown_aliases_returns_empty_for_no_files(tmp_path: Path):
    gaps = scan_unknown_aliases(tmp_path)
    assert gaps.heroes == frozenset()
    assert gaps.teams == frozenset()


def test_scan_unknown_aliases_skips_unplayed_future_matches(tmp_path: Path):
    # No finished param at all — just blank fields, same as a scheduled
    # future match on the live wiki (winner="" instead of finished=skip).
    unplayed_text = """
{{Matchlist|id=Y|M1={{Match
    |opponent1={{TeamOpponent|Selangor Red Giants}}
    |opponent2={{TeamOpponent|Team Vamos}}
    |map1={{Map|team1side= |team2side= |length= |winner=
        |t1h1= |t1h2= |t1h3= |t1h4= |t1h5=
    }}
}}}}
"""
    (tmp_path / "season-18").mkdir()
    (tmp_path / "season-18" / "regular-season.wiki").write_text(
        unplayed_text, encoding="utf-8"
    )

    gaps = scan_unknown_aliases(tmp_path)

    assert gaps.heroes == frozenset()
