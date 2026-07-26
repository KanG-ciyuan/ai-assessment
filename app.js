import {
  DIMENSION_ORDER,
  DIMENSIONS,
  QUESTIONS,
  STORAGE_KEY,
  calculateAssessment,
  createAssessmentId,
  createStoredResult,
} from './assessment-core.js';

const AUTO_ADVANCE_DELAY_MS = 320;

const els = Object.fromEntries([...document.querySelectorAll('[id]')].map((el) => [el.id, el]));
const state = {
  view: 'home',
  questionIndex: 0,
  answers: {},
  result: null,
  assessmentId: null,
  consentedAt: null,
  storedResult: null,
};
let autoAdvanceTimer = null;

function cancelAutoAdvance() {
  if (autoAdvanceTimer === null) return;
  clearTimeout(autoAdvanceTimer);
  autoAdvanceTimer = null;
}

function showView(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
  window.scrollTo({ top: 0, behavior: 'instant' });
  els.headerStatus.textContent = view === 'quiz' ? `QUESTION ${String(state.questionIndex + 1).padStart(2, '0')} / 12` : 'FIELD READY';
  drawProfile();
}

function startAssessment() {
  if (!els.consentInput.checked) return;
  cancelAutoAdvance();
  state.answers = {};
  state.result = null;
  state.questionIndex = 0;
  state.assessmentId = createAssessmentId();
  state.consentedAt = new Date().toISOString();
  state.storedResult = null;
  renderQuestion();
  showView('quiz');
}

function renderQuestion() {
  const question = QUESTIONS[state.questionIndex];
  const dimension = DIMENSIONS[question.dimension];
  const selected = state.answers[question.id];
  const progress = ((state.questionIndex + 1) / QUESTIONS.length) * 100;

  els.questionCurrent.textContent = String(state.questionIndex + 1).padStart(2, '0');
  els.dimensionName.textContent = dimension.name;
  els.dimensionExplanation.textContent = dimension.explanation;
  els.scenarioName.textContent = `${question.scenario}场景`;
  els.questionText.textContent = question.text;
  els.progressPercent.textContent = `${Math.round(progress)}%`;
  els.progressFill.style.width = `${progress}%`;
  els.previousButton.disabled = state.questionIndex === 0;
  els.headerStatus.textContent = `QUESTION ${String(state.questionIndex + 1).padStart(2, '0')} / 12`;

  els.answerList.replaceChildren(...question.options.map((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `answer-option${selected === index ? ' selected' : ''}`;
    button.innerHTML = `<span class="letter">${String.fromCharCode(65 + index)}</span><span class="answer-text"></span><span class="answer-check">✓</span>`;
    button.querySelector('.answer-text').textContent = option;
    button.addEventListener('click', () => {
      cancelAutoAdvance();
      state.answers[question.id] = index;
      renderQuestion();
      autoAdvanceTimer = window.setTimeout(() => {
        autoAdvanceTimer = null;
        nextQuestion();
      }, AUTO_ADVANCE_DELAY_MS);
    });
    return button;
  }));

  els.dimensionIndex.replaceChildren(...DIMENSION_ORDER.map((key) => {
    const marker = document.createElement('i');
    const dimensionIndex = DIMENSION_ORDER.indexOf(question.dimension);
    const itemIndex = DIMENSION_ORDER.indexOf(key);
    marker.className = itemIndex < dimensionIndex ? 'done' : itemIndex === dimensionIndex ? 'current' : '';
    return marker;
  }));

  els.bioProgress.replaceChildren(...QUESTIONS.map((item, index) => {
    const marker = document.createElement('i');
    marker.className = state.answers[item.id] !== undefined || index < state.questionIndex ? 'done' : index === state.questionIndex ? 'current' : '';
    return marker;
  }));
}

function nextQuestion() {
  const question = QUESTIONS[state.questionIndex];
  if (state.answers[question.id] === undefined) return;
  if (state.questionIndex < QUESTIONS.length - 1) {
    state.questionIndex += 1;
    renderQuestion();
    return;
  }
  state.result = calculateAssessment(state.answers);
  const completedAt = new Date().toISOString();
  const stored = createStoredResult(
    state.result,
    state.answers,
    completedAt,
    state.assessmentId,
    state.consentedAt,
  );
  state.storedResult = stored;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  updateLastResultButton();
  renderResult();
  showView('result');
  exportAssessment(stored, completedAt);
}

function previousQuestion() {
  cancelAutoAdvance();
  if (state.questionIndex === 0) return;
  state.questionIndex -= 1;
  renderQuestion();
}

