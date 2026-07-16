# AI 能力测评 V2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将五维兴趣测评升级为四维、十二题、固定规则的 AI 应用能力测评，并在不调用模型 API 的情况下生成可行动的本地报告。

**Architecture:** 新增无 DOM 依赖的 `assessment-core.js`，集中题库、计分、阶段约束和报告模板。`index.html` 仅处理交互、渲染和 localStorage；Node 内置测试直接导入核心模块。

**Tech Stack:** 纯 HTML/CSS/ES Modules、localStorage、Node.js `node:test`、Cloudflare Pages 静态部署。

---

## 文件结构

| 文件 | 责任 |
| --- | --- |
| `assessment-core.js` | 题库、四维计分、阶段、报告和本地结果序列化 |
| `index.html` | 交互、渲染、模块导入和浏览器本地记录 |
| `tests/assessment-core.test.mjs` | V2 规则与边界测试 |
| `tests/maintenance-mode.test.mjs` | API 关闭回归测试 |
| `AI能力测评_项目材料/AI能力测评_题库_v2.md` | 可供人工审阅的线上题库 |
| `README.md` | 当前产品定位和版本说明 |

### Task 1: 定义 V2 题库和失败测试

**Files:**

- Create: `tests/assessment-core.test.mjs`
- Create: `AI能力测评_项目材料/AI能力测评_题库_v2.md`

- [ ] **Step 1: 写入失败测试**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { DIMENSION_ORDER, QUESTIONS, calculateAssessment, createStoredResult } from '../assessment-core.js';

const answerAll = (value) => Object.fromEntries(QUESTIONS.map(({ id }) => [id, value]));

test('V2 has 12 questions and four three-question dimensions', () => {
  assert.equal(QUESTIONS.length, 12);
  assert.deepEqual(DIMENSION_ORDER, ['understanding', 'expression', 'application', 'workflow']);
  for (const question of QUESTIONS) assert.equal(question.options.length, 4);
});

test('all-zero answers are cognitive starters', () => {
  const result = calculateAssessment(answerAll(0));
  assert.equal(result.total, 0);
  assert.equal(result.stage.key, 'cognitive-start');
  assert.equal(result.route.key, 'foundation');
});

test('stage boundaries use the approved score ranges', () => {
  assert.equal(calculateAssessment({ 1: 3, 2: 3, 3: 3 }).stage.key, 'cognitive-start');
  assert.equal(calculateAssessment({ 1: 3, 2: 3, 3: 3, 4: 1 }).stage.key, 'basic-collaboration');
  assert.equal(calculateAssessment({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 1 }).stage.key, 'scenario-application');
  assert.equal(calculateAssessment(answerAll(3)).stage.key, 'workflow-advanced');
});

test('a dimension below four caps advanced results', () => {
  const answers = answerAll(3);
  answers[1] = 0;
  answers[2] = 0;
  const result = calculateAssessment(answers);
  assert.equal(result.total, 30);
  assert.equal(result.stage.key, 'scenario-application');
  assert.equal(result.stage.capped, true);
});

