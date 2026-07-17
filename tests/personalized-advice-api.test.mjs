import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/personalized-advice.js';

const requestFor = (body) => new Request('https://example.test/api/personalized-advice', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

test('returns a safe unavailable response when advice secrets are absent', async () => {
  const response = await onRequest({ request: requestFor({}), env: {} });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    success: false,
    code: 'FEATURE_UNAVAILABLE',
    error: '个性化建议暂未开启',
  });
});

test('rejects an invalid assessment request before model access', async () => {
  const response = await onRequest({
    request: requestFor({ assessmentId: 'assessment-test-1234', answers: { 1: 0 } }),
    env: { DEEPSEEK_API_KEY: 'test-key', IP_HASH_SECRET: 'test-secret', DB: {} },
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'INVALID_REQUEST');
});
