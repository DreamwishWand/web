import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  OPERATION_NATIVE_STATIC_GATE,NATIVE_OPERATION_ROWS,NATIVE_SOURCE_TARGETS,
  NATIVE_PRODUCT_WRITER_ENABLED,NATIVE_STATIC_V3_ACCEPTED,
  describeNativeOperation,previewNativeInventoryAmount,inspectNativeStaticTraceDraft
} from '../src/lib/ddv/native/operation-native-static-gate.mjs';
const sw=NATIVE_SOURCE_TARGETS.switch1253,steam=NATIVE_SOURCE_TARGETS.steam1253;
const hash='a'.repeat(64);
const path='/Player/ListInventories/12/Inventory/31100001/Amount';
const amount=()=>({declaredBuild:sw,inventoryId:12,canonicalItemId:31100001,
  compatibleItemType:'ItemType_ActivityItem',existingRow:true,oldAmount:50,nextAmount:49,
  sourceHash:hash,changedPaths:[path]});

test('21 canonical operations are unique, immutable and none authorizes export',()=>{
  assert.equal(OPERATION_NATIVE_STATIC_GATE,'wand.01e.native-operation-static-gate@1');
  assert.equal(NATIVE_OPERATION_ROWS.length,21);
  assert.equal(new Set(NATIVE_OPERATION_ROWS.map(x=>x.operationId)).size,21);
  for(const op of NATIVE_OPERATION_ROWS){
    assert.ok(Object.isFrozen(op));assert.ok(Object.isFrozen(op.requiredStaticEvidence));
    assert.equal(op.nativeV3Accepted,false);assert.equal(op.writerAuthorized,false);
    assert.equal(op.editedCopyAuthorized,false);
  }
  assert.equal(NATIVE_PRODUCT_WRITER_ENABLED,false);
  assert.equal(NATIVE_STATIC_V3_ACCEPTED,false);
});

test('Tier A quantity, chest, appearance, wardrobe and independent time are NOT gated by unrelated W1 or Road/Fence',()=>{
  for(const id of ['INV_AMOUNT','INV_MOVE','CHEST_AMOUNT','APPEARANCE','WARDROBE','TIME_SIMPLE']){
    const result=describeNativeOperation(id,sw);
    assert.equal(result.status,'TIER_A_STATIC_INDEPENDENT_CANDIDATE',id);
    assert.equal(result.w1OrRoadFenceGlobalBlocker,false,id);
    assert.equal(result.nativeV3Accepted,false);
    assert.equal(result.productWriterAuthorized,false);
  }
});

test('Cross-domain native recomputation remains Tier B; premium rights stay Tier C protected',()=>{
  for(const id of ['INV_SLOT','CHEST_TRANSFER','FURNITURE_STORAGE','OWNERSHIP_LOCAL','SKIN_SELECT',
  'TIME_EVENT','GRID_MOVE','GRID_ADDDEL','SUBGRID','ROAD_FENCE','QUEST','COLLECTION','PRESET_APPLY']){
    assert.equal(describeNativeOperation(id,sw).status,'TIER_B_NATIVE_DEPENDENCIES_OPEN',id);
  }
  for(const id of ['SKIN_UNLOCK','ENTITLEMENT_REMOTE']){
    assert.equal(describeNativeOperation(id,sw).status,'REJECTED',id);
  }
});

test('Steam and Switch same schema626 do not imply the same Build, and caller cannot mint Native acceptance',()=>{
  const s=describeNativeOperation('INV_AMOUNT',steam);
  assert.equal(s.status,'TIER_A_STATIC_INDEPENDENT_CANDIDATE');
  assert.equal(s.externalBuildIsAuthentication,false);
  const forged={...steam,buildId:sw.buildId};
  assert.equal(describeNativeOperation('INV_AMOUNT',forged).reason,'EXACT_PLATFORM_BUILD_VERSION_SCHEMA_REQUIRED');
  assert.equal(describeNativeOperation('INV_AMOUNT',{...sw,schema:624}).status,'REJECTED');
  assert.equal(describeNativeOperation('NOT_REAL',sw).reason,'UNKNOWN_OPERATION');
  assert.equal(describeNativeOperation('INV_AMOUNT',{...sw,writerAuthorized:true}).productWriterAuthorized,false);
});

test('Existing inventory amount 50→49 is a read-only CAS preview; NOT a verified Native write',()=>{
  const x=previewNativeInventoryAmount(amount());
  assert.equal(x.status,'TIER_A_01D_TO_01A_CAS_PREVIEW_ONLY');
  assert.equal(x.sourcePointer,path);
  assert.equal(x.compatibleItemType,'ItemType_ActivityItem');
  assert.equal(x.hypotheticalNextAmount,49);
  assert.equal(x.nativeV3Accepted,false);
  assert.equal(x.productWriterAuthorized,false);
  assert.equal(x.productEditedCopyAuthorized,false);
  assert.equal(x.recomputationRequirement,'UNKNOWN_UNTIL_SAME_BUILD_NATIVE_STATIC_TRACE');
});

