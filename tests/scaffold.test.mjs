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
  for (const route of ['editor/items', 'editor/world', 'help', 'explore', 'projects', 'editor', 'presets']) {
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


test('Presets product surface preserves canonical WEP safety boundary', () => {
  const page = read('src/routes/presets/+page.svelte');
  assert.match(page, />Discover</);
  assert.match(page, />Library</);
  assert.match(page, />In-Game Presets</);
  assert.match(page, /createPresetCommunityBridge/);
  assert.match(page, /preflightPreset/);
  assert.match(page, /DDVセーブへの書き込みは行いません/);
  assert.doesNotMatch(page, />Apply</);
});


test('World Editor product surface is WEP-backed and writer-safe', () => {
  const page = read('src/routes/editor/world/+page.svelte');
  assert.match(page, /createEditorSession/);
  assert.match(page, /projectObjects/);
  assert.match(page, /captureScenePreset/);
  assert.match(page, /createScenePresetWorkflow/);
  assert.match(page, /openWorldSaveBytes/);
  assert.match(page, /createSwitchWorldReadAdapter/);
  assert.match(page, /projectSwitchAreaGrid/);
  assert.match(page, /Open DDV Save \/ EditorDocument/);
  assert.match(page, /Nintendo Switch/);
  assert.match(page, /Steam \/ Windows/);
  assert.match(page, /exactBuildKnown=false/);
  assert.match(page, /persistentWriteAuthorized=false/);
  assert.match(page, /Open in Canvas/);
  assert.match(page, /01B v1\.7 pinned GridData contract/);
  assert.match(page, /PLACEMENT READINESS/);
  assert.match(page, /NATIVE_TERRAIN_OCCUPANCY_VALIDATION_REQUIRED|Not validated/);
  assert.match(page, /Publish Scene Preset/);
  assert.match(page, /Persistent write: disabled/);
  assert.doesNotMatch(page, />Apply</);
  assert.doesNotMatch(page, />Commit</);
});
