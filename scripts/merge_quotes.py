#!/usr/bin/env python3
"""
Merge additional quotes into quotes.json with de-duplication.

Usage:
  python scripts/merge_quotes.py path/to/new_quotes.json --write

Input format for new quotes: JSON array of objects like
[{"text": "Quote text", "author": "Author"}, ...]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
QUOTES_PATH = ROOT / "quotes.json"


def _norm(s: str | None) -> str:
    if s is None:
        return ""
    s = str(s).strip()
    trans = str.maketrans({
        "“": '"', "”": '"', "‘": "'", "’": "'",
        "–": "-", "—": "-",
        "…": "...",
    })
    s = s.translate(trans)
    while "  " in s:
        s = s.replace("  ", " ")
    return s


def load_json_array(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f"{path} must be a JSON array")
    out: list[dict] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        text = _norm(item.get("text") or item.get("quote"))
        if not text:
            continue
        author = _norm(item.get("author"))
        out.append({"text": text, "author": author})
    return out


def dedupe(quotes: Iterable[dict]) -> list[dict]:
    seen: set[tuple[str, str]] = set()
    unique: list[dict] = []
    for q in quotes:
        text = _norm(q.get("text"))
        if not text:
            continue
        author = _norm(q.get("author"))
        key = (text.lower(), author.lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append({"text": text, "author": author})
    return unique


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Merge quotes into quotes.json with de-duplication")
    ap.add_argument("inputs", nargs="+", type=Path, help="One or more JSON files containing new quotes")
    ap.add_argument("--write", action="store_true", help="Write changes to quotes.json (otherwise dry-run)")
    ap.add_argument("--sort", action="store_true", help="Sort output by author then text")
    args = ap.parse_args(argv)

    current = load_json_array(QUOTES_PATH) if QUOTES_PATH.exists() else []
    to_merge: list[dict] = []
    for p in args.inputs:
        to_merge.extend(load_json_array(p))

    start_count = len(current)
    add_count = len(to_merge)
    merged = dedupe([*current, *to_merge])
    final_count = len(merged)
    dupes_removed = start_count + add_count - final_count

    if args.sort:
        merged.sort(key=lambda q: (q.get("author", "").lower(), q.get("text", "").lower()))

    print(f"Existing: {start_count}")
    print(f"Incoming: {add_count}")
    print(f"Duplicates removed: {dupes_removed}")
    print(f"Final: {final_count}")

    if args.write:
        tmp = QUOTES_PATH.with_suffix(".json.tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(merged, f, ensure_ascii=False, indent=2)
            f.write("\n")
        tmp.replace(QUOTES_PATH)
        print(f"Wrote {final_count} quotes to {QUOTES_PATH}")
    else:
        print("Dry run (no files written). Use --write to persist.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
