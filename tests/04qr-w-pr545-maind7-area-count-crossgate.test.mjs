// 04 QR-W NEW composition only: protected main d7 PR541 × unchanged PR545
// owner-private schema626 boundary. Synthetic fixture ONLY; no owner original in CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {openWorldSaveBytes,WEP_WORLD_READONLY_626_PROVENANCE} from '../src/lib/wep/world-save-source.ts';
import {raw626GridObjectEntries,evaluate626BrowserCount} from '../scripts/wep-private-626-readonly-boundary-20261104.mjs';
import {requireOwnerPrivateScope,inspectExternallyAttestedSaveProfile,WEP_PRIVATE_626_BID,WEP_PRIVATE_624_BID} from '../scripts/wep-private-real-save-e2e-safety-20261104.mjs';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';

const PREV='c48e392e3bc9dc7e5844a6912b8ff2c4daf997fd';
const MAIN='d7d9a76e1b4d2d17135d92c7a4a1e0ff35b59b22';
const SOURCE='03d0708359ba3707dd4f3e9f46a06309da67f757';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const mainPaths=['src/lib/wep/world-save-source.ts','tests/wep-schema626-area-record-unknown.test.mjs'].sort();
const sourcePaths=[
 '.github/workflows/wep-private-626-readonly-browser-20261104.yml',
 'docs/wep/private-626-world-readonly-browser-20261104.md',
 'scripts/wep-private-626-readonly-boundary-20261104.mjs',
 'scripts/wep-private-626-readonly-browser-receipt-20261104.mjs',
 'tests/wep-private-626-readonly-browser-boundary.test.mjs'
].sort();
const qaPaths=[
 '.github/workflows/04qr-w-pr545-maind7-area-count-crossgate.yml',
 'tests/04qr-w-pr545-maind7-area-count-crossgate.test.mjs'
].sort();
const sha={
 'src/lib/wep/world-save-source.ts':'2287fc98306bffe8c28f52ac48509ea2e63f54ac',
 'tests/wep-schema626-area-record-unknown.test.mjs':'791f8216c0e98876a1b48b81e0c2506c3bd7219c',
 '.github/workflows/wep-private-626-readonly-browser-20261104.yml':'9cae3a5413437475183caa193e0cf6d61392f556',
 'docs/wep/private-626-world-readonly-browser-20261104.md':'b0fae8e4200446c13e8ec05d649dd2ad19c21aff',
 'scripts/wep-private-626-readonly-boundary-20261104.mjs':'ad39e8974de1321bd52014646bb514aec921ba7b',
 'scripts/wep-private-626-readonly-browser-receipt-20261104.mjs':'9e7c8fa0cfa2c6bab9e1dff7a16d16734d33e262',
 'tests/wep-private-626-readonly-browser-boundary.test.mjs':'2b86c367f6fed0e022e058820f09a15397c53799'
};
const provenance={sourcePlatform:'switch',targetBuild:{platform:'switch',kind:'switch-bid',value:WEP_PRIVATE_626_BID},sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE};
const profile=()=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{}, World:{
  Villages:[{Areas:{'7':{GridIDs:[10],Unlocked:true}}},{Areas:{'9':{GridIDs:[],Unlocked:false}}}],
  GridCollection:{Grids:{'10':{ID:10,Objects:{'42':{State:{ExtraUntrusted:true}}}}},DiffGrids:{}}
 },UnknownRoot:{opaque:true}
});
const read=async p=>{
 const packed=makeSyntheticP1gProfile(p),original=packed.slice();
 const result=await openWorldSaveBytes(packed,provenance);
 assert.deepEqual(packed,original,'packed original immutable');
 assert.equal(result.profileSchemaVersion,626);
 assert.equal(result.compatibility.readOnly,true);
 assert.equal(result.compatibility.routesAuthorized,false);
 for(const key of ['editingAuthorized','persistentWriteAuthorized','verifiedReplacementCandidateAuthorized','productApplyAuthorized'])assert.equal(result.compatibility[key],false,key);
 assert.deepEqual(result.areas,[],'no Native Area projection authorized');
 return result;
};

test('current main PR541 exactly two + PR545 exactly five immutable original source files; QA-only two',()=>{
 assert.equal(git('merge-base',PREV,MAIN),PREV);
 assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
 assert.deepEqual(git('diff','--name-only',PREV,MAIN).split('\n').sort(),mainPaths);
 assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n').sort(),sourcePaths);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qaPaths);
 for(const [p,blob] of Object.entries(sha))assert.equal(git('rev-parse',SOURCE+':'+p),blob,p);
 assert.equal(git('diff','--name-only',MAIN,SOURCE,'--','src/','supabase/','static/','.github/workflows/pages.yml'),'');
});

