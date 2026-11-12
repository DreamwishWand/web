import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {previewNativeInventoryAmount as preview,describeNativeOperation as describe,
 inspectNativeStaticTraceDraft as trace,NATIVE_SOURCE_TARGETS as B,
 NATIVE_OPERATION_ROWS,NATIVE_PRODUCT_WRITER_ENABLED,NATIVE_STATIC_V3_ACCEPTED}
 from '../../src/lib/ddv/native/operation-native-static-gate.mjs';
const oldHead='c96edab903762696558a5a02cdc3c05f30d67876';
const acceptedMain='61f0a1c00b87ae35dede4d3dbc2430a77e8196e1';
const file='src/lib/ddv/native/operation-native-static-gate.mjs';
const gitFile=(ref,path,blob)=>{
 assert.equal(execFileSync('git',['rev-parse',ref+':'+path],{encoding:'utf8'}).trim(),blob);
 return execFileSync('git',['show',ref+':'+path],{encoding:'utf8'});
};
const importText=async s=>import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
const old=await importText(gitFile(oldHead,file,'954dfd2b802410a284dee00006c538a91dacbd43'));
const d=await importText(gitFile(acceptedMain,'src/lib/ddv/core/items/tier-a-edit-requests.mjs','473aabc9a83ab9227cd8c8c915d4f225139d386d'));
const rust=gitFile(acceptedMain,'crates/ddv-save-core/src/semantic_writer.rs','9e77d3d0243ea01fb061de7134f6aeb867ac5297');
const decl=readFileSync('src/lib/ddv/native/operation-native-static-gate.d.mts','utf8');
const H='a'.repeat(64),path='/Player/ListInventories/4/Inventory/30000001/Amount';
const valid=()=>({declaredBuild:B.steam1253,inventoryId:4,canonicalItemId:30000001,
 compatibleItemType:'ItemType_Ingredient',existingRow:true,oldAmount:50,nextAmount:49,
 sourceHash:H,changedPaths:[path]});
const off=r=>{
 for(const f of ['nativeV3Accepted','productWriterAuthorized','productEditedCopyAuthorized','operationEnabled'])
  assert.equal(r[f],false,f);
};
const denied=(r,code)=>{off(r);assert.equal(r.status,'REJECTED');assert.equal(r.reason,code)};
const yes=r=>{off(r);assert.equal(r.status,'TIER_A_01D_TO_01A_CAS_PREVIEW_ONLY');
 assert.equal(r.originalShaValidatedByCore,false);assert.equal(r.externalBuildIsAuthentication,false);
 assert.equal(r.fullReferenceClosureVerified,false);assert.equal(r.independentRealEditedCopyVerified,false);
 assert.equal(r.recomputationRequirement,'UNKNOWN_UNTIL_SAME_BUILD_NATIVE_STATIC_TRACE');};
const dreq=(type,patch={})=>d.describeTierARequest({
 target:d.STEAM626,source:{originalEncryptedSha256:H},
 session:{sessionId:'1'.repeat(32),revision:0,indexGeneration:1,decodedSha256:H},
 command:{operation:'Inventory.ExistingAmountDecrease',inventoryId:4,canonicalItemId:30000001,
 compatibleItemType:type,expectedOldAmount:50,nextAmount:49,entryPresent:true,...patch}
});
const draft=(operationId='INV_AMOUNT')=>({operationId,declaredBuild:B.steam1253,
 producerCalls:[{symbol:'unverified producer',binarySha256:H}],
 consumerCalls:[{symbol:'unverified consumer',binarySha256:H}],
 saveReadPointers:[path],saveWritePointers:[path],derivedWritePointers:[],
 nativeBinarySha256:H,claim:{nativeV3Accepted:true,productWriterAuthorized:true}});
