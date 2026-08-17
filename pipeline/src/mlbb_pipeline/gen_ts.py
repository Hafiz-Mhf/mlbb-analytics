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