test('Amount rejects absent row, zero/depletion, bad amount/ID, fake path and unrelated DLC write',()=>{
  const cases=[
    {existingRow:false},{nextAmount:0},{oldAmount:0},{nextAmount:-1},
    {nextAmount:2147483648},{nextAmount:50},{nextAmount:51},{oldAmount:10000},{canonicalItemId:0},
    {canonicalItemId:-1},{canonicalItemId:2147483648},{canonicalItemId:31100001.5},
    {inventoryId:0},{inventoryId:4294967296},
    {compatibleItemType:'ItemType_Ingredient'},{compatibleItemType:'ActivityItemType_Ingredient'},
    {compatibleItemType:'ItemType_Unknown'},{compatibleItemType:'ItemType_Furniture'},
    {inventoryId:-1},{compatibleItemType:-1},{compatibleItemType:7},
    {compatibleItemType:0},{compatibleItemType:null},
    {compatibleItemType:'untrusted'},{compatibleItemType:'ItemType_'},
    {compatibleItemType:'ItemType_Premium'},{compatibleItemType:'ItemType_DLC'},
    {compatibleItemType:'ItemType_Currency'},{compatibleItemType:'ItemType_Quest'},
    {compatibleItemType:'ItemType_Ingredient '},
    {compatibleItemType:'ItemType_Ingredient\\n'},
    {compatibleItemType:'ItemType_ActivityItem'.repeat(6)},
    {sourceHash:'bad'},
    {changedPaths:[]},{changedPaths:[path,path]},
    {changedPaths:[path,'/Player/Entitlement/Premium']},
    {changedPaths:['/Player/ListInventories/12/Inventory/5678/Amount']}
  ];
  for(const change of cases){const x=previewNativeInventoryAmount({...amount(),...change});
    assert.equal(x.status,'REJECTED',JSON.stringify(change));
    assert.equal(x.productWriterAuthorized,false);
  }
});

test('Static trace with plausible same-build producer and consumer is not self-authenticating V3',()=>{
  const claim={operationId:'INV_AMOUNT',declaredBuild:sw,nativeBinarySha256:hash,
    producerCalls:[{symbol:'untrusted.producer',binarySha256:hash}],
    consumerCalls:[{symbol:'untrusted.consumer',binarySha256:hash}],
    saveReadPointers:[path],saveWritePointers:[path],derivedWritePointers:[],
    claim:{nativeV3Accepted:true,allNativeReferencesVerified:true,writerAuthorized:true}};
  const x=inspectNativeStaticTraceDraft(claim);
  assert.equal(x.status,'UNTRUSTED_STATIC_TRACE_SHAPE_ONLY');
  assert.equal(x.noDerivedWritesProven,false);
  assert.equal(x.nativeV3Accepted,false);
  assert.equal(x.productWriterAuthorized,false);
  assert.ok(x.missingEvidence.includes('EXACT_SOURCE_SESSION_READSET_AND_CAS_NOT_BOUND'));
});

test('Static trace denies foreign build hashes, no producer, nonstandard pointers and protected edits',()=>{
  const base={operationId:'QUEST',declaredBuild:sw,nativeBinarySha256:hash,
    producerCalls:[{symbol:'prod',binarySha256:hash}],consumerCalls:[{symbol:'cons',binarySha256:hash}],
    saveReadPointers:['/Player/Quests/1'],saveWritePointers:['/Player/Quests/1'],derivedWritePointers:[]};
  for(const change of [{producerCalls:[]},{consumerCalls:[]},{nativeBinarySha256:'b'.repeat(64)},
  {saveReadPointers:['/Player/Quests/1','/Player/Quests/1']},{saveWritePointers:['not/a/pointer']},
  {saveWritePointers:['/Player/Entitlements/1']},{derivedWritePointers:['/Player/DLC/Items']},
  {producerCalls:[{symbol:'prod',binarySha256:'b'.repeat(64)}]}]){
    const x=inspectNativeStaticTraceDraft({...base,...change});
    assert.equal(x.status,'REJECTED',JSON.stringify(change));
  }
});

test('W1 event producer cannot be chosen by inverse Softwood ItemID; intentional 2126 never auto-repaired',()=>{
  const b={operationId:'TIME_EVENT',declaredBuild:sw,nativeBinarySha256:hash,
    producerCalls:[{symbol:'time.producer',binarySha256:hash}],
    consumerCalls:[{symbol:'time.consumer',binarySha256:hash}],
    saveReadPointers:['/World/RecurringEvents/155/ItemSpawning/NextOccurrence'],
    saveWritePointers:['/World/RecurringEvents/155/ItemSpawning/NextOccurrence'],
    derivedWritePointers:[],eventsFromItemId:[2010000021,2010000022,2010000024,2010000025]};
  assert.equal(inspectNativeStaticTraceDraft(b).reason,'ITEM_ID_CANNOT_SELECT_UNIQUE_EVENT_PRODUCER');
  const x=inspectNativeStaticTraceDraft({...b,eventsFromItemId:[2010000021]});
  assert.equal(x.nativeV3Accepted,false);
  assert.equal(x.productWriterAuthorized,false);
  assert.equal(x.noDerivedWritesProven,false);
});

