function formatFeishuDate(value) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function buildAssessmentExport({ assessmentId, consentedAt, completedAt, answers, result }) {
  return {
    '测评编号': assessmentId,
    '同意时间': formatFeishuDate(consentedAt),
    '完成时间': formatFeishuDate(completedAt),
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
