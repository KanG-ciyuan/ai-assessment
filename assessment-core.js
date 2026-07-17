export const DIMENSION_ORDER = ['understanding', 'expression', 'application', 'workflow'];

export const DIMENSIONS = {
  understanding: {
    name: 'AI 理解与判断',
    questionIds: [1, 2, 3],
    max: 9,
    explanation: '理解 AI 的适用边界，并能核验和修正输出。',
  },
  expression: {
    name: '任务表达与协作',
    questionIds: [4, 5, 6],
    max: 9,
    explanation: '将模糊需求表达为清晰、可迭代的任务。',
  },
  application: {
    name: '场景应用与问题解决',
    questionIds: [7, 8, 9],
    max: 9,
    explanation: '用 AI 处理学习、生活或工作中的真实问题。',
  },
  workflow: {
    name: '工具选择与流程能力',
    questionIds: [10, 11, 12],
    max: 9,
    explanation: '根据任务选择工具，并组织多步骤工作过程。',
  },
};

export const STAGES = [
  {
    key: 'cognitive-start',
    name: '认知起步',
    min: 0,
    max: 9,
    desc: '你已经知道 AI 可以帮忙，下一步是建立一次真实使用和核验的习惯。',
  },
  {
    key: 'basic-collaboration',
    name: '基础协作',
    min: 10,
    max: 18,
    desc: '你能借助 AI 完成简单任务，下一步是把需求表达得更清楚，并检查结果。',
  },
  {
    key: 'scenario-application',
    name: '场景应用',
    min: 19,
    max: 27,
    desc: '你已经能把 AI 用进具体问题，下一步是沉淀可复用的方法和场景。',
  },
  {
    key: 'workflow-advanced',
    name: '流程进阶',
    min: 28,
    max: 36,
    desc: '你能选择工具并组织多步骤任务，适合继续优化自己的工作流程。',
  },
];

export const QUESTIONS = [
  { id: 1, dimension: 'understanding', scenario: '生活', text: 'AI 对一项会随时间变化的重要信息给出很肯定的回答时，你通常会？', options: ['直接照着做', '觉得说得通就采用', '追问依据或再找一个来源核对', '把 AI 当作线索，优先核验官方或原始信息，并标出不确定处'] },
  { id: 2, dimension: 'understanding', scenario: '工作', text: '遇到一项需要你本人承担后果的决定时，你会怎样使用 AI？', options: ['让 AI 直接替我决定', '问一个笼统问题后按建议做', '说明自己的情况，把回答作为参考再自行判断', '让 AI 列出方案、风险和需要补充的信息，再结合事实和责任边界做决定'] },
  { id: 3, dimension: 'understanding', scenario: '工作', text: 'AI 根据一份资料生成了总结，但你发现其中有几处似乎不对时，你会？', options: ['直接使用', '大致读一遍，感觉没问题就使用', '对照原资料修改明显错误', '把结论拆成事实点逐项核验，保留来源依据，并让 AI 按修正意见重写'] },
  { id: 4, dimension: 'expression', scenario: '工作', text: '需要把一堆零散会议记录整理成给负责人看的周报时，你会怎样提要求？', options: ['只说“帮我写周报”', '把记录贴进去后说“总结一下”', '说明读者、重点和输出格式', '先说明目标、读者、材料边界和格式，拿到初稿后按遗漏点继续补充和修改'] },
  { id: 5, dimension: 'expression', scenario: '工作', text: 'AI 的第一版结果不符合你的预期时，你通常会？', options: ['放弃使用 AI', '重新发一次同样的问题', '直接指出不满意的部分，让它修改', '说明差距、补充示例和限制条件，分步修改并检查最终结果'] },
  { id: 6, dimension: 'expression', scenario: '生活', text: '想让 AI 帮你制定一周学习或生活计划时，你会提供什么信息？', options: ['只问“帮我做计划”', '只给一个大致目标', '给出目标和可用时间', '给出目标、现状、时间、限制和优先级，并要求给出可调整的检查点'] },
  { id: 7, dimension: 'application', scenario: '学习', text: '遇到一个不理解的知识点时，你会怎样借助 AI 学习？', options: ['不会想到用 AI', '只问“这是什么”', '让 AI 用例子解释，再追问不懂的地方', '要求分层解释、举例、出练习并检查自己的理解，再把结论用到一道真实题目中'] },
  { id: 8, dimension: 'application', scenario: '生活', text: '规划一次出行或重要安排时，你会怎样使用 AI？', options: ['不使用', '只问推荐地点或建议', '告诉它预算、时间和偏好，参考生成的方案', '让它给出行程、预算、备选方案和待确认事项，再自行核验关键价格和规则'] },
  { id: 9, dimension: 'application', scenario: '工作', text: '面对一份杂乱的数据、资料或任务清单时，你会怎样让 AI 帮忙？', options: ['觉得 AI 帮不上忙', '把内容丢进去让它随便整理', '让它按指定分类、表格或优先级整理', '先定义要解决的问题和验收格式，再让 AI 分步整理，并用原始材料检查结果'] },
  { id: 10, dimension: 'workflow', scenario: '学习', text: '需要从一份很长的材料中提取重点并完成一页笔记时，你会？', options: ['只用最熟悉的聊天框', '整份材料一次性贴进去', '选择适合处理长材料的工具，并明确要提取的重点', '将提取、整理和复核拆开，选择适合的工具或功能，并保留可复用的笔记模板'] },
  { id: 11, dimension: 'workflow', scenario: '工作', text: '每周都要重复完成类似的信息整理任务时，你会？', options: ['每次从头做', '保存一次结果，下次再找', '保存提示词或表格模板复用', '把输入、处理和输出步骤标准化，形成检查清单、模板或简单自动化流程'] },
  { id: 12, dimension: 'workflow', scenario: '生活', text: '需要基于多份可信资料回答一个问题时，你会？', options: ['只相信 AI 的第一句回答', '把所有内容一次性塞给 AI', '选择能引用资料的方式，并检查关键出处', '先确定资料范围和可信标准，再分步检索、整理观点、核验出处并输出结论'] },
];

