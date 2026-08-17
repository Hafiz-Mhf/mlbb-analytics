# Generated TypeScript Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `frontend/src/lib/types.ts` a generated artifact of Pydantic models in the pipeline, so a field rename in Python breaks the build instead of silently rendering `undefined` in the frontend.

**Architecture:** Add a `dataset_models.py` module defining Pydantic models that mirror the wire-format JSON exactly (camelCase field names, `extra="forbid"`). Wire `emit.py` to validate the assembled dict against `Dataset.model_validate(...)` before writing JSON — a shape mismatch now raises and halts the build, per stack.md's "a failed validation never publishes" rule. Add a small custom TS generator (`gen_ts.py`) that introspects those same models and produces `types.ts` — no new npm dependency, since the four models are simple (str/int/bool/Literal/list) and a generic `json-schema-to-typescript` pipeline would be more machinery than the problem needs, one line stack.md's own philosophy elsewhere ("no chart library... add one only when demonstrably needed"). A pytest test asserts the generated output equals the committed `frontend/src/lib/types.ts` byte-for-byte, so a model change without regenerating fails CI (once GH Actions exists) or `pytest` (today).

**Tech Stack:** Python 3.12, Pydantic 2.7+, pytest. No new dependencies.

**Spec:** `docs/stack.md` (the "Type safety across the boundary" row) and `docs/roadmap.md` line 35.

## Global Constraints

- JSON field names stay camelCase (frontend convention, already established by `emit.py`).
- `extra="forbid"` on every wire model — an unexpected key must halt, not pass through silently.
- No new runtime or dev dependency — pyproject.toml and package.json stay as they are.
- Renaming `MockDataset` → `Dataset` is in scope: the "Mock" name is stale now that `src/lib/mock/` is deleted (current-context.md), and `types.ts` is being fully regenerated anyway in this plan.

---

## File Structure

- Create: `pipeline/src/mlbb_pipeline/dataset_models.py` — `Team`, `Hero`, `MatchRow`, `DraftRow`, `Dataset` Pydantic models mirroring the JSON wire format.
- Create: `pipeline/src/mlbb_pipeline/gen_ts.py` — introspects those models, returns the `types.ts` file content as a string; CLI entry point writes it to disk.
- Modify: `pipeline/src/mlbb_pipeline/emit.py` — validate the assembled dict against `Dataset` before `write_dataset` serializes it.
- Modify: `pipeline/pyproject.toml` — add `mlbb-gen-types` script entry.
- Modify: `frontend/src/lib/types.ts` — regenerated content (rename `MockDataset` → `Dataset`).
- Modify: `frontend/src/lib/data.ts` — update the `MockDataset` import to `Dataset`.
- Test: `pipeline/tests/test_dataset_models.py` — validation behavior (rejects unknown/missing fields).
- Test: `pipeline/tests/test_gen_ts.py` — generated string matches the committed `frontend/src/lib/types.ts` exactly.
- Test: `pipeline/tests/test_emit.py` — extend with a case proving a broken dict now raises instead of writing.

## Task 1: Wire-format Pydantic models

**Files:**
- Create: `pipeline/src/mlbb_pipeline/dataset_models.py`
- Test: `pipeline/tests/test_dataset_models.py`

**Interfaces:**
- Produces: `Team`, `Hero`, `MatchRow`, `DraftRow`, `Dataset` — Pydantic `BaseModel` subclasses, camelCase field names matching `frontend/src/lib/types.ts` field-for-field, each with `model_config = ConfigDict(extra="forbid")`.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_dataset_models.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && uv run pytest tests/test_dataset_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'mlbb_pipeline.dataset_models'`

- [ ] **Step 3: Write the models**

```python
# pipeline/src/mlbb_pipeline/dataset_models.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pipeline && uv run pytest tests/test_dataset_models.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/dataset_models.py pipeline/tests/test_dataset_models.py
git commit -m "feat: add wire-format Pydantic models mirroring dataset.json"
```

## Task 2: Validate emit output against the model

**Files:**
- Modify: `pipeline/src/mlbb_pipeline/emit.py`
- Test: `pipeline/tests/test_emit.py`

**Interfaces:**
- Consumes: `Dataset` from Task 1 (`mlbb_pipeline.dataset_models`).
- Produces: `dataset_from_db(conn)` now raises `pydantic.ValidationError` if the assembled dict doesn't match `Dataset` — same public signature and return value as before for valid input, so `build.py` needs no change.

- [ ] **Step 1: Write the failing test**

Add to `pipeline/tests/test_emit.py`:

```python
import pytest
from pydantic import ValidationError


