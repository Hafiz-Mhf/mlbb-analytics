from mlbb_pipeline.parser import (
    find_matching_close,
    find_template_calls,
    params_dict,
    split_top_level,
    strip_comments,
)


def test_find_matching_close_handles_nesting():
    text = "{{Outer|a={{Inner|b=1}}|c=2}}"
    open_idx = text.index("{{Outer")
    close_idx = find_matching_close(text, open_idx)
    assert text[close_idx] == "}"
    assert text[open_idx:close_idx + 1] == text  # whole string is one template


def test_split_top_level_ignores_pipes_inside_nested_braces():
    body = "a=1|b={{Inner|x=1|y=2}}|c=3"
    assert split_top_level(body) == ["a=1", "b={{Inner|x=1|y=2}}", "c=3"]


def test_params_dict_ignores_positional_parts():
    parts = ["Team Name", "a=1", "b=2"]
    assert params_dict(parts) == {"a": "1", "b": "2"}


def test_find_template_calls_extracts_nested_body():
    text = "prefix {{TeamOpponent|Selangor Red Giants|substitutes={{PlayerSubstitutions|{{Substitution|in=Unii|out=Sekys}}}}}} suffix"
    bodies = find_template_calls(text, "TeamOpponent")
    assert len(bodies) == 1
    assert bodies[0].startswith("Selangor Red Giants")
    assert "PlayerSubstitutions" in bodies[0]


def test_find_template_calls_returns_multiple_in_order():
    text = "{{Map|winner=1}} and {{Map|winner=2}}"
    bodies = find_template_calls(text, "Map")
    assert bodies == ["winner=1", "winner=2"]


def test_strip_comments_removes_html_comments():
    text = "a=1 <!-- Hero picks --> |b=2"
    assert strip_comments(text) == "a=1  |b=2"
