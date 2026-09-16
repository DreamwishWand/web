import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

test('static GitHub Pages build has project base path and fallback', () => {
  const config = read('svelte.config.js');
  assert.match(config, /process\.env\.BASE_PATH/);
  assert.match(config, /fallback:\s*'404\.html'/);
  assert.match(read('src/routes/+layout.ts'), /trailingSlash\s*=\s*'always'/);
});

test('every homepage destination is an existing static route', () => {
  for (const route of ['editor/items', 'editor/world', 'help', 'explore', 'projects', 'editor']) {
    assert.ok(exists(`src/routes/${route}/+page.svelte`), route);
  }
});

test('Pages action builds, verifies, and deploys static output', () => {
  const workflow = read('.github/workflows/pages.yml');
  assert.match(workflow, /BASE_PATH:\s*\/web/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm install/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /deploy-pages@v4/);
});

test('starter contains no save-reading UI or misleading edit action', () => {
  const preview = read('src/routes/editor/items/+page.svelte');
  assert.match(preview, /UIサンプル/);
  assert.match(preview, /ファイルの読み込み、変更、保存はできません/);
  assert.doesNotMatch(preview, /type="file"/);
});