def test_dataset_from_db_raises_on_schema_break(monkeypatch):
    conn = _conn_with_one_game()

    import mlbb_pipeline.emit as emit_module

    original = emit_module.dataset_from_db

    def broken(conn):
        d = original(conn)
        d["teams"][0]["extraField"] = "unexpected"
        return d

    # Simulate a field rename by validating a deliberately-broken dict
    # the same way dataset_from_db does internally.
    from mlbb_pipeline.dataset_models import Dataset

    broken_dict = broken(conn)
    with pytest.raises(ValidationError):
        Dataset.model_validate(broken_dict)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && uv run pytest tests/test_emit.py -v -k schema_break`
Expected: This particular test actually already passes (it validates the model directly, not through `dataset_from_db`) — it's a characterization test for Task 1's model, not Task 2's wiring. The real check for Task 2 is Step 4 below: confirm `dataset_from_db` itself now validates.

- [ ] **Step 3: Wire validation into emit.py**

```python
# pipeline/src/mlbb_pipeline/emit.py — add import and one line
from .dataset_models import Dataset

# ... inside dataset_from_db, replace the final `return {...}` with:
    dataset = {"teams": teams, "heroes": heroes, "matches": matches, "drafts": drafts}
    Dataset.model_validate(dataset)  # raises on shape mismatch — halts the build (stack.md)
    return dataset
```

- [ ] **Step 4: Run the full emit test file to verify nothing regressed**

Run: `cd pipeline && uv run pytest tests/test_emit.py -v`
Expected: PASS, all tests including the three pre-existing ones (`test_dataset_from_db_has_all_four_tables`, `test_dataset_from_db_uses_camelcase_field_names_matching_types_ts`, `test_write_dataset_writes_valid_json`)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/mlbb_pipeline/emit.py pipeline/tests/test_emit.py
git commit -m "feat: validate emitted dataset against wire-format models before write"
```

## Task 3: TypeScript generator

**Files:**
- Create: `pipeline/src/mlbb_pipeline/gen_ts.py`
- Modify: `pipeline/pyproject.toml`
- Test: `pipeline/tests/test_gen_ts.py`

**Interfaces:**
- Consumes: `Team`, `Hero`, `MatchRow`, `DraftRow`, `Dataset`, `Stage` from `mlbb_pipeline.dataset_models` (Task 1).
- Produces: `generate_ts() -> str` — the full `types.ts` file content. `main(argv)` CLI entry writing it to `frontend/src/lib/types.ts` (default path, overridable via `--out`).

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_gen_ts.py
from pathlib import Path

from mlbb_pipeline.gen_ts import generate_ts

REPO_ROOT = Path(__file__).resolve().parents[2]
TYPES_TS_PATH = REPO_ROOT / "frontend" / "src" / "lib" / "types.ts"


def test_generated_ts_matches_committed_types_ts():
    committed = TYPES_TS_PATH.read_text(encoding="utf-8")
    assert generate_ts() == committed
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && uv run pytest tests/test_gen_ts.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mlbb_pipeline.gen_ts'`

- [ ] **Step 3: Write the generator**