function renderResult() {
  const result = state.result;
  if (!result) return;
  els.totalScore.textContent = result.total;
  els.profileScore.textContent = result.total;
  els.stageName.textContent = result.stage.name;
  els.stageDescription.textContent = result.stage.desc;
  els.priorityName.textContent = result.priorityDimension.name;
  els.priorityExplanation.textContent = result.priorityDimension.explanation;
  els.strengthNames.textContent = result.strengths.map((item) => item.name).join(' / ');
  els.routeName.textContent = result.route.name;
  renderPersonalizedAdvice(state.storedResult);

  const scoreTargets = {
    understanding: els.scoreUnderstanding,
    expression: els.scoreExpression,
    application: els.scoreApplication,
    workflow: els.scoreWorkflow,
  };
  DIMENSION_ORDER.forEach((key) => {
    scoreTargets[key].textContent = `${result.dimensions[key].score} / 9`;
  });

  els.dimensionBars.replaceChildren(...DIMENSION_ORDER.map((key) => {
    const dimension = result.dimensions[key];
    const row = document.createElement('div');
    row.className = 'dimension-bar';
    row.innerHTML = `<span></span><div class="bar"><i></i></div><b></b>`;
    row.querySelector('span').textContent = dimension.name;
    row.querySelector('i').style.width = `${dimension.rate}%`;
    row.querySelector('b').textContent = `${dimension.score} / 9`;
    return row;
  }));

  els.routeGrid.replaceChildren(...result.route.steps.map((step, index) => {
    const day = document.createElement('article');
    day.className = 'route-day';
    day.innerHTML = `<span>D${index + 1}</span><strong></strong><p></p>`;
    day.querySelector('strong').textContent = step.title;
    day.querySelector('p').textContent = step.desc;
    return day;
  }));
  requestAnimationFrame(drawProfile);
}

function updateLastResultButton() {
  els.lastResultButton.hidden = !localStorage.getItem(STORAGE_KEY);
}

function loadLastResult() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored?.version !== 2 || !stored?.answers) return;
    state.answers = stored.answers;
    state.result = calculateAssessment(stored.answers);
    state.assessmentId = stored.assessmentId;
    state.consentedAt = stored.consentedAt;
    state.storedResult = stored;
    renderResult();
    showView('result');
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    updateLastResultButton();
  }
}

async function exportAssessment(stored, completedAt) {
  try {
    await fetch('/api/assessment-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessmentId: stored.assessmentId,
        consentedAt: stored.consentedAt,
        completedAt,
        answers: stored.answers,
      }),
    });
  } catch {
    // Anonymous export must never block the local report.
  }
}

function appendInlineMarkdown(target, source) {
  source.split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      target.append(strong);
      return;
    }
    target.append(document.createTextNode(part));
  });
}

function renderAdviceMarkdown(text) {
  const content = document.createElement('div');
  content.className = 'personalized-advice-content';
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let paragraphLines = [];
  let list = null;
  let listType = null;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    const paragraph = document.createElement('p');
    paragraphLines.forEach((line, index) => {
      if (index) paragraph.append(document.createElement('br'));
      appendInlineMarkdown(paragraph, line);
    });
    content.append(paragraph);
    paragraphLines = [];
  };

  const flushList = () => {
    if (!list) return;
    content.append(list);
    list = null;
    listType = null;
  };

  lines.forEach((line) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const unordered = line.match(/^[-*+]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const title = document.createElement(`h${Math.min(heading[1].length + 2, 5)}`);
      appendInlineMarkdown(title, heading[2]);
      content.append(title);
      return;
    }
    if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? 'ul' : 'ol';
      if (!list || listType !== nextType) {
        flushList();
        list = document.createElement(nextType);
        listType = nextType;
      }
      const item = document.createElement('li');
      appendInlineMarkdown(item, (unordered || ordered)[1]);
      list.append(item);
      return;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }
    flushList();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();
  return content;
}

function getStoredAdviceText(personalizedAdvice) {
  if (typeof personalizedAdvice === 'string') return personalizedAdvice;
  if (!personalizedAdvice || typeof personalizedAdvice !== 'object') return '';
  const sections = [
    ['当前状态', personalizedAdvice.currentStatus],
    ['下一步动作', personalizedAdvice.nextAction],
    ['一个提醒', personalizedAdvice.caution],
  ].filter(([, value]) => typeof value === 'string' && value.trim());
  return sections.map(([title, value]) => `### ${title}\n${value}`).join('\n\n');
}

function setAdviceButtonText(text) {
  els.adviceButton.querySelector('span').textContent = text;
}

class AdviceRequestError extends Error {}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function renderPersonalizedAdvice(stored) {
  const panel = els.personalizedAdvicePanel;
  const content = els.personalizedAdviceContent;
  const status = els.personalizedAdviceStatus;
  const adviceText = getStoredAdviceText(stored?.personalizedAdvice);
  content.replaceChildren();

  if (!adviceText) {
    panel.hidden = true;
    els.adviceButton.hidden = false;
    els.adviceButton.disabled = false;
    setAdviceButtonText('生成个性化建议');
    return;
  }

  status.textContent = '这份建议已为本次测评生成，重新打开报告不会重复调用。';
  content.append(renderAdviceMarkdown(adviceText));
  panel.hidden = false;
  els.adviceButton.hidden = true;
}

