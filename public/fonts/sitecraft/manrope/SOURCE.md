# Manrope

- Source: https://github.com/google/fonts/tree/b31870aff700ab7a1d74fa0c6887d95beb9e0037/ofl/manrope
- Source commit: `b31870aff700ab7a1d74fa0c6887d95beb9e0037`
- Copyright: Copyright 2019 The Manrope Project Authors (https://github.com/googlefonts/manrope)
- Upstream version: 4.505
- License: SIL Open Font License 1.1 (full text in `OFL.txt`)
- Subset: Latin code points only; weights 400, 500, 600, 700 instantiated from the upstream variable font
- Rebuild: `python3 scripts/subset-site-fonts.py /tmp/t087-font-src public/fonts/sitecraft --pyftsubset /opt/miniconda3/bin/pyftsubset`
- Subsetter: FontTools 4.63.0 / pyftsubset; Unicode range is the `UNICODE_RANGE` constant in `scripts/subset-site-fonts.py`; variable sources are instantiated at the listed weights before woff2 output.
- Required symbols retained: © ® ° ± × – — €; CJK is intentionally excluded.
