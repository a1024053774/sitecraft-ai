# Sora

- Source: https://github.com/google/fonts/tree/69109d1f48319d1d474a8d2f70018efc2346a3a7/ofl/sora
- Source commit: `69109d1f48319d1d474a8d2f70018efc2346a3a7`
- Copyright: Copyright 2019 The Sora Project Authors (https://github.com/sora-xor/sora-font)
- Upstream version: 2.000
- License: SIL Open Font License 1.1 (full text in `OFL.txt`)
- Subset: Latin code points only; weight 700 instantiated from the upstream variable font
- Rebuild: `python3 scripts/subset-site-fonts.py /tmp/t087-font-src public/fonts/sitecraft --pyftsubset /opt/miniconda3/bin/pyftsubset`
- Subsetter: FontTools 4.63.0 / pyftsubset; Unicode range is the `UNICODE_RANGE` constant in `scripts/subset-site-fonts.py`; variable sources are instantiated at the listed weights before woff2 output.
- Required symbols retained: © ® ° ± × – — €; CJK is intentionally excluded.
