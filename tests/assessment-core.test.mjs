import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIMENSION_ORDER,
  QUESTIONS,
  calculateAssessment,
  createStoredResult,
} from '../assessment-core.js';

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
  assert.equal(result.route.steps.length, 7);
  assert.deepEqual(result.route.steps.map((step) => step.label), [
    '第 1 天',
    '第 2 天',
    '第 3 天',
    '第 4 天',
    '第 5 天',
    '第 6 天',
    '第 7 天',
  ]);
  assert.equal(stored.version, 2);
  assert.equal(stored.apiReport, undefined);
});
