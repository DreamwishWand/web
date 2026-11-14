import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// Independent ACT899 regression. Existing synthetic fixture only.

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
function wrapPlacement(input,observe){
 const original=input.placementBinding;
 return {...original,classifyMinimumTransformPlacement(args){
  observe(args);
  return original.classifyMinimumTransformPlacement(args);
 }};
}
const commit=(input,review)=>commitMinimumVerifiedTransform({
 review,currentSourceEpoch:input.sourceEpoch,sourceBytes:input.sourceBytes,
 baselineDocument:input.baselineDocument,draftDocument:input.draftDocument,
 worldBinding:input.worldBinding
});
test('ACT899 invalid destination remains invalid when draft changes and restores before placement',async()=>{
 const {input}=await transformFixture();
 const originalX=input.draftDocument.objects[0].x;
 const initialBytes=Uint8Array.from(input.sourceBytes);
 input.draftDocument.objects[0].x=-100000;
 const initial=structuredClone(input.draftDocument);
 let swapped=0,observed=0;
 const fetchImpl=async url=>{
  if(String(url).includes('min-transform-scope-pack-v125.json')){
   input.draftDocument.objects[0].x=originalX;
   await Promise.resolve();
   input.draftDocument.objects[0].x=initial.objects[0].x;
   swapped++;
  }
  return localFetch(url);
 };
 const placementBinding=wrapPlacement(input,({document})=>{
  observed++;
  assert.notEqual(document,input.draftDocument);
  assert.notEqual(document.objects[0],input.draftDocument.objects[0]);
  assert.deepEqual(document,initial);
 });
 await assert.rejects(()=>reviewMinimumVerifiedTransform({...input,fetchImpl,placementBinding}),/WEP_EXPORT_INVALID_DESTINATION/);
 assert.equal(swapped,1);assert.equal(observed,1);
 assert.deepEqual(input.sourceBytes,initialBytes);
});
test('ACT899 legal detached snapshot; changed caller cannot export; fresh receipt reopens exact change',async()=>{
 const {profile,input}=await transformFixture();
 const initialBytes=Uint8Array.from(input.sourceBytes);
 const original=structuredClone(input.draftDocument);
 let swapped=0,observed=0;
 const fetchImpl=async url=>{
  if(String(url).includes('min-transform-scope-pack-v125.json')){
   input.draftDocument.objects[0].x=-100000;
   await Promise.resolve();
   input.draftDocument.objects[0].x=original.objects[0].x;
   swapped++;
  }
  return localFetch(url);
 };
 const placementBinding=wrapPlacement(input,({document})=>{
  observed++;
  assert.notEqual(document,input.draftDocument);
  assert.notEqual(document.objects[0],input.draftDocument.objects[0]);
  assert.deepEqual(document,original);
  input.draftDocument.objects[0].x=-100000;
  assert.deepEqual(document,original);
 });
 const review=await reviewMinimumVerifiedTransform({...input,fetchImpl,placementBinding});
 assert.equal(swapped,1);assert.equal(observed,1);
 assert.equal(review.status,'READY');
 await assert.rejects(()=>commit(input,review),/WEP_EXPORT_REVIEW_STALE/);
 assert.deepEqual(input.sourceBytes,initialBytes);
 input.draftDocument.objects[0].x=original.objects[0].x;
 const fresh=await reviewMinimumVerifiedTransform(input);
 const result=await commit(input,fresh);
 assert.equal(result.status,'PASS');
 assert.deepEqual(Uint8Array.from(result.artifacts.backup.bytes),initialBytes);
 const reopened=await openWorldSaveBytes(result.artifacts.edited.bytes,{sourcePlatform:'switch'});
 const expected=structuredClone(profile);
 expected.World.GridCollection.Grids['10'].Objects['101'].X=original.objects[0].x;
 assert.deepEqual(reopened.profile,expected);
 assert.deepEqual(input.sourceBytes,initialBytes);
 await assert.rejects(()=>commit(input,fresh),/WEP_EXPORT_REVIEW_STALE/);
});
