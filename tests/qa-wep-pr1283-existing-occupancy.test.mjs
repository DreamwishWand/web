import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { makeSyntheticP1gProfile, syntheticProfile } from './helpers/p1g-fixture.mjs';
import {
  createSwitchWorldReadAdapter,
  projectSwitchAreaGrid
} from '../src/lib/wep/world-browser-adapter.ts';
import { openWorldSaveBytes } from '../src/lib/wep/world-save-source.ts';
import {
  ORDINARY_FURNITURE_ADD_RUNTIME_STATUS,
  ORDINARY_FURNITURE_ADD_SCOPE_PACK_SHA256,
  ORDINARY_FURNITURE_ADD_VERIFIED_EXPORT_CONTRACT,
  analyzeOrdinaryFurnitureAddDraft,
  commitOrdinaryFurnitureAddVerifiedExport,
  reviewOrdinaryFurnitureAddVerifiedExport,
  verifyOrdinaryFurnitureAddReplacementArtifactPipeline
} from '../src/lib/wep/ordinary-furniture-add-verified-export-v125.ts';

if(!globalThis.crypto) globalThis.crypto=webcrypto;

const root=new URL('../',import.meta.url);
const packPath=new URL(
  '../static/ddv/wep/world/v1.25/ordinary-furniture-add-scope-pack-v125.json',
  import.meta.url
);

async function repoFile(path){
  return new Uint8Array(await readFile(new URL(path,root)));
}
async function localFetch(url){
  const pathname=new URL(String(url),'https://wand.invalid').pathname;
  try{
    const bytes=await repoFile(`./static${pathname}`);
    return new Response(bytes,{status:200});
  }catch{
    return new Response('not found',{status:404});
  }
}
function sha(bytes){
  return createHash('sha256').update(bytes).digest('hex');
}

function acceptedPlacementBinding(){
  return Object.freeze({
    classifyMinimumTransformPlacement({document,editorId}){
      const candidate=(document?.objects??[]).find(
        object=>String(object?.editorId??'')===String(editorId??'')
      );
      assert.ok(candidate,'placement candidate missing');
      return Object.freeze({
        revision:'V125_NATIVE_ORDINARY_CARDINAL_NONWALL_GROUPSET_2',
        sameRootGrid:true,
        clearArea:false,
        automaticSpawning:false,
        result:Object.freeze({
          status:'VALID',
          valid:true,
          verdict:'VALID'
        }),
        persistentWriteAuthorized:false
      });
    }
  });
}

function sourceProfile(){
  const profile=syntheticProfile('DeviceType_Switch');
  profile.World={
    DecorationPresets:[],
    GridCollection:{
      Grids:{
        '10':{
          ID:10,
          GridDataPath:'GridData/Villages/Village04-BeachLevel-GridData.json',
          GridDefaultLayoutPath:'',
          TessellationFactor:2,
          NextGridObjectID:101,
          Objects:{}
        }
      }
    },
    Villages:[{
      SceneItemId:1540000000,
      Areas:{
        '7':{
          GridIDs:[10],
          Unlocked:true,
          EnvironmentEffectItemID:0,
          EnvironmentEffectOrientation:'GridOrientation_Up'
        }
      }
    }]
  };
  profile.Opaque={keep:{future:true,values:[1,2,3]}};
  return profile;
}

async function fixture(){
  const bytes=Uint8Array.from(makeSyntheticP1gProfile(sourceProfile()));
  const opened=await openWorldSaveBytes(bytes,{sourcePlatform:'switch'});
  const worldBinding=await createSwitchWorldReadAdapter({
    fetchImpl:localFetch
  });
  const placementBinding=acceptedPlacementBinding();
  const area=opened.areas.find(
    entry=>Number(entry.villageIndex)===0&&Number(entry.areaId)===7
  );
  assert.ok(area,'synthetic village area did not resolve');
  const baseline=projectSwitchAreaGrid(opened,area,10,worldBinding);
  const draft=structuredClone(baseline);
  const validCell={x:2,y:2};
  draft.objects.push({
    editorId:'draft-1',
    itemId:40000048,
    layer:'furniture',
    x:validCell.x,
    y:validCell.y,
    orientation:0,
    footprint:[{x:0,y:0}],
    source:null,
    portableState:null,
    dependencyIds:[],
    editability:'editable',
    metadata:{
      worldClass:'FurnitureItemData',
      stateKind:'NONE',
      reasons:[],
      draftInserted:true
    }
  });
  return {bytes,opened,worldBinding,placementBinding,baseline,draft,validCell};
}


import {createSwitchV125PlacementLegalityBinding} from '../src/lib/wep/placement-legality-v19.ts';

