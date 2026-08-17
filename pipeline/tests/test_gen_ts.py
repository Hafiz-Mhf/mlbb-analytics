from pathlib import Path

from mlbb_pipeline.gen_ts import generate_ts

REPO_ROOT = Path(__file__).resolve().parents[2]
TYPES_TS_PATH = REPO_ROOT / "frontend" / "src" / "lib" / "types.ts"


def test_generated_ts_matches_committed_types_ts():
    committed = TYPES_TS_PATH.read_text(encoding="utf-8")
    assert generate_ts() == committed
