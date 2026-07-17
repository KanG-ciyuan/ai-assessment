# V2.1 单次个性化建议 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 V2 四维测评报告增加一次性、受限且可校验的个性化建议，同时确保固定报告在 API 未启用时继续正常工作。

**Architecture:** 浏览器仍用 `assessment-core.js` 生成固定报告，并为每次完成的测评保存一个 `assessmentId`。新的 Cloudflare Pages Function 只接收结果标识和原始答案，在服务端用 V2 规则重新计算结果，调用模型生成严格的三字段 JSON，并用 D1 保存成功使用记录。提示词构造和模型输出校验置于独立纯模块，以便不依赖 Cloudflare 运行时测试。

**Tech Stack:** 纯 HTML/CSS/JavaScript、ES Modules、Node 内置 `node:test`、Cloudflare Pages Functions、Cloudflare D1、DeepSeek Chat Completions API、浏览器 localStorage。

---

## 文件结构

- 修改：`assessment-core.js`：生成并保存每次测评的 `assessmentId`。
- 新建：`personalized-advice-core.js`：V2 结果摘要、模型 Prompt、答案校验和 JSON 输出校验；不处理 HTTP 或 D1。
- 新建：`functions/api/personalized-advice.js`：Cloudflare HTTP 端点、IP 哈希、D1 使用限制和模型调用。
- 修改：`schema.sql`：新增个性化建议使用记录表与索引。
- 修改：`index.html`：在 7 天路径后展示建议面板、处理本地缓存与错误状态；功能开关默认关闭。
- 新建：`tests/personalized-advice-core.test.mjs`：覆盖输入边界、Prompt 数据边界和模型 JSON 校验。
- 修改：`tests/assessment-core.test.mjs`：覆盖结果标识的生成与保存。
- 修改：`tests/maintenance-mode.test.mjs`：覆盖默认关闭状态和新入口的静态契约。
- 修改：`README.md`：记录 V2.1 的启用条件、D1 迁移、密钥和本地行为。

## Task 1: 给每份本地结果增加稳定标识

**Files:**
- Modify: `assessment-core.js:142-153`
- Modify: `tests/assessment-core.test.mjs:1-66`

- [ ] **Step 1: 写出结果标识的失败测试**

在 `tests/assessment-core.test.mjs` 的 import 中加入 `createAssessmentId`，并添加：

```js
test('stored V2 results carry the supplied assessment identifier', () => {
  const answers = answerAll(1);
  const result = calculateAssessment(answers);
  const stored = createStoredResult(result, answers, '2026-07-17T00:00:00.000Z', 'assessment-test-1234');

  assert.equal(stored.assessmentId, 'assessment-test-1234');
  assert.equal(stored.personalizedAdvice, undefined);
});

test('assessment identifiers are non-empty strings', () => {
  assert.match(createAssessmentId(), /^assessment-[a-z0-9-]+$/i);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test tests/assessment-core.test.mjs`

Expected: FAIL，提示 `createAssessmentId` 未导出或 `assessmentId` 为 `undefined`。

- [ ] **Step 3: 在评分核心中实现标识生成和存储**

在 `assessment-core.js` 的 `createStoredResult` 前加入：

```js
export function createAssessmentId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `assessment-${uuid}`;
  return `assessment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
