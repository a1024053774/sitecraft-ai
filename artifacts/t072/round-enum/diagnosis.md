# T-072 enum recommendation evidence

This is the single real DeepSeek round run after code commit `87bc3a79f79d0af9cf15554a76163a7b5fe2f2d1` on 2026-10-03 09:23–09:25 UTC:

`SITECRAFT_ENV_FILE=/Users/luckye/Documents/Code/sitecraft-ai/.env.local T072_OUTPUT_DIR=artifacts/t072/round-enum node artifacts/t072/round-enum/generate.mjs`

The runner made six top-level requests (two per pack), all HTTP 200, with `stopped: null`. Every result records the parsed planner JSON under `plannerOutput`, the top-level structured `recommendation` under `plannerRecommendation`, the final card choice, and the corresponding commit SHA. No prompt, materials body, request body, or key is stored.

All six planner outputs obeyed the new contract: `enumFailures=0`. Industrial returned `kind=ready` twice with engineering-industrial + graphite; export returned one `question` and one `ready`, both with engineering-industrial + turquoise; molding returned `kind=ready` twice with engineering-industrial + graphite. The code-level b rule still chose export-catalog for the structured export draft, so the final card differs from the planner style recommendation while preserving the planner color recommendation and reason.

The earlier label-shaped and missing-recommendation cases are covered by `tests/alignment-recommendation-schema-t072.test.ts`: the schema rejects them, the existing retry budget is used, and the chat route returns HTTP 502 with `invalid_output` and the message that the style/color recommendation format is invalid. The service does not guess IDs or silently choose a default for a schema-invalid planner response.
