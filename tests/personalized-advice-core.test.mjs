import assert from 'node:assert/strict';
import test from 'node:test';
import { QUESTIONS, calculateAssessment } from '../assessment-core.js';
import {
  buildAdviceInput,
  buildPersonalizedAdvicePrompt,
  isCompleteAnswerSet,
  parsePersonalizedAdvice,
} from '../personalized-advice-core.js';

const allAnswers = (value) => Object.fromEntries(QUESTIONS.map(({ id }) => [id, value]));

test('accepts exactly twelve V2 answer values from zero through three', () => {
  assert.equal(isCompleteAnswerSet(allAnswers(2)), true);
  assert.equal(isCompleteAnswerSet({ 1: 2 }), false);
  assert.equal(isCompleteAnswerSet({ ...allAnswers(2), 3: 4 }), false);
});

test('advice input contains only V2 result fields and route day one', () => {
  const input = buildAdviceInput(calculateAssessment(allAnswers(2)));
  assert.equal(input.dimensions.length, 4);
  assert.equal(input.routeDayOne.label, '第 1 天');
  assert.equal('answers' in input, false);
  assert.equal('questions' in input, false);
});

test('prompt requires exactly three plain-text JSON fields', () => {
  const prompt = buildPersonalizedAdvicePrompt(buildAdviceInput(calculateAssessment(allAnswers(2))));
  assert.match(prompt, /current_status/);
  assert.match(prompt, /next_action/);
  assert.match(prompt, /caution/);
  assert.doesNotMatch(prompt, /AI 认知|使用频率|行业应用/);
});

test('parses valid plain JSON and rejects markdown or invalid structures', () => {
  const currentStatus = '甲'.repeat(25);
  const nextAction = '乙'.repeat(40);
  const caution = '丙'.repeat(25);

  assert.deepEqual(
    parsePersonalizedAdvice(JSON.stringify({
      current_status: currentStatus,
      next_action: nextAction,
      caution,
    })),
    { currentStatus, nextAction, caution },
  );
  assert.throws(() => parsePersonalizedAdvice('```json\n{}\n```'));
  assert.throws(() => parsePersonalizedAdvice('{"current_status":"a","next_action":"b","caution":"c","extra":"d"}'));
});

test('rejects incomplete answers and overlong advice fields', () => {
  assert.equal(isCompleteAnswerSet({ ...allAnswers(1), 12: '1' }), false);
  assert.throws(() => parsePersonalizedAdvice(JSON.stringify({
    current_status: '甲'.repeat(71),
    next_action: '乙'.repeat(40),
    caution: '丙'.repeat(25),
  })));
});