async function occupiedFixture(){
  const original=sourceProfile();
  original.World.GridCollection.Grids['10'].Objects['100']={ID:100,ItemID:40000048,X:452,Y:228,Orientation:'GridOrientation_Up',State:null};
  const bytes=Uint8Array.from(makeSyntheticP1gProfile(original));
  const opened=await openWorldSaveBytes(bytes,{sourcePlatform:'switch'});
  const worldBinding=await createSwitchWorldReadAdapter({fetchImpl:localFetch});
  const placementBinding=await createSwitchV125PlacementLegalityBinding({fetchImpl:localFetch});
  const area=opened.areas.find(a=>a.villageIndex===0&&a.areaId===7);
  assert.ok(area);
  const baseline=projectSwitchAreaGrid(opened,area,10,worldBinding);
  assert.equal(baseline.objects.length,1);
  assert.equal(baseline.objects[0].itemId,40000048);
  const template=(await fixture()).draft.objects[0];
  const draft=structuredClone(baseline);
  draft.objects.push({...structuredClone(template),x:452,y:228});
  const classify=d=>placementBinding.classifyMinimumTransformPlacement({document:d,editorId:template.editorId});
  assert.equal(classify(draft).result.valid,false,'actual occupied coordinate must be rejected');
  return {bytes,opened,worldBinding,placementBinding,baseline,draft,classify};
}
const inputFor=f=>({sourceBytes:f.bytes,sourceName:'profile',sourceEpoch:948,opened:f.opened,baselineDocument:f.baseline,draftDocument:f.draft,placementBinding:f.placementBinding,worldBinding:f.worldBinding,fetchImpl:localFetch,exactBuildConfirmed:true});
const commitFor=(f,review)=>commitOrdinaryFurnitureAddVerifiedExport({review,currentSourceEpoch:948,sourceBytes:f.bytes,baselineDocument:f.baseline,draftDocument:f.draft,worldBinding:f.worldBinding});

test('ACT948 actual existing occupancy cannot be omitted or relocated in caller baseline and draft',async()=>{
  const f=await occupiedFixture(),before=sha(f.bytes),input=inputFor(f);
  await assert.rejects(()=>reviewOrdinaryFurnitureAddVerifiedExport(input),/WEP_ADD_INVALID_DESTINATION/);
  for(const kind of ['omit','move','source-id','duplicate']){
    const b=structuredClone(f.baseline),d=structuredClone(f.draft);
    if(kind==='omit'){b.objects=[];d.objects=d.objects.slice(1);}
    if(kind==='move'){b.objects[0].x=100000;d.objects[0].x=100000;}
    if(kind==='source-id'){b.objects[0].source.gridObjectId=999;d.objects[0].source.gridObjectId=999;}
    if(kind==='duplicate'){b.objects.push(structuredClone(b.objects[0]));d.objects.splice(1,0,structuredClone(d.objects[0]));}
    await assert.rejects(()=>reviewOrdinaryFurnitureAddVerifiedExport({...input,baselineDocument:b,draftDocument:d}),/WEP_ADD_BASELINE_SOURCE_MISMATCH|WEP_ADD_UNSUPPORTED_PENDING_CHANGE/);
  }
  assert.equal(sha(f.bytes),before);
});

test('ACT948 real occupied source, detached placement snapshot, exact independent fresh output',async()=>{
  const f=await occupiedFixture(),before=sha(f.bytes);
  const add=f.draft.objects[1];
  let chosen=null;
  for(let dy=-40;dy<=40&&!chosen;dy+=2)for(let dx=-40;dx<=40;dx+=2){
    add.x=452+dx;add.y=228+dy;
    if(f.classify(f.draft).result.valid===true){chosen={x:add.x,y:add.y};break;}
  }
  assert.ok(chosen,'real legal alternate destination');
  const frozen=structuredClone(f.draft);
  let observed=0;
  const placementBinding={...f.placementBinding,classifyMinimumTransformPlacement(args){
    observed++;
    assert.notEqual(args.document,f.draft);
    assert.notEqual(args.document.objects[0],f.draft.objects[0]);
    assert.deepEqual(args.document,frozen);
    return f.placementBinding.classifyMinimumTransformPlacement(args);
  }};
  const fetchImpl=async url=>{
    if(String(url).includes('ordinary-furniture-add-scope-pack-v125.json')){
      add.x=452;add.y=228;
      await Promise.resolve();
      add.x=chosen.x;add.y=chosen.y;
    }
    return localFetch(url);
  };
  const review=await reviewOrdinaryFurnitureAddVerifiedExport({...inputFor(f),placementBinding,fetchImpl});
  assert.equal(observed,1);
  f.draft.objects[0].x+=2;
  await assert.rejects(()=>commitFor(f,review),/WEP_ADD_REVIEW_STALE/);
  f.draft.objects[0].x-=2;
  const fresh=await reviewOrdinaryFurnitureAddVerifiedExport(inputFor(f));
  const out=await commitFor(f,fresh);
  const reopened=await openWorldSaveBytes(out.artifacts.edited.bytes,{sourcePlatform:'switch'});
  const expected=structuredClone(f.opened.profile);
  expected.World.GridCollection.Grids['10'].Objects['101']={ID:101,ItemID:40000048,X:chosen.x,Y:chosen.y,Orientation:'GridOrientation_Up',State:null};
  expected.World.GridCollection.Grids['10'].NextGridObjectID=102;
  assert.deepEqual(reopened.profile,expected);
  assert.deepEqual(Array.from(out.artifacts.backup.bytes),Array.from(f.bytes));
  assert.equal(sha(f.bytes),before);
});
