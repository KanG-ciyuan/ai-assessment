# Anonymous Assessment Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After explicit start-page consent, export each completed assessment's anonymous, server-recalculated result to a dedicated Feishu Base table without delaying the report.

**Architecture:** The browser stores consent in the current assessment result and posts only consent metadata plus answers to a new Pages Function after rendering the local report. The Function validates and recalculates the result, uses D1 as an export-idempotency guard, obtains a Feishu tenant token with server-only credentials, and creates one record in the dedicated Base table.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Cloudflare Pages Functions, Cloudflare D1, Feishu Bitable OpenAPI, Node.js built-in test runner.

---

## File Structure

- `assessment-export-core.js`: builds the allowlisted, anonymous Feishu field payload from a server-calculated assessment result.
- `functions/api/assessment-events.js`: validates consent and answers, deduplicates with D1, obtains a Feishu server token and writes one Base record.
- `index.html`: adds required consent UI, persists consent metadata and sends the non-blocking export after report rendering.
- `schema.sql`: defines the D1 export-idempotency table.
- `tests/assessment-export-core.test.mjs`: tests field allowlisting and stable result mapping.
- `tests/assessment-events-api.test.mjs`: tests missing consent, duplicate IDs, Feishu failures and successful Feishu payloads.
- `.gitignore`: ignores temporary visual-brainstorm files.
- `README.md`: documents consent, exported fields, environment variables and the non-blocking behavior.

### Task 1: Create the dedicated Feishu data table

**External resource:** Existing Base `AI 能力测评 V2.1 用户反馈` (`RB9abnjZQa5NUbsOPIFceIa7nET`)

- [ ] **Step 1: Create a new table named `匿名测评数据` in the existing Base.**

Create these exact fields: `测评编号` (text), `同意时间` (datetime), `完成时间` (datetime), `题目答案` (text), `AI 理解与判断` (number), `任务表达与协作` (number), `场景应用与问题解决` (number), `工具选择与流程能力` (number), `总分` (number), `能力阶段` (select), and `测评版本` (text).

- [ ] **Step 2: Read the created table and copy the returned table ID.**

Run: `lark-cli base +table-list --base-token "RB9abnjZQa5NUbsOPIFceIa7nET" --as user`

Expected: a table named `匿名测评数据` with a real `table_id`; do not guess the ID.

- [ ] **Step 3: Record the Base token and table ID only in Cloudflare settings, not source files.**

Create production environment variables `FEISHU_BASE_TOKEN` and `FEISHU_ASSESSMENT_TABLE_ID` in the Cloudflare Pages project. Mark both as encrypted secrets.

### Task 2: Build and test the anonymous payload mapper

**Files:**
- Create: `assessment-export-core.js`
- Create: `tests/assessment-export-core.test.mjs`

- [ ] **Step 1: Write a failing mapper test.**

```js
import { buildAssessmentExport } from '../assessment-export-core.js';

const payload = buildAssessmentExport({
  assessmentId: 'assessment-test-1234',
  consentedAt: '2026-07-18T08:00:00.000Z',
  completedAt: '2026-07-18T08:05:00.000Z',
  answers: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 0, 6: 1, 7: 2, 8: 3, 9: 0, 10: 1, 11: 2, 12: 3 },
  result: calculateAssessment({ 1: 0, 2: 1, 3: 2, 4: 3, 5: 0, 6: 1, 7: 2, 8: 3, 9: 0, 10: 1, 11: 2, 12: 3 }),
});

assert.equal(payload['测评编号'], 'assessment-test-1234');
assert.equal(payload['测评版本'], 'V2.1');
assert.equal(payload['总分'], 18);
assert.equal('IP' in payload, false);
assert.equal('个性化建议' in payload, false);
```

- [ ] **Step 2: Run `node --test tests/assessment-export-core.test.mjs`; expect an import failure.**

- [ ] **Step 3: Implement `buildAssessmentExport`.**

```js
export function buildAssessmentExport({ assessmentId, consentedAt, completedAt, answers, result }) {
  return {
    '测评编号': assessmentId,
    '同意时间': consentedAt,
    '完成时间': completedAt,
    '题目答案': JSON.stringify(answers),
    'AI 理解与判断': result.dimensions.understanding.score,
    '任务表达与协作': result.dimensions.expression.score,
    '场景应用与问题解决': result.dimensions.application.score,
    '工具选择与流程能力': result.dimensions.workflow.score,
    '总分': result.total,
    '能力阶段': result.stage.name,
    '测评版本': 'V2.1',
  };
}
```

- [ ] **Step 4: Run `node --test tests/assessment-export-core.test.mjs`; expect PASS.**
- [ ] **Step 5: Commit with `git add assessment-export-core.js tests/assessment-export-core.test.mjs` and `git commit -m "feat: map anonymous assessment exports"`.**

