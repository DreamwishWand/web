/**
 * 04 QR-W / W-04QR-W-001: PR493 NEW cumulative integration QA only.
 * Parent main a043...; source PR493 46ab...; five accepted PR479 blobs.
 * NEVER open or decode a genuine P1G; never invoke owner-private executor.
 * Reuse previous QR489/QR491 findings without re-running those tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MAIN='a0439bf01251a6c20280e219731fc4334fe9e4df';
const SOURCE='46ab3ab2a96ebbef65f1e188b2968706874f6fa2';
const changed=[
 ['.github/workflows/wep-private-genuine-p1g-harness-policy-20261104.yml','8816752c571ec5e58869902f9d6c2b1a819f8369'],
 ['docs/wep/private-real-save-spatial-e2e-local-only-20261104.md','d869219121036506b499033d2f93d636a5fc0018'],
 ['scripts/wep-private-real-save-2d-local-only-20261104.mjs','3aa36cea064cef10ae27abc5d0c4094a62cf2f42'],
 ['scripts/wep-private-real-save-e2e-safety-20261104.mjs','f77d995e2c4e49dcfef4c2208cb7d62d906850fc'],
 ['tests/wep-private-real-save-e2e-safety.test.mjs','7b9620d27a3517f7df36e3e0b2817ffeec1bbe54']
];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const read=(file)=>readFileSync(file,'utf8');

test('exact protected-main ancestry and five immutable PR479 blobs; no sibling or accepted source drift',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.equal(git('rev-list','--count',MAIN+'..'+SOURCE),'1');
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),
   changed.map(x=>x[0]).sort());
 for(const [path,expected] of changed)
   assert.equal(git('hash-object',path),expected,path);
 assert.equal(git('hash-object','src/routes/editor/world/+page.svelte'),
   '5ae7f7640a99b05083b20b784fb0cbf3693fee84');
 assert.equal(git('hash-object','src/lib/wep/real-save-spatial-read.ts'),
   '48b32c3bd3132c6e48a47d7b8f017a35642d2623');
});

test('QA branch contributes only independent test and workflow, not source mutation',()=>{
 const paths=git('diff','--name-only',SOURCE,'HEAD').split('\n').sort();
 assert.deepEqual(paths,[
   '.github/workflows/04qr-w-pr493-main-harness-independent.yml',
   'tests/04qr-w-pr493-main-harness-independent.test.mjs'
 ]);
});

test('current main World UI and owner-local harness agree on native-ID and same-object Move/Undo contract',()=>{
 const ui=read('src/routes/editor/world/+page.svelte');
 const runner=read('scripts/wep-private-real-save-2d-local-only-20261104.mjs');
 const targets=[
  'data-wep-real-source-read-status','data-wep-626-bid',
  'data-editor-object-id={object.editorId}',
  'data-wep-spatial-native-grid-object-id={object.spatial.nativeGridObjectId',
  'data-wep-spatial-details-id',
  'data-wep-spatial-delta={change.editorId}',
  'data-wep-spatial-changes',
  'class="toolbar-actions"'
 ];
 for(const token of targets) assert.ok(ui.includes(token),'missing current-main UI contract '+token);
 assert.match(ui,/change\.before\.x\},\$\{change\.before\.y\}\/\$\{change\.before\.orientation\}/);
 assert.match(ui,/runPrimaryMutation\('move', 'right'\)/);
 assert.match(ui,/on:click=\{runPrimaryUndo\}/);
 assert.match(ui,/aria-disabled=\{!primaryJobAvailability\.commands\.undo\.enabled\}/);
 assert.match(runner,/\[data-wep-spatial-delta="/);
 assert.match(runner,/!changeText\.includes\(raw\.X\+','\+raw\.Y\+'\/'\)/);
 assert.match(runner,/await delta\.waitFor\(\{state:'detached'/);
 assert.match(runner,/PRIVATE_ORIGINAL_SOURCE_SHA_CHANGED/);
 assert.ok(!runner.includes('export_verified_copy('),'owner local harness must not call Writer');
});

test('cumulative test execution remains synthetic: no P1G runner in any GitHub workflow',()=>{
 const flow=read('.github/workflows/wep-private-genuine-p1g-harness-policy-20261104.yml');
 const qaFlow=read('.github/workflows/04qr-w-pr493-main-harness-independent.yml');
 const runner=read('scripts/wep-private-real-save-2d-local-only-20261104.mjs');
 assert.match(flow,/node --check scripts\/wep-private-real-save-2d-local-only-20261104\.mjs/);
 assert.doesNotMatch(flow,/node (?!\-\-check)(?:--experimental-strip-types )?scripts\/wep-private-real-save-2d-local-only-20261104\.mjs/);
 assert.match(qaFlow,/node --test tests\/04qr-w-pr493-main-harness-independent\.test\.mjs/);
 assert.match(qaFlow,/test -z "\$\{WEP_PRIVATE_P1G_PATH:-\}"/);
 assert.match(runner,/if \(process\.env\.CI\|\|process\.env\.GITHUB_ACTIONS\)/);
 assert.match(runner,/serviceWorkers:'block'/);
 assert.match(runner,/routeWebSocket\('\*\*\/\*'/);
 assert.match(runner,/\['GET','HEAD'\]\.includes\(route\.request\(\)\.method\(\)\)/);
});
