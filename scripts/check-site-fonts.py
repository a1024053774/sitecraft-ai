#!/usr/bin/env python3
"""Audit the committed woff2 cmap files used by the four production kits."""

from __future__ import annotations

import json
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1] / "public" / "fonts" / "sitecraft"
SYMBOLS = {ord(char) for char in "©®°±×–—€"}
KITS = {
    "screwfast": ("geist", "geist-mono", (400, 500, 600, 700)),
    "landwind": ("manrope", "jetbrains-mono", (400, 500, 600, 700)),
    "forge": ("manrope", "jetbrains-mono", (400, 500, 600, 700)),
    "tailwind-landing": ("geist", "geist-mono", (400, 500, 600, 700)),
}


def cmap(path: Path) -> set[int]:
    font = TTFont(path)
    return {codepoint for table in font["cmap"].tables for codepoint in table.cmap}


def file_for(family: str, weight: int) -> Path:
    return ROOT / family / f"{family}-{weight}-latin.woff2"


result = {"ok": True, "kits": {}, "symbols": sorted(SYMBOLS)}
for kit, (body, data, weights) in KITS.items():
    body_files = [file_for(body, weight) for weight in weights]
    data_files = [file_for(data, weight) for weight in weights]
    files = body_files + data_files
    checks = []
    for path in files:
        codepoints = cmap(path)
        checks.append({
            "file": str(path.relative_to(ROOT)),
            "has_cjk": 0x4E2D in codepoints,
            "missing_symbols": [chr(symbol) for symbol in sorted(SYMBOLS - codepoints)],
        })
    result["kits"][kit] = {"body": body, "data": data, "files": checks}
    if any(item["has_cjk"] or item["missing_symbols"] for item in checks):
        result["ok"] = False

print(json.dumps(result, ensure_ascii=False, sort_keys=True))
raise SystemExit(0 if result["ok"] else 1)
