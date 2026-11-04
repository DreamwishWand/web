/**
 * 04 QR-W / independent new-only PR494 626 owner-local receipt audit.
 * Prior QR489 (624 owner-local harness) and QR470 (626 source inspector)
 * reused, never rerun. No genuine P1G/decoded user content in CI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
 raw626GridObjectEntries,evaluate626BrowserCount
} from '../scripts/wep-private-626-readonly-boundary-20261104.mjs';
import {classify626ReferenceIndex} from '../scripts/wep-private-real-save-e2e-safety-20261104.mjs';

const BASE='a0a18a2f898668cac8d958f1925791e08372bdb0';
const SOURCE='c75bafc20168679c6826a1dfa8967908e7413679';
const files=[
 ['.github/workflows/wep-private-626-readonly-browser-20261104.yml','afeb0d1d9e131806540a243320ca96d6a393487a'],
 ['docs/wep/private-626-world-readonly-browser-20261104.md','b0fae8e4200446c13e8ec05d649dd2ad19c21aff'],
 ['scripts/wep-private-626-readonly-boundary-20261104.mjs','ad39e8974de1321bd52014646bb514aec921ba7b'],
 ['scripts/wep-private-626-readonly-browser-receipt-20261104.mjs','9e7c8fa0cfa2c6bab9e1dff7a16d16734d33e262'],
 ['tests/wep-private-626-readonly-browser-boundary.test.mjs','2b86c367f6fed0e022e058820f09a15397c53799']
];
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const read=p=>readFileSync(p,'utf8');
const valid=()=>({
 World:{GridCollection:{Grids:{
  '42':{ID:42,Objects:{'7':{ID:7,ItemID:31700014,X:0,Y:0},'8':{ID:8,ItemID:1,X:3,Y:2}}},
  '43':{ID:43,Objects:{}}
 }}}
});

test('only PR494 five new source-only paths, old 624/626 accepted Source unchanged',()=>{
 assert.equal(git('merge-base',BASE,SOURCE),BASE);
 assert.deepEqual(git('diff','--name-only',BASE,SOURCE).split('\n').sort(),
   files.map(x=>x[0]).sort());
 for(const [p,sha] of files)assert.equal(git('hash-object',p),sha,p);
 assert.equal(git('hash-object','src/lib/wep/real-save-spatial-read.ts'),
   '48b32c3bd3132c6e48a47d7b8f017a35642d2623');
 assert.equal(git('hash-object','src/routes/editor/world/+page.svelte'),
   '5ae7f7640a99b05083b20b784fb0cbf3693fee84');
});

test('QA branch adds exactly two test-only paths; no new source authority',()=>{
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),[
  '.github/workflows/04qr-w-pr494-626-sourceonly-independent.yml',
  'tests/04qr-w-pr494-626-sourceonly-independent.test.mjs'
 ]);
});

test('forged 626 raw structures remain missing/partial, never authorize V1 or Native geometry',()=>{
 const p=valid();
 assert.equal(raw626GridObjectEntries(p),2);
 assert.equal(evaluate626BrowserCount(2,'2',0).status,'SOURCE_ONLY_MATCH');
 for(const bad of [
  {World:{}},
  {World:{GridCollection:{Grids:[]}}},
  {World:{GridCollection:{Grids:{'42':{Objects:[]}}}}},
  {World:{GridCollection:{Grids:{'42':null}}}}
 ]){
  const count=raw626GridObjectEntries(bad);
  assert.equal(count,null);
  assert.equal(evaluate626BrowserCount(count,'2',0).status,'PARTIAL');
 }
 assert.equal(classify626ReferenceIndex({
   version:{schema:626},geometryFor2d:'NOT_VERIFIED',
   persistentWriteAuthorized:false,productApplyAuthorized:false,
   status:'REFERENCE_ERRORS_FAIL_CLOSED',objects:[],grids:[],
   issues:[{code:'SPATIAL_GRID_MAP_ID_MISMATCH'}]
 }).checkStatus,'PARTIAL');
});

test('even equivalent counts reject unresolved source issue or impossible browser labels',()=>{
 const idx=valid();
 assert.equal(raw626GridObjectEntries(idx),2);
 for(const n of ['02','2 objects','2.0','2e0','Infinity','9'.repeat(1000),'２']){
  assert.equal(evaluate626BrowserCount(2,n,0).status,'PARTIAL',n.slice(0,40));
 }
 for(const issueCount of [1,999,Number.MAX_SAFE_INTEGER]){
  assert.equal(evaluate626BrowserCount(2,'2',issueCount).status,'PARTIAL');
 }
 assert.equal(evaluate626BrowserCount(2,'2',-1).status,'PARTIAL');
 assert.equal(evaluate626BrowserCount(2,'2',2.5).status,'PARTIAL');
});

test('private receipt selectors match frozen UI without claiming 626 Canvas/native 2D',()=>{
 const runner=read('scripts/wep-private-626-readonly-browser-receipt-20261104.mjs');
 const ui=read('src/routes/editor/world/+page.svelte');
 for(const sel of [
  'data-wep-626-readonly','data-wep-626-gridobject-entries',
  'data-wep-626-bid','data-wep-626-provenance'
 ])assert.ok(ui.includes(sel),sel);
 assert.match(runner,/panel\.waitFor\(\{state:'detached'/);
 assert.match(runner,/\.editor-shell'\)\.count\(\),0/);
 assert.match(runner,/\.toolbar-actions'\)\.count\(\),0/);
 assert.match(runner,/nativeGeometryVerified:false/);
 assert.match(runner,/persistentWriterAuthorized:false/);
 assert.match(runner,/originalShaUnchanged/);
 assert.match(runner,/PARTIAL_626_REFERENCE_OR_BROWSER_SOURCE_UNRESOLVED/);
});

test('private runner can only be parsed in CI: no owner payload/Provider/uploads/screenshots',()=>{
 const runner=read('scripts/wep-private-626-readonly-browser-receipt-20261104.mjs');
 const flow=read('.github/workflows/wep-private-626-readonly-browser-20261104.yml');
 const qaFlow=read('.github/workflows/04qr-w-pr494-626-sourceonly-independent.yml');
 assert.ok(runner.indexOf('const scope=requireOwnerPrivateScope()') <
   runner.indexOf('await readFile(approvedSourcePath)'));
 assert.ok(runner.indexOf('ensurePrivateSourceOutsideCheckout') <
   runner.indexOf('await readFile(approvedSourcePath)'));
 assert.match(runner,/serviceWorkers:'block'/);
 assert.match(runner,/routeWebSocket\('\*\*\/\*'/);
 assert.match(runner,/\['GET','HEAD'\]\.includes\(route\.request\(\)\.method\(\)\)/);
 assert.doesNotMatch(runner,/screenshot\(|fetch\(['"]https:|writeFile\(sourcePath/);
 assert.match(flow,/--check scripts\/wep-private-626-readonly-browser-receipt-20261104\.mjs/);
 assert.match(qaFlow,/node --test tests\/04qr-w-pr494-626-sourceonly-independent\.test\.mjs/);
 assert.doesNotMatch(qaFlow,/node (?!.*--check).*scripts\/wep-private-626-readonly-browser-receipt-20261104\.mjs/);
 assert.match(qaFlow,/test -z "\$\{WEP_PRIVATE_P1G_PATH:-\}"/);
});
