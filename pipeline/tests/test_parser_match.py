from mlbb_pipeline.parser import (
    parse_bracket,
    parse_match,
    parse_matchlist,
    parse_team_opponent,
    strip_date_template_suffix,
)

RAW_MATCH = (
    "{{Match|bestof=3"
    "|opponent1={{TeamOpponent|Selangor Red Giants}}"
    "|opponent2={{TeamOpponent|Team Vamos}}"
    "|date=April 3, 2026 - 17:00 {{Abbr/MYT}}"
    "|map1={{Map|team1side=blue|team2side=red|length=21:59|winner=1"
    "|t1h1=sora|t1h2=guin|t1h3=zhuxin|t1h4=granger|t1h5=chou"
    "|t2h1=phoveus|t2h2=leomord|t2h3=yve|t2h4=harith|t2h5=khaleed"
    "|t1b1=baxia|t1b2=valen|t1b3=kalea|t1b4=suyou|t1b5=harley"
    "|t2b1=freya|t2b2=marcel|t2b3=fanny|t2b4=gloo|t2b5=claude}}"
    "|map2={{Map|finished=skip}}"
    "}}"
)


def test_strip_date_template_suffix_removes_trailing_template():
    assert strip_date_template_suffix("April 3, 2026 - 17:00 {{Abbr/MYT}}") == "April 3, 2026 - 17:00"


def test_parse_team_opponent_extracts_positional_name():
    assert parse_team_opponent("{{TeamOpponent|Team Vamos}}") == "Team Vamos"


def test_parse_team_opponent_extracts_name_with_nested_substitutes():
    raw = "{{TeamOpponent|Selangor Red Giants|substitutes={{PlayerSubstitutions|{{Substitution|in=Unii|out=Sekys}}}}}}"
    assert parse_team_opponent(raw) == "Selangor Red Giants"


def test_parse_match_returns_only_played_games():
    games = parse_match(RAW_MATCH, series_id="MPLMYS17W1_M1", season="17", stage="regular_season")
    assert len(games) == 1
    assert games[0].match.team1 == "Selangor Red Giants"
    assert games[0].match.team2 == "Team Vamos"
    assert games[0].match.played_at == "April 3, 2026 - 17:00"
    assert games[0].match.game_number_in_series == 1


def test_parse_matchlist_builds_series_id_from_matchlist_id_and_key():
    # M1's value is the full RAW_MATCH template, wrapped in a Matchlist.
    text = "{{Matchlist|id=MPLMYS17W1|title=Week 1|M1=" + RAW_MATCH + "}}"
    games = parse_matchlist(text, season="17", stage="regular_season")
    assert len(games) == 1
    assert games[0].match.series_id == "MPLMYS17W1_M1"


def test_parse_bracket_builds_series_id_from_round_and_match_keys():
    # Playoffs pages use {{Bracket|...}} with R{round}M{match} keys instead
    # of {{Matchlist|...}}'s M{n} keys — same {{Match}} bodies inside.
    text = "{{Bracket|Bracket/4L2DSU2L1D|id=MPLMYS17PL|R1M1=" + RAW_MATCH + "}}"
    games = parse_bracket(text, season="17", stage="playoffs")
    assert len(games) == 1
    assert games[0].match.series_id == "MPLMYS17PL_R1M1"
    assert games[0].match.stage == "playoffs"
