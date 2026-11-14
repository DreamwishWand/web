import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const scopePath=new URL('../static/ddv/core/world/v1.25/min-transform-scope-pack-v125.json',import.meta.url);
const orchestratorPath=new URL('../src/lib/wep/min-verified-transform-export-v1.ts',import.meta.url);
const placementPath=new URL('../src/lib/wep/placement-legality-v19.ts',import.meta.url);

test('minimum transform browser scope pack is pinned to the canonical v1.25 CORE subset',async()=>{
  const bytes=await readFile(scopePath);
  const sha=createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha,'8fb0c2ba53977eb98a63930f56ae67408f59b6c2a7e01549a3430c9b5f6c8934');
  const pack=JSON.parse(bytes.toString('utf8'));
  assert.equal(pack.schema,'dreamwish-wand-v125-furniture-write-scope-core-browser-pack');
  assert.equal(pack.version,1);
  assert.equal(pack.gameVersion,'1.25.0');
  assert.equal(pack.buildID,'52BD625D9B4E0053');
  assert.equal(pack.sourceCount,6233);
  assert.equal(pack.coreCount,3276);
  assert.equal(Object.keys(pack.items).length,3276);
  let syncOnline=0,mission=0,nativeReject=0;
  for(const row of Object.values(pack.items)){
    assert.equal(row[0],'FurnitureItemData');
    assert.equal(row[1],'CORE_STATELESS_FURNITURE');
    assert.equal(row[2],'None');
    assert.equal(typeof row[3],'boolean');
    assert.equal(row[4],false);
    assert.ok(row[5]===null||row[5]===false);
    assert.ok(Array.isArray(row[6]));
    assert.equal(typeof row[7],'boolean');
    if(row[7]) syncOnline++;
    if(row[3]) mission++;
    if(row[6].length) nativeReject++;
  }
  assert.equal(syncOnline,798);
  assert.equal(mission,466);
  assert.equal(nativeReject,492);
});

test('WEP verified export source is bound to promoted 01A/01B chain and keeps direct persistence false',async()=>{
  const source=await readFile(orchestratorPath,'utf8');
  for(const required of [
    'classifyMinimumPersistentTransform',
    'buildMinimumTransformTransactionPlan',
    'minimumPersistentTransformAdapter',
    'createVerifiedWriteCandidate',
    'verifyWriteCandidate',
    'createVerifiedCandidateExportBundle',
    'openWorldSaveBytes',
    'projectSwitchAreaGrid',
    'WEP_EXPORT_SOURCE_CHANGED_SINCE_PLAN',
    'WEP_EXPORT_EXACT_BUILD_CONFIRMATION_REQUIRED',
    'exactBuildConfirmed',
    'WEP_EXPORT_UNSUPPORTED_PENDING_CHANGE',
    'persistentWriteAuthorized:false',
    'WORLD_PERSISTENT_WRITE_V125:false'
  ]) assert.ok(source.includes(required),required);
  assert.ok(!source.includes('executePersistentCommit('));
  assert.ok(!source.includes('targetPath'));
});

test('WEP placement binding exposes the exact promoted minimum-transform placement revision',async()=>{
  const source=await readFile(placementPath,'utf8');
  assert.ok(source.includes('V125_NATIVE_ORDINARY_CARDINAL_NONWALL_GROUPSET_2'));
  assert.ok(source.includes('classifyMinimumTransformPlacement'));
  assert.ok(source.includes('validateOrdinaryCardinalPlacement'));
  assert.ok(source.includes('clearArea: false'));
  assert.ok(source.includes('automaticSpawning: false'));
});

import { makeSyntheticP1gProfile } from './helpers/p1g-fixture.mjs';
import { openWorldSaveBytes } from '../src/lib/wep/world-save-source.ts';
import { createSwitchWorldReadAdapter,projectSwitchAreaGrid } from '../src/lib/wep/world-browser-adapter.ts';
import { createSwitchV125PlacementLegalityBinding } from '../src/lib/wep/placement-legality-v19.ts';
import { normalizeEditorDocument } from '../src/lib/wep/editor-runtime.ts';
import { reviewMinimumVerifiedTransform,commitMinimumVerifiedTransform } from '../src/lib/wep/min-verified-transform-export-v1.ts';

