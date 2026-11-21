import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 PRESET_BANNED_BUILD,PRESET_BANNED_LOCALIZATION_KEY,PRESET_RESULT_FAMILIES,
 classifyPresetShareImportResultV1253
} from '../src/lib/ddv/core/world/preset-share-import-banned-v1253.js';
const src={...PRESET_BANNED_BUILD};
const classify=(family,code,source=src)=>classifyPresetShareImportResultV1253({source,family,code});
const hard=x=>{for(const k of ['persistentWriteAuthorized','WORLD_PERSISTENT_WRITE_V125','PERSISTENT_WRITE','productApplyAuthorized','directSourceReplacementAuthorized','nativeWriterAuthorized'])assert.equal(x[k],false,k);};
test('Switch v1.25.3 explicit share 14 and import 17 are non-bypassable Banned',()=>{
 for(const [family,code] of [[PRESET_RESULT_FAMILIES.SHARE,14],[PRESET_RESULT_FAMILIES.IMPORT,17]]){
  const x=classify(family,code);assert.equal(x.status,'BANNED');assert.equal(x.reasonCode,'BANNED_DENIED_ORIGIN_UNVERIFIED');assert.equal(x.displayLocalizationKey,PRESET_BANNED_LOCALIZATION_KEY);assert.equal(x.remoteRejection,null);assert.equal(x.mayEnterExistingValidatedFlow,false);hard(x);
 }
});
test('success only hands over to existing validated workflow; unknown response fails closed',()=>{
 for(const fam of Object.values(PRESET_RESULT_FAMILIES)){
  const s=classify(fam,0);assert.equal(s.status,'UPSTREAM_SUCCESS_ONLY');assert.equal(s.mayEnterExistingValidatedFlow,true);assert.equal(s.canImportWithoutExistingValidation,false);hard(s);
  for(const code of [12,13,20,999,-1]){const u=classify(fam,code);assert.equal(u.status,'REJECTED_OR_UNRECOGNIZED');assert.equal(u.mayEnterExistingValidatedFlow,false);hard(u);}
 }
});
test('v1.25.0 and Steam cannot inherit Switch v1.25.3 interpretation',()=>{
 for(const source of [{...src,gameVersion:'1.25.0',profileSchemaVersion:624,buildIdentity:'52BD625D9B4E0053'}, {...src,platform:'SteamWindows'}, {...src,buildIdentity:'other'}]){
  const r=classify(PRESET_RESULT_FAMILIES.SHARE,14,source);assert.equal(r.status,'UNSUPPORTED_BUILD');assert.equal(r.displayLocalizationKey,null);hard(r);
 }
 assert.equal(classify('UNKNOWN',14).status,'UNKNOWN_RESULT_FAMILY');assert.equal(classify(PRESET_RESULT_FAMILIES.SHARE,'14').status,'UNKNOWN_RESULT');
});
test('machine evidence pins versioned values, source hashes, async declaration change, and false hard flags',async()=>{
 const m=JSON.parse(await readFile(new URL('../static/ddv/core/world/v1.25.3/preset-share-import-banned-v1253.json',import.meta.url),'utf8'));
 assert.equal(m.confirmed.shareResult.current,14);assert.equal(m.confirmed.importError.current,17);
 assert.equal(m.confirmed.localization.key,PRESET_BANNED_LOCALIZATION_KEY);
 assert.ok(m.confirmed.stateMachineDelta.v1253Awaiters.includes('TaskAwaiter<bool>'));
 assert.equal(m.confirmed.stateMachineDelta.v1250Awaiters.includes('TaskAwaiter<bool>'),false);
 assert.match(m.sources.switch1253.sha256,/^[a-f0-9]{64}$/);
 assert.equal(m.status,'PARTIAL_NATIVE_BODY_AND_RUNTIME_PENDING');
 hard(m.hardFlags);
});