### Task 3: Add D1 delivery guard and Pages Function

**Files:**
- Modify: `schema.sql`
- Create: `functions/api/assessment-events.js`
- Create: `tests/assessment-events-api.test.mjs`

- [ ] **Step 1: Write failing function tests for consent, duplicate and success.**

```js
assert.equal((await response.json()).code, 'CONSENT_REQUIRED');
assert.equal(response.status, 409); // existing assessment ID
assert.equal(response.status, 202); // accepted export
assert.equal(feishuRecordPayload.fields['测评版本'], 'V2.1');
assert.equal('IP' in feishuRecordPayload.fields, false);
```

Mock `fetch` for both Feishu requests and mock `env.DB` for three states: no existing ID, existing ID, and delete-after-failed-Feishu-write.

- [ ] **Step 2: Run `node --test tests/assessment-events-api.test.mjs`; expect an import failure.**

- [ ] **Step 3: Add the D1 table.**

```sql
CREATE TABLE IF NOT EXISTS assessment_export_usage (
  assessment_id TEXT PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 4: Implement the handler.**

The handler must require `FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `FEISHU_BASE_TOKEN`, `FEISHU_ASSESSMENT_TABLE_ID`, and `DB`. It must accept only a valid `assessmentId`, ISO consent time and complete answers, calculate the result on the server, reserve the ID in D1, obtain a tenant access token, and POST `{ fields: buildAssessmentExport(...) }` to the documented Feishu Bitable record endpoint. If either Feishu call fails, delete the reserved D1 ID and return `202` with `exported: false`; never expose provider error details to the browser.

- [ ] **Step 5: Run `node --test tests/assessment-events-api.test.mjs`; expect PASS.**
- [ ] **Step 6: Commit with `git add schema.sql functions/api/assessment-events.js tests/assessment-events-api.test.mjs` and `git commit -m "feat: export anonymous assessment events"`.**

### Task 4: Add required consent and non-blocking export to the browser

**Files:**
- Modify: `index.html`
- Modify: `assessment-core.js`
- Modify: `tests/assessment-core.test.mjs`

- [ ] **Step 1: Write a failing stored-result test for consent metadata.**

```js
const stored = createStoredResult(result, answers, '2026-07-18T08:05:00.000Z', 'assessment-test-1234', '2026-07-18T08:00:00.000Z');
assert.equal(stored.consentedAt, '2026-07-18T08:00:00.000Z');
```

- [ ] **Step 2: Run `node --test tests/assessment-core.test.mjs`; expect failure because the helper has no consent argument.**

- [ ] **Step 3: Add the start-page consent control and state handling.**

Insert a checkbox directly above the existing start button with the approved sentence `我已知悉并同意：本次匿名测评数据将用于改进测评。`. Style the start button's disabled state without changing the existing visual language. `goToQuiz()` must return without changing pages unless the checkbox is checked; when checked, capture `new Date().toISOString()` as the current session's consent time.

- [ ] **Step 4: Persist consent and export after report rendering.**

Extend `createStoredResult` with `consentedAt`. In `submitQuiz()`, create and store the result with that timestamp, render the report immediately, then call a new `exportAssessmentEvent(stored)` function without awaiting it. The function posts only `assessmentId`, `consentedAt`, `completedAt` and `answers` to `/api/assessment-events`; it silently returns for non-successful responses so reporting remains usable offline or when Feishu is unavailable.

- [ ] **Step 5: Run `node --test tests/assessment-core.test.mjs`; expect PASS.**
- [ ] **Step 6: Commit with `git add index.html assessment-core.js tests/assessment-core.test.mjs` and `git commit -m "feat: require consent before anonymous export"`.**

### Task 5: Configure secrets, document and verify the live flow

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`
- Test: `tests/*.test.mjs`

- [ ] **Step 1: Add `.superpowers/` to `.gitignore` to keep visual brainstorming output out of Git.**

- [ ] **Step 2: Document the consent wording, exported fields and four server-only variables.**

State explicitly that the new Base data table is for anonymous product analysis and is separate from voluntary `体验反馈` records.

- [ ] **Step 3: Run `node --test tests/*.test.mjs`; expect all tests PASS.**

- [ ] **Step 4: Add the four production secrets in Cloudflare Pages.**

Set `FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `FEISHU_BASE_TOKEN`, and `FEISHU_ASSESSMENT_TABLE_ID`. Do not enter any value in source code, test fixtures, Git history or client JavaScript.

- [ ] **Step 5: Push and perform one consented live test.**

Run: `git push origin main`

Expected: after the deployment completes, a new consented assessment renders immediately and exactly one anonymous row appears in `匿名测评数据`; an unchecked start button cannot begin a quiz.