```python
# pipeline/src/mlbb_pipeline/gen_ts.py
"""Generates frontend/src/lib/types.ts from the wire-format Pydantic
models in dataset_models.py. Run `mlbb-gen-types` after any change to
those models — test_gen_ts.py fails CI if the committed types.ts falls
out of sync, per stack.md: 'a field rename breaks the frontend build
instead of rendering undefined'."""
from __future__ import annotations

import argparse
import types
import typing
from pathlib import Path

from pydantic.fields import FieldInfo

from .dataset_models import Dataset, DraftRow, Hero, MatchRow, Stage, Team

# Order matches the committed file. Dataset's own field list drives the
# order of the interfaces that reference it; these five cover every
# model in dataset_models.py.
_MODELS = [Team, Hero, MatchRow, DraftRow, Dataset]

_PRIMITIVES = {str: "string", int: "number", bool: "boolean"}


def _ts_type(annotation: object, field_name: str) -> str:
    if field_name == "stage":
        return "Stage"

    origin = typing.get_origin(annotation)

    if origin is typing.Literal:
        options = typing.get_args(annotation)
        return " | ".join(f"'{o}'" for o in options)

    if origin in (typing.Union, types.UnionType):
        args = [a for a in typing.get_args(annotation) if a is not type(None)]
        assert len(args) == 1, f"only Optional[T] unions are supported, got {annotation}"
        return f"{_ts_type(args[0], field_name)} | null"

    if origin is list:
        (item,) = typing.get_args(annotation)
        return f"{item.__name__}[]"

    if annotation in _PRIMITIVES:
        return _PRIMITIVES[annotation]

    raise TypeError(f"no TS mapping for annotation {annotation!r} on field {field_name!r}")


def _interface(model: type) -> str:
    lines = [f"export interface {model.__name__} {{"]
    for name, field in model.model_fields.items():
        ts_type = _ts_type(field.annotation, name)
        comment = f" // {field.description}" if field.description else ""
        lines.append(f"\t{name}: {ts_type};{comment}")
    lines.append("}")
    return "\n".join(lines)


def generate_ts() -> str:
    stage_options = " | ".join(f"'{o}'" for o in typing.get_args(Stage))
    parts = [f"export type Stage = {stage_options};"]
    parts += [_interface(m) for m in _MODELS]
    return "\n\n".join(parts) + "\n"


DEFAULT_OUT_PATH = (
    Path(__file__).resolve().parents[3] / "frontend" / "src" / "lib" / "types.ts"
)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Generate frontend/src/lib/types.ts from dataset_models.py."
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_PATH)
    args = parser.parse_args(argv)
    args.out.write_text(generate_ts(), encoding="utf-8")
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Add the CLI entry point**

```toml
# pipeline/pyproject.toml — inside [project.scripts]
mlbb-gen-types = "mlbb_pipeline.gen_ts:main"
```

- [ ] **Step 5: Run test to verify it fails (expected — types.ts not yet regenerated)**

Run: `cd pipeline && uv run pytest tests/test_gen_ts.py -v`
Expected: FAIL — generated string won't match the current hand-authored `types.ts` yet (different formatting, and `MockDataset` vs `Dataset`). This is expected; Task 4 regenerates the committed file to match.

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/mlbb_pipeline/gen_ts.py pipeline/pyproject.toml pipeline/tests/test_gen_ts.py
git commit -m "feat: add TS generator for frontend/src/lib/types.ts"
```

## Task 4: Regenerate types.ts, rename MockDataset -> Dataset

**Files:**
- Modify: `frontend/src/lib/types.ts` (fully regenerated, not hand-edited)
- Modify: `frontend/src/lib/data.ts`

**Interfaces:**
- Consumes: `generate_ts()` from Task 3.
- Produces: `frontend/src/lib/types.ts` now generated content; `Dataset` is the exported name frontend code imports (previously `MockDataset`).

- [ ] **Step 1: Generate the file**

Run: `cd pipeline && uv run mlbb-gen-types`
Expected output: `wrote <repo>/frontend/src/lib/types.ts`

- [ ] **Step 2: Update the one frontend import site**

```typescript
// frontend/src/lib/data.ts
import dataset from './data/dataset.json';
import type { Dataset } from './types';

export const mockDataset = dataset as Dataset;
export const generatedAt = new Date().toISOString();
```

(Only the type import and cast change — `mockDataset` as an exported name and the `generatedAt` TODO are unrelated to this plan and stay as-is.)

- [ ] **Step 3: Confirm no other reference to MockDataset remains**

Run: `cd frontend && grep -rn "MockDataset" src`
Expected: no matches

- [ ] **Step 4: Run pipeline tests**

Run: `cd pipeline && uv run pytest -v`
Expected: PASS, all tests including `test_gen_ts.py::test_generated_ts_matches_committed_types_ts`

- [ ] **Step 5: Run frontend tests and typecheck**

Run: `cd frontend && npm run check && npx vitest run`
Expected: PASS — `Dataset` type resolves, no `MockDataset` reference left to break the typecheck

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/data.ts
git commit -m "chore: regenerate types.ts from Pydantic models, rename MockDataset to Dataset"
```

---

## Self-Review Notes

**Spec coverage:** stack.md's row ("Pydantic models → generated TypeScript types... a field rename breaks the frontend build instead of rendering undefined") is covered two ways: (1) `emit.py` now validates against the model at build time (Python-side halt), and (2) `test_gen_ts.py` fails if `dataset_models.py` and the committed `types.ts` diverge (catches a model change that wasn't followed by regeneration). roadmap.md line 35 ("Generated TypeScript types from the Pydantic models") — done by Task 3/4.

**Out of scope, deliberately:** wiring `mlbb-gen-types` into the `mlbb-build` CLI or CI. Types change only when `dataset_models.py` changes, not every weekly data refresh — folding it into every build would create noise commits. GitHub Actions cron (roadmap.md's next item, item 8) is a separate plan; when it's written, it should run `pytest` (which will catch model/types.ts drift via `test_gen_ts.py`) rather than blindly regenerating and committing.

**Type consistency check:** `Dataset.model_validate` in Task 2 matches the `Dataset` class defined in Task 1. `generate_ts()` in Task 3 imports the exact five names (`Team, Hero, MatchRow, DraftRow, Dataset, Stage`) defined in Task 1 — no drift between tasks.
