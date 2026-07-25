import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');

assert.match(html, /<script type="module" src="\.\/app\.js"><\/script>/);
assert.match(html, /id="profileChart"/);
assert.match(html, /id="personalizedAdvicePanel"/);
assert.match(app, /from '\.\/assessment-core\.js'/);
assert.match(app, /\/api\/personalized-advice/);
assert.match(app, /个性化建议暂未开启/);
assert.match(app, /\/api\/assessment-events/);
assert.doesNotMatch(html, /supabase\.min\.js|SUPABASE_URL|调用 Vercel API/);
assert.doesNotMatch(app, /fetch\('\/api\/generate-report/);

await assert.rejects(access(new URL('../supabase.min.js', import.meta.url)));

console.log('maintenance-mode checks passed');
