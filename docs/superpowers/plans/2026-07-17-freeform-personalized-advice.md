# Freeform Personalized Advice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return and display high-quality freeform personalized AI advice without rigid JSON, length, or model-output limits.

**Architecture:** The Pages Function will accept any non-empty model text while retaining the D1 usage guard. The browser will convert a small, escaped Markdown subset into DOM nodes, allowing headings, lists, bold text and line breaks without allowing raw HTML execution.

**Tech Stack:** Cloudflare Pages Functions, D1, browser DOM APIs, Node.js built-in test runner.

---

## File Structure

- `personalized-advice-core.js`: complete-answer validation and freeform, fact-bound prompt.
- `functions/api/personalized-advice.js`: unrestricted DeepSeek request and non-empty text validation.
- `index.html`: safe Markdown rendering and localStorage persistence.
- `tests/personalized-advice-core.test.mjs`: core prompt and response-validation coverage.
- `tests/personalized-advice-api.test.mjs`: request payload and freeform API coverage.
- `README.md`: current architecture description.

### Task 1: Replace strict JSON validation

**Files:**
- Modify: `personalized-advice-core.js`
- Modify: `tests/personalized-advice-core.test.mjs`

- [ ] **Step 1: Write failing tests for a natural response and a blank response.**

```js
import { validatePersonalizedAdvice } from '../personalized-advice-core.js';
assert.equal(validatePersonalizedAdvice('## 今天先做什么\n\n用 AI 整理一次真实会议记录。'), '## 今天先做什么\n\n用 AI 整理一次真实会议记录。');
assert.throws(() => validatePersonalizedAdvice('   '));
```

- [ ] **Step 2: Run `node --test tests/personalized-advice-core.test.mjs`; expect a missing-export failure.**

- [ ] **Step 3: Add the minimal validator and replace the prompt contract.**

```js
export function validatePersonalizedAdvice(content) {
  if (typeof content !== 'string' || !content.trim()) throw new Error('invalid personalized advice response');
  return content.trim();
}
```

The new Chinese prompt must contain only computed assessment facts, request practical analysis and next actions, allow natural Markdown, and prescribe no fields, counts, or output length.

- [ ] **Step 4: Run `node --test tests/personalized-advice-core.test.mjs`; expect PASS.**
- [ ] **Step 5: Commit with `git add personalized-advice-core.js tests/personalized-advice-core.test.mjs` and `git commit -m "feat: accept freeform personalized advice"`.**

### Task 2: Remove model format and token restrictions

**Files:**
- Modify: `functions/api/personalized-advice.js`
- Modify: `tests/personalized-advice-api.test.mjs`

- [ ] **Step 1: Write failing API assertions.**

```js
assert.equal('thinking' in requestPayload, false);
assert.equal('response_format' in requestPayload, false);
assert.equal('max_tokens' in requestPayload, false);
assert.deepEqual(await response.json(), { success: true, advice: '## 建议\n\n先完成一次真实任务。' });
```

Mock a `200` model response with the example text and assert that a successful call writes one D1 usage row.

- [ ] **Step 2: Run `node --test tests/personalized-advice-api.test.mjs`; expect current JSON assumptions to fail.**

- [ ] **Step 3: Implement the Pages Function update.**

```js
const content = modelData.choices?.[0]?.message?.content || '';
try { advice = validatePersonalizedAdvice(content); }
catch { throw new ModelFailure('MODEL_RESPONSE_EMPTY', { stage: 'content', model }); }
```

Import the new validator, remove JSON parser/diagnostic helpers, and send only `model`, `messages`, and `temperature`. Keep the D1 checks and insert usage only after a non-empty response.

- [ ] **Step 4: Run `node --test tests/personalized-advice-api.test.mjs`; expect PASS for unavailable secrets, invalid requests, request failures, empty content and successful text.**
- [ ] **Step 5: Commit with `git add functions/api/personalized-advice.js tests/personalized-advice-api.test.mjs` and `git commit -m "feat: return unrestricted model advice"`.**

### Task 3: Render Markdown safely in the report

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add DOM-only inline and block Markdown rendering.**

```js
function appendInlineMarkdown(target, source) {
  for (const part of source.split(/(\*\*[^*]+\*\*)/g)) {
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      target.append(strong);
    } else target.append(document.createTextNode(part));
  }
}
```

Add `renderAdviceMarkdown(text)` beside report helpers. It uses only `document.createElement` and supports `#` to `###`, unordered lists, ordered lists, bold, paragraphs and line breaks. It never uses `innerHTML`.

- [ ] **Step 2: Replace three cards with one freeform result.**

```js
if (typeof storedResult.personalizedAdvice === 'string') {
  copy.textContent = '这份建议已为本次测评生成，重新打开报告不会重复调用。';
  result.hidden = false;
  result.append(renderAdviceMarkdown(storedResult.personalizedAdvice));
  button.hidden = true;
  return;
}
```

Update result CSS for a compact article, headings, paragraphs and list indentation. Preserve button, error handling, localStorage and one-request behavior.

- [ ] **Step 3: Run `npx wrangler pages dev . --d1=DB=ai-assessment-db`; verify headings/lists/bold render, `<script>` is text only, and reload preserves saved advice.**
- [ ] **Step 4: Commit with `git add index.html` and `git commit -m "feat: render freeform advice safely"`.**

### Task 4: Update docs, test and deploy

**Files:**
- Modify: `README.md`
- Test: `tests/*.test.mjs`

- [ ] **Step 1: Replace “默认关闭” and “大模型仅返回三段 JSON 文本” with enabled freeform advice and its one-assessment/daily usage guard.**
- [ ] **Step 2: Run `node --test tests/*.test.mjs`; expect all tests PASS.**
- [ ] **Step 3: Commit with `git add README.md` and `git commit -m "docs: describe freeform advice flow"`.**
- [ ] **Step 4: Run `git push origin main`; verify the latest commit deploys in Cloudflare Pages project `ai-assessment-2`, then smoke-test the report.**
