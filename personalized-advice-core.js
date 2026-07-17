import { DIMENSION_ORDER, QUESTIONS } from './assessment-core.js';

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

  return `你是一位务实的 AI 应用学习教练。请基于以下已计算的 AI 应用能力测评结果，给出高质量、贴合实际的个性化建议。

阶段：${input.stage.name}
阶段说明：${input.stage.description}
总分：${input.total}/36
四维得分：
${dimensions}
优势：${input.strengths.join('、')}
优先提升：${input.priority}
第 1 天行动：${input.routeDayOne.title}。${input.routeDayOne.desc}

请只依据这些测评事实，不要臆测用户的职业、行业、经历或工具使用情况。
用自然的中文直接回应，可以按你的判断使用标题、段落、列表和加粗，让用户容易看懂。
重点说明他目前最值得关注的能力问题、为什么优先处理它，以及下一步怎样在真实生活或工作任务中开始实践。建议要具体、可执行，但不需要为了凑格式而机械分段。`;
}

export function validatePersonalizedAdvice(content) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('invalid personalized advice response');
  }
  return content.trim();
}
