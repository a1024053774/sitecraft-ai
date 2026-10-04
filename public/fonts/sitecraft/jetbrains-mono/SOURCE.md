# JetBrains Mono

- Source: https://github.com/google/fonts/tree/2e05c1cf00a6e4f40a4b931600a90881c26e15cd/ofl/jetbrainsmono
- Source commit: `2e05c1cf00a6e4f40a4b931600a90881c26e15cd`
- Copyright: Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)
- Upstream version: 2.211
- License: SIL Open Font License 1.1 (full text in `OFL.txt`)
- Subset: Latin code points only; weights 400, 500, 600, 700 instantiated from the upstream variable font
- Rebuild: `python3 scripts/subset-site-fonts.py /tmp/t087-font-src public/fonts/sitecraft --pyftsubset /opt/miniconda3/bin/pyftsubset`
- Subsetter: FontTools 4.63.0 / pyftsubset; Unicode range is the `UNICODE_RANGE` constant in `scripts/subset-site-fonts.py`; variable sources are instantiated at the listed weights before woff2 output.
- Required symbols retained: © ® ° ± × – — €; CJK is intentionally excluded.
