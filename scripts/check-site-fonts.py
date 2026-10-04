#!/usr/bin/env python3
"""Audit the committed woff2 cmap files used by the four production kits."""

from __future__ import annotations

import json
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1] / "public" / "fonts" / "sitecraft"
SYMBOLS = {ord(char) for char in "©®°±×–—€"}
KITS = {
    "screwfast": {"body": ("geist", (400, 500, 600, 700)), "heading": ("geist", (400, 500, 600, 700)), "data": ("geist-mono", (400, 500, 600, 700))},
    "landwind": {"body": ("manrope", (400, 500, 600, 700)), "heading": ("manrope", (400, 500, 600, 700)), "data": ("jetbrains-mono", (400, 500, 600, 700))},
    "forge": {"body": ("manrope", (400, 500, 600, 700)), "heading": ("sora", (700,)), "data": ("jetbrains-mono", (400, 500, 600, 700))},
    "tailwind-landing": {"body": ("geist", (400, 500, 600, 700)), "heading": ("geist", (400, 500, 600, 700)), "data": ("geist-mono", (400, 500, 600, 700))},
}


def cmap(path: Path) -> set[int]:
    font = TTFont(path)
    return {codepoint for table in font["cmap"].tables for codepoint in table.cmap}


def file_for(family: str, weight: int) -> Path:
    return ROOT / family / f"{family}-{weight}-latin.woff2"


result = {"ok": True, "kits": {}, "symbols": sorted(SYMBOLS)}
for kit, roles in KITS.items():
    role_files = {
        role: [file_for(family, weight) for weight in weights]
        for role, (family, weights) in roles.items()
    }
    files = [path for paths in role_files.values() for path in paths]
    checks = []
    for path in files:
        codepoints = cmap(path)
        checks.append({
            "file": str(path.relative_to(ROOT)),
            "has_cjk": 0x4E2D in codepoints,
            "missing_symbols": [chr(symbol) for symbol in sorted(SYMBOLS - codepoints)],
        })
    result["kits"][kit] = {
        "body": roles["body"][0],
        "heading": roles["heading"][0],
        "data": roles["data"][0],
        "files": checks,
    }
    if any(item["has_cjk"] or item["missing_symbols"] for item in checks):
        result["ok"] = False

print(json.dumps(result, ensure_ascii=False, sort_keys=True))
raise SystemExit(0 if result["ok"] else 1)
