import assert from 'node:assert/strict';
import test from 'node:test';
import { QUESTIONS, calculateAssessment } from '../assessment-core.js';
import {
  buildAdviceInput,
  buildPersonalizedAdvicePrompt,
  isCompleteAnswerSet,
  validatePersonalizedAdvice,
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

test('prompt provides measurement facts without forcing a JSON response contract', () => {
  const prompt = buildPersonalizedAdvicePrompt(buildAdviceInput(calculateAssessment(allAnswers(2))));
  assert.match(prompt, /四维得分/);
  assert.match(prompt, /自然的中文/);
  assert.doesNotMatch(prompt, /current_status/);
  assert.doesNotMatch(prompt, /JSON 对象/);
  assert.doesNotMatch(prompt, /AI 认知|使用频率|行业应用/);
});

test('accepts non-empty freeform advice including Markdown', () => {
  const advice = '## 今天先做什么\n\n用 **AI** 整理一次真实会议记录。';
  assert.equal(validatePersonalizedAdvice(advice), advice);
});

test('rejects incomplete answers and blank advice text', () => {
  assert.equal(isCompleteAnswerSet({ ...allAnswers(1), 12: '1' }), false);
  assert.throws(() => validatePersonalizedAdvice('   '));
  assert.throws(() => validatePersonalizedAdvice(null));
});
