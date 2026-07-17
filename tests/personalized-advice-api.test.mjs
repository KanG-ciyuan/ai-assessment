import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/personalized-advice.js';

const requestFor = (body) => new Request('https://example.test/api/personalized-advice', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
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

test('returns safe diagnostics when the model request is rejected', async () => {
  const originalFetch = globalThis.fetch;
  let requestPayload;
  globalThis.fetch = async (_url, options) => {
    requestPayload = JSON.parse(options.body);
    return new Response('', { status: 404 });
  };
  const db = {
    prepare(sql) {
      return {
        async run() {},
        bind() {
          return {
            async first() {
              return sql.includes('COUNT') ? { count: 0 } : null;
            },
            async run() {},
          };
        },
      };
    },
  };

  try {
    const response = await onRequest({
      request: requestFor({
        assessmentId: 'assessment-model-status-1234',
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [index + 1, 1])),
      }),
      env: { DEEPSEEK_API_KEY: 'test-key', IP_HASH_SECRET: 'test-secret', DB: db, DEEPSEEK_MODEL: 'deepseek-v4-flash' },
    });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      success: false,
      code: 'MODEL_REQUEST_FAILED',
      error: '暂时无法生成，请稍后重试',
      diagnostic: { stage: 'request', model: 'deepseek-v4-flash', status: 404 },
    });
    assert.deepEqual(requestPayload.thinking, { type: 'disabled' });
    assert.deepEqual(requestPayload.response_format, { type: 'json_object' });
    assert.equal(requestPayload.max_tokens, 500);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns field lengths without model text when a JSON reply fails validation', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      current_status: '甲'.repeat(10),
      next_action: '乙'.repeat(40),
      caution: '丙'.repeat(20),
    }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const db = {
    prepare(sql) {
      return {
        async run() {},
        bind() {
          return {
            async first() {
              return sql.includes('COUNT') ? { count: 0 } : null;
            },
            async run() {},
          };
        },
      };
    },
  };

  try {
    const response = await onRequest({
      request: requestFor({
        assessmentId: 'assessment-short-field-1234',
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [index + 1, 1])),
      }),
      env: { DEEPSEEK_API_KEY: 'test-key', IP_HASH_SECRET: 'test-secret', DB: db, DEEPSEEK_MODEL: 'deepseek-v4-flash' },
    });
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.code, 'MODEL_RESPONSE_INVALID');
    assert.deepEqual(body.diagnostic.fieldLengths, {
      current_status: 10,
      next_action: 40,
      caution: 20,
    });
    assert.equal('content' in body.diagnostic, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
