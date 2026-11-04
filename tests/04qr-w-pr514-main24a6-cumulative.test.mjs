/** 04 QR-W cumulative NEW-MAIN scoped audit for PR514.
 * PREVIOUS QR502, QR498 and QR491 inherited; do not rerun prior work.
 * No real P1G, no Native geometry or Writer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {openWorldSaveBytes,WEP_WORLD_READONLY_626_PROVENANCE} from '../src/lib/wep/world-save-source.ts';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';
import {requireOwnerPrivateScope} from '../scripts/wep-private-real-save-e2e-safety-20261104.mjs';
const MAIN='24a6c9515ae2a80c8ea39cc4d0ec7c17f455e8ba';
const INTEGRATION='04f052090d7e4e904f2ce2030a7c279d0e31230e';
const SOURCE='1110f5359f4bcd9b1e27cc78c41c4de688920c6f';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const selected=Object.freeze({
 'scripts/wep-schema626-readonly-browser-acceptance.mjs':'7c63a131e5dc75002e06158c7a826ceb03feaa8e',
 'src/lib/wep/world-save-source.ts':'9888b91c92953cf0f9fd828d2ba0cb763e35dac5',
 'tests/wep-schema626-gridobject-structural-count.test.mjs':'ab48f8e251511c017d81b130ceef04a040c8a8d4',
 'tests/wep-world-readonly626.test.mjs':'5719697f0dcabaf8b1008082346568e7d289627b'
});
const mainPrivate=Object.freeze({
 '.github/workflows/wep-private-genuine-p1g-harness-policy-20261104.yml':'8816752c571ec5e58869902f9d6c2b1a819f8369',
 'docs/wep/private-real-save-spatial-e2e-local-only-20261104.md':'d869219121036506b499033d2f93d636a5fc0018',
 'scripts/wep-private-real-save-2d-local-only-20261104.mjs':'3aa36cea064cef10ae27abc5d0c4094a62cf2f42',
 'scripts/wep-private-real-save-e2e-safety-20261104.mjs':'f77d995e2c4e49dcfef4c2208cb7d62d906850fc',
 'tests/wep-private-real-save-e2e-safety.test.mjs':'7b9620d27a3517f7df36e3e0b2817ffeec1bbe54'
});
const fixture=()=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{},World:{
 Villages:[{Areas:{'7':{GridIDs:[10,11],Unlocked:true}}}],
 GridCollection:{Grids:{
   '10':{ID:10,Objects:{'42':{State:{}}}},
   '11':{ID:11,Objects:{'43':{State:{}},'44':{State:{}}}}
 },DiffGrids:{'10':{ID:10,Objects:{'45':{State:{}}}}}}
 }
});
const accepted={sourcePlatform:'switch',targetBuild:{platform:'switch',kind:'switch-bid',value:'9A239D3DB569756D'},sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE};
test('integrated exact four accepted PR499 blobs on protected main24a6 (no source graft)',()=>{
 assert.equal(git('merge-base',MAIN,INTEGRATION),MAIN);
 assert.deepEqual(git('diff','--name-only',MAIN,INTEGRATION).split('\n').sort(),Object.keys(selected).sort());
 for(const [path,sha] of Object.entries(selected)){
  assert.equal(git('hash-object',path),sha,path);
  assert.equal(git('rev-parse',SOURCE+':'+path),sha,path+' inherited approved source');
 }
});
test('protected main PR493 local-only private harness all five unchanged under PR514',()=>{
 for(const [path,sha] of Object.entries(mainPrivate)){
  assert.equal(git('hash-object',path),sha,path);
  assert.equal(git('rev-parse',MAIN+':'+path),sha,path);
 }
 const privateExecutor=readFileSync('scripts/wep-private-real-save-2d-local-only-20261104.mjs','utf8');
 assert.match(privateExecutor,/OWNER LOCAL ONLY/);
 const checkedIn=readFileSync('.github/workflows/04qr-w-pr514-main24a6-626-cumulative.yml','utf8');
 assert.doesNotMatch(checkedIn,/\bnode\s+scripts\/wep-private-real-save-2d-local-only-20261104\.mjs/);
});
test('QA-only new three files exact, no inherited source/CI/user-private mutations',()=>{
 assert.deepEqual(git('diff','--name-only',INTEGRATION,'HEAD').split('\n').sort(),[
 '.github/workflows/04qr-w-pr514-main24a6-626-cumulative.yml',
 'scripts/04qr-w-pr514-main24a6-cumulative-chromium.mjs',
 'tests/04qr-w-pr514-main24a6-cumulative.test.mjs'
 ]);
 assert.equal(git('hash-object','src/routes/editor/world/+page.svelte'),'5ae7f7640a99b05083b20b784fb0cbf3693fee84');
});
test('new COMPOSED main synthetic 626 raw count excludes DiffGrids overlap, never grants 624 geometry or writer',async()=>{
 const bytes=makeSyntheticP1gProfile(fixture()),before=bytes.slice(),sha=createHash('sha256').update(bytes).digest('hex');
 const opened=await openWorldSaveBytes(bytes,accepted);
 assert.equal(opened.profileSchemaVersion,626);
 assert.equal(opened.structuralDiagnostics.gridObjectEntryCount,3);
 assert.equal(opened.structuralDiagnostics.gridRecordCount,2);
 assert.equal(opened.compatibility.readOnly,true);
 assert.deepEqual(opened.areas,[]);
 assert.equal(opened.compatibility.routesAuthorized,false);
 assert.equal(opened.compatibility.editingAuthorized,false);
 assert.equal(opened.compatibility.persistentWriteAuthorized,false);
 assert.equal(opened.compatibility.productApplyAuthorized,false);
 assert.equal(opened.compatibility.verifiedReplacementCandidateAuthorized,false);
 assert.deepEqual(bytes,before);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
});
test('PR493 policy remains in CI fail-closed; no genuine owner-private harness invocation',()=>{
 assert.throws(()=>requireOwnerPrivateScope({
  env:{CI:'true',GITHUB_ACTIONS:'true'},sourcePath:'/private-owner/profile',ownerAck:'YES',externalBuildConfirmed:'YES',claimedBid:'9A239D3DB569756D'
 }),/PRIVATE_SAVE_CI_FORBIDDEN/);
 const u=readFileSync('src/routes/editor/world/+page.svelte','utf8');
 assert.match(u,/structuralDiagnostics\?\.gridObjectEntryCount \?\? '—'/);
 assert.match(u,/data-wep-626-readonly/);
});