export const STORAGE_KEY = 'ai-assessment:v2:last-result';

const priorityIndex = Object.fromEntries(DIMENSION_ORDER.map((key, index) => [key, index]));

const ROUTES = {
  foundation: {
    name: '基础上手路径',
    steps: [
      { label: '第 1 天', title: '选一个高频小任务', desc: '从解释一个概念、整理一段资料或规划一天开始，用 AI 完成一次真实任务。' },
      { label: '第 2 天', title: '完成第一次实践', desc: '按昨天选定的任务完成一版结果，先关注是否真正帮你节省了时间。' },
      { label: '第 3 天', title: '补全任务信息', desc: '在提问中补上目标、背景、限制和希望得到的格式，再比较结果变化。' },
      { label: '第 4 天', title: '再做一次同类任务', desc: '用改进后的提问方式处理一件相似任务，确认它不是偶然有效。' },
      { label: '第 5 天', title: '比较并调整提问', desc: '对照两次结果，保留有效信息，删掉无效描述，写出自己的提问要点。' },
      { label: '第 6 天', title: '固定可复用步骤', desc: '把任务背景、提问方式和检查步骤整理成一页简短的操作清单。' },
      { label: '第 7 天', title: '核验并保存模板', desc: '检查关键事实和遗漏内容，把有效的提问方式保存为自己的模板。' },
    ],
  },
  scenario: {
    name: '场景应用路径',
    steps: [
      { label: '第 1 天', title: '选择一个真实问题', desc: '挑一件本周必须完成的学习、生活或工作任务，不用虚构练习。' },
      { label: '第 2 天', title: '明确目标和材料', desc: '写清这件事的目标、已有材料、限制条件，以及什么结果才算完成。' },
      { label: '第 3 天', title: '完成一次完整协作', desc: '按目标、输入、输出格式、核验和修改五步，让 AI 参与整个过程。' },
      { label: '第 4 天', title: '用到第二个场景', desc: '把同样的方法用于另一件真实小事，观察哪些步骤仍然适用。' },
      { label: '第 5 天', title: '检查结果是否可靠', desc: '核对关键事实、数字和遗漏项，记录需要由自己最终判断的部分。' },
      { label: '第 6 天', title: '优化协作方式', desc: '根据两次体验调整输入、输出格式和检查点，让过程更顺手。' },
      { label: '第 7 天', title: '复盘可复用部分', desc: '记录这次最有效的提问、检查点和结果格式，下次直接复用。' },
    ],
  },
  workflow: {
    name: '流程进阶路径',
    steps: [
      { label: '第 1 天', title: '找出重复任务', desc: '列出一项每周会重复出现的信息整理、写作或计划任务。' },
      { label: '第 2 天', title: '收集一次完整样本', desc: '准备这项任务的原始输入、参考结果和常见问题，作为后续优化依据。' },
      { label: '第 3 天', title: '拆成输入、处理和输出', desc: '为每一步确定材料、工具和验收标准，避免把所有事情交给一次对话。' },
      { label: '第 4 天', title: '跑通第一版流程', desc: '按拆分后的步骤完成一次任务，记录每一步花费的时间和卡点。' },
      { label: '第 5 天', title: '删掉无效步骤', desc: '找出重复、模糊或容易出错的环节，补上必要的检查动作。' },
      { label: '第 6 天', title: '沉淀输入和输出模板', desc: '把常用材料、提示词、表格格式和检查清单整理到同一个位置。' },
      { label: '第 7 天', title: '沉淀为模板或清单', desc: '把步骤整理成可复用提示词、表格模板或检查清单，并在下一次任务中验证。' },
    ],
  },
};

function scoreAnswer(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= 3 ? numeric : 0;
}

function selectRoute(priorityDimension, total) {
  if (priorityDimension.key === 'application') {
    return { key: 'scenario', ...ROUTES.scenario };
  }
  if (priorityDimension.key === 'workflow' && total >= 19) {
    return { key: 'workflow', ...ROUTES.workflow };
  }
  return { key: 'foundation', ...ROUTES.foundation };
}

export function getDimensionStatus(score) {
  if (score >= 7) return { key: 'strength', name: '优势' };
  if (score >= 4) return { key: 'developing', name: '发展中' };
  return { key: 'priority', name: '优先提升' };
}

export function calculateAssessment(answers = {}) {
  const dimensions = Object.fromEntries(DIMENSION_ORDER.map((key) => {
    const config = DIMENSIONS[key];
    const score = config.questionIds.reduce((sum, id) => sum + scoreAnswer(answers[id]), 0);
    return [key, {
      key,
      name: config.name,
      explanation: config.explanation,
      score,
      max: config.max,
      rate: Math.round((score / config.max) * 100),
      status: getDimensionStatus(score),
    }];
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

  return {
    answers: { ...answers },
    dimensions,
    total,
    stage,
    priorityDimension: ranked[0],
    strengths,
    route: selectRoute(ranked[0], total),
  };
}

export function createAssessmentId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `assessment-${uuid}`;
  return `assessment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
