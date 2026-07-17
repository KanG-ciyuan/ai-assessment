# Report Layout Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the assessment and report pages more compact on desktop while keeping radar-chart dimension labels clearly outside the chart.

**Architecture:** Keep the V2 scoring, question data, and report content unchanged. Adjust only the final CSS overrides in `index.html`, enlarge the SVG coordinate system, and replace dynamic label collision logic with fixed outer label anchors for the four known dimensions.

**Tech Stack:** Static HTML, CSS, ES modules, Node.js built-in test runner.

---

### Task 1: Capture the report layout contract

**Files:**
- Modify: `tests/maintenance-mode.test.mjs`
- Test: `tests/maintenance-mode.test.mjs`

- [ ] **Step 1: Write the failing test**

Add these assertions after the existing module-action assertions:

```js
assert.match(source, /viewBox="0 0 480 360" id="radarSvg"/);
assert.match(source, /const RADAR_LABEL_POSITIONS = \{/);
assert.match(source, /expression: \{ x: 365, y: 184, anchor: 'start' \}/);
assert.match(source, /workflow: \{ x: 115, y: 184, anchor: 'end' \}/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/maintenance-mode.test.mjs`

Expected: FAIL because the current SVG still uses a `280 x 280` viewBox and the outer-label anchor map does not exist.

- [ ] **Step 3: Commit the test**

```bash
git add tests/maintenance-mode.test.mjs
git commit -m "test: define report radar layout contract"
```

### Task 2: Compact desktop typography and the report hero

**Files:**
- Modify: `index.html:1928-1938`
- Modify: `index.html:2027-2110`
- Test: `tests/maintenance-mode.test.mjs`

- [ ] **Step 1: Implement the compact desktop CSS**

Replace the effective desktop rules with these values, leaving mobile overrides unchanged:

```css
.quiz-card-question {
  font-size: clamp(26px, 3.2vw, 38px);
  line-height: 1.22;
  margin-bottom: 30px;
}

.report-hero {
  min-height: clamp(250px, 34vh, 330px);
  padding: clamp(24px, 3.2vw, 38px);
  margin-bottom: 26px;
}

.report-summary-line {
  margin-bottom: 16px;
}

.report-hero > div:nth-of-type(2) {
  margin-top: 26px;
}
```

- [ ] **Step 2: Run the maintenance test**

Run: `node --test tests/maintenance-mode.test.mjs`

Expected: PASS because this task does not change the static product boundaries.

- [ ] **Step 3: Commit the CSS change**

```bash
git add index.html
git commit -m "style: compact assessment and report hero"
```

### Task 3: Move radar labels outside the chart

**Files:**
- Modify: `index.html:2162-2170`
- Modify: `index.html:2867-2869`
- Modify: `index.html:3358-3405`
- Test: `tests/maintenance-mode.test.mjs`

- [ ] **Step 1: Expand the SVG drawing area**

Replace the report SVG with:

```html
<svg viewBox="0 0 480 360" id="radarSvg"></svg>
```

Set the desktop SVG display size to `min(480px, 90vw)` by `auto`, retaining the existing mobile `height: auto` behavior.

- [ ] **Step 2: Replace label-position calculations with fixed anchors**

Use the known V2 dimension order to add this map before `drawRadar`:

```js
const RADAR_LABEL_POSITIONS = {
  understanding: { x: 240, y: 34, anchor: 'middle' },
  expression: { x: 365, y: 184, anchor: 'start' },
  application: { x: 240, y: 344, anchor: 'middle' },
  workflow: { x: 115, y: 184, anchor: 'end' },
};
```

Inside `drawRadar`, use `cx = 240`, `cy = 180`, `r = 100`. For each label, read `RADAR_LABEL_POSITIONS[key]` and render it at that fixed location with `font-size="13"` and its configured `text-anchor`. Remove the label-width and clamping calculations.

- [ ] **Step 3: Run the targeted test and full test suite**

Run: `node --test tests/maintenance-mode.test.mjs && node --test tests/*.test.mjs`

Expected: both commands PASS.

- [ ] **Step 4: Run JavaScript and whitespace checks**

Run:

```bash
sed -n '/<script type="module">/,/<\/script>/p' index.html | sed '1d;$d' > /tmp/ai-assessment-module-check.js
node --check /tmp/ai-assessment-module-check.js
git diff --check
```

Expected: all commands exit with code `0`.

- [ ] **Step 5: Commit the radar change**

```bash
git add index.html tests/maintenance-mode.test.mjs
git commit -m "style: place report radar labels outside chart"
```

### Task 4: Rendered desktop and mobile verification

**Files:**
- Modify: none
- Test: live deployed page or local static preview

- [ ] **Step 1: Verify the desktop report flow**

Open the assessment, complete all 12 questions, and confirm the report opens with a readable question title, compact stage card, and labels outside the radar polygon.

- [ ] **Step 2: Verify a mobile viewport**

At a width near `390px`, complete the same flow and confirm labels remain readable, do not clip, and the report remains single-column.

- [ ] **Step 3: Check browser console health**

Confirm the tested flow produces no relevant JavaScript errors or framework error overlay.
