/** 04QR-W independent Stage1 Presets four-root / two-In-Game visual contract.
 * Original NativePresetManager, provider and writer semantics NOT reaccepted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {
 PRESETS_STAGE1_ROOT,PRESETS_STAGE1_IN_GAME,
 PRESETS_STAGE1_NATIVE_WRITER_ENABLED,PRESETS_STAGE1_SHOP_PROVIDER_ENABLED,
 PRESETS_STAGE1_TOM_WRITER_ENABLED,presetsStage1Copy
} from '../src/lib/presets/stage1-root.mjs';
const PARENT='bd966f9e94be48fafce25cfbdc298439ee47aca3';
const SOURCE='bbc2801aa94072c20e76feb8558a20d0526e1201';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sources=[
 '.github/workflows/web-stage1-presets-ux.yml',
 'scripts/web-stage1-presets-chrome.mjs',
 'src/lib/presets/stage1-root.mjs',
 'src/routes/presets/+page.svelte',
 'tests/scaffold.test.mjs',
 'tests/web-stage1-presets-root.test.mjs'
],qa=[
 '.github/workflows/04qr-w-pr533-presets-visual-independent.yml',
 'scripts/04qr-w-pr533-presets-visual-chromium.mjs',
 'tests/04qr-w-pr533-presets-visual-independent.test.mjs'
];
const page=readFileSync('src/routes/presets/+page.svelte','utf8');
test('exact original 6 Presets source changes and 3 independent QA paths on mainbd966',()=>{
 assert.equal(git('merge-base',PARENT,SOURCE),PARENT);
 assert.deepEqual(git('diff','--name-only',PARENT,SOURCE).split('\n').sort(),sources);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qa);
 assert.equal(git('rev-parse',SOURCE+':src/routes/presets/+page.svelte'),'55f8522f0e0099b69e780ab04191c66cd3bc05ff');
 assert.equal(git('rev-parse',SOURCE+':src/lib/presets/stage1-root.mjs'),'7f741542e0f7f5d7df0b8e51caf1e32c9d617c58');
 assert.equal(git('rev-parse',SOURCE+':src/lib/presets/NativePresetManager.svelte'),
  git('rev-parse',PARENT+':src/lib/presets/NativePresetManager.svelte'),
  'original NativePresetManager unchanged');
});
test('owner Presets root four and In-Game exactly two, untouched explicit Native manager',()=>{
 assert.deepEqual(PRESETS_STAGE1_ROOT,['wand','touchOfMagic','inGame','my']);
 assert.deepEqual(PRESETS_STAGE1_IN_GAME,['decorations','shop']);
 assert.match(page,/data-stage1-presets-four-cards/);
 assert.match(page,/data-preset-child=\{id\}/);
 assert.match(page,/data-stage1-presets-ingame/);
 assert.match(page,/data-preset-ingame-child=\{id\}/);
 assert.match(page,/surface==='root'/);
 assert.match(page,/surface==='inGame' && !inGameChild/);
 assert.match(page,/NativePresetManager/);
 assert.match(page,/chooseInGame\(id as 'decorations'\|'shop'\)/);
});
test('no root automatic Provider/Cloud connect or Writer right elevation and Shop/ToM fail closed',()=>{
 assert.deepEqual([PRESETS_STAGE1_NATIVE_WRITER_ENABLED,PRESETS_STAGE1_SHOP_PROVIDER_ENABLED,PRESETS_STAGE1_TOM_WRITER_ENABLED],[false,false,false]);
 assert.match(page,/data-native-writer="off" data-provider-gate="off" data-tom-writer="off"/);
 assert.match(page,/if\(next==='wand'\)/);
 assert.match(page,/else if\(next==='my'\)/);
 assert.match(page,/\{#if surface==='root'\}/);
 assert.match(page,/data-preset-unavailable/);
 assert.match(page,/inGameChild==='shop'/);
 assert.doesNotMatch(page,/onMount\(/);
 assert.doesNotMatch(page,/WEP_PRIVATE_P1G_PATH|originalOverwriteAuthorized\s*=\s*true|productWriterAuthorized\s*=\s*true/);
});
test('all eight locale labels exist, Japanese two-level IA and unknown Shop caveat remain',()=>{
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const c=presetsStage1Copy(lang);
  for(const x of ['wand','tom','inGame','my','decorations','shop','back','unavailable'])
   assert.ok(typeof c[x]==='string'&&c[x].length>0,lang+' '+x);
 }
 const ja=presetsStage1Copy('ja');
 assert.equal(ja.inGame,'ゲーム内プリセット');
 assert.equal(ja.shop,'ショップ');
 assert.equal(ja.decorations,'デコレーション');
 assert.notEqual(presetsStage1Copy('fr').decorations,presetsStage1Copy('en').decorations);
});