const localFetch=async url=>{
  const path=new URL(String(url),'https://wand.invalid').pathname;
  try{return new Response(await readFile(new URL('../static'+path,import.meta.url)),{status:200});}
  catch{return new Response('not found',{status:404});}
};
function profileForTransform(){
  return {
    GameInfo:{Version:624,InitialVersion:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
    Player:{},ProfileWorld:{Stores:[],Shops:[]},ConditionalEventHistory:{ActiveEvents:{}},
    World:{
      GridCollection:{Grids:{'10':{ID:10,GridDataPath:'GridData/Villages/Village04-BeachLevel-GridData.json',GridDefaultLayoutPath:'',TessellationFactor:2,NextGridObjectID:102,Objects:{
        '101':{ID:101,ItemID:40000048,X:452,Y:228,Orientation:'GridOrientation_Up',State:null}
      }}},DiffGrids:{}},
      Villages:[{SceneItemId:1540000000,Areas:{'7':{GridIDs:[10],Unlocked:true,EnvironmentEffectItemID:0,EnvironmentEffectOrientation:'GridOrientation_Up'}}}],
      FloatingIslands:{},MissionSlots:{},QuestInfo:{},Keyholes:{}
    },Opaque:{keep:true}
  };
}
async function transformFixture(){
  const profile=profileForTransform();
  const sourceBytes=Uint8Array.from(makeSyntheticP1gProfile(profile));
  const opened=await openWorldSaveBytes(sourceBytes,{sourcePlatform:'switch'});
  const worldBinding=await createSwitchWorldReadAdapter({fetchImpl:localFetch});
  const placementBinding=await createSwitchV125PlacementLegalityBinding({fetchImpl:localFetch});
  const baselineDocument=normalizeEditorDocument(projectSwitchAreaGrid(opened,opened.areas[0],10,worldBinding));
  const draftDocument=structuredClone(baselineDocument);
  const object=draftDocument.objects[0];
  assert.equal(object.itemId,40000048);
  // Reuse the exact positive cell from accepted primary-job Chrome PR64
  // run37113368314/job111175398809, then recheck against current pinned data.
  const before=placementBinding.classifyMinimumTransformPlacement({document:baselineDocument,editorId:object.editorId});
  assert.equal(before.result.verdict,'VALID');
  object.x=453;object.y=228;
  const after=placementBinding.classifyMinimumTransformPlacement({document:draftDocument,editorId:object.editorId});
  assert.equal(after.result.valid,true);
  assert.equal(after.result.verdict,'VALID');
  const input={sourceBytes,sourceName:'profile',sourceEpoch:1,opened,baselineDocument,draftDocument,placementBinding,worldBinding,fetchImpl:localFetch,exactBuildConfirmed:true};
  return {profile,input};
}
test('minimum transform Review rejects another packaged source and forged baseline before export',async()=>{
  const {profile,input}=await transformFixture();
  const other=structuredClone(profile);
  other.Opaque.keep=false;
  const bytes=Uint8Array.from(makeSyntheticP1gProfile(other));
  await assert.rejects(()=>reviewMinimumVerifiedTransform({...input,sourceBytes:bytes}),/WEP_EXPORT_SOURCE_PROFILE_MISMATCH/);
  const baseline=structuredClone(input.baselineDocument),draft=structuredClone(input.draftDocument);
  baseline.objects[0].x+=2;
  await assert.rejects(()=>reviewMinimumVerifiedTransform({...input,baselineDocument:baseline,draftDocument:draft}),/WEP_EXPORT_BASELINE_SOURCE_MISMATCH/);
  const stale=structuredClone(input.opened);
  stale.profile.World.GridCollection.Grids['10'].Objects['102']={ID:102,ItemID:40000048,X:1,Y:1,Orientation:'GridOrientation_Up',State:null};
  await assert.rejects(()=>reviewMinimumVerifiedTransform({...input,opened:stale}),/WEP_EXPORT_SOURCE_PROFILE_MISMATCH/);
});
test('minimum transform accepts one source-bound Review and denies cloned, changed and replayed plans',async()=>{
  const {input}=await transformFixture();
  const review=await reviewMinimumVerifiedTransform(input);
  assert.equal(review.status,'READY');
  const commit=review=>commitMinimumVerifiedTransform({review,currentSourceEpoch:1,sourceBytes:input.sourceBytes,baselineDocument:input.baselineDocument,draftDocument:input.draftDocument,worldBinding:input.worldBinding});
  await assert.rejects(()=>commit(structuredClone(review)),/WEP_EXPORT_REVIEW_STALE/);
  const changed=await reviewMinimumVerifiedTransform(input);
  changed.plan.intent.finalTransform.x+=2;
  await assert.rejects(()=>commit(changed),/WEP_EXPORT_REVIEW_STALE/);
  const result=await commit(review);
  assert.equal(result.status,'PASS');
  assert.deepEqual(Array.from(result.artifacts.backup.bytes),Array.from(input.sourceBytes));
  assert.notDeepEqual(Array.from(result.artifacts.edited.bytes),Array.from(input.sourceBytes));
  await assert.rejects(()=>commit(review),/WEP_EXPORT_REVIEW_STALE/);
});

test('minimum transform real Core rotation derives exact footprint, size and marker and exports Orientation only',async()=>{
  const {input}=await transformFixture();
  const before=input.baselineDocument.objects[0];
  const geometry=input.worldBinding.adapter.geometryService;
  const after=geometry.rotateSelectionLikeScene([structuredClone(before)],1)[0];
  assert.equal(after.metadata.rotationSemantics,'SCENE_CARDINAL_TOP_LEFT');
  assert.equal(after.x,before.x);assert.equal(after.y,before.y);
  const draft=structuredClone(input.baselineDocument);draft.objects=[after];
  const review=await reviewMinimumVerifiedTransform({...input,draftDocument:draft});
  assert.equal(review.change.operation,'ROTATE');
  const result=await commitMinimumVerifiedTransform({review,currentSourceEpoch:1,sourceBytes:input.sourceBytes,baselineDocument:input.baselineDocument,draftDocument:draft,worldBinding:input.worldBinding});
  assert.equal(result.status,'PASS');
  const reopened=await openWorldSaveBytes(result.artifacts.edited.bytes,{sourcePlatform:'switch'});
  const expected=structuredClone(input.opened.profile);
  expected.World.GridCollection.Grids['10'].Objects['101'].Orientation='GridOrientation_Right';
  assert.deepEqual(reopened.profile,expected);
  assert.deepEqual(Array.from(result.artifacts.backup.bytes),Array.from(input.sourceBytes));
  for(const alter of [
    x=>x.footprint=[{x:999,y:999}],
    x=>x.metadata.footprintSize={w:999,h:999},
    x=>x.metadata.rotationSemantics='FORGED',
    x=>x.metadata.rawState={forged:true},
    x=>x.source.relation='CHILD',
    x=>x.dependencyIds=['forged']
  ]){
    const bad=structuredClone(draft);alter(bad.objects[0]);
    await assert.rejects(()=>reviewMinimumVerifiedTransform({...input,draftDocument:bad}),/WEP_EXPORT_UNSUPPORTED_PENDING_CHANGE|WEP_EXPORT_TARGET_IDENTITY_MISMATCH/);
  }
  const badBaseline=structuredClone(input.baselineDocument);
  badBaseline.objects[0].footprint=[{x:999,y:999}];
  const badDraft=structuredClone(badBaseline);
  badDraft.objects=geometry.rotateSelectionLikeScene(badBaseline.objects,1);
  await assert.rejects(()=>reviewMinimumVerifiedTransform({...input,baselineDocument:badBaseline,draftDocument:badDraft}),/WEP_EXPORT_BASELINE_SOURCE_MISMATCH|WEP_EXPORT_UNSUPPORTED_PENDING_CHANGE/);
});

test('minimum transform review binds the same draft to asynchronous placement and the exported plan',async()=>{
  const {input}=await transformFixture();
  const valid=structuredClone(input.draftDocument);
  const invalid=structuredClone(valid);
  invalid.objects[0].x=-100000;
  const editorId=invalid.objects[0].editorId;
  assert.equal(input.placementBinding.classifyMinimumTransformPlacement({document:invalid,editorId}).result.valid,false);
  // Start with an illegal destination, then substitute a legal destination
  // exactly during the awaited scope fetch. Restore the illegal draft before
  // commit. The plan must never use a different destination than the check.
  let swapped=false;
  const fetchImpl=async url=>{
    if(String(url).includes('min-transform-scope-pack-v125.json')){
      invalid.objects[0].x=valid.objects[0].x;
      swapped=true;
    }
    return localFetch(url);
  };
  let review;
  try {
    review=await reviewMinimumVerifiedTransform({...input,draftDocument:invalid,fetchImpl});
  } catch(e) {
    assert.match(String(e?.code??e?.message),/WEP_EXPORT_INVALID_DESTINATION|WEP_EXPORT_REVIEW_STALE|WEP_EXPORT_DRAFT_CHANGED/);
    assert.equal(swapped,true);
    return;
  }
  invalid.objects[0].x=-100000;
  // A safe rejection is allowed either at Review or at commit. If both succeed,
  // this is a real encrypted-output safety regression, not merely a UI race.
  let result;
  try {
    result=await commitMinimumVerifiedTransform({review,currentSourceEpoch:1,sourceBytes:input.sourceBytes,baselineDocument:input.baselineDocument,draftDocument:invalid,worldBinding:input.worldBinding});
  } catch(e) {
    assert.match(String(e?.code??e?.message),/WEP_EXPORT_INVALID_DESTINATION|WEP_EXPORT_REVIEW_STALE|WEP_EXPORT_DRAFT_CHANGED/);
    return;
  }
  const reopened=await openWorldSaveBytes(result.artifacts.edited.bytes,{sourcePlatform:'switch'});
  assert.fail('unsafe async placement review emitted illegal X='+reopened.profile.World.GridCollection.Grids['10'].Objects['101'].X);
});

test('minimum transform rejects changes to both baseline and draft after review, even when selected delta is unchanged',async()=>{
  const {input}=await transformFixture();
  const review=await reviewMinimumVerifiedTransform(input);
  const baseline=structuredClone(input.baselineDocument);
  const draft=structuredClone(input.draftDocument);
  baseline.target.areaId=999;draft.target.areaId=999;
  const commit=(baselineDocument,draftDocument)=>commitMinimumVerifiedTransform({review,currentSourceEpoch:1,sourceBytes:input.sourceBytes,baselineDocument,draftDocument,worldBinding:input.worldBinding});
  await assert.rejects(()=>commit(baseline,draft),/WEP_EXPORT_REVIEW_STALE/);
  // The rejected stale attempt did not consume the original genuine receipt.
  const result=await commit(input.baselineDocument,input.draftDocument);
  assert.equal(result.status,'PASS');
  assert.deepEqual(Array.from(result.artifacts.backup.bytes),Array.from(input.sourceBytes));
});
test('minimum transform rejects a valid draft changed during async fetch, and a fresh unchanged review succeeds',async()=>{
  const {input}=await transformFixture();
  const draft=structuredClone(input.draftDocument);
  const x=draft.objects[0].x;
  const fetchImpl=async url=>{
    if(String(url).includes('min-transform-scope-pack-v125.json'))draft.objects[0].x=-100000;
    return localFetch(url);
  };
  await assert.rejects(()=>reviewMinimumVerifiedTransform({...input,draftDocument:draft,fetchImpl}),/WEP_EXPORT_DRAFT_CHANGED/);
  draft.objects[0].x=x;
  const review=await reviewMinimumVerifiedTransform({...input,draftDocument:draft});
  const result=await commitMinimumVerifiedTransform({review,currentSourceEpoch:1,sourceBytes:input.sourceBytes,baselineDocument:input.baselineDocument,draftDocument:draft,worldBinding:input.worldBinding});
  assert.equal(result.status,'PASS');
});