async function requestPersonalizedAdvice() {
  if (!state.storedResult || getStoredAdviceText(state.storedResult.personalizedAdvice)) return;
  els.adviceButton.disabled = true;
  setAdviceButtonText('正在生成建议');

  try {
    const response = await fetch('/api/personalized-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessmentId: state.storedResult.assessmentId,
        answers: state.storedResult.answers,
      }),
    });
    const data = await parseJsonResponse(response);
    if (!response.ok || !data?.success) {
      const messages = {
        FEATURE_UNAVAILABLE: '个性化建议暂未开启。固定报告和七天路径仍可正常使用。',
        DAILY_LIMIT_REACHED: '今日个性化建议额度已用完，请明日再试。',
        ASSESSMENT_ALREADY_USED: '本次测评的建议已经生成，请重新完成测评后再获取。',
      };
      throw new AdviceRequestError(messages[data?.code] || '暂时无法生成，请稍后重试。');
    }

    state.storedResult.personalizedAdvice = data.advice;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.storedResult));
    renderPersonalizedAdvice(state.storedResult);
    els.personalizedAdvicePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    els.personalizedAdviceStatus.textContent = error instanceof AdviceRequestError
      ? error.message
      : '暂时无法生成，请稍后重试。';
    els.personalizedAdviceContent.replaceChildren();
    els.personalizedAdvicePanel.hidden = false;
    els.adviceButton.hidden = false;
    els.adviceButton.disabled = false;
    setAdviceButtonText('重新尝试');
    els.personalizedAdvicePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function drawProfile() {
  if (state.view !== 'result' || !state.result) return;
  const canvas = els.profileChart;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.max(300, Math.round(rect.width));
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);
  const center = size / 2;
  const radius = size * .355;
  const styles = getComputedStyle(document.body);
  const primary = styles.getPropertyValue('--primary').trim();
  const secondary = styles.getPropertyValue('--secondary').trim();
  const line = styles.getPropertyValue('--line').trim();
  const values = DIMENSION_ORDER.map((key) => state.result.dimensions[key].score / 9);

  ctx.save();
  ctx.translate(center, center);
  for (let ring = 1; ring <= 4; ring += 1) {
    ctx.beginPath();
    ctx.arc(0, 0, radius * ring / 4, 0, Math.PI * 2);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (let i = 0; i < 4; i += 1) {
    const angle = -Math.PI / 2 + i * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    ctx.strokeStyle = line;
    ctx.stroke();

    const valueRadius = Math.max(radius * .24, radius * values[i]);
    const spread = .64;
    const left = angle - spread;
    const right = angle + spread;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(
      Math.cos(left) * valueRadius * .57,
      Math.sin(left) * valueRadius * .57,
      Math.cos(left) * valueRadius * .8,
      Math.sin(left) * valueRadius * .8,
      Math.cos(angle) * valueRadius,
      Math.sin(angle) * valueRadius,
    );
    ctx.bezierCurveTo(
      Math.cos(right) * valueRadius * .8,
      Math.sin(right) * valueRadius * .8,
      Math.cos(right) * valueRadius * .57,
      Math.sin(right) * valueRadius * .57,
      0,
      0,
    );
    ctx.fillStyle = `${primary}16`;
    ctx.fill();
    ctx.strokeStyle = i % 2 ? secondary : primary;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = i % 2 ? secondary : primary;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(Math.cos(angle) * valueRadius, Math.sin(angle) * valueRadius, 5, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? secondary : primary;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius * .19, 0, Math.PI * 2);
  ctx.strokeStyle = `${primary}88`;
  ctx.stroke();
  ctx.restore();
}

function createField() {
  const canvas = els.field;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let width = 0;
  let height = 0;
  let frame = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(130, Math.round(width / 10));
    particles = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: .5 + Math.random() * 1.7,
      speed: .08 + Math.random() * .3,
      phase: index * .37,
    }));
    drawProfile();
  }

  function draw() {
    frame += .01;
    ctx.clearRect(0, 0, width, height);
    particles.forEach((particle, index) => {
      particle.y -= particle.speed * .35;
      particle.x += Math.sin(frame + particle.phase) * .06;
      if (particle.y < -10) particle.y = height + 10;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      const accent = index % 7 === 0 ? '231,119,85' : '157,219,175';
      ctx.fillStyle = `rgba(${accent},.14)`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
}

els.consentInput.addEventListener('change', () => { els.startButton.disabled = !els.consentInput.checked; });
els.startButton.addEventListener('click', startAssessment);
els.lastResultButton.addEventListener('click', loadLastResult);
els.previousButton.addEventListener('click', previousQuestion);
els.homeButton.addEventListener('click', () => showView('home'));
els.backHomeButton.addEventListener('click', () => showView('home'));
els.restartButton.addEventListener('click', () => {
  cancelAutoAdvance();
  state.questionIndex = 0;
  state.answers = {};
  state.result = null;
  state.assessmentId = createAssessmentId();
  state.consentedAt = new Date().toISOString();
  state.storedResult = null;
  renderQuestion();
  showView('quiz');
});
els.adviceButton.addEventListener('click', requestPersonalizedAdvice);

document.addEventListener('keydown', (event) => {
  if (state.view !== 'quiz' || event.key < '1' || event.key > '4') return;
  const option = els.answerList.querySelectorAll('.answer-option')[Number(event.key) - 1];
  option?.click();
});

updateLastResultButton();
createField();