test('01E d.mts both CompatibleItemType positions match 01A/01D String Native enum contract',()=>{
  const d=readFileSync(new URL('../src/lib/ddv/native/operation-native-static-gate.d.mts',import.meta.url),'utf8');
  assert.ok(d.includes("NativeExistingAmountItemType = 'ItemType_ActivityItem'|'ItemType_Furniture'"));
  assert.ok(d.includes('compatibleItemType?:NativeExistingAmountItemType;'));
  assert.ok(d.includes('compatibleItemType:NativeExistingAmountItemType;'));
  assert.ok(!d.includes('compatibleItemType?:number;'));
  assert.ok(!d.includes('compatibleItemType:number;'));
  assert.equal(previewNativeInventoryAmount({...amount(),declaredBuild:steam}).compatibleItemType,
    'ItemType_ActivityItem');
});

// Synthetic IDs test only the prefix fence, not actual ItemDB membership.
test('Steam626 exact enum and signed ItemID type prefix: ActivityItem and Furniture positive, mismatches fail closed',()=>{
  for(const [id,type] of [[31100001,'ItemType_ActivityItem'],[40000001,'ItemType_Furniture']]){
    const input={...amount(),declaredBuild:steam,canonicalItemId:id,compatibleItemType:type,
      changedPaths:[`/Player/ListInventories/12/Inventory/${id}/Amount`]};
    const x=previewNativeInventoryAmount(input);
    assert.equal(x.status,'TIER_A_01D_TO_01A_CAS_PREVIEW_ONLY');
    assert.equal(x.nativeV3Accepted,false);
    assert.equal(x.fullReferenceClosureVerified,false);
    assert.equal(x.productWriterAuthorized,false);
    for(const other of ['ItemType_Ingredient','ActivityItemType_Ingredient','ItemType_Unknown',
      type==='ItemType_ActivityItem'?'ItemType_Furniture':'ItemType_ActivityItem']){
      assert.equal(previewNativeInventoryAmount({...input,compatibleItemType:other}).status,'REJECTED');
    }
  }
});

test('QA958 regression: changing or throwing Build accessors never pair a Steam witness with a Switch target',()=>{
  for(const op of ['INV_AMOUNT','CHEST_AMOUNT','GRID_MOVE']){
    let calls=0;
    const b={get platform(){return ++calls<=2?sw.platform:steam.platform;},
      get buildKind(){return calls<=2?sw.buildKind:steam.buildKind;},
      get buildId(){return calls<=2?sw.buildId:steam.buildId;},
      gameVersion:'1.25.3',schema:626};
    const bad=describeNativeOperation(op,b);
    assert.equal(bad.status,'REJECTED');
    assert.equal(bad.archivedSteam626NativeWitness,undefined);
    assert.equal(calls,0);
    const throwing={...steam,get schema(){throw new Error('caller accessor');}};
    assert.equal(describeNativeOperation(op,throwing).status,'REJECTED');
    const inherited=Object.create(steam);
    assert.equal(describeNativeOperation(op,inherited).status,'REJECTED');
    const revoked=Proxy.revocable({...steam},{});
    revoked.revoke();
    assert.equal(describeNativeOperation(op,revoked.proxy).status,'REJECTED');
  }
});
test('QA958 regression: one coherent Build snapshot selects both target and witness across all three operations',()=>{
  for(const op of ['INV_AMOUNT','CHEST_AMOUNT','GRID_MOVE']){
    for(const target of [steam,sw]){
      const reads=new Map();
      let propertyReads=0;
      const b=new Proxy({...target},{
        get(){propertyReads++;throw new Error('unexpected ordinary property read');},
        getOwnPropertyDescriptor(obj,key){
          const count=(reads.get(key)||0)+1;reads.set(key,count);
          if(count>1)throw new Error('second Build descriptor read');
          return Reflect.getOwnPropertyDescriptor(obj,key);
        }
      });
      const result=describeNativeOperation(op,b);
      assert.deepEqual(result.target,target);
      assert.ok(Object.isFrozen(result.target));
      assert.equal(propertyReads,0);
      assert.deepEqual([...reads.values()],[1,1,1,1,1]);
      assert.equal(result.archivedSteam626NativeWitness?.operationId,target===steam?op:undefined);
      assert.equal(result.externalBuildIsAuthentication,false);
      assert.equal(result.nativeV3Accepted,false);
      assert.equal(result.productWriterAuthorized,false);
      assert.equal(describeNativeOperation(op,{...target,buildId:'wrong'}).status,'REJECTED');
      assert.equal(describeNativeOperation(op,Object.assign(Object.create(null),target)).target.platform,target.platform);
    }
  }
});