test('schema626 later-missing or malformed Areas UNKNOWN; raw GridObject source-count remains bounded, never Native route',async()=>{
 for(const mutate of [
  p=>{delete p.World.Villages[1].Areas;},
  p=>{p.World.Villages[1].Areas=null;},
  p=>{p.World.Villages[1].Areas=[];},
  p=>{p.World.Villages[1]=null;}
 ]){
  const p=profile();mutate(p);
  const opened=await read(p);
  assert.equal(opened.structuralDiagnostics.villageCount,2);
  assert.equal(opened.structuralDiagnostics.areaRecordCount,null,'unknown not misleading partial/zero');
  assert.equal(opened.structuralDiagnostics.gridObjectEntryCount,1);
  assert.equal(raw626GridObjectEntries(p),1);
  // PR545 count contract is strictly serialized GridObject equality, NOT
  // full Area completeness, a V1 acceptance receipt, or Native geometry.
  const count=evaluate626BrowserCount(1,'1',0);
  assert.equal(count.status,'SOURCE_ONLY_MATCH');
  assert.notEqual(count.status,'V1_PASS');
  assert.equal(opened.compatibility.persistentWriteAuthorized,false);
 }
});

test('present-empty Areas is genuine zero; unresolved raw Objects/issue mismatch is PARTIAL fail closed',async()=>{
 const p=profile();p.World.Villages=[{Areas:{}},{Areas:{}}];
 const opened=await read(p);
 assert.equal(opened.structuralDiagnostics.areaRecordCount,0);
 assert.equal(opened.structuralDiagnostics.gridObjectEntryCount,1);
 assert.equal(evaluate626BrowserCount(raw626GridObjectEntries(p),'1',0).status,'SOURCE_ONLY_MATCH');
 assert.equal(evaluate626BrowserCount(1,'1',1).status,'PARTIAL');
 assert.equal(evaluate626BrowserCount(1,'—',0).status,'PARTIAL');
 assert.equal(evaluate626BrowserCount(1,'0',0).status,'PARTIAL');
 const bad=profile();bad.World.GridCollection.Grids['10'].Objects=null;
 const diag=(await read(bad)).structuralDiagnostics;
 assert.equal(diag.gridObjectEntryCount,null,'missing Objects UNKNOWN not fake0');
 assert.equal(raw626GridObjectEntries(bad),null);
 assert.equal(evaluate626BrowserCount(null,'0',0).status,'PARTIAL');
});

test('wrong external BID and CI private source fail closed without ever executing private runner',async()=>{
 const p=profile();
 assert.equal(inspectExternallyAttestedSaveProfile(p,WEP_PRIVATE_626_BID).lastSaveDeviceTypeIsAuthority,false);
 assert.throws(()=>inspectExternallyAttestedSaveProfile(p,WEP_PRIVATE_624_BID),/BOUNDARY_MISMATCH/);
 await assert.rejects(openWorldSaveBytes(makeSyntheticP1gProfile(p),{
  ...provenance,targetBuild:{platform:'switch',kind:'switch-bid',value:'0000000000000000'}
 }));
 assert.throws(()=>requireOwnerPrivateScope({
  env:{CI:'true',GITHUB_ACTIONS:'true'},sourcePath:'/not-a-real-save',ownerAck:'YES',externalBuildConfirmed:'YES',claimedBid:WEP_PRIVATE_626_BID
 }),/PRIVATE_SAVE_CI_FORBIDDEN/);
 const runner=readFileSync('scripts/wep-private-626-readonly-browser-receipt-20261104.mjs','utf8');
 for(const marker of ["serviceWorkers:'block'", "routeWebSocket('**/*'", "['GET','HEAD']", "sourceSha256", "ORIGINAL_ENCRYPTED_P1G_SHA_UNCHANGED","nativeGeometryVerified:false","persistentWriterAuthorized:false"])assert.ok(runner.includes(marker),marker);
 assert.equal(runner.includes('screenshot('),false);
 assert.equal(runner.includes('cloudUpload'),false);
 const workflow=readFileSync('.github/workflows/04qr-w-pr545-maind7-area-count-crossgate.yml','utf8');
 assert.match(workflow,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.match(workflow,/node --test tests\/04qr-w-pr545-maind7-area-count-crossgate.test.mjs/);
 assert.doesNotMatch(workflow,/secrets\.|pull_request_target|workflow_dispatch|deploy-pages|git push|write-all/);
});