import { calculateAssessment } from '../../assessment-core.js';
import {
  buildAdviceInput,
  buildPersonalizedAdvicePrompt,
  isCompleteAnswerSet,
  parsePersonalizedAdvice,
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

  try {
    const modelResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个简洁、务实的 AI 学习教练。严格遵守用户消息中的 JSON 输出契约。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 350,
      }),
    });
    if (!modelResponse.ok) throw new Error('model request failed');
    const modelData = await modelResponse.json();
    advice = parsePersonalizedAdvice(modelData.choices?.[0]?.message?.content || '');
  } catch {
    return jsonResponse({ success: false, code: 'MODEL_RESPONSE_INVALID', error: '暂时无法生成，请稍后重试' }, 502);
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