test('old immutable Source c96edab reproduces number versus String mismatch; fixed reverses',()=>{
 const a=old.previewNativeInventoryAmount(valid());
 denied(a,'EXISTING_CANONICAL_ROW_AND_NONZERO_AMOUNT_REQUIRED');
 const b=old.previewNativeInventoryAmount({...valid(),compatibleItemType:7});
 yes(b);assert.equal(b.compatibleItemType,7);
 const c=preview(valid());yes(c);assert.equal(c.compatibleItemType,'ItemType_Ingredient');
 denied(preview({...valid(),compatibleItemType:7}),'EXISTING_CANONICAL_ROW_AND_NONZERO_AMOUNT_REQUIRED');
});
test('actual accepted 01D request and 01A Rust command agree with new 01E String exact token',()=>{
 const r=preview(valid());yes(r);
 const q=dreq(r.compatibleItemType);
 assert.equal(q.status,'INVENTORY_CAS_TYPED_PREVIEW_RUST_NATIVE_ITEM_RULES_PENDING');
 const cmd=q.candidate.nativeDevCommand;
 assert.equal(cmd.variant,'InventoryExistingAmountDecrease');
 assert.equal(cmd.expected_compatible_item_type,r.compatibleItemType);
 assert.equal(cmd.expected_old_amount,r.expectedOldAmount);
 assert.equal(cmd.new_amount,r.hypotheticalNextAmount);
 assert.equal(q.candidate.fieldPath,r.sourcePointer);
 assert.equal(q.candidate.readSet.find(x=>x.expectedType==='EXACT_NATIVE_ENUM').expectedValue,r.compatibleItemType);
 assert.match(rust,/expected_compatible_item_type\s*:\s*String/);
 assert.equal(q.writerAuthorized,false);
 assert.equal(dreq(7).status,'BLOCKED');
 assert.match(decl,/compatibleItemType\?:string/);
 assert.match(decl,/compatibleItemType:string/);
 assert.doesNotMatch(decl,/compatibleItemType\??:number/);
});
test('exact shared token filter rejects numeric coercion malformed or protected values',()=>{
 for(const type of [7,0,-1,NaN,null,undefined,true,{},['ItemType_Ingredient'],
  '', '7','Ingredient','itemtype_Ingredient','ItemType_','ItemType_Ingredient ',
  'ItemType_Ingredient/Other','ItemType_'+ 'X'.repeat(49),
  'ItemType_Premium','ItemType_DLC','ItemType_Entitlement','ItemType_Receipt',
  'ItemType_Auth','ItemType_Currency','ItemType_Moonstone','ItemType_Quest']){
  denied(preview({...valid(),compatibleItemType:type}),'EXISTING_CANONICAL_ROW_AND_NONZERO_AMOUNT_REQUIRED');
  assert.equal(dreq(type).status,'BLOCKED');
 }
});
test('bounded unknown enum shape stays unverified, no inferred Native allowed type',()=>{
 for(const type of ['ItemType_X','ItemType_'+ 'A'.repeat(48),'ItemType_UnprovenFutureType']){
  const r=preview({...valid(),compatibleItemType:type});yes(r);
  assert.equal(r.compatibleItemType,type);
  assert.equal(r.fullReferenceClosureVerified,false);
 }
});
test('exact declared Steam626 vs Switch626, mixed tags and schema denied',()=>{
 yes(preview(valid()));yes(preview({...valid(),declaredBuild:B.switch1253}));
 for(const patch of [{platform:'switch'},{buildKind:'switch-bid'},{buildId:B.switch1253.buildId},
  {schema:624},{schema:625},{schema:627},{gameVersion:'1.25.0'},
  {buildId:'releases_1.25-v1.25.3'},{buildId:'52BD625D9B4E0053'}]){
  denied(preview({...valid(),declaredBuild:{...B.steam1253,...patch}}),'EXACT_PLATFORM_BUILD_VERSION_SCHEMA_REQUIRED');
 }
 assert.equal(dreq('ItemType_Ingredient').target.buildId,B.steam1253.buildId);
});
test('normalized numeric ids and exact path; string/fraction/alias/extra fields rejected',()=>{
 for(const patch of [{inventoryId:'04'},{canonicalItemId:'30000001'},
  {inventoryId:4.1},{canonicalItemId:0},{canonicalItemId:-1},{inventoryId:2**53},
  {canonicalItemId:2**53},{existingRow:false},{existingRow:'true'}])
  denied(preview({...valid(),...patch}),'EXISTING_CANONICAL_ROW_AND_NONZERO_AMOUNT_REQUIRED');
 for(const changedPaths of [[],[path,path],[path+'/x'],[path.replace('/4/','/04/')],
  [path.replace('/4/','/4~1.. /')],[path,'/World/RecurringEvents/1/Next']])
  denied(preview({...valid(),changedPaths}),'EXACT_SINGLE_EXISTING_AMOUNT_POINTER_REQUIRED');
});
test('old value CAS is a hypothetical assertion, no stale caller hash or old amount is authenticated',()=>{
 for(const patch of [{oldAmount:0},{oldAmount:1.5},{oldAmount:50,nextAmount:50},
  {oldAmount:2147483648},{nextAmount:0},{nextAmount:-1},{nextAmount:2147483648}])
  denied(preview({...valid(),...patch}),'EXISTING_CANONICAL_ROW_AND_NONZERO_AMOUNT_REQUIRED');
 denied(preview({...valid(),sourceHash:'x'.repeat(64)}),'SOURCE_HASH_SHAPE_REQUIRED_NOT_AUTHENTICATION');
 const forged=preview({...valid(),sourceHash:'b'.repeat(64),oldAmount:51,
  revision:999,indexGeneration:999,sessionId:'forged',nativeV3Accepted:true,productWriterAuthorized:true});
 yes(forged);assert.equal(forged.expectedOldAmount,51);
 // Actual stale/old-amount denial belongs to the already-accepted Rust CAS.
});
test('01E broader static shape cannot elevate non-DEV limits or increases into Rust command',()=>{
 for(const patch of [{oldAmount:50,nextAmount:51},{oldAmount:10000,nextAmount:9999}]){
  yes(preview({...valid(),...patch}));
  assert.equal(dreq('ItemType_Ingredient',{expectedOldAmount:patch.oldAmount,nextAmount:patch.nextAmount}).status,'BLOCKED');
 }
});
test('forged EventID and ambiguous inverse producer do not authenticate event or repair clock',()=>{
 const x=draft('TIME_EVENT');
 for(const eventsFromItemId of [[],[1,2],Array.from({length:8},(_,i)=>i+1)])
  denied(trace({...x,eventsFromItemId}),'ITEM_ID_CANNOT_SELECT_UNIQUE_EVENT_PRODUCER');
 const r=trace({...x,eventsFromItemId:[99999999],eventId:99999999,
  saveWritePointers:['/World/RecurringEvents/99999999/Next'],nextDate:'2126-01-01'});
 off(r);assert.equal(r.status,'UNTRUSTED_STATIC_TRACE_SHAPE_ONLY');
 assert.equal(r.nativeBinaryAuthenticated,false);assert.equal(r.noDerivedWritesProven,false);
 assert.equal(r.sourceDigestValidated,false);assert.equal(r.fullReferenceClosureVerified,false);
});
test('fake Area mapping and Native symbol/hash claims cannot produce Native proof',()=>{
 const r=trace({...draft('GRID_MOVE'),areaEnum:1,areaMapKey:1,
  claim:{areaMappingVerified:true,nativeV3Accepted:true,productWriterAuthorized:true}});
 off(r);assert.equal(r.status,'UNTRUSTED_STATIC_TRACE_SHAPE_ONLY');
 assert.equal(r.nativeBinaryAuthenticated,false);assert.equal(r.declaredBuildIsAuthentic,false);
 assert.equal(r.noDerivedWritesProven,false);
 denied(trace({...draft(),producerCalls:[{symbol:'fake',binarySha256:'b'.repeat(64)}]}),'NATIVE_TRACE_DRAFT_INCOMPLETE_OR_UNTRUSTED');
 denied(trace({...draft(),consumerCalls:[]}),'NATIVE_TRACE_DRAFT_INCOMPLETE_OR_UNTRUSTED');
});
test('rights and timestamp modification cannot be authorized through static trace or inventory pointer',()=>{
 for(const op of ['SKIN_UNLOCK','ENTITLEMENT_REMOTE'])
  denied(describe(op,B.steam1253),'PROTECTED_RIGHTS_OR_ENTITLEMENT_OPERATION');
 for(const p of ['/Player/Entitlements/0','/Player/DLC/1','/Player/Premium/Amount',
 '/Player/Receipt/1','/Player/Auth/token','/Player/Moonstones/Amount','/Player/Currencies/1']){
  denied(trace({...draft(),saveWritePointers:[p]}),'PROTECTED_ENTITLEMENT_OR_DLC_WRITE_PATH');
  denied(trace({...draft(),derivedWritePointers:[p]}),'PROTECTED_ENTITLEMENT_OR_DLC_WRITE_PATH');
 }
 denied(preview({...valid(),changedPaths:[path,'/World/RecurringEvents/1/Next']}),'EXACT_SINGLE_EXISTING_AMOUNT_POINTER_REQUIRED');
 off(describe('TIME_SIMPLE',B.steam1253));
 off(describe('TIME_EVENT',B.steam1253));
 assert.equal(NATIVE_PRODUCT_WRITER_ENABLED,false);assert.equal(NATIVE_STATIC_V3_ACCEPTED,false);
 for(const row of NATIVE_OPERATION_ROWS){
  assert.equal(row.writerAuthorized,false);assert.equal(row.nativeV3Accepted,false);
 }
});