```

将原函数替换为：

```js
export function createStoredResult(
  result,
  answers,
  savedAt = new Date().toISOString(),
  assessmentId = createAssessmentId(),
) {
  return {
    version: 2,
    assessmentId,
    savedAt,
    answers: { ...answers },
    total: result.total,
    stage: result.stage.key,
    dimensions: Object.fromEntries(DIMENSION_ORDER.map((key) => [key, result.dimensions[key].score])),
  };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `node --test tests/assessment-core.test.mjs`

Expected: PASS，所有既有评分边界和新增标识断言通过。

- [ ] **Step 5: 提交本任务**

```bash
git add assessment-core.js tests/assessment-core.test.mjs
git commit -m "feat: identify stored assessment results"
```

## Task 2: 建立可测试的 V2 建议与 JSON 校验核心

**Files:**
- Create: `personalized-advice-core.js`
- Create: `tests/personalized-advice-core.test.mjs`

- [ ] **Step 1: 先定义失败测试**

创建 `tests/personalized-advice-core.test.mjs`：

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { QUESTIONS, calculateAssessment } from '../assessment-core.js';
import {
  buildAdviceInput,
  buildPersonalizedAdvicePrompt,
  isCompleteAnswerSet,
  parsePersonalizedAdvice,
} from '../personalized-advice-core.js';

const allAnswers = (value) => Object.fromEntries(QUESTIONS.map(({ id }) => [id, value]));

test('accepts exactly twelve V2 answer values from zero through three', () => {
  assert.equal(isCompleteAnswerSet(allAnswers(2)), true);
  assert.equal(isCompleteAnswerSet({ 1: 2 }), false);
  assert.equal(isCompleteAnswerSet({ ...allAnswers(2), 3: 4 }), false);
});

test('advice input contains only V2 result fields and route day one', () => {
  const input = buildAdviceInput(calculateAssessment(allAnswers(2)));
  assert.equal(input.dimensions.length, 4);
  assert.equal(input.routeDayOne.label, '第 1 天');
  assert.equal('answers' in input, false);
  assert.equal('questions' in input, false);
});

test('prompt requires exactly three plain-text JSON fields', () => {
  const prompt = buildPersonalizedAdvicePrompt(buildAdviceInput(calculateAssessment(allAnswers(2))));
  assert.match(prompt, /current_status/);
  assert.match(prompt, /next_action/);
  assert.match(prompt, /caution/);
  assert.doesNotMatch(prompt, /AI 认知|使用频率|行业应用/);
});

test('parses valid plain JSON and rejects markdown or invalid structures', () => {
  const currentStatus = '甲'.repeat(40);
  const nextAction = '乙'.repeat(60);
  const caution = '丙'.repeat(40);
  assert.deepEqual(
    parsePersonalizedAdvice(JSON.stringify({
      current_status: currentStatus,
      next_action: nextAction,
      caution,
    })),
    {
      currentStatus,
      nextAction,
      caution,
    },
  );
  assert.throws(() => parsePersonalizedAdvice('```json\n{}\n```'));
  assert.throws(() => parsePersonalizedAdvice('{"current_status":"a","next_action":"b","caution":"c","extra":"d"}'));
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test tests/personalized-advice-core.test.mjs`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现纯函数模块**

创建 `personalized-advice-core.js`，使用以下公开契约：

```js
import { DIMENSION_ORDER, QUESTIONS } from './assessment-core.js';

const ADVICE_KEYS = ['current_status', 'next_action', 'caution'];
const MARKDOWN_PATTERN = /```|^\s*(#{1,6}\s|[-*+]\s+|\d+[.)]\s+)|\|/m;
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}]/u;

export function isCompleteAnswerSet(answers) {
  if (!answers || typeof answers !== 'object' || Object.keys(answers).length !== QUESTIONS.length) return false;
  return QUESTIONS.every(({ id }) => Number.isInteger(answers[id]) && answers[id] >= 0 && answers[id] <= 3);
}

export function buildAdviceInput(result) {
  return {
    stage: { name: result.stage.name, description: result.stage.desc },
    total: result.total,
    dimensions: DIMENSION_ORDER.map((key) => ({
      name: result.dimensions[key].name,
      score: result.dimensions[key].score,
      max: result.dimensions[key].max,
      status: result.dimensions[key].status.name,
    })),
    strengths: result.strengths.map(({ name }) => name),
    priority: result.priorityDimension.name,
    routeDayOne: result.route.steps[0],
  };
}
```

`buildPersonalizedAdvicePrompt(input)` 必须把上述字段序列化为文字上下文，并包含下面的输出约束：

```text
只返回一个合法 JSON 对象，不要 Markdown、列表、表格、Emoji、代码块、额外字段、标题、寒暄或解释。
键必须且只能是 current_status、next_action、caution。
current_status 为 40-70 个字符，next_action 为 60-90 个字符，caution 为 40-70 个字符。
```

`parsePersonalizedAdvice(content)` 必须：去除首尾空白、用 `JSON.parse` 解析、验证对象键与 `ADVICE_KEYS` 完全一致、把 snake_case 字段映射为 camelCase、拒绝空文本/Markdown/Emoji/长度超限，并返回：

```js
{
  currentStatus: parsed.current_status.trim(),
  nextAction: parsed.next_action.trim(),
  caution: parsed.caution.trim(),
}
```

长度使用 `[...text].length` 计算；限制分别为 40-70、60-90、40-70。校验失败均 `throw new Error('invalid personalized advice response')`，不暴露模型原文。

- [ ] **Step 4: 运行核心测试，确认通过**

Run: `node --test tests/personalized-advice-core.test.mjs`

Expected: PASS。

- [ ] **Step 5: 运行全部已有测试，确认评分未回归**

Run: `node --test tests/*.test.mjs`

Expected: PASS。

- [ ] **Step 6: 提交本任务**

```bash
git add personalized-advice-core.js tests/personalized-advice-core.test.mjs
git commit -m "feat: add personalized advice validation core"
```

## Task 3: 新建 V2 Cloudflare 建议接口和 D1 限额记录

**Files:**
- Create: `functions/api/personalized-advice.js`
- Modify: `schema.sql:1-24`
- Modify: `tests/personalized-advice-core.test.mjs`

- [ ] **Step 1: 为长度、字段和输入异常补充失败测试**

在 `tests/personalized-advice-core.test.mjs` 添加：

```js
test('rejects incomplete answers and overlong advice fields', () => {
  assert.equal(isCompleteAnswerSet({ ...allAnswers(1), 12: '1' }), false);
  const overlong = '甲'.repeat(71);
  assert.throws(() => parsePersonalizedAdvice(JSON.stringify({
    current_status: overlong,
    next_action: '乙'.repeat(60),
    caution: '丙'.repeat(40),
  })));
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test tests/personalized-advice-core.test.mjs`

Expected: FAIL，当前校验未处理长度或字符串答案。

- [ ] **Step 3: 写入 D1 表和索引**

在 `schema.sql` 末尾加入：

```sql
CREATE TABLE IF NOT EXISTS personalized_advice_usage (
  assessment_id TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  day_key TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_personalized_advice_usage_ip_day
  ON personalized_advice_usage (ip_hash, day_key);

CREATE INDEX IF NOT EXISTS idx_personalized_advice_usage_created_at
  ON personalized_advice_usage (created_at);
```

- [ ] **Step 4: 实现新的 Cloudflare Pages Function**

创建 `functions/api/personalized-advice.js`。它必须 import `calculateAssessment` 和 Task 2 的四个纯函数，并实现以下顺序：

```js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const { request, env } = context;
if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
if (request.method !== 'POST') return jsonResponse({ success: false, error: '只支持 POST 请求' }, 405);
if (!env.DEEPSEEK_API_KEY || !env.IP_HASH_SECRET || !env.DB) {
  return jsonResponse({ success: false, code: 'FEATURE_UNAVAILABLE', error: '个性化建议暂未开启' }, 503);
}
```

解析体 `{ assessmentId, answers }` 后，要求 `assessmentId` 匹配 `/^assessment-[a-z0-9-]{8,160}$/i`、`isCompleteAnswerSet(answers)` 为真；否则返回 400。之后：

1. 读取 `CF-Connecting-IP`；缺失时返回 503，不使用客户端传来的 IP。
2. 用 `crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.IP_HASH_SECRET}:${ip}`))` 生成小写十六进制 `ipHash`。
3. 计算 `dayKey = new Date().toISOString().slice(0, 10)`，先执行 `DELETE FROM personalized_advice_usage WHERE created_at < datetime('now', '-7 days')`。
4. 查 `assessment_id`；存在时返回 409，代码 `ASSESSMENT_ALREADY_USED`。
5. 查 `ip_hash` 和 `day_key` 的记录数；达到 5 时返回 429，代码 `DAILY_LIMIT_REACHED`。
6. 执行 `calculateAssessment(answers)`、`buildAdviceInput(result)` 和 `buildPersonalizedAdvicePrompt(input)`。
7. 调用 `https://api.deepseek.com/v1/chat/completions`，使用 `env.DEEPSEEK_API_KEY`，`temperature: 0.3`、`max_tokens: 350`。系统消息固定为“你是一个简洁、务实的 AI 学习教练。严格遵守用户消息中的 JSON 输出契约。”，用户消息使用步骤 6 的 Prompt。
8. 非 2xx、空内容或 `parsePersonalizedAdvice` 异常均返回 502，代码 `MODEL_RESPONSE_INVALID`；不要写入 D1。
9. 校验成功后插入 `assessment_id`、`ip_hash`、`day_key`；若插入发生唯一键冲突，返回 409；成功则返回 `{ success: true, advice }`。

HTTP JSON 响应始终带 `Content-Type: application/json` 与现有函数同样的 CORS 头。不要导入、调用或修改旧的 `functions/api/generate-report.js`。

- [ ] **Step 5: 运行核心测试，确认通过**

Run: `node --test tests/personalized-advice-core.test.mjs`

Expected: PASS。

- [ ] **Step 6: 手动检查接口无密钥保护**

Run: `rg -n "FEATURE_UNAVAILABLE|IP_HASH_SECRET|DAILY_LIMIT_REACHED|MODEL_RESPONSE_INVALID" functions/api/personalized-advice.js`

Expected: 显示四个常量/代码分支，且没有旧 V1 五维名称。

- [ ] **Step 7: 提交本任务**

```bash
git add schema.sql functions/api/personalized-advice.js tests/personalized-advice-core.test.mjs
git commit -m "feat: add rate-limited personalized advice api"
```

## Task 4: 在报告的 7 天路径后接入一次性建议面板

**Files:**
- Modify: `index.html:945-1058, 2871-2876, 2880-3410`
- Modify: `tests/maintenance-mode.test.mjs:1-30`

- [ ] **Step 1: 先写静态页面契约测试**

在 `tests/maintenance-mode.test.mjs` 追加：

```js
assert.match(source, /id="personalizedAdvicePanel"/);
assert.match(source, /\/api\/personalized-advice/);
assert.match(source, /const AI_ANALYSIS_ENABLED = false;/);
assert.match(source, /个性化建议暂未开启/);
assert.doesNotMatch(source, /fetch\('\/api\/generate-report/);
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test tests/maintenance-mode.test.mjs`

Expected: FAIL，找不到个性化建议面板。

- [ ] **Step 3: 添加报告面板与样式**

在 `#reportTimeline` 后、`#reportScoreTable` 前加入：

```html
<section class="personalized-advice-panel" id="personalizedAdvicePanel" aria-live="polite">
  <div class="personalized-advice-kicker">个性化建议</div>
  <h2 class="personalized-advice-title">把第 1 天行动落到一件具体小事</h2>
  <p class="personalized-advice-copy" id="personalizedAdviceCopy"></p>
  <div class="personalized-advice-result" id="personalizedAdviceResult" hidden></div>
  <button class="btn-personalized-advice" id="btnPersonalizedAdvice" type="button"></button>
</section>
```

在报告样式段新增 `.personalized-advice-panel`、`.personalized-advice-kicker`、`.personalized-advice-title`、`.personalized-advice-copy`、`.personalized-advice-result`、`.personalized-advice-item` 和 `.btn-personalized-advice`。样式沿用页面现有的灰白底色、1px 边框、8px 以下圆角和 16px 左右内容字号；桌面限制在报告内容宽度内，移动端保持单列。按钮的 loading/disabled 状态不改变面板尺寸。

- [ ] **Step 4: 添加本地迁移、渲染与请求函数**

从 `assessment-core.js` import `createAssessmentId`。在 `readLastResult` 中，解析成功且结果没有非空字符串 `assessmentId` 时执行：

```js
stored.assessmentId = createAssessmentId();
localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
```

把 `submitQuiz` 改为先创建并保存 `const stored = createStoredResult(result, answers)`，然后调用 `showV2Report(result, stored)`。把 `showLastResult` 改为 `showV2Report(calculateAssessment(stored.answers), stored)`。把 `showV2Report` 签名改为 `showV2Report(result, storedResult)`，在渲染 7 天路径后调用 `renderPersonalizedAdvice(storedResult, result)`。

实现 `renderPersonalizedAdvice(storedResult, result)`：已有 `storedResult.personalizedAdvice` 时显示三段内容并隐藏按钮；`AI_ANALYSIS_ENABLED` 为 `false` 时显示“个性化建议暂未开启”并禁用按钮；其它情况下显示“本次结果可免费获取 1 次”和“获取个性化建议”按钮。

三段成功内容用 `document.createElement` 和 `textContent` 创建，不使用 `innerHTML` 插入任何模型字段。按钮请求时使用：

```js
const response = await fetch('/api/personalized-advice', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ assessmentId: storedResult.assessmentId, answers: storedResult.answers }),
});
```

加载期间禁用按钮并显示“正在生成建议”。成功时将 `data.advice` 保存为 `storedResult.personalizedAdvice`，写回 `localStorage`，再渲染成功状态。`FEATURE_UNAVAILABLE`、`DAILY_LIMIT_REACHED`、`ASSESSMENT_ALREADY_USED` 和其它失败分别显示设计文档规定的中文文案；任何失败都不写入 `personalizedAdvice`。

- [ ] **Step 5: 运行前端静态与全部单元测试**

Run: `node --test tests/*.test.mjs`

Expected: PASS。

- [ ] **Step 6: 本地人工验收关闭状态**

Run: `python3 -m http.server 8080`

Expected: 打开 `http://localhost:8080`，完成 12 题后可在 7 天路径下看到“个性化建议暂未开启”；固定报告完整显示，点击按钮不会请求 API。

- [ ] **Step 7: 提交本任务**

```bash
git add index.html tests/maintenance-mode.test.mjs
git commit -m "feat: add personalized advice report panel"
```

## Task 5: 更新项目说明并完成上线前验证

**Files:**
- Modify: `README.md:15-108`
- Modify: `docs/superpowers/specs/2026-07-17-personalized-advice-design.md:92-106`

- [ ] **Step 1: 更新 README 的版本与架构说明**

将“当前状态”明确为 V2.1：固定测评仍免费、默认不调模型；个性化建议是可选功能，每份结果成功生成一次，未启用时显示明确提示。将架构图区分为：

```text
用户答题 -> 前端固定规则 -> 固定报告和 7 天行动路径
用户主动点击 -> Pages Function 重新计算 V2 结果 -> 模型短 JSON -> D1 限额记录 -> 本地缓存展示
```

增加“启用个性化建议”小节，逐项列出 D1 执行 `schema.sql`、绑定 `DB`、配置 `DEEPSEEK_API_KEY` 与 `IP_HASH_SECRET`、把 `AI_ANALYSIS_ENABLED` 改为 `true`、部署后验证成功/重复/每日额度三种结果。写明密钥不应提交仓库。

- [ ] **Step 2: 同步设计文档的完成状态**

在设计文档的“配置与启用”后添加一行：`实现时默认关闭；仅在 Cloudflare 密钥和 D1 绑定已验证后开启。` 不改变已确认的范围和限制。

- [ ] **Step 3: 运行全量自动化测试**

Run: `node --test tests/*.test.mjs`

Expected: PASS，所有测试通过且无 skipped/failing 测试。

- [ ] **Step 4: 检查工作区和关键安全边界**

Run: `git status --short && rg -n "DEEPSEEK_API_KEY|IP_HASH_SECRET|AI_ANALYSIS_ENABLED" README.md index.html functions/api/personalized-advice.js`

Expected: 仅显示本任务预期的未提交文档改动和配置名称；不出现任何密钥值。

- [ ] **Step 5: 提交本任务**

```bash
git add README.md docs/superpowers/specs/2026-07-17-personalized-advice-design.md
git commit -m "docs: explain personalized advice activation"
```

## Task 6: 发布前人工验证与部署

**Files:**
- Modify: none until the checks below pass

- [ ] **Step 1: 在功能关闭状态验证公开页面**

Run: `git log --oneline -5 && node --test tests/*.test.mjs`

Expected: 本地所有测试通过；可部署版本保持 `AI_ANALYSIS_ENABLED = false`，不会因为没有 API Key 影响固定报告。

- [ ] **Step 2: 推送代码并等待 Cloudflare Pages 部署**

Run: `git push origin main`

Expected: 推送成功；Cloudflare Pages 自动部署新版本。

- [ ] **Step 3: 在公开页面复核固定报告**

打开 `https://ai-assessment-260.pages.dev/`，完成一份测评。

Expected: 12 题、四维图、7 天路径均正常；路径后显示“个性化建议暂未开启”；浏览器控制台没有未捕获错误。

- [ ] **Step 4: 等用户配置密钥后再做开启验证**

在 Cloudflare Pages 完成 D1 绑定和两个服务端密钥配置后，将 `AI_ANALYSIS_ENABLED` 改为 `true` 并重新部署。用同一浏览器依次验证：首次成功返回三段建议、刷新后不再请求、重新测评后可再次请求、同 IP 第 6 次返回当日额度提示。任何模型失败都必须允许重试。

## 实现完成标准

- 固定 V2 报告在所有 API 状态下可用。
- 新接口不引用旧 V1 五维题库或 Markdown 报告逻辑。
- 模型原文只有通过三字段 JSON 校验后才会展示，且以纯文本渲染。
- 成功使用受到 `assessmentId` 和 IP 每日 5 次两层限制。
- `node --test tests/*.test.mjs` 通过，公开页面关闭状态经人工验证。
