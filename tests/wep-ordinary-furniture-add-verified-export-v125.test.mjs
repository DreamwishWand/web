import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { makeSyntheticP1gProfile, syntheticProfile } from './helpers/p1g-fixture.mjs';
import {
  createSwitchV125PlacementLegalityBinding
} from '../src/lib/wep/placement-legality-v19.ts';
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
  const placementBinding=await createSwitchV125PlacementLegalityBinding({
    fetchImpl:localFetch
  });
  const area=opened.areas.find(
    entry=>Number(entry.villageIndex)===0&&Number(entry.areaId)===7
  );
  assert.ok(area,'synthetic village area did not resolve');
  const baseline=projectSwitchAreaGrid(opened,area,10,worldBinding);
  const draft=structuredClone(baseline);
  draft.objects.push({
    editorId:'draft-1',
    itemId:40000048,
    layer:'furniture',
    x:0,
    y:0,
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
  let validCell=null;
  const maxX=Math.max(1,Number(draft.target?.size?.width??256));
  const maxY=Math.max(1,Number(draft.target?.size?.height??256));
  for(let y=0;y<maxY&&!validCell;y++){
    for(let x=0;x<maxX;x++){
      draft.objects[0].x=x;
      draft.objects[0].y=y;
      const evidence=placementBinding.classifyMinimumTransformPlacement({
        document:draft,
        editorId:'draft-1'
      });
      if(
        evidence?.result?.status==='VALID' &&
        evidence?.result?.valid===true &&
        evidence?.result?.verdict==='VALID'
      ){
        validCell={x,y};
        break;
      }
    }
  }
  assert.ok(validCell,'no native-valid ordinary Furniture ADD cell found');
  draft.objects[0].x=validCell.x;
  draft.objects[0].y=validCell.y;
  return {bytes,opened,worldBinding,placementBinding,baseline,draft,validCell};
}

test('ordinary Furniture ADD browser scope pack is exact and pinned',async()=>{
  const bytes=await readFile(packPath);
  assert.equal(sha(bytes),ORDINARY_FURNITURE_ADD_SCOPE_PACK_SHA256);
  const pack=JSON.parse(bytes.toString('utf8'));
  assert.equal(pack.schema,'dreamwish-wand-v125-ordinary-furniture-add-scope-browser-pack');
  assert.equal(pack.version,1);
  assert.equal(pack.gameVersion,'1.25.0');
  assert.equal(pack.buildID,'52BD625D9B4E0053');
  assert.equal(pack.sourceSha256,'e4b13913017b3406f9a49bb9e343a6843d8907c98a8d779eb0726c5de955607a');
  assert.equal(pack.sourceCount,6233);
  assert.equal(pack.coreCount,3276);
  assert.equal(pack.eligibleCount,1099);
  assert.equal(Object.keys(pack.items).length,3276);
  assert.equal(pack.items['40000048'][8],false);
  assert.equal(pack.items['40000072'][8],true);
  assert.equal(pack.items['40000153'][7],true);
  assert.equal(pack.items['40001030'][3],true);
});

test('ADD review is explicit, exact-build gated and binds 01B adapter to 01A structural plan',async()=>{
  const f=await fixture();
  const change=analyzeOrdinaryFurnitureAddDraft({
    baselineDocument:f.baseline,
    draftDocument:f.draft
  });
  assert.equal(change.operation,'ADD');
  assert.equal(change.itemId,40000048);
  assert.equal(change.gridId,10);
  assert.deepEqual(change.after,{x:f.validCell.x,y:f.validCell.y,orientation:0});

  await assert.rejects(
    ()=>reviewOrdinaryFurnitureAddVerifiedExport({
      sourceBytes:f.bytes,
      sourceName:'profile',
      sourceEpoch:1,
      opened:f.opened,
      baselineDocument:f.baseline,
      draftDocument:f.draft,
      placementBinding:f.placementBinding,
      fetchImpl:localFetch,
      exactBuildConfirmed:false
    }),
    /WEP_ADD_EXACT_BUILD_CONFIRMATION_REQUIRED/
  );

  const review=await reviewOrdinaryFurnitureAddVerifiedExport({
    sourceBytes:f.bytes,
    sourceName:'profile',
    sourceEpoch:1,
    opened:f.opened,
    baselineDocument:f.baseline,
    draftDocument:f.draft,
    placementBinding:f.placementBinding,
    fetchImpl:localFetch,
    exactBuildConfirmed:true
  });
  assert.equal(review.contract,ORDINARY_FURNITURE_ADD_VERIFIED_EXPORT_CONTRACT);
  assert.equal(review.status,'READY_STATIC_RUNTIME_PENDING');
  assert.equal(review.change.operation,'ADD');
  assert.equal(review.plan.capabilityRequired,'STRUCTURAL_WRITE_CANDIDATE');
  assert.equal(review.plan.target.kind,'GRID_OBJECT_SET');
  assert.equal(review.plan.mutationAdapter.id,'01b-ordinary-root-furniture-add-v125-v1');
  assert.deepEqual(review.plan.target.createdGridObjectIds,[101]);
  assert.equal(review.plan.target.nextGridObjectIDBefore,101);
  assert.equal(review.plan.target.nextGridObjectIDAfter,102);
  assert.equal(review.runtimeAcceptance.status,ORDINARY_FURNITURE_ADD_RUNTIME_STATUS);
  assert.equal(review.productExportAuthorized,false);
  assert.equal(review.persistentWriteAuthorized,false);
});

test('ADD candidate pipeline reaches 01A verifier, export bundle and canonical reopen without authorizing product export',async()=>{
  const f=await fixture();
  const review=await reviewOrdinaryFurnitureAddVerifiedExport({
    sourceBytes:f.bytes,
    sourceName:'profile',
    sourceEpoch:2,
    opened:f.opened,
    baselineDocument:f.baseline,
    draftDocument:f.draft,
    placementBinding:f.placementBinding,
    fetchImpl:localFetch,
    exactBuildConfirmed:true
  });
  const evidence=await verifyOrdinaryFurnitureAddReplacementArtifactPipeline({
    review,
    currentSourceEpoch:2,
    sourceBytes:f.bytes,
    baselineDocument:f.baseline,
    draftDocument:f.draft,
    worldBinding:f.worldBinding
  });
  assert.equal(evidence.status,'PASS_STATIC_BROWSER_PIPELINE_RUNTIME_PENDING');
  assert.equal(evidence.verification.status,'PASS');
  assert.equal(evidence.reload.gridId,10);
  assert.equal(evidence.reload.gridObjectId,101);
  assert.equal(evidence.reload.itemId,40000048);
  assert.deepEqual(evidence.reload.transform,{x:f.validCell.x,y:f.validCell.y,orientation:0});
  assert.equal(evidence.reload.nextGridObjectID,102);
  assert.equal(evidence.source.untouched,true);
  assert.equal(evidence.productExportAuthorized,false);
  assert.equal(evidence.persistentWriteAuthorized,false);
  assert.ok(evidence.artifacts.edited.bytes.length>0);
  assert.deepEqual(
    Array.from(evidence.artifacts.backup.bytes),
    Array.from(f.bytes)
  );
});

test('ADD product export remains fail closed until exact 01E cold-reload acceptance',async()=>{
  await assert.rejects(
    ()=>commitOrdinaryFurnitureAddVerifiedExport({}),
    /WEP_ADD_RUNTIME_ACCEPTANCE_PENDING/
  );
});

test('ADD rejects generator-unavailable CORE definition even when local draft shape is otherwise ordinary',async()=>{
  const f=await fixture();
  f.draft.objects[0].itemId=40000072;
  let validCell=null;
  const maxX=Math.max(1,Number(f.draft.target?.size?.width??256));
  const maxY=Math.max(1,Number(f.draft.target?.size?.height??256));
  for(let y=0;y<maxY&&!validCell;y++){
    for(let x=0;x<maxX;x++){
      f.draft.objects[0].x=x;
      f.draft.objects[0].y=y;
      const evidence=f.placementBinding.classifyMinimumTransformPlacement({
        document:f.draft,
        editorId:'draft-1'
      });
      if(
        evidence?.result?.status==='VALID' &&
        evidence?.result?.valid===true &&
        evidence?.result?.verdict==='VALID'
      ){
        validCell={x,y};
        break;
      }
    }
  }
  assert.ok(validCell,'no native-valid generator-unavailable probe cell found');
  await assert.rejects(
    ()=>reviewOrdinaryFurnitureAddVerifiedExport({
      sourceBytes:f.bytes,
      sourceName:'profile',
      sourceEpoch:3,
      opened:f.opened,
      baselineDocument:f.baseline,
      draftDocument:f.draft,
      placementBinding:f.placementBinding,
      fetchImpl:localFetch,
      exactBuildConfirmed:true
    }),
    /WEP_ADD_OBJECT_NO_LONGER_ADMISSIBLE/
  );
});
