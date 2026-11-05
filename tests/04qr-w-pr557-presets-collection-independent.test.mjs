import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
  PRESETS_STAGE1_ROOT, PRESETS_STAGE1_IN_GAME, presetsStage1Copy,
  PRESETS_STAGE1_NATIVE_WRITER_ENABLED, PRESETS_STAGE1_SHOP_PROVIDER_ENABLED,
  PRESETS_STAGE1_TOM_WRITER_ENABLED
} from '../src/lib/presets/stage1-root.mjs';

const MAIN='bd2edd00d029f866986aff96435615218398f991';
const SOURCE='e67cc4960370a89b86ab829779cf92444dfa5ceb';
const OLD='bbc2801aa94072c20e76feb8558a20d0526e1201';
const sourcePaths=[
 '.github/workflows/web-stage1-presets-ux.yml',
 'scripts/web-stage1-presets-chrome.mjs',
 'src/lib/presets/stage1-root.mjs',
 'src/routes/presets/+page.svelte',
 'tests/scaffold.test.mjs',
 'tests/web-stage1-presets-root.test.mjs'
].sort();
const qaPaths=[
 '.github/workflows/04qr-w-pr557-currentmain-presets-collection.yml',
 'scripts/04qr-w-pr557-presets-collection-chromium.mjs',
 'tests/04qr-w-pr557-presets-collection-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const page=readFileSync('src/routes/presets/+page.svelte','utf8');

test('new main pinned; exactly six Source changes and three independently authored QA-only files',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),sourcePaths);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qaPaths);
 const preserved={
  'src/routes/presets/+page.svelte':'55f8522f0e0099b69e780ab04191c66cd3bc05ff',
  'src/lib/presets/stage1-root.mjs':'7f741542e0f7f5d7df0b8e51caf1e32c9d617c58',
  'tests/scaffold.test.mjs':'74350aaca60b8438cf08bb0a66602f40362e458a',
  'tests/web-stage1-presets-root.test.mjs':'517e99053b3684f4be995952fb3249096c5cf87c',
  'scripts/web-stage1-presets-chrome.mjs':'91e8b8bd354fd6d060da151dfeccac23873d711f'
 };
 for(const [name,blob] of Object.entries(preserved)){
  assert.equal(git('rev-parse',SOURCE+':'+name),blob);
  assert.equal(git('rev-parse',OLD+':'+name),blob);
 }
 assert.equal(git('rev-parse',MAIN+':scripts/web-shared-catalog-e2e-chrome.mjs'),'584e13cc7b7ad1fd4651aff940266c0c62761167');
 assert.equal(git('rev-parse',SOURCE+':scripts/web-shared-catalog-e2e-chrome.mjs'),'584e13cc7b7ad1fd4651aff940266c0c62761167');
});

test('Presets four root to two In-Game is unchanged while new Collection main owns Item route',()=>{
 assert.deepEqual(PRESETS_STAGE1_ROOT,['wand','touchOfMagic','inGame','my']);
 assert.deepEqual(PRESETS_STAGE1_IN_GAME,['decorations','shop']);
 assert.match(page,/data-stage1-presets-four-cards/);
 assert.match(page,/data-stage1-presets-ingame/);
 assert.match(page,/data-native-writer="off" data-provider-gate="off" data-tom-writer="off"/);
 assert.doesNotMatch(page,/onMount\(/);
 for(const v of [PRESETS_STAGE1_NATIVE_WRITER_ENABLED,PRESETS_STAGE1_SHOP_PROVIDER_ENABLED,PRESETS_STAGE1_TOM_WRITER_ENABLED])
  assert.equal(v,false);
 const coll=readFileSync('src/routes/collection/+page.svelte','utf8');
 for(const marker of ['data-stage1-category-grid','data-stage1-search','data-stage1-search-groups','data-stage1-item-info','data-personal-progress="unknown"','data-writer="off"'])
  assert.ok(coll.includes(marker),'new main Collection selector: '+marker);
 assert.equal(git('rev-parse',MAIN+':src/routes/collection/+page.svelte'),git('rev-parse',SOURCE+':src/routes/collection/+page.svelte'));
 assert.equal(git('rev-parse',MAIN+':src/lib/presets/NativePresetManager.svelte'),git('rev-parse',SOURCE+':src/lib/presets/NativePresetManager.svelte'));
});

test('negative: main fixed shared Item source navigates verified 40000047 and persists Moodboard without auto Writer',()=>{
 const e2e=readFileSync('scripts/web-shared-catalog-e2e-chrome.mjs','utf8');
 for(const needle of ["const ITEM='40000047'",'[data-stage1-search]','[data-stage1-item-info]','DETAIL_TYPED_ITEM_MOODBOARD_SAVE_AND_RELOAD','FORGED_SOURCE_VERSION_DENIED_IN_REAL_BROWSER','MOBILE_320_ZOOM200_KEYBOARD_NO_OVERFLOW'])
  assert.ok(e2e.includes(needle),'shared E2E guard '+needle);
 assert.doesNotMatch(e2e,/\.collection-grid|\.collection-controls/);
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const labels=presetsStage1Copy(locale);
  assert.ok(labels.wand&&labels.inGame&&labels.shop&&labels.unavailable,locale+' no empty root label');
 }
 assert.match(page,/data-preset-unavailable/);
 assert.doesNotMatch(page,/productWriterAuthorized\s*=\s*true|originalOverwriteAuthorized\s*=\s*true|WEP_PRIVATE_P1G_PATH/);
});

test('workflow is strictly scoped and cannot promote Source/Provider/Save in CI',()=>{
 const flow=readFileSync('.github/workflows/04qr-w-pr557-currentmain-presets-collection.yml','utf8');
 assert.match(flow,/branches: \['integration\/stage1-presets-four-to-two-maine400-20261105'\]/);
 assert.match(flow,/persist-credentials: false/);
 assert.match(flow,/node --test tests\/04qr-w-pr557-presets-collection-independent.test.mjs/);
 assert.match(flow,/node scripts\/04qr-w-pr557-presets-collection-chromium.mjs/);
 assert.match(flow,/WEP_PRIVATE_P1G_PATH/);
 assert.doesNotMatch(flow,/continue-on-error|workflow_dispatch|secrets\./);
});
