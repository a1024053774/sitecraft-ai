#!/usr/bin/env python3
"""Rebuild the first-party Latin font assets from the audited upstream downloads.

Inputs are the files written by artifacts/t087/fetch-fonts.sh.  This script deliberately
does not download anything: source provenance stays in each font directory's SOURCE.md.
The output is a fixed set of static woff2 instances used by lib/site-fonts.ts.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path
from tempfile import NamedTemporaryFile

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

UNICODE_RANGE = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,"
    "U+2212,U+2215,U+FEFF,U+FFFD"
)
WEIGHTS = (400, 500, 600, 700)
STATIC_FILES = {
    "geist": ("geist", ("Geist-Regular.woff2", "Geist-Medium.woff2", "Geist-SemiBold.woff2", "Geist-Bold.woff2")),
    "geist-mono": ("geist-mono", ("GeistMono-Regular.woff2", "GeistMono-Medium.woff2", "GeistMono-SemiBold.woff2", "GeistMono-Bold.woff2")),
}
VARIABLE_FILES = {
    "manrope": "Manrope.ttf",
    "jetbrains-mono": "JetBrainsMono.ttf",
}


def subset(pyftsubset: str, source: Path, output: Path, weight: int | None = None) -> None:
    temporary: Path | None = None
    input_path = source
    if weight is not None:
        font = instantiateVariableFont(TTFont(source), {"wght": weight}, inplace=False)
        with NamedTemporaryFile(suffix=".ttf", dir="/tmp", delete=False) as handle:
            temporary = Path(handle.name)
        font.save(temporary)
        input_path = temporary
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            pyftsubset,
            str(input_path),
            f"--output-file={output}",
            "--flavor=woff2",
            f"--unicodes={UNICODE_RANGE}",
            "--layout-features=*",
            "--name-IDs=*",
            "--drop-tables+=DSIG",
        ],
        check=True,
    )
    if temporary:
        temporary.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="directory produced by fetch-fonts.sh")
    parser.add_argument("output", type=Path, help="public/fonts/sitecraft")
    parser.add_argument("--pyftsubset", default="pyftsubset")
    args = parser.parse_args()
    print(f"fontTools subset command; unicode range={UNICODE_RANGE}; weights={WEIGHTS}")
    for family, (stem, names) in STATIC_FILES.items():
        # Keep this recipe runnable with the project's minimum Python 3.9; zip(strict=...) arrived in 3.10.
        if len(WEIGHTS) != len(names):
            raise ValueError(f"weight/file count mismatch for {family}")
        for weight, name in zip(WEIGHTS, names):
            subset(args.pyftsubset, args.source / family / name, args.output / family / f"{stem}-{weight}-latin.woff2")
    for family, name in VARIABLE_FILES.items():
        for weight in WEIGHTS:
            subset(args.pyftsubset, args.source / family / name, args.output / family / f"{family}-{weight}-latin.woff2", weight)
    subset(args.pyftsubset, args.source / "sora" / "Sora.ttf", args.output / "sora" / "sora-700-latin.woff2", 700)


if __name__ == "__main__":
    main()
