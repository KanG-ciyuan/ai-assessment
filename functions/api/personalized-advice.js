import { calculateAssessment } from '../../assessment-core.js';
import {
  buildAdviceInput,
  buildPersonalizedAdvicePrompt,
  isCompleteAnswerSet,
  validatePersonalizedAdvice,
} from '../../personalized-advice-core.js';

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

class ModelFailure extends Error {
  constructor(code, diagnostic) {
    super(code);
    this.code = code;
    this.diagnostic = diagnostic;
  }
}

function isAssessmentId(value) {
  return typeof value === 'string' && /^assessment-[a-z0-9-]{8,160}$/i.test(value);
}

async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function readRequestBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ success: false, error: '只支持 POST 请求' }, 405);
  if (!env.DEEPSEEK_API_KEY || !env.IP_HASH_SECRET || !env.DB) {
    return jsonResponse({ success: false, code: 'FEATURE_UNAVAILABLE', error: '个性化建议暂未开启' }, 503);
  }

  const body = await readRequestBody(request);
  if (!body || !isAssessmentId(body.assessmentId) || !isCompleteAnswerSet(body.answers)) {
    return jsonResponse({ success: false, code: 'INVALID_REQUEST', error: '测评结果无效，请重新完成测评' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return jsonResponse({ success: false, code: 'FEATURE_UNAVAILABLE', error: '个性化建议暂未开启' }, 503);

  const dayKey = new Date().toISOString().slice(0, 10);
  const ipHash = await hashIp(ip, env.IP_HASH_SECRET);

  try {
    await env.DB.prepare("DELETE FROM personalized_advice_usage WHERE created_at < datetime('now', '-7 days')").run();

    const existing = await env.DB.prepare(
      'SELECT assessment_id FROM personalized_advice_usage WHERE assessment_id = ?'
    ).bind(body.assessmentId).first();
    if (existing) {
      return jsonResponse({ success: false, code: 'ASSESSMENT_ALREADY_USED', error: '本次测评的建议已生成' }, 409);
    }

    const dailyUsage = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM personalized_advice_usage WHERE ip_hash = ? AND day_key = ?'
    ).bind(ipHash, dayKey).first();
    if (Number(dailyUsage?.count || 0) >= 5) {
      return jsonResponse({ success: false, code: 'DAILY_LIMIT_REACHED', error: '今日个性化建议额度已用完，请明日再试' }, 429);
    }
  } catch {
    return jsonResponse({ success: false, code: 'FEATURE_UNAVAILABLE', error: '个性化建议暂未开启' }, 503);
  }

  const result = calculateAssessment(body.answers);
  const prompt = buildPersonalizedAdvicePrompt(buildAdviceInput(result));
  let advice;
  const model = env.DEEPSEEK_MODEL || 'deepseek-chat';

  try {
    const modelResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是一个务实、耐心的 AI 学习教练。请以自然中文给出高质量、可执行的建议。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      }),
    });
    if (!modelResponse.ok) {
      const diagnostic = { stage: 'request', model, status: modelResponse.status };
      console.error('personalized-advice model request failed', diagnostic);
      throw new ModelFailure('MODEL_REQUEST_FAILED', diagnostic);
    }
    let modelData;
    try {
      modelData = await modelResponse.json();
    } catch {
      throw new ModelFailure('MODEL_RESPONSE_INVALID', { stage: 'decode', model });
    }
    const content = modelData.choices?.[0]?.message?.content || '';
    try {
      advice = validatePersonalizedAdvice(content);
    } catch {
      throw new ModelFailure('MODEL_RESPONSE_EMPTY', { stage: 'content', model });
    }
  } catch (error) {
    if (!(error instanceof ModelFailure)) {
      console.error('personalized-advice model call failed', {
        model,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
    const failure = error instanceof ModelFailure
      ? error
      : new ModelFailure('MODEL_REQUEST_FAILED', { stage: 'network', model });
    return jsonResponse({
      success: false,
      code: failure.code,
      error: '暂时无法生成，请稍后重试',
      diagnostic: failure.diagnostic,
    }, 502);
  }

  try {
    await env.DB.prepare(
      'INSERT INTO personalized_advice_usage (assessment_id, ip_hash, day_key) VALUES (?, ?, ?)'
    ).bind(body.assessmentId, ipHash, dayKey).run();
  } catch {
    return jsonResponse({ success: false, code: 'ASSESSMENT_ALREADY_USED', error: '本次测评的建议已生成' }, 409);
  }

  return jsonResponse({ success: true, advice });
}
