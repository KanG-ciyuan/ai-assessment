import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');

assert.match(source, /const AI_ANALYSIS_ENABLED = true;/);
assert.match(source, /<script type="module">/);
assert.match(source, /from '\.\/assessment-core\.js'/);
assert.match(source, /本次结果按固定规则生成，不调用模型 API/);
assert.match(source, /window\.goToQuiz = goToQuiz;/);
assert.match(source, /window\.showLastResult = showLastResult;/);
assert.match(source, /viewBox="0 0 480 360" id="radarSvg"/);
assert.match(source, /const RADAR_LABEL_POSITIONS = \{/);
assert.match(source, /expression: \{ x: 365, y: 184, anchor: 'start' \}/);
assert.match(source, /workflow: \{ x: 115, y: 184, anchor: 'end' \}/);
assert.doesNotMatch(source, /supabase\.min\.js/);
assert.doesNotMatch(source, /SUPABASE_URL/);
assert.doesNotMatch(source, /调用 Vercel API/);
assert.doesNotMatch(source, /fetch\(API_URL/);
assert.match(source, /id="personalizedAdvicePanel"/);
assert.match(source, /\/api\/personalized-advice/);
assert.match(source, /个性化建议暂未开启/);
assert.doesNotMatch(source, /fetch\('\/api\/generate-report/);

await assert.rejects(access(new URL('../supabase.min.js', import.meta.url)));

console.log('maintenance-mode checks passed');
