import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/assessment-events.js';

const answers = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [index + 1, index % 4]));

function requestFor(body) {
  return new Request('https://example.test/api/assessment-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createDb({ existing = false } = {}) {
  const sqlLog = [];
  return {
    sqlLog,
    prepare(sql) {
      return {
        async run() { sqlLog.push(sql); },
        bind() {
          return {
            async first() { return existing ? { assessment_id: 'assessment-duplicate-1234' } : null; },
            async run() { sqlLog.push(sql); },
          };
        },
      };
    },
  };
}

const baseEnv = (DB) => ({
  DB,
  FEISHU_APP_ID: 'cli_test_app_id',
  FEISHU_APP_SECRET: 'test-secret',
  FEISHU_BASE_TOKEN: 'RB9abnjZQa5NUbsOPIFceIa7nET',
  FEISHU_ASSESSMENT_TABLE_ID: 'tblr9WIZADs8875D',
});

test('rejects exports without explicit consent before database or Feishu access', async () => {
  const response = await onRequest({
    request: requestFor({ assessmentId: 'assessment-no-consent-1234', answers }),
    env: baseEnv(createDb()),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    code: 'CONSENT_REQUIRED',
    error: '需要先同意匿名测评数据用于改进测评',
  });
});

test('does not write a duplicate assessment identifier', async () => {
  const response = await onRequest({
    request: requestFor({
      assessmentId: 'assessment-duplicate-1234',
      consentedAt: '2026-07-18T08:00:00.000Z',
      completedAt: '2026-07-18T08:05:00.000Z',
      answers,
    }),
    env: baseEnv(createDb({ existing: true })),
  });

  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'ASSESSMENT_ALREADY_EXPORTED');
});

test('recalculates and exports exactly one approved anonymous record', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    if (url.includes('tenant_access_token')) {
      return new Response(JSON.stringify({ tenant_access_token: 'tenant-token', code: 0 }), { status: 200 });
    }
    return new Response(JSON.stringify({ code: 0, data: { record: { record_id: 'rec-test' } } }), { status: 200 });
  };
  const DB = createDb();

  try {
    const response = await onRequest({
      request: requestFor({
        assessmentId: 'assessment-export-success-1234',
        consentedAt: '2026-07-18T08:00:00.000Z',
        completedAt: '2026-07-18T08:05:00.000Z',
        answers,
      }),
      env: baseEnv(DB),
    });

    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { success: true, exported: true });
    assert.equal(requests.length, 2);
    assert.equal(requests[1].body.fields['测评编号'], 'assessment-export-success-1234');
    assert.equal(requests[1].body.fields['测评版本'], 'V2.1');
    assert.equal('IP' in requests[1].body.fields, false);
    assert.equal(DB.sqlLog.filter((sql) => sql.startsWith('INSERT')).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('releases the D1 reservation when Feishu rejects a record', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new Response(JSON.stringify(
    url.includes('tenant_access_token') ? { tenant_access_token: 'tenant-token', code: 0 } : { code: 99991663 },
  ), { status: 200 });
  const DB = createDb();

  try {
    const response = await onRequest({
      request: requestFor({
        assessmentId: 'assessment-export-failure-1234',
        consentedAt: '2026-07-18T08:00:00.000Z',
        completedAt: '2026-07-18T08:05:00.000Z',
        answers,
      }),
      env: baseEnv(DB),
    });

    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { success: true, exported: false });
    assert.equal(DB.sqlLog.filter((sql) => sql.startsWith('DELETE')).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('logs only safe Feishu failure diagnostics before releasing the reservation', async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const logs = [];
  globalThis.fetch = async (url) => new Response(JSON.stringify(
    url.includes('tenant_access_token') ? { tenant_access_token: 'tenant-token', code: 0 } : { code: 99991663, msg: 'permission denied' },
  ), { status: 200 });
  console.error = (...args) => logs.push(args);

  try {
    await onRequest({
      request: requestFor({
        assessmentId: 'assessment-export-diagnostics-1234',
        consentedAt: '2026-07-18T08:00:00.000Z',
        completedAt: '2026-07-18T08:05:00.000Z',
        answers,
      }),
      env: baseEnv(createDb()),
    });

    assert.deepEqual(logs, [[
      'assessment-export failed',
      { stage: 'record', status: 200, code: 99991663 },
    ]]);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test('persists only safe failure metadata for later diagnosis', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new Response(JSON.stringify(
    url.includes('tenant_access_token') ? { tenant_access_token: 'tenant-token', code: 0 } : { code: 99991663 },
  ), { status: 200 });
  const DB = createDb();

  try {
    await onRequest({
      request: requestFor({
        assessmentId: 'assessment-export-persisted-diagnostic-1234',
        consentedAt: '2026-07-18T08:00:00.000Z',
        completedAt: '2026-07-18T08:05:00.000Z',
        answers,
      }),
      env: baseEnv(DB),
    });

    assert.equal(
      DB.sqlLog.some((sql) => sql.includes('INSERT INTO assessment_export_diagnostics')),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
