/**
 * 04QR-W / W-04QR-W-001 — PR493 NEW main5b composition only.
 * Reuse QA489 (original 5-file harness), QA491 (World UI), QA495 (main-a043)
 * and 05QR492 (W1 source probe). No genuine P1G/decoded content in CI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
  classify626ReferenceIndex
} from '../scripts/wep-private-real-save-e2e-safety-20261104.mjs';
import {
  W1_PROBE_BUILD, inspectW1WetlandGridCandidates
} from '../src/lib/ddv/timing/w1-wetland-area-grid-candidate-probe.mjs';

const MAIN='5b1b1d359a7be27455556f708b5959ffed9e13f3';
const PREVIOUS_SOURCE='46ab3ab2a96ebbef65f1e188b2968706874f6fa2';
const SOURCE='241f582f682af2f7ba7aed07654addc082aa83a8';
const blobs=[
 ['.github/workflows/wep-private-genuine-p1g-harness-policy-20261104.yml','8816752c571ec5e58869902f9d6c2b1a819f8369'],
 ['docs/wep/private-real-save-spatial-e2e-local-only-20261104.md','d869219121036506b499033d2f93d636a5fc0018'],
 ['scripts/wep-private-real-save-2d-local-only-20261104.mjs','3aa36cea064cef10ae27abc5d0c4094a62cf2f42'],
 ['scripts/wep-private-real-save-e2e-safety-20261104.mjs','f77d995e2c4e49dcfef4c2208cb7d62d906850fc'],
 ['tests/wep-private-real-save-e2e-safety.test.mjs','7b9620d27a3517f7df36e3e0b2817ffeec1bbe54']
];
const w1=[
 ['docs/core/01e-w1-wetland-area-grid-candidate-probe-20261104.md','6bc4f2780aec4bb6009f22499d09aca2b2668989'],
 ['src/lib/ddv/timing/w1-wetland-area-grid-candidate-probe.mjs','10a63f9233085a876cac4a8fe28e8db509566e41'],
 ['tests/01e-w1-wetland-area-grid-candidate-probe.test.mjs','033355e49e10ffb4c43741fb36575fcf2f7345a3']
];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sourceText=p=>readFileSync(p,'utf8');
const sha='a'.repeat(64);
const makeIndex=(patch={})=>({
 contract:'ddv.real-save-spatial-source-read@1',
 version:{...W1_PROBE_BUILD},
 sourceSha256:sha,sourceRevision:'qa-main5b-session-1',
 status:'READ_ONLY_REFERENCE_INDEX',
 geometryFor2d:'NOT_VERIFIED',
 persistentWriteAuthorized:false,productApplyAuthorized:false,
 grids:[{gridId:42,kind:'GRIDS',areaRefs:['v0:a1'],
   sourceGridDataPath:'World.GridCollection.Grids.42',parentAddress:null}],
 objects:[{gridId:42,itemId:31700014}],
 issues:[],...patch
});
const expected={sourceSha256:sha,sourceRevision:'qa-main5b-session-1'};

test('fixed main5b composition selects ONLY five prior approved harness blobs',()=>{
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.equal(git('rev-parse',SOURCE+'^1'),PREVIOUS_SOURCE);
 assert.equal(git('rev-parse',SOURCE+'^2'),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),
   blobs.map(([p])=>p).sort());
 for(const [p,blob] of blobs) assert.equal(git('hash-object',p),blob,p);
 assert.equal(git('hash-object','src/lib/wep/real-save-spatial-read.ts'),
   '48b32c3bd3132c6e48a47d7b8f017a35642d2623');
 assert.equal(git('hash-object','src/routes/editor/world/+page.svelte'),
   '5ae7f7640a99b05083b20b784fb0cbf3693fee84');
 for(const [p,blob] of w1){
   assert.equal(git('rev-parse',MAIN+':'+p),blob,p);
   assert.equal(git('hash-object',p),blob,p);
 }
});

test('QA-only branch never changes Source/W1/World/Flags and is confined to two files',()=>{
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),
 [
  '.github/workflows/04qr-w-pr493-main5b-w1-crossboundary-independent.yml',
  'tests/04qr-w-pr493-main5b-w1-crossboundary-independent.test.mjs'
 ]);
});

test('new main W1 candidate probe cannot turn 626 World references into Native geometry/Writer',()=>{
 const idx=makeIndex();
 const read=classify626ReferenceIndex(idx);
 const w1Result=inspectW1WetlandGridCandidates(idx,expected);
 assert.equal(read.checkStatus,'PASS'); // 626 references only, never 2D
 assert.equal(w1Result.status,'SOURCE_AREA_CANDIDATES_NOT_NATIVE_VERIFIED');
 assert.equal(w1Result.candidates.length,1);
 assert.equal(w1Result.selectedNativeWetlandArea,null);
 assert.equal(w1Result.nativeAreaMappingVerified,false);
 assert.equal(w1Result.originalSourceAuthenticated,false);
 assert.equal(w1Result.sourceSessionCasVerified,false);
 assert.equal(w1Result.nativeRuntimeVerified,false);
 assert.equal(w1Result.productWriterAuthorized,false);
 assert.equal(w1Result.productEditedCopyAuthorized,false);
 assert.equal(w1Result.automaticDateRepairAuthorized,false);
 assert.equal(idx.geometryFor2d,'NOT_VERIFIED');
 assert.equal(idx.persistentWriteAuthorized,false);
});

test('new main W1 candidate does not convert unresolved 626 Diff/parent to fake success',()=>{
 const idx=makeIndex({
  status:'REFERENCE_ERRORS_FAIL_CLOSED',
  issues:[{code:'SPATIAL_DIFF_DEFAULT_LAYOUT_UNRESOLVED'}],
  grids:[{gridId:42,kind:'DIFF_ONLY',areaRefs:['v0:a1'],
    sourceGridDataPath:'',parentAddress:'v0:a0'}]
 });
 assert.equal(classify626ReferenceIndex(idx).checkStatus,'PARTIAL');
 const w1Result=inspectW1WetlandGridCandidates(idx,expected);
 assert.equal(w1Result.nativeRuntimeVerified,false);
 assert.equal(w1Result.productWriterAuthorized,false);
 assert.equal(w1Result.productEditedCopyAuthorized,false);
 assert.ok(w1Result.riskCodes.includes('SOURCE_SPATIAL_INDEX_HAS_UNRESOLVED_REFERENCES'));
 assert.ok(w1Result.riskCodes.includes('DIFF_ONLY_DEFAULT_LAYOUT_UNVERIFIED'));
 assert.equal(w1Result.candidates[0].nativeWetlandMembershipVerified,false);
 assert.equal(w1Result.candidates[0].nativeSoftwoodQuotaVerified,false);
});

test('cross-domain mismatched session/BID stays unavailable and 626 harness cannot derive authority',()=>{
 const idx=makeIndex();
 const bad=inspectW1WetlandGridCandidates(idx,{...expected,sourceRevision:'stale'});
 assert.equal(bad.status,'SOURCE_REFERENCE_UNAVAILABLE');
 assert.equal(bad.productWriterAuthorized,false);
 const wrong=inspectW1WetlandGridCandidates(makeIndex({
   version:{...W1_PROBE_BUILD,bid:'52BD625D9B4E0053'}
 }),expected);
 assert.equal(wrong.status,'SOURCE_REFERENCE_UNAVAILABLE');
 assert.equal(wrong.nativeAreaMappingVerified,false);
 assert.equal(classify626ReferenceIndex(idx).checkStatus,'PASS');
 assert.equal(idx.geometryFor2d,'NOT_VERIFIED');
});

test('private E2E runner stays non-executed in CI and no W1 probe is wired to local SaveWriter',()=>{
 const runner=sourceText('scripts/wep-private-real-save-2d-local-only-20261104.mjs');
 const mainW1=sourceText('src/lib/ddv/timing/w1-wetland-area-grid-candidate-probe.mjs');
 const flow=sourceText('.github/workflows/04qr-w-pr493-main5b-w1-crossboundary-independent.yml');
 assert.doesNotMatch(runner,/inspectW1WetlandGridCandidates|W1_AREA_GRID_SOURCE_PROBE/);
 assert.doesNotMatch(mainW1,/export_verified_copy|stage_command|enableWriter|writeFileSync/);
 assert.match(runner,/PRIVATE_SAVE_CI_FORBIDDEN/);
 assert.match(runner,/serviceWorkers:'block'/);
 assert.match(runner,/routeWebSocket\('\*\*\/\*'/);
 assert.match(flow,/node --test tests\/04qr-w-pr493-main5b-w1-crossboundary-independent\.test\.mjs/);
 assert.doesNotMatch(flow,/node (?!--check)(?:--experimental-strip-types )?scripts\/wep-private-real-save-2d-local-only-20261104\.mjs/);
 assert.match(flow,/test -z "\$\{WEP_PRIVATE_P1G_PATH:-\}"/);
});
