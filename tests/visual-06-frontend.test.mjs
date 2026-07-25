import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('production page uses the selected 06 visual shell', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /BIO SYNTHESIS/);
  assert.match(html, /id="field"/);
  assert.match(html, /id="consentInput"/);
  assert.match(html, /id="personalizedAdvicePanel"/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.doesNotMatch(html, /PARTICLE STORM/);
});

test('production app preserves APIs and advances after one option click', async () => {
  const app = await readFile(new URL('app.js', root), 'utf8');
  assert.match(app, /from '\.\/assessment-core\.js'/);
  assert.match(app, /STORAGE_KEY/);
  assert.match(app, /\/api\/assessment-events/);
  assert.match(app, /\/api\/personalized-advice/);
  assert.match(app, /async function parseJsonResponse/);
  assert.match(app, /AUTO_ADVANCE_DELAY_MS/);
  assert.match(app, /window\.setTimeout\(.*nextQuestion/s);
});

test('selected visual has desktop, mobile and reduced-motion rules', async () => {
  const css = await readFile(new URL('styles.css', root), 'utf8');
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.bio-organism/);
  assert.doesNotMatch(css, /\.storm-signal/);
});
