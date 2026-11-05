// 04 QR-W PR541 latest protected-main14f synthetic browser changed risk. Reuse old QA510.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const BASE='14f85625c06f277f580581f73897748367bcfe7a';
const SOURCE='f7401efe3f1c567d6a2572bc187f7a46b42573b2';
const ADVANCED='058ac652b06fdc62ff85559186375c5b7a1e62a4';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sourcePaths=['src/lib/wep/world-save-source.ts','tests/wep-schema626-area-record-unknown.test.mjs'];
const qaPaths=[
 '.github/workflows/04qr-w-pr541-main14f-626-world-collection-crossgate.yml',
 'scripts/04qr-w-pr541-main14f-626-world-collection-crossgate-chrome.mjs',
 'tests/04qr-w-pr541-main14f-626-world-collection-crossgate.test.mjs'
].sort();
test('Source exact two original WEP626 Area UNKNOWN files on main14f; QA only three new paths',()=>{
 assert.equal(git('merge-base',BASE,SOURCE),BASE);
 assert.deepEqual(git('diff','--name-only',BASE,SOURCE).split('\n').sort(),sourcePaths);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qaPaths);
 assert.equal(git('rev-parse',SOURCE+':src/lib/wep/world-save-source.ts'),'2287fc98306bffe8c28f52ac48509ea2e63f54ac');
 assert.equal(git('rev-parse',SOURCE+':tests/wep-schema626-area-record-unknown.test.mjs'),'791f8216c0e98876a1b48b81e0c2506c3bd7219c');
 // Identical original 02 WEP PR504 accepted Source/04QR-W QA510 ancestors.
 assert.equal(git('rev-parse',SOURCE+':src/lib/presets/stage1-root.mjs'),'7f741542e0f7f5d7df0b8e51caf1e32c9d617c58');
 assert.equal(git('rev-parse',SOURCE+':src/routes/presets/+page.svelte'),'55f8522f0e0099b69e780ab04191c66cd3bc05ff');
});
test('main advanced by Guide-only three paths; WEP+Collection/Presets accepted states untouched; new cumulative QA NOT inferred',()=>{
 assert.equal(git('merge-base',BASE,ADVANCED),BASE);
 const newer=git('diff','--name-only',BASE,ADVANCED).split('\n').sort();
 assert.deepEqual(newer,[
  '.github/workflows/web-guide-systems-primary-bridge.yml',
  'src/lib/guide/systems-primary-mechanic-bridge.mjs',
  'tests/web-guide-systems-primary-mechanic-bridge.test.mjs'
 ]);
 assert.equal(git('diff','--name-only',BASE,ADVANCED,'--','src/lib/wep/','src/routes/editor/world/',
  'src/lib/presets/','src/routes/presets/','src/routes/collection/','src/lib/collection/'),'');
});
test('only bound Read-only 626 UNKNOWN records; no new Source edit rights, Native route or writer positive',()=>{
 const s=readFileSync('src/lib/wep/world-save-source.ts','utf8');
 assert.match(s,/Absence of any Village Areas map is UNKNOWN, not a proven zero/);
 assert.match(s,/let areaRecordCount: number \| null = Array\.isArray\(villages\) \? 0 : null/);
 assert.match(s,/if \(!areas \|\| areaRecordCount === null\)/);
 assert.match(s,/if \(!Number\.isSafeInteger\(count\)\)/);
 const ui=readFileSync('src/routes/editor/world/+page.svelte','utf8');
 assert.match(ui,/worldSource\.structuralDiagnostics\?\.areaRecordCount \?\? '—'/);
 assert.match(ui,/data-wep-626-readonly/);
 assert.match(ui,/\{#if worldSource\.compatibility\.readOnly\}/);
 assert.equal(git('diff','--name-only',BASE,SOURCE,'--','src/lib/ddv/','src/routes/gallery/',
  'src/routes/presets/','src/routes/collection/','supabase/','static/','.github/workflows/pages.yml'),'');
});
test('QA workflow blocks private owner P1G and selects real installed Chrome only for new composite',()=>{
 const w=readFileSync('.github/workflows/04qr-w-pr541-main14f-626-world-collection-crossgate.yml','utf8');
 assert.match(w,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.match(w,/playwright-core@1\.55\.0/);
 assert.match(w,/node --test tests\/04qr-w-pr541-main14f-626-world-collection-crossgate.test.mjs/);
 assert.doesNotMatch(w,/secrets\.|workflow_dispatch|deploy-pages|write-all/);
 assert.equal(git('diff','--name-only',SOURCE,'HEAD','--','src/','static/','supabase/','.github/workflows/pages.yml'),'');
});
