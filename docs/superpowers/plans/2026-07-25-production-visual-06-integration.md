# Production Visual 06 Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已确认的 06 生物合成视觉系统接入真实 V2.1 测评，同时保留匿名导出、固定评分、本地结果和个性化建议。

**Architecture:** 保持 `assessment-core.js` 和 Pages Functions 不变。将旧的单文件页面拆为 `index.html`、`styles.css` 和 `app.js`，由 `app.js` 负责页面状态、自动跳题、固定报告、匿名导出与个性化建议。

**Tech Stack:** 原生 HTML/CSS/JavaScript ES Modules、Canvas、Cloudflare Pages Functions、Node.js `node:test`

---

### Task 1: 前端结构契约

**Files:**
- Create: `tests/visual-06-frontend.test.mjs`
- Modify: `tests/maintenance-mode.test.mjs`

- [ ] 增加对 06 首页、答题、结果、自动跳题和 API 路径的静态契约测试。
- [ ] 运行新测试并确认旧页面无法满足契约。

### Task 2: 生产页面壳层

**Files:**
- Replace: `index.html`
- Create: `styles.css`
- Create: `app.js`

- [ ] 接入已确认的 06 首页、答题和结果页面。
- [ ] 实现选项反馈后自动跳题、上一题修改和最后一题自动生成报告。
- [ ] 使用正式 `STORAGE_KEY` 保存最近结果。

### Task 3: 恢复生产数据能力

**Files:**
- Modify: `app.js`

- [ ] 完成测评后非阻塞调用 `/api/assessment-events`。
- [ ] 个性化建议仅在点击后调用 `/api/personalized-advice`。
- [ ] 安全渲染常用 Markdown，不执行模型 HTML。
- [ ] 恢复已保存建议和错误/限额状态。

### Task 4: 完整验证

**Files:**
- Test: `tests/*.mjs`

- [ ] 运行全部 Node 测试。
- [ ] 浏览器完成 12 题、最近结果、个性化建议失败降级与复测流程。
- [ ] 验证桌面端和 390×844 手机端无裁切、重叠或控制台错误。
- [ ] 提供本地验收地址，不部署。

