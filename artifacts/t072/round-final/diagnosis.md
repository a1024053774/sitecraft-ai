# T-072 final recommendation evidence

This is the single six-request real DeepSeek round run after code commit `d7394f42563ed4db057a7e95c4541b0df6637208` on 2026-10-03 08:31–08:33 UTC. The command used `SITECRAFT_ENV_FILE=/Users/luckye/Documents/Code/sitecraft-ai/.env.local T072_OUTPUT_DIR=artifacts/t072/round-final node artifacts/t072/round-final/generate.mjs`. The runner stored only parsed planner JSON, card recommendations, and non-sensitive call metadata; it did not store prompts, materials, request bodies, or keys.

All six requests returned HTTP 200 and `stopped` is null. Each result contains `plannerOutput`, the parsed JSON returned by the planner. `plannerRecommendations` and `comparison.json` distinguish a field/question from a valid catalog id:

- Industrial run 1: planner supplied valid `field=style` and `field=colorSet` recommendations; the card kept engineering-industrial + graphite.
- Industrial run 2: planner supplied recommended options, but used labels such as `工程工业（engineering-industrial）` and `石墨工坊（graphite）` instead of catalog ids. The route rejected those ids; the deterministic structured-data rule kept engineering-industrial and the color card fell back to engineering-warm-orange.
- Export run 1: planner supplied recommended options with labels but no valid ids; the structured-data rule selected export-catalog and the color card fell back to porcelain.
- Export run 2: planner supplied valid engineering-industrial and graphite ids; the structured-data rule still selected export-catalog, proving the code recommendation is independent of the planner's style pick, and the card kept graphite.
- Molding runs 1 and 2: planner returned `kind=ready`, so it supplied no style or color-set recommendation. The structured-data rule selected engineering-industrial and the existing color fallback stayed warm-orange.

The final card look set contains engineering-industrial and export-catalog, and the card combinations are not all identical. The raw per-run JSON is in `recommendations.json`; `comparison.json` records whether each raw planner field and recommended option was present.
