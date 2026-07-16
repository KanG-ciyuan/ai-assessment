import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');

assert.match(source, /const AI_ANALYSIS_ENABLED = false;/);
assert.match(source, /<script type="module">/);
assert.match(source, /from '\.\/assessment-core\.js'/);
assert.match(source, /本次结果按固定规则生成，不调用模型 API/);
assert.doesNotMatch(source, /supabase\.min\.js/);
assert.doesNotMatch(source, /SUPABASE_URL/);
assert.doesNotMatch(source, /调用 Vercel API/);
assert.doesNotMatch(source, /fetch\(API_URL/);

await assert.rejects(access(new URL('../supabase.min.js', import.meta.url)));

console.log('maintenance-mode checks passed');
