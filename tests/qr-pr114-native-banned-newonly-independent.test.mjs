import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {classifyPresetShareImportResultV1253,PRESET_BANNED_BUILD,PRESET_RESULT_FAMILIES}
  from '../src/lib/ddv/core/world/preset-share-import-banned-v1253.js';
import {classifyFurniture40600547DefinitionV1253,FURNITURE_40600547_BUILD}
  from '../src/lib/ddv/core/world/furniture-40600547-placement-boundary-v1253.js';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const base='4951ec5bafad1e681100a499d130061b692ff2f1';
const before='ba2a658700620c95858a5d4d0cd93f8ee37ad314';
const classify=(family,code,source=PRESET_BANNED_BUILD)=>classifyPresetShareImportResultV1253({source,family,code});
const forbidden=r=>{
 for(const k of ['persistentWriteAuthorized','WORLD_PERSISTENT_WRITE_V125','PERSISTENT_WRITE','productApplyAuthorized','directSourceReplacementAuthorized','nativeWriterAuthorized','canBypassServerPolicy','canImportWithoutExistingValidation'])
   assert.equal(r[k],false,k);
};
test('owner post-native repair exactly two JS+test files, no other source or privilege mutation',()=>{
 assert.equal(git('merge-base',before,base),before);
 assert.equal(git('merge-base',base,'HEAD'),base);
 assert.deepEqual(git('diff','--name-only',before,base).split('\n').sort(),[
 'src/lib/ddv/core/world/preset-share-import-banned-v1253.js',
 'tests/ddv-core-world-preset-share-import-banned-v1253.test.mjs']);
 assert.equal(git('hash-object','src/lib/ddv/core/world/preset-share-import-banned-v1253.js'),'adb0ee0bc6702bde89302d7441d76e3ed8f3aab1');
 console.log('QR_PR114_OWNER_MINIMAL_TWO_FILE_REPAIR_PIN_PASS');
});
test('independent two-family 14 /17 are each denied without any remote issuer claim or import/save authority',()=>{
 const pairs=[[PRESET_RESULT_FAMILIES.SHARE,14],[PRESET_RESULT_FAMILIES.IMPORT,17]];
 for(const [family,code] of pairs){
  const r=classify(family,code);
  assert.equal(r.status,'BANNED');assert.equal(r.code,code);assert.equal(r.family,family);
  assert.equal(r.reasonCode,'BANNED_DENIED_ORIGIN_UNVERIFIED');
  assert.equal(r.displayLocalizationKey,'menu.decoration_preset_banned_text');
  assert.equal(r.remoteRejection,null);
  assert.equal(r.mayEnterExistingValidatedFlow,false);
  forbidden(r);
 }
 assert.equal(classify(PRESET_RESULT_FAMILIES.SHARE,17).status,'REJECTED_OR_UNRECOGNIZED');
 assert.equal(classify(PRESET_RESULT_FAMILIES.IMPORT,14).status,'REJECTED_OR_UNRECOGNIZED');
 console.log('QR_PR114_BANNED_14_17_SEPARATE_PRODUCER_FAIL_CLOSED_PASS');
});
test('unknown, malformed, unsupported build, and nonzero results fail closed, while success is not unsupervised import',()=>{
 const families=[PRESET_RESULT_FAMILIES.SHARE,PRESET_RESULT_FAMILIES.IMPORT];
 for(const family of families){
  for(const code of [-4,13,15,16,18,129,7777,'17',null,NaN,Infinity]){
   const r=classify(family,code);assert.notEqual(r.status,'UPSTREAM_SUCCESS_ONLY');assert.equal(r.mayEnterExistingValidatedFlow,false);forbidden(r);
  }
  const ok=classify(family,0);
  assert.equal(ok.status,'UPSTREAM_SUCCESS_ONLY');assert.equal(ok.mayEnterExistingValidatedFlow,true);forbidden(ok);
 }
 for(const src of [null,{}, {...PRESET_BANNED_BUILD,buildIdentity:'52BD625D9B4E0053'}, {...PRESET_BANNED_BUILD,gameVersion:'1.25.0'}, {...PRESET_BANNED_BUILD,platform:'SteamWindows'}, {...PRESET_BANNED_BUILD,profileSchemaVersion:624}]){
  const a=classify(PRESET_RESULT_FAMILIES.SHARE,14,src);
  assert.equal(a.status,'UNSUPPORTED_BUILD');assert.equal(a.mayEnterExistingValidatedFlow,false);forbidden(a);
 }
 const unknown=classify('OTHER',14);assert.equal(unknown.status,'UNKNOWN_RESULT_FAMILY');forbidden(unknown);
 console.log('QR_PR114_UNKNOWN_BUILDS_AND_RESULTS_DENY_PASS');
});
test('v1.25.3 source machine binds distinct enums, but owner old server assumption is NOT authority',()=>{
 const m=JSON.parse(readFileSync('static/ddv/core/world/v1.25.3/preset-share-import-banned-v1253.json','utf8'));
 assert.equal(m.confirmed.shareResult.current,14);
 assert.equal(m.confirmed.importError.current,17);
 assert.equal(m.platform,'Nintendo Switch');
 assert.equal(m.buildId,'9A239D3DB569756D');
 assert.equal(m.profileSchema,626);
 const code=readFileSync('src/lib/ddv/core/world/preset-share-import-banned-v1253.js','utf8');
 assert.ok(code.includes('remoteRejection:null'));
 assert.ok(!code.includes('SERVER_REJECTED_BANNED'));
 assert.ok(!code.includes('remoteRejection:true'));
 assert.ok(code.includes('BANNED_DENIED_ORIGIN_UNVERIFIED'));
 assert.ok(m.hardFlags.productApplyAuthorized===false);
 console.log('QR_PR114_NO_FALSE_SERVER_ORIGIN_OR_WRITER_PERMISSION_PASS');
});
test('Furniture 40600547 generic grid 1x1 Layers66 NEVER equals quest placement legality',()=>{
 const m=JSON.parse(readFileSync('static/ddv/core/world/v1.25.3/furniture-40600547-placement-boundary-v1253.json','utf8'));
 assert.equal(m.target.itemId,40600547);
 assert.deepEqual(m.typedDecode.paths.map(x=>x.after),[1,1,[66]]);
 assert.deepEqual(m.typedDecode.paths.map(x=>x.before),[2,2,[4,68,4,68]]);
 const probe=classifyFurniture40600547DefinitionV1253({
    source:FURNITURE_40600547_BUILD,itemId:40600547,
    recordSha256:m.sources.switch1253Furniture.recordSha256,
    gridArea:{SizeX:1,SizeY:1,Layers:[66]}
 });
 assert.equal(probe.status,'STATIC_DELTA_CONFIRMED_NATIVE_PENDING');
 assert.equal(probe.currentNativePlacementValidity,'UNKNOWN');
 assert.equal(probe.mayAuthorizePlacement,false);assert.equal(probe.mayAuthorizeMutation,false);
 assert.equal(probe.productApplyAuthorized,false);assert.equal(probe.nativeWriterAuthorized,false);
 for(const p of [
   {source:{...FURNITURE_40600547_BUILD,buildIdentity:'52BD625D9B4E0053'},itemId:40600547,recordSha256:m.sources.switch1253Furniture.recordSha256,gridArea:{SizeX:1,SizeY:1,Layers:[66]}},
   {source:FURNITURE_40600547_BUILD,itemId:40600547,recordSha256:m.sources.switch1253Furniture.recordSha256,gridArea:{SizeX:1,SizeY:1,Layers:[68]}}
 ]){
  const r=classifyFurniture40600547DefinitionV1253(p);assert.notEqual(r.status,'STATIC_DELTA_CONFIRMED_NATIVE_PENDING');assert.equal(r.mayAuthorizePlacement,false);
 }
 console.log('QR_PR114_GENERIC_GRID_NOT_QUEST_PLACEMENT_PASS');
});
