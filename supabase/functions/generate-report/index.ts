import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// 环境变量（部署时设置）
// ========================================
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const PROJECT_URL = Deno.env.get("PROJECT_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;

// ========================================
// DeepSeek System Prompt（角色设定）
// ========================================
const SYSTEM_PROMPT = `你是一位资深 AI 能力诊断专家，擅长根据用户的测评数据发现其 AI 能力的强项与薄弱点，并用通俗易懂的语言给出针对性学习建议。

你的原则：
- 不说套话，每条建议都要具体可执行
- 鼓励为主但不讨好，弱项直接指出但不打击
- 用大白话，不要堆砌术语
- 报告读起来像朋友聊天，不像学术论文`;

// ========================================
// 题目数据（与前端保持一致）
// ========================================
const QUESTIONS = [
  { id:1,  dimension:'AI 认知', text:'你对 AI 能做什么了解多少？' },
  { id:2,  dimension:'AI 认知', text:'你平时关注 AI 发展趋势吗？' },
  { id:3,  dimension:'AI 认知', text:'你对 AI 在自己行业/岗位里的应用了解多少？' },
  { id:4,  dimension:'使用频率', text:'你使用 AI 工具有多频繁？' },
  { id:5,  dimension:'使用频率', text:'你主要用 AI 来做什么？' },
  { id:6,  dimension:'工具掌握', text:'你用过多少种 AI 工具？' },
  { id:7,  dimension:'工具掌握', text:'你用 AI 工具到了什么深度？' },
  { id:8,  dimension:'工具掌握', text:'你有没有用过 AI 编程或开发工具？' },
  { id:9,  dimension:'学习意愿', text:'你学习 AI 的意愿有多强？' },
  { id:10, dimension:'学习意愿', text:'遇到 AI 相关问题时，你一般怎么解决？' },
  { id:11, dimension:'行业应用', text:'你有没有用 AI 优化过自己的工作流程？' },
  { id:12, dimension:'行业应用', text:'你对 AI 的商业或产业价值理解到哪个程度？' },
];

const DIM_CONFIG: Record<string, { name: string; max: number; qs: number[] }> = {
  'ai认知':   { name: 'AI 认知',   max: 9, qs: [1, 2, 3] },
  '使用频率': { name: '使用频率', max: 6, qs: [4, 5] },
  '工具掌握': { name: '工具掌握', max: 9, qs: [6, 7, 8] },
  '学习意愿': { name: '学习意愿', max: 6, qs: [9, 10] },
  '行业应用': { name: '行业应用', max: 6, qs: [11, 12] },
};

const DIM_ORDER = ['ai认知', '使用频率', '工具掌握', '学习意愿', '行业应用'];

// ========================================
// 拼装分析 Prompt
// ========================================
function buildPrompt(
  answers: Record<string, number>,
  dimScores: Record<string, { score: number; max: number; rate: number }>,
  totalScore: number
): string {
  let questionsBlock = '';
  DIM_ORDER.forEach((key, di) => {
    const cfg = DIM_CONFIG[key];
    questionsBlock += `【维度${di + 1}：${cfg.name}】\n`;
    cfg.qs.forEach((qid) => {
      const q = QUESTIONS.find(q => q.id === qid);
      const score = answers[String(qid)] ?? 0;
      questionsBlock += `题目${qid}（${q?.text || ''}）：${score}\n`;
    });
    const ds = dimScores[key];
    questionsBlock += `→ 维度${di + 1}总分：${ds?.score || 0}/${cfg.max}\n\n`;
  });

  const scoreRows = DIM_ORDER.map((key) => {
    const cfg = DIM_CONFIG[key];
    const ds = dimScores[key];
    const rate = ds?.rate || 0;
    const levelEmoji = rate >= 80 ? '✨' : rate >= 50 ? '—' : '⚡';
    return `| ${cfg.name} | ${ds?.score || 0} | ${cfg.max} | ${levelEmoji} |`;
  }).join('\n');

  const prompt = `用户完成了 12 道选择题，以下是每道题的维度归属、题干和用户得分（0/1/2/3 分）：

${questionsBlock}总分：${totalScore}/36

---
## 评分参考
各维度得分率：
- 80%以上 = 强项 ✨
- 50%-79% = 中等
- 50%以下 = 薄弱点 ⚡

---
## 输出报告结构
请严格按以下结构生成报告：

### 📊 你的 AI 能力画像
一句话总结（不超过 30 字），给用户一个直观印象。

---

### ✨ 你的强项（得分率 ≥ 80% 的维度）
逐维度分析：
- 这个维度为什么是你的强项
- 具体表现（结合用户选的选项来描述，不要重复题目原文）
- 怎么继续发挥优势（给 1 条进阶建议）
（如果没有强项维度，写"这次测评没有特别突出的强项，但每个维度都有成长空间。"）

---

### ⚡ 需要加强的（得分率 < 50% 的维度）
逐维度分析：
- 这个维度弱在哪里（结合具体选项）
- 为什么这个维度重要（不补会错过什么）
- 怎么提升（给 2-3 条具体可操作的建议，包含推荐的具体工具或学习资源方向）
（如果没有薄弱维度，写"没有明显短板，各方面基础都不错。"）

---

### 🎯 中等水平（得分率 50%-79% 的维度）
逐维度简述现状 + 1 条突破建议。
（如果没有中等维度，写"你的能力分布比较两极化，继续保持强项优势。"）

---

### 🗺️ 你的 AI 学习路径建议
综合全部 5 个维度，给出一条 3 步学习路线：
- 第一步（立刻做）：最紧急的薄弱点，本周就能开始的事
- 第二步（一个月内）：中等维度的提升方向
- 第三步（长期目标）：从强项出发，往哪个方向深耕

---

### 📈 得分一览
| 维度 | 得分 | 满分 | 等级 |
|------|------|------|------|
${scoreRows}
| **总分** | **${totalScore}** | **36** | |

---
## 禁止事项
- 不要输出「根据您提供的数据」「您在第X题中选择了C选项」这类原文复读
- 不要推荐付费课程/产品（可以推荐免费开源工具或学习平台）
- 不要让报告超过 800 字
- 不要使用英文缩写不加解释（首次出现要说明）`;

  return prompt;
}

// ========================================
// 启动 Edge Function 服务
// ========================================
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json();
    const { response_id, answers, dim_scores, total_score, level } = body;

    if (!answers || !dim_scores || total_score === undefined) {
      throw new Error("缺少必要参数：answers、dim_scores、total_score");
    }

    console.log(`收到请求 — response_id: ${response_id}, total_score: ${total_score}`);

    // 1. 拼装 Prompt
    const prompt = buildPrompt(answers, dim_scores, total_score);

    // 2. 调用 DeepSeek API
    console.log("正在调用 DeepSeek API...");
    const deepseekRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!deepseekRes.ok) {
      const errText = await deepseekRes.text();
      console.error(`DeepSeek API 错误 (${deepseekRes.status}): ${errText}`);
      throw new Error(`DeepSeek API 返回错误 (${deepseekRes.status})`);
    }

    const deepseekData = await deepseekRes.json();
    const reportText = deepseekData.choices[0]?.message?.content || "";

    if (!reportText) {
      throw new Error("DeepSeek 返回了空内容");
    }

    console.log("DeepSeek 返回成功，报告长度:", reportText.length);

    // 3. 提取一句话总结
    const summaryMatch = reportText.match(/###\s*📊\s*你的 AI 能力画像\s*\n+\s*(.+?)(?:\n|$)/);
    const summary = summaryMatch ? summaryMatch[1].trim() : "";

    // 4. 存入 quiz_reports 表
    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY);

    const { error: insertError } = await supabase
      .from("quiz_reports")
      .insert({
        response_id: response_id || null,
        summary: summary || "AI 分析报告",
        analysis: {
          full_text: reportText,
          generated_by: "deepseek-flash",
          total_score,
          level,
          dim_scores,
        },
      });

    if (insertError) {
      console.error("写入 quiz_reports 失败:", insertError);
    }

    // 5. 返回报告给前端
    return new Response(
      JSON.stringify({
        success: true,
        report: {
          summary,
          full_text: reportText,
        },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Edge Function 异常:", error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