test('priority order and local result are deterministic', () => {
  const answers = answerAll(2);
  answers[1] = answers[2] = answers[3] = 0;
  const result = calculateAssessment(answers);
  const stored = createStoredResult(result, answers, '2026-07-16T00:00:00.000Z');
  assert.equal(result.priorityDimension.key, 'understanding');
  assert.equal(result.route.steps.length, 3);
  assert.equal(stored.version, 2);
  assert.equal(stored.apiReport, undefined);
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/assessment-core.test.mjs`

Expected: FAIL，因为 `assessment-core.js` 尚不存在。

- [ ] **Step 3: 写入当前题库文档**

`AI能力测评_项目材料/AI能力测评_题库_v2.md` 必须明确每题属于的维度、生活/学习/工作场景、四个选项与 0-3 分映射。使用下表作为题干来源：

| ID | 维度 | 场景 | 题干 |
| ---: | --- | --- | --- |
| 1 | AI 理解与判断 | 生活 | AI 对一项会随时间变化的重要信息给出很肯定的回答时，你通常会？ |
| 2 | AI 理解与判断 | 工作 | 遇到一项需要你本人承担后果的决定时，你会怎样使用 AI？ |
| 3 | AI 理解与判断 | 工作 | AI 根据一份资料生成了总结，但你发现其中有几处似乎不对时，你会？ |
| 4 | 任务表达与协作 | 工作 | 需要把一堆零散会议记录整理成给负责人看的周报时，你会怎样提要求？ |
| 5 | 任务表达与协作 | 工作 | AI 的第一版结果不符合你的预期时，你通常会？ |
| 6 | 任务表达与协作 | 生活 | 想让 AI 帮你制定一周学习或生活计划时，你会提供什么信息？ |
| 7 | 场景应用与问题解决 | 学习 | 遇到一个不理解的知识点时，你会怎样借助 AI 学习？ |
| 8 | 场景应用与问题解决 | 生活 | 规划一次出行或重要安排时，你会怎样使用 AI？ |
| 9 | 场景应用与问题解决 | 工作 | 面对一份杂乱的数据、资料或任务清单时，你会怎样让 AI 帮忙？ |
| 10 | 工具选择与流程能力 | 学习 | 需要从一份很长的材料中提取重点并完成一页笔记时，你会？ |
| 11 | 工具选择与流程能力 | 工作 | 每周都要重复完成类似的信息整理任务时，你会？ |
| 12 | 工具选择与流程能力 | 生活 | 需要基于多份可信资料回答一个问题时，你会？ |

选项的固定递进：0 分为不使用或无核验，1 分为泛化使用，2 分为带明确约束或核验，3 分为分步处理、核验并沉淀可复用方法。不能出现必须会编程、使用 API 或安装特定工具才能选择 3 分的表述。

当前题库的具体选项如下，文档与代码必须保持一致：

- 题 1：`直接照着做`；`觉得说得通就采用`；`追问依据或再找一个来源核对`；`把 AI 当作线索，优先核验官方或原始信息，并标出不确定处`。
- 题 2：`让 AI 直接替我决定`；`问一个笼统问题后按建议做`；`说明自己的情况，把回答作为参考再自行判断`；`让 AI 列出方案、风险和需要补充的信息，再结合事实和责任边界做决定`。
- 题 3：`直接使用`；`大致读一遍，感觉没问题就使用`；`对照原资料修改明显错误`；`把结论拆成事实点逐项核验，保留来源依据，并让 AI 按修正意见重写`。
- 题 4：`只说“帮我写周报”`；`把记录贴进去后说“总结一下”`；`说明读者、重点和输出格式`；`先说明目标、读者、材料边界和格式，拿到初稿后按遗漏点继续补充和修改`。
- 题 5：`放弃使用 AI`；`重新发一次同样的问题`；`直接指出不满意的部分，让它修改`；`说明差距、补充示例和限制条件，分步修改并检查最终结果`。
- 题 6：`只问“帮我做计划”`；`只给一个大致目标`；`给出目标和可用时间`；`给出目标、现状、时间、限制和优先级，并要求给出可调整的检查点`。
- 题 7：`不会想到用 AI`；`只问“这是什么”`；`让 AI 用例子解释，再追问不懂的地方`；`要求分层解释、举例、出练习并检查自己的理解，再把结论用到一道真实题目中`。
- 题 8：`不使用`；`只问推荐地点或建议`；`告诉它预算、时间和偏好，参考生成的方案`；`让它给出行程、预算、备选方案和待确认事项，再自行核验关键价格和规则`。
- 题 9：`觉得 AI 帮不上忙`；`把内容丢进去让它随便整理`；`让它按指定分类、表格或优先级整理`；`先定义要解决的问题和验收格式，再让 AI 分步整理，并用原始材料检查结果`。
- 题 10：`只用最熟悉的聊天框`；`整份材料一次性贴进去`；`选择适合处理长材料的工具，并明确要提取的重点`；`将提取、整理和复核拆开，选择适合的工具或功能，并保留可复用的笔记模板`。
- 题 11：`每次从头做`；`保存一次结果，下次再找`；`保存提示词或表格模板复用`；`把输入、处理和输出步骤标准化，形成检查清单、模板或简单自动化流程`。
- 题 12：`只相信 AI 的第一句回答`；`把所有内容一次性塞给 AI`；`选择能引用资料的方式，并检查关键出处`；`先确定资料范围和可信标准，再分步检索、整理观点、核验出处并输出结论`。

- [ ] **Step 4: 提交**

Run: `git add tests/assessment-core.test.mjs AI能力测评_项目材料/AI能力测评_题库_v2.md`

Run: `git commit -m "test: define V2 assessment rules"`

### Task 2: 实现独立的测评核心

**Files:**

- Create: `assessment-core.js`
- Test: `tests/assessment-core.test.mjs`

- [ ] **Step 1: 创建维度和阶段配置**

```js
export const DIMENSION_ORDER = ['understanding', 'expression', 'application', 'workflow'];

export const DIMENSIONS = {
  understanding: { name: 'AI 理解与判断', questionIds: [1, 2, 3], max: 9 },
  expression: { name: '任务表达与协作', questionIds: [4, 5, 6], max: 9 },
  application: { name: '场景应用与问题解决', questionIds: [7, 8, 9], max: 9 },
  workflow: { name: '工具选择与流程能力', questionIds: [10, 11, 12], max: 9 },
};

export const STAGES = [
  { key: 'cognitive-start', name: '认知起步', min: 0, max: 9, desc: '你已经知道 AI 可以帮忙，下一步是建立一次真实使用和核验的习惯。' },
  { key: 'basic-collaboration', name: '基础协作', min: 10, max: 18, desc: '你能借助 AI 完成简单任务，下一步是把需求表达得更清楚，并检查结果。' },
  { key: 'scenario-application', name: '场景应用', min: 19, max: 27, desc: '你已经能把 AI 用进具体问题，下一步是沉淀可复用的方法和场景。' },
  { key: 'workflow-advanced', name: '流程进阶', min: 28, max: 36, desc: '你能选择工具并组织多步骤任务，适合继续优化自己的工作流程。' },
];
```

- [ ] **Step 2: 创建完整题库和计分函数**

`QUESTIONS` 必须有 12 个对象，包含 `id`、`dimension`、`scenario`、`text`、`options`。它必须与 Task 1 的当前题库文档逐字一致；选项数组索引就是 0-3 分。

```js
const priorityIndex = Object.fromEntries(DIMENSION_ORDER.map((key, index) => [key, index]));

export function calculateAssessment(answers) {
  const dimensions = Object.fromEntries(DIMENSION_ORDER.map((key) => {
    const config = DIMENSIONS[key];
    const score = config.questionIds.reduce((sum, id) => sum + Number(answers[id] ?? 0), 0);
    return [key, { key, name: config.name, score, max: config.max, rate: Math.round((score / config.max) * 100) }];
  }));
  const total = DIMENSION_ORDER.reduce((sum, key) => sum + dimensions[key].score, 0);
  const nominal = STAGES.find((stage) => total >= stage.min && total <= stage.max);
  const hasCriticalGap = DIMENSION_ORDER.some((key) => dimensions[key].score < 4);
  const stage = nominal.key === 'workflow-advanced' && hasCriticalGap
    ? { ...STAGES[2], capped: true }
    : { ...nominal, capped: false };
  const ranked = DIMENSION_ORDER.map((key) => dimensions[key])
    .sort((a, b) => a.score - b.score || priorityIndex[a.key] - priorityIndex[b.key]);
  const strengths = [...DIMENSION_ORDER.map((key) => dimensions[key])]
    .sort((a, b) => b.score - a.score || priorityIndex[a.key] - priorityIndex[b.key])
    .slice(0, 2);
  return { answers: { ...answers }, dimensions, total, stage, priorityDimension: ranked[0], strengths, route: selectRoute(ranked[0], total) };
}
```

- [ ] **Step 3: 实现三类行动路径和结果序列化**

`selectRoute(priorityDimension, total)` 返回 `key`、`name` 和三项七天内能完成的动作。`understanding` 或 `expression` 返回 `foundation`；`application` 返回 `scenario`；只有 `workflow` 且 `total >= 19` 才返回 `workflow`，否则返回 `foundation`。动作不推荐付费课程，不调用模型，也不包含外部链接。

```js
export const STORAGE_KEY = 'ai-assessment:v2:last-result';

export function createStoredResult(result, answers, savedAt = new Date().toISOString()) {
  return {
    version: 2,
    savedAt,
    answers: { ...answers },
    total: result.total,
    stage: result.stage.key,
    dimensions: Object.fromEntries(DIMENSION_ORDER.map((key) => [key, result.dimensions[key].score])),
  };
}
```

- [ ] **Step 4: 运行并提交核心模块**

Run: `node --test tests/assessment-core.test.mjs`

Expected: PASS。

Run: `git add assessment-core.js tests/assessment-core.test.mjs`

Run: `git commit -m "feat: add V2 assessment scoring core"`

### Task 3: 接入页面并去除提交时的网络调用

**Files:**

- Modify: `index.html:2807-2860`
- Modify: `index.html:2862-3368`
- Modify: `tests/maintenance-mode.test.mjs`

- [ ] **Step 1: 先扩展维护模式测试**

在现有测试加入：

```js
assert.match(source, /<script type="module">/);
assert.match(source, /from '\.\/assessment-core\.js'/);
assert.match(source, /const AI_ANALYSIS_ENABLED = false;/);
assert.doesNotMatch(source, /fetch\(API_URL/);
```

Run: `node --test tests/maintenance-mode.test.mjs`

Expected: FAIL，因为页面尚未导入模块且仍含提交网络请求。

- [ ] **Step 2: 导入测评核心并替换旧五维数据**

将第 2862 行脚本替换为模块脚本，并使用：

```js
import { DIMENSION_ORDER, DIMENSIONS, QUESTIONS, STORAGE_KEY, calculateAssessment, createStoredResult } from './assessment-core.js';

const AI_ANALYSIS_ENABLED = false;
const questions = QUESTIONS;
const dimOrder = DIMENSION_ORDER;
const dimConfig = DIMENSIONS;
let currentQ = 0;
let answers = {};
```

删除旧 `questions`、五维 `dimConfig`、`calcScores`、`getLevel`、`reportTemplates`、`genSummary` 和 `genLearningPath`。`renderQuestion()` 中所有固定 `12` 改为 `questions.length`，维度标题改为 `DIMENSIONS[q.dimension].name`。

- [ ] **Step 3: 使用本地计算提交与保存**

```js
function submitQuiz() {
  const unanswered = questions.filter((question) => answers[question.id] === undefined);
  if (unanswered.length > 0) {
    currentQ = questions.indexOf(unanswered[0]);
    renderQuestion();
    return;
  }
  const result = calculateAssessment(answers);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createStoredResult(result, answers)));
  showReport(result);
}
```

移除 `API_URL`、`fetch(API_URL)`、`aiReport` 参数和 AI 深度报告显示分支。基础说明改为“本次结果按固定规则生成，不调用模型 API”。

- [ ] **Step 4: 按 V2 结果渲染报告**

将 `showReport` 改为只接收 `result`。Hero 显示阶段、`total / 36` 与 `result.stage.desc`；若 `result.stage.capped` 为真，显示“存在关键短板，阶段按能力短板校正”。雷达图、得分表和能力卡只遍历四维。

能力卡状态固定为：0-3 “优先提升”、4-6 “发展中”、7-9 “优势”。新增“你的优势”区显示 `result.strengths` 的两个维度；新增“当前优先短板”区显示 `result.priorityDimension.name`；学习时间线改为 `result.route.steps` 的三项七天动作。

- [ ] **Step 5: 增加最近结果入口**

在开始按钮附近增加默认隐藏的“查看上次结果”按钮。页面初始化时读取 `STORAGE_KEY`，只在 `version === 2` 且 12 题答案齐全时显示。点击后使用保存的答案重新计算并调用 `showReport`。`restartQuiz()` 不删除本地记录，只清空当前答题状态。

- [ ] **Step 6: 运行并提交**

Run: `node --test tests/*.test.mjs`

Expected: PASS。

Run: `git add index.html tests/maintenance-mode.test.mjs`

Run: `git commit -m "feat: render V2 local assessment report"`

### Task 4: 同步入口、README 和项目资料

**Files:**

- Modify: `index.html:2670-2801`
- Modify: `README.md:1-130`
- Modify: `AI能力测评_项目材料/README.md`

- [ ] **Step 1: 更新入口与演示文案**

入口统一使用以下文案：

```text
AI 应用能力测评
用 12 个真实场景，看看你如何把 AI 用进学习、生活和工作。
能力阶段 · 四维画像 · 七天行动路径
12 Questions / 4 Dimensions
```

删除入口和 Demo 中的五维、探索者/进阶者、AI 深度报告承诺。

- [ ] **Step 2: 更新 README**

README 说明当前为 V2.0 免费体验版；12 题覆盖四维；计分与报告完全在浏览器固定规则运行；最近一次结果保存在当前浏览器，清除站点数据会丢失；飞书知识库陪练是后续独立版本，不是当前功能。旧五维表、旧等级名和旧“前端计算五维得分”架构图均替换为 V2 事实。

- [ ] **Step 3: 标注题库版本**

在项目材料 README 中加入 `AI能力测评_题库_v2.md` 作为当前题库，将 `AI能力测评_题库_v1.md` 明确标记为历史版本。

- [ ] **Step 4: 搜索旧线上表述并提交**

Run: `rg -n "5 个能力维度|五维度|探索者|进阶者|入门者|初识者" README.md AI能力测评_项目材料 index.html`

Expected: 只有历史 V1 文件允许命中；README 和 `index.html` 不得命中。

Run: `git add index.html README.md AI能力测评_项目材料`

Run: `git commit -m "docs: describe V2 application assessment"`

### Task 5: 最终验证

**Files:**

- Modify: `tests/assessment-core.test.mjs`（仅在验证发现规则遗漏时）
- Modify: `tests/maintenance-mode.test.mjs`（仅在维护模式回归时）

- [ ] **Step 1: 运行静态验证**

Run: `node --check assessment-core.js && node --test tests/*.test.mjs && git diff --check`

Expected: 全部成功。

- [ ] **Step 2: 手工验证四个评分场景**

1. 全选 A：显示“认知起步”和基础上手路径。
2. 全选 B：显示“基础协作”。
3. 全选 C：显示“场景应用”。
4. 除第一维外全选 D、第一维为 0/0/3：总分 30，但显示“场景应用”与短板校正说明。

在 390px 宽度下确认题干、四个选项、行动路径和“查看上次结果”不溢出。完成一次后刷新页面，点击“查看上次结果”应恢复结果；清除站点数据后按钮消失。提交测评时网络面板中不得出现 `/api/generate-report` 请求。

- [ ] **Step 3: 检查工作区并做最终测试提交**

Run: `git status --short`

Expected: 空输出。若 Task 5 为修正测试而产生未提交改动，依次运行 `git add tests/assessment-core.test.mjs tests/maintenance-mode.test.mjs` 与 `git commit -m "test: verify V2 assessment experience"`。
