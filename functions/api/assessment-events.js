import { calculateAssessment } from '../../assessment-core.js';
import { buildAssessmentExport } from '../../assessment-export-core.js';
import { isCompleteAnswerSet } from '../../personalized-advice-core.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isAssessmentId(value) {
  return typeof value === 'string' && /^assessment-[a-z0-9-]{8,160}$/i.test(value);
}

function isIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

async function readRequestBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function getTenantAccessToken(env) {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }),
  });
  if (!response.ok) return { token: null, diagnostic: { stage: 'token', status: response.status } };
  const data = await response.json();
  if (data.code === 0 && typeof data.tenant_access_token === 'string') {
    return { token: data.tenant_access_token, diagnostic: null };
  }
  return { token: null, diagnostic: { stage: 'token', status: response.status, code: data.code } };
}

async function createFeishuRecord(env, token, fields) {
  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${env.FEISHU_BASE_TOKEN}/tables/${env.FEISHU_ASSESSMENT_TABLE_ID}/records`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fields }),
    },
  );
  if (!response.ok) return { exported: false, diagnostic: { stage: 'record', status: response.status } };
  const data = await response.json();
  if (data.code === 0) return { exported: true, diagnostic: null };
  return { exported: false, diagnostic: { stage: 'record', status: response.status, code: data.code } };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ success: false, error: '只支持 POST 请求' }, 405);
  if (!env.DB || !env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET || !env.FEISHU_BASE_TOKEN || !env.FEISHU_ASSESSMENT_TABLE_ID) {
    return jsonResponse({ success: false, code: 'FEATURE_UNAVAILABLE', error: '匿名数据收集暂未开启' }, 503);
  }

  const body = await readRequestBody(request);
  if (!body?.consentedAt) {
    return jsonResponse({ success: false, code: 'CONSENT_REQUIRED', error: '需要先同意匿名测评数据用于改进测评' }, 400);
  }
  if (!isAssessmentId(body.assessmentId) || !isIsoDate(body.consentedAt) || !isIsoDate(body.completedAt) || !isCompleteAnswerSet(body.answers)) {
    return jsonResponse({ success: false, code: 'INVALID_REQUEST', error: '匿名测评数据无效' }, 400);
  }

  try {
    const existing = await env.DB.prepare(
      'SELECT assessment_id FROM assessment_export_usage WHERE assessment_id = ?'
    ).bind(body.assessmentId).first();
    if (existing) {
      return jsonResponse({ success: false, code: 'ASSESSMENT_ALREADY_EXPORTED', error: '本次测评已记录' }, 409);
    }

    try {
      await env.DB.prepare(
        'INSERT INTO assessment_export_usage (assessment_id) VALUES (?)'
      ).bind(body.assessmentId).run();
    } catch {
      return jsonResponse({ success: false, code: 'ASSESSMENT_ALREADY_EXPORTED', error: '本次测评已记录' }, 409);
    }
  } catch {
    return jsonResponse({ success: false, code: 'FEATURE_UNAVAILABLE', error: '匿名数据收集暂未开启' }, 503);
  }

  const fields = buildAssessmentExport({
    assessmentId: body.assessmentId,
    consentedAt: body.consentedAt,
    completedAt: body.completedAt,
    answers: body.answers,
    result: calculateAssessment(body.answers),
  });

  try {
    const tokenResult = await getTenantAccessToken(env);
    if (!tokenResult.token) {
      console.error('assessment-export failed', tokenResult.diagnostic);
    } else {
      const recordResult = await createFeishuRecord(env, tokenResult.token, fields);
      if (recordResult.exported) return jsonResponse({ success: true, exported: true }, 202);
      console.error('assessment-export failed', recordResult.diagnostic);
    }
  } catch {
    console.error('assessment-export failed', { stage: 'provider_exception' });
  }

  try {
    await env.DB.prepare(
      'DELETE FROM assessment_export_usage WHERE assessment_id = ?'
    ).bind(body.assessmentId).run();
  } catch {
    // A stale guard is safer than exposing an export failure to the visitor.
  }
  return jsonResponse({ success: true, exported: false }, 202);
}
