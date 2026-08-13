from pathlib import Path

from mlbb_pipeline.snapshot import read_snapshot, snapshot_path, write_snapshot


def test_snapshot_path_slugifies_title_segments(tmp_path: Path):
    path = snapshot_path(tmp_path, "MPL/Malaysia/Season 17/Regular Season")
    assert path == tmp_path / "mpl" / "malaysia" / "season-17" / "regular-season.wiki"


def test_write_snapshot_creates_parent_dirs_and_writes_content(tmp_path: Path):
    path = write_snapshot(tmp_path, "MPL/Malaysia/Season 17/Playoffs", "{{Matchlist}}")

    assert path == tmp_path / "mpl" / "malaysia" / "season-17" / "playoffs.wiki"
    assert path.read_text(encoding="utf-8") == "{{Matchlist}}"


def test_write_snapshot_overwrites_existing_file(tmp_path: Path):
    write_snapshot(tmp_path, "MPL/Malaysia/Season 17/Playoffs", "old content")
    write_snapshot(tmp_path, "MPL/Malaysia/Season 17/Playoffs", "new content")

    assert read_snapshot(tmp_path, "MPL/Malaysia/Season 17/Playoffs") == "new content"
