import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAssessment } from '../assessment-core.js';
import { buildAssessmentExport } from '../assessment-export-core.js';

const answers = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 0, 6: 1, 7: 2, 8: 3, 9: 0, 10: 1, 11: 2, 12: 3 };

test('maps only approved anonymous assessment fields', () => {
  const payload = buildAssessmentExport({
    assessmentId: 'assessment-test-1234',
    consentedAt: '2026-07-18T08:00:00.000Z',
    completedAt: '2026-07-18T08:05:00.000Z',
    answers,
    result: calculateAssessment(answers),
  });

  assert.deepEqual(payload, {
    '测评编号': 'assessment-test-1234',
    '同意时间': '2026-07-18T08:00:00.000Z',
    '完成时间': '2026-07-18T08:05:00.000Z',
    '题目答案': JSON.stringify(answers),
    'AI 理解与判断': 3,
    '任务表达与协作': 4,
    '场景应用与问题解决': 5,
    '工具选择与流程能力': 6,
    '总分': 18,
    '能力阶段': '基础协作',
    '测评版本': 'V2.1',
  });
  assert.equal('IP' in payload, false);
  assert.equal('个性化建议' in payload, false);
});
