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

test('every canonical homepage destination is an existing static route', () => {
  for (const route of ['explore', 'collection', 'guide', 'presets', 'gallery', 'dreamsnaps', 'qa']) {
    assert.ok(exists(`src/routes/${route}/+page.svelte`), route);
  }
  assert.ok(exists('src/routes/moodboards/+page.svelte'), 'Decorate > Moodboards');
  assert.ok(exists('src/routes/editor/world/+page.svelte'), 'Decorate > World Editor');
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


test('Presets product surface preserves canonical WEP safety boundary through localized presentation', () => {
  const page = read('src/routes/presets/+page.svelte');
  const copy = read('src/lib/presets/page-copy.js');
  assert.match(page, /presetPageCopy/);
  assert.match(page, /\{copy\.discover\}/);
  assert.match(page, /\{copy\.library\}/);
  assert.match(page, /\{copy\.ingame\}/);
  assert.match(page, /NativePresetManager/);
  assert.match(page, /createPresetCommunityBridge/);
  assert.match(page, /preflightPreset/);
  assert.match(page, /preflightBoundaryReason/);
  assert.match(page, /copy\.signedBytes/);
  assert.match(page, /copy\.reuse/);
  assert.match(page, /CORE_COMMIT_ADAPTER_NOT_BOUND/);
  assert.match(page, /copy\.preflightNote/);
  assert.match(copy, /persistent DDV/);
  assert.match(copy, /DDVセーブへの書き込みは行いません/);
  assert.doesNotMatch(page, />Apply</);
});


test('World Editor product surface is WEP-backed, localized and writer-safe', () => {
  const page = read('src/routes/editor/world/+page.svelte');
  assert.match(page, /createEditorSession/);
  assert.match(page, /projectObjects/);
  assert.match(page, /captureScenePreset/);
  assert.match(page, /saveScenePresetPrivateMaster/);
  assert.match(page, /\/presets\/publish\/\?master=/);
  assert.match(page, /scenePrivateCopy\.continuePublish/);
  assert.match(page, /openWorldSaveBytes/);
  assert.match(page, /createSwitchWorldReadAdapter/);
  assert.match(page, /projectSwitchAreaGrid/);
  assert.match(page, /worldEditor\.open\.title/);
  assert.match(page, /worldEditor\.open\.switch/);
  assert.match(page, /worldEditor\.open\.steamWindows/);
  assert.match(page, /exactBuildKnown=false/);
  assert.match(page, /persistentWriteAuthorized=false/);
  assert.match(page, /worldEditor\.routes\.openCanvas/);
  assert.match(page, /worldEditor\.placement\.eyebrow/);
  assert.match(page, /createEditorDraftValidator/);
  assert.match(page, /localizeWepBlocker/);
  assert.match(page, /captureRegion: sceneCaptureRegion\(\)/);
  assert.match(page, /worldEditor\.scene\.customRegion/);
  assert.match(page, /FENCE_REPRESENTATION_LAYOUT_EDIT/);
  assert.match(page, /syncFencePostDraftFromDocument/);
  assert.match(page, /validationPresentation\.groups/);
  assert.match(page, /worldEditor\.status\.unavailableActions/);
  assert.match(page, /worldEditor\.inspector\.eyebrow/);
  assert.match(page, /worldEditor\.command\.reviewSavePrep/);
  assert.doesNotMatch(page, /publishCapturedScene/);
  assert.doesNotMatch(page, /value="unlisted"/);
  assert.doesNotMatch(page, /value="private"/);
  assert.match(page, /worldEditor\.canvas\.persistentWriteDisabled/);
  assert.doesNotMatch(page, />Apply</);
  assert.doesNotMatch(page, />Commit</);
});
