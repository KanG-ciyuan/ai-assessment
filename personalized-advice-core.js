import { DIMENSION_ORDER, QUESTIONS } from './assessment-core.js';

const ADVICE_KEYS = ['current_status', 'next_action', 'caution'];
const MARKDOWN_PATTERN = /```|^\s*(#{1,6}\s|[-*+]\s+|\d+[.)]\s+)|\|/m;
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}]/u;
const FIELD_LIMITS = {
  current_status: [25, 70],
  next_action: [40, 90],
  caution: [25, 70],
};

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

export function buildPersonalizedAdvicePrompt(input) {
  const dimensions = input.dimensions
    .map((dimension) => `${dimension.name}：${dimension.score}/${dimension.max}，${dimension.status}`)
    .join('\n');

  return `请基于以下已计算的 AI 应用能力测评结果，给出一次简洁、务实的行动建议。

阶段：${input.stage.name}
阶段说明：${input.stage.description}
总分：${input.total}/36
四维得分：
${dimensions}
优势：${input.strengths.join('、')}
优先提升：${input.priority}
第 1 天行动：${input.routeDayOne.title}。${input.routeDayOne.desc}

只返回一个合法 JSON 对象，不要 Markdown、列表、表格、Emoji、代码块、额外字段、标题、寒暄或解释。
键必须且只能是 current_status、next_action、caution。
current_status 为 25-70 个字符，next_action 为 40-90 个字符，caution 为 25-70 个字符。
next_action 必须把第 1 天行动具体化，包含一个真实场景、完成动作和检查标准。`;
}

function invalidAdviceResponse() {
  throw new Error('invalid personalized advice response');
}

function normalizeField(value, key) {
  if (typeof value !== 'string') invalidAdviceResponse();
  const text = value.trim();
  const [min, max] = FIELD_LIMITS[key];
  if (!text || [...text].length < min || [...text].length > max || MARKDOWN_PATTERN.test(text) || EMOJI_PATTERN.test(text)) {
    invalidAdviceResponse();
  }
  return text;
}

export function parsePersonalizedAdvice(content) {
  if (typeof content !== 'string' || MARKDOWN_PATTERN.test(content) || EMOJI_PATTERN.test(content)) {
    invalidAdviceResponse();
  }

  let parsed;
  try {
    parsed = JSON.parse(content.trim());
  } catch {
    invalidAdviceResponse();
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') invalidAdviceResponse();
  const keys = Object.keys(parsed).sort();
  const expectedKeys = [...ADVICE_KEYS].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) invalidAdviceResponse();

  return {
    currentStatus: normalizeField(parsed.current_status, 'current_status'),
    nextAction: normalizeField(parsed.next_action, 'next_action'),
    caution: normalizeField(parsed.caution, 'caution'),
  };
}
