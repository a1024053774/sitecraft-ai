# Workspace AI Refinement Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that AI refinement preserves draft integrity across localized edits, exact targets, destructive confirmation, conflicts, history, provider failure and invisible template slots, then fix the confirmed destructive-request parity gap.

**Architecture:** Keep `site-operations.ts` as the authoritative mutation boundary and `site-store.ts` as the revision/history transaction boundary. Exercise observable behavior through existing Node tests and Playwright workspace flows; make the destructive-confirmation client path use the same HTTP conflict adoption and timeout semantics as the normal chat path.

**Tech Stack:** Next.js 16.3.1 App Router, React 19, TypeScript, Node test runner, Playwright.

## Global Constraints

- Do not modify `app/generate/page.tsx`, template vendor snapshots, `lib/template-static.ts`, or `.project-to-act`.
- Preserve existing project structure and user changes; do not commit or revert unrelated work.
- Every defect fix must have a failing regression test before implementation.
- All generated artifacts remain on `D:`.

---

## Test Matrix

| Scenario | Boundary | Expected result | Coverage |
|---|---|---|---|
| Edit hero | operation + workspace | only requested Hero target changes; revision +1 | existing unit/E2E |
| English only | validation + workspace | English changes; Chinese remains byte-for-byte equal | existing unit/E2E |
| Exact section/card | selected target + operation | only exact card/slot changes | existing unit + slot tests |
| Product field | operation + undo | requested SKU field changes and inverse restores it | add focused unit characterization if absent |
| Unauthorized template switch | validation | switch rejected unless explicitly requested | existing unit |
| Concurrent revision conflict | store + workspace | newer snapshot adopted; stale operation never overwrites | existing server path; add destructive-confirm E2E RED |
| Undo restore | history transaction | content and revision move to reversible state; redo available | existing E2E |
| AI failure | workspace | draft/history unchanged; busy state released; useful error | existing client branch; adversarial E2E when feasible |
| AI timeout | normal + confirmed request | request aborted; draft/history unchanged; retry enabled | normal implemented; fix confirmed path |
| Invisible slot | slot preflight + workspace | clarification shown; draft/history unchanged | existing unit/server path |

### Task 1: Characterize the confirmed-destructive conflict bug

**Files:**
- Modify: `e2e/specs/workspace.spec.ts`
- Reuse: `e2e/helpers/api.ts`

**Interfaces:**
- Consumes: `PUT /api/sites/:siteId/draft`, `POST /api/sites/:siteId/chat` SSE contract.
- Produces: a Playwright regression proving a 409 returned after confirmation adopts the latest server draft and releases the input.

- [x] **Step 1: Write the failing test**

Intercept the first chat request with `need_confirmation`; commit a concurrent company-name edit through the real draft API; return the real latest snapshot with HTTP 409 on the confirmed request. Assert the latest company name is visible, the server message is shown, the send control is enabled, and the stale template operation was not applied.

- [x] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/specs/workspace.spec.ts --project=chromium --grep "确认期间 revision 冲突"`

Expected: FAIL because the current confirmed path tries to parse JSON as SSE and reports “模型没有返回完成事件” without adopting the snapshot.

### Task 2: Give confirmed requests HTTP and timeout parity

**Files:**
- Modify: `app/workspace/page.tsx`
- Test: `e2e/specs/workspace.spec.ts`

**Interfaces:**
- Consumes: `DraftSnapshot`, `adoptSnapshot`, `CHAT_TIMEOUT_MS`, `chatAbortRef`.
- Produces: confirmed destructive requests that abort at the same deadline and handle non-2xx snapshots exactly like normal chat requests.

- [x] **Step 1: Implement the minimal client fix**

Create an `AbortController` and deadline around the confirmed fetch, set/clear `chatAbortRef`, check `response.ok` before opening the SSE reader, adopt `payload.draft` when present, and use the same revision-conflict message and timeout copy as `submitChat`.

- [x] **Step 2: Run the conflict test to verify GREEN**

Run the same focused Playwright command. Expected: `1 passed`.

### Task 3: Verify the refinement matrix

**Files:**
- Test: `tests/site-operations.test.ts`
- Test: `tests/template-slot-guard.test.ts`
- Test: `e2e/specs/workspace.spec.ts`

**Interfaces:**
- Consumes: existing test suites.
- Produces: fresh pass/fail evidence and an explicit coverage-gap report.

- [x] **Step 1: Run focused unit suites**

Run: `node --test --experimental-strip-types tests/site-operations.test.ts tests/template-slot-guard.test.ts`

- [x] **Step 2: Run workspace E2E**

Run: `npx playwright test e2e/specs/workspace.spec.ts --project=chromium`

- [x] **Step 3: Run static gates**

Run: `npm run typecheck` and `git diff --check -- app/workspace/page.tsx e2e/specs/workspace.spec.ts`.

- [x] **Step 4: Report residual gaps**

Report AI timeout as deterministic client behavior if no fake-clock E2E is added; do not claim real-provider latency coverage from mocked tests.
