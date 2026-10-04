# Geist

- Source: https://github.com/vercel/geist-font/tree/a0a06a3d916dcf92fe96f12051a124f89056b36a/fonts/Geist/webfonts
- Source commit: `a0a06a3d916dcf92fe96f12051a124f89056b36a`
- Copyright: Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font)
- Upstream version: 1.800
- License: SIL Open Font License 1.1 (full text in `OFL.txt`)
- Subset: Latin code points only; weights 400, 500, 600, 700
- Rebuild: `python3 scripts/subset-site-fonts.py /tmp/t087-font-src public/fonts/sitecraft --pyftsubset /opt/miniconda3/bin/pyftsubset`
- Subsetter: FontTools 4.63.0 / pyftsubset; Unicode range is the `UNICODE_RANGE` constant in `scripts/subset-site-fonts.py`; variable sources are instantiated at the listed weights before woff2 output.
- Required symbols retained: © ® ° ± × – — €; CJK is intentionally excluded.
