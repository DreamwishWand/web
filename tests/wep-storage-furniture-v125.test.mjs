import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import { BuildIdentityKind, PlatformFamily } from '../src/lib/ddv/core/save/versioning.js';
import {
  annotateStorageFurnitureDocumentV125,
  loadStorageFurnitureDefinitionPack,
  planStorageCrossGridMoveInternalV125,
  planStoragePutAwayNonemptyInternalV125,
  planStorageReplaceNonemptyInternalV125,
  STORAGE_FURNITURE_DEFINITION_PACK_SHA256
} from '../src/lib/wep/storage-furniture-v125.ts';
import { buildPrimaryJobAvailability } from '../src/lib/wep/world-editor-primary-job.ts';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const ITEM=40001838, CID=21, LIST=2, BID='52BD625D9B4E0053';
const enc=new TextEncoder(),dec=new TextDecoder();
const source={platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,buildIdentity:BID};

function storageObject(){return {ID:42,ItemID:ITEM,X:10,Y:20,Orientation:'GridOrientation_Up',State:{Storage:{ContainerInventoryID:CID,DefaultContainerInventoryData:'',UnlockKeyItemID:0,UnlockLocId:'',DesignID:null}},Opaque:{keep:true}};}
function profile({placed=true,amount=2}={}){return {
  GameInfo:{InitialVersion:518,Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'},Opaque:{keep:true}},
  Player:{
    ContainerInventories:{'21':{ID:21,Size:48,Inventory:[{ItemID:30000001,Amount:10,ItemState:null}],BelongsToPlayer:true,BlockMoveTo:false,ParentItemID:ITEM,ExtraSize:0,Opaque:{keep:true}}},
    NextContainerInventoryID:100,
    ListInventories:{'2':{ID:2,CompatibleItemType:'ItemType_Furniture',Inventory:{[ITEM]:{Amount:amount,Marker:'Favorite'}},Opaque:{keep:true}}}
  },
  World:{GridCollection:{Grids:{
    '3':{ID:3,NextGridObjectID:100,Objects:placed?{'42':storageObject()}:{},Opaque:{keep:'source'}},
    '7':{ID:7,NextGridObjectID:80,Objects:{'9':{ID:9,ItemID:40000001,X:1,Y:1,Orientation:'GridOrientation_Up',State:null}},Opaque:{keep:'destination'}}
  }},PlayerHouses:[],ConditionalEventHistoryData:{}}
};}
function document(){
  return {schema:'dreamwish-wand-wep-editor-document',version:1,target:{platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,rootGridId:3},objects:[{
    editorId:'g3:o42',itemId:ITEM,layer:'furniture',x:10,y:20,orientation:0,footprint:[{x:0,y:0}],source:{gridId:3,gridObjectId:42,objectMapKey:'42',relation:'ROOT'},portableState:null,dependencyIds:[],editability:'readonly',metadata:{worldClass:'FurnitureItemData',stateKind:'Storage',reasons:['STATE_Storage_UNSUPPORTED'],geometryStatus:'RESOLVED'}
  }],networks:{roads:null,fences:null},capabilities:{},metadata:{}};
}
function codec(){return {contract:'p1g-v0',async loadProfile(input){const text=dec.decode(input);return {inputType:'plain',jsonText:text,metadata:{version:JSON.parse(text)?.GameInfo?.Version??624}};},parseProfileText(text){return {metadata:{version:JSON.parse(text)?.GameInfo?.Version??624}};},async createEncodedProfile(text){return enc.encode(text);},getProfileVersion(m){return m.version;}};}
async function session(root){return SafeProfileEditSession.open({sourceBytes:enc.encode(JSON.stringify(root)),codec:codec(),sourcePlatform:PlatformFamily.Switch});}
function txInput(s){const c=s.getPreflightContext();return {platform:PlatformFamily.Switch,gameVersion:'1.25.0',profileGameInfoVersion:624,originalFileLength:s.source.length,originalSha256:c.saveIdentity.sourceRawSha256,codecContract:c.codecContract,targetBuild:{platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:BID}};}
function placement(gridId,x,y,orientation){return {status:'VALID',valid:true,clearArea:false,gridId,itemId:ITEM,x,y,orientation};}
async function pack(){
  const bytes=await readFile(new URL('../static/ddv/wep/world/v1.25/storage-furniture-definition-pack-v125.json',import.meta.url));
  const fetchImpl=async()=>new Response(bytes,{status:200});
  return loadStorageFurnitureDefinitionPack({fetchImpl});
}

test('storage definition pack is hash pinned, complete for active-reference scanning and exact for Large White Chest',async()=>{
  const bytes=await readFile(new URL('../static/ddv/wep/world/v1.25/storage-furniture-definition-pack-v125.json',import.meta.url));
  const hash=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
  assert.equal(hash,STORAGE_FURNITURE_DEFINITION_PACK_SHA256);
  const p=await pack();
  assert.equal(Object.keys(p.itemDefinitionsById).length,136);
  assert.deepEqual(p.itemDefinitionsById[String(ITEM)],{
    itemId:ITEM,concreteType:'FurnitureItemData',interaction:'Container',defaultContainerSize:48,
    rawPayloadSha256:'a64edf3aaf50ecf3d2129d3fdc6d5381bf632a3586f3bd49c9b169969f877181'
  });
  assert.equal(p.itemDefinitionsById['40001038'].interaction,'HomeStorage');
  assert.equal(p.itemDefinitionsById['40005038'].defaultContainerSize,null);
  for(const v of Object.values(p.hardFlags)) assert.equal(v,false);
});

test('supported non-empty storage becomes move-editable without serializing slot contents into editor metadata',async()=>{
  const p=await pack(),root=profile(),annotated=annotateStorageFurnitureDocumentV125({document:document(),profile:root,itemDefinitionsById:p.itemDefinitionsById});
  const object=annotated.objects[0];
  assert.equal(object.editability,'editable');
  assert.deepEqual(object.metadata.reasons,[]);
  assert.equal(object.metadata.storageCapability.containerInventoryId,CID);
  assert.equal(object.metadata.storageCapability.contents,'PROTECTED_ATTACHED_STATE');
  assert.equal(JSON.stringify(object.metadata.storageCapability).includes('30000001'),false);
  assert.equal(JSON.stringify(object.metadata.storageCapability).includes('Inventory'),true); // identity label only
  const availability=buildPrimaryJobAvailability({document:annotated,selectionIds:['g3:o42'],mutationBound:true});
  assert.equal(availability.commands.move.enabled,true);
  for(const command of ['rotate','copy','duplicate','delete']) assert.equal(availability.commands[command].enabled,false);
  assert.equal(availability.commands.rotate.reasonCode,'WEP_STORAGE_ROTATE_NOT_PROMOTED');
});

test('empty, non-player, ParentItemID/Size mismatch and duplicate active references all remain fail-closed',async()=>{
  const p=await pack();
  const cases=[
    root=>{root.Player.ContainerInventories['21'].Inventory[0].Amount=0;},
    root=>{root.Player.ContainerInventories['21'].BelongsToPlayer=false;},
    root=>{root.Player.ContainerInventories['21'].ParentItemID=40000001;},
    root=>{root.Player.ContainerInventories['21'].Size=32;},
    root=>{root.World.GridCollection.Grids['7'].Objects['80']={...storageObject(),ID:80};}
  ];
  const expected=['WEP_STORAGE_EMPTY_UNSUPPORTED','PLAYER_OWNED_CONTAINER_REQUIRED','CONTAINER_PARENT_ITEM_ID_MISMATCH','CONTAINER_SIZE_DEFINITION_MISMATCH','STORAGE_ACTIVE_REFERENCE_DUPLICATE'];
  for(let i=0;i<cases.length;i++){
    const root=profile();cases[i](root);
    const object=annotateStorageFurnitureDocumentV125({document:document(),profile:root,itemDefinitionsById:p.itemDefinitionsById}).objects[0];
    assert.equal(object.editability,'readonly');
    assert.ok(object.metadata.reasons.some(x=>String(x).includes(expected[i])),JSON.stringify(object.metadata.reasons));
  }
});

test('structural Storage operations are reusable INTERNAL_ONLY planners and preserve exact frozen target modes',async()=>{
  const p=await pack(),root=profile(),s=await session(root),input=txInput(s);
  const cross=planStorageCrossGridMoveInternalV125({profile:root,itemDefinitionsById:p.itemDefinitionsById,transactionInput:input,gridId:3,gridObjectId:42,destination:{gridId:7,x:30,y:40,orientation:'GridOrientation_Right'},placementEvidence:placement(7,30,40,'GridOrientation_Right'),planId:'wep-storage-cross-test'});
  assert.equal(cross.status,'INTERNAL_ONLY');assert.equal(cross.semanticOperation,'STORAGE CROSS-GRID MOVE');assert.equal(cross.plan.target.mode,'CROSS_GRID_MOVE');assert.equal(cross.plan.target.kind,'STORAGE_FURNITURE_TRANSITION');
  const put=planStoragePutAwayNonemptyInternalV125({profile:root,itemDefinitionsById:p.itemDefinitionsById,transactionInput:input,gridId:3,gridObjectId:42,planId:'wep-storage-put-test'});
  assert.equal(put.status,'INTERNAL_ONLY');assert.equal(put.semanticOperation,'STORAGE PUT AWAY');assert.equal(put.plan.target.mode,'PUT_AWAY_NONEMPTY');

  const stored=profile({placed:false,amount:3}),ss=await session(stored),storedInput=txInput(ss);
  const replace=planStorageReplaceNonemptyInternalV125({profile:stored,itemDefinitionsById:p.itemDefinitionsById,transactionInput:storedInput,itemId:ITEM,containerInventoryId:CID,gridObjectTemplate:storageObject(),destination:{gridId:7,x:50,y:60,orientation:'GridOrientation_Right'},placementEvidence:placement(7,50,60,'GridOrientation_Right'),planId:'wep-storage-replace-test'});
  assert.equal(replace.status,'INTERNAL_ONLY');assert.equal(replace.semanticOperation,'STORAGE RE-PLACE');assert.equal(replace.plan.target.mode,'REPLACE_NONEMPTY');assert.equal(replace.sameSaveHashBound,storedInput.originalSha256);
  assert.equal(replace.protectedStorage.contents,'PROTECTED_ATTACHED_STATE');
  for(const x of [cross,put,replace]){assert.equal(x.persistentWriteAuthorized,false);assert.equal(x.productApplyAuthorized,false);assert.equal(x.directSourceReplacementAuthorized,false);}
});

import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';
import {openWorldSaveBytes} from '../src/lib/wep/world-save-source.ts';
import {createSwitchWorldReadAdapter,projectSwitchAreaGrid} from '../src/lib/wep/world-browser-adapter.ts';
import {createSwitchV125PlacementLegalityBinding} from '../src/lib/wep/placement-legality-v19.ts';
import {reviewStorageSameGridMoveVerifiedExportV125,commitStorageFurnitureVerifiedExportV125} from '../src/lib/wep/storage-furniture-v125.ts';

async function storageFetch(url){
  const path=new URL(String(url),'https://wand.invalid').pathname;
  try{return new Response(await readFile(new URL('../static'+path,import.meta.url)),{status:200});}
  catch{return new Response('not found',{status:404});}
}
async function actualStorageFixture(){
  const p=await pack(),root=profile(),g=root.World.GridCollection.Grids['3'];
  g.GridDataPath='GridData/Villages/Village04-BeachLevel-GridData.json';
  g.GridDefaultLayoutPath='';g.TessellationFactor=2;
  g.Objects['42'].X=452;g.Objects['42'].Y=228;
  root.World.Villages=[{SceneItemId:1540000000,Areas:{'7':{GridIDs:[3],Unlocked:true}}}];
  root.World.GridCollection.DiffGrids={};
  const worldBinding=await createSwitchWorldReadAdapter({fetchImpl:storageFetch});
  const placementBinding=await createSwitchV125PlacementLegalityBinding({fetchImpl:storageFetch});
  const build=async()=>{
    const sourceBytes=Uint8Array.from(makeSyntheticP1gProfile(root));
    const opened=await openWorldSaveBytes(sourceBytes,{sourcePlatform:'switch'});
    const baselineDocument=annotateStorageFurnitureDocumentV125({document:projectSwitchAreaGrid(opened,opened.areas[0],3,worldBinding),profile:opened.profile,itemDefinitionsById:p.itemDefinitionsById});
    return {sourceBytes,sourceName:'profile',sourceEpoch:1,opened,baselineDocument,draftDocument:structuredClone(baselineDocument),placementBinding,worldBinding,itemDefinitionsById:p.itemDefinitionsById,exactBuildConfirmed:true};
  };
  let f=await build();
  const mover=f.draftDocument.objects.find(o=>o.itemId===ITEM);
  const classify=d=>placementBinding.classifyMinimumTransformPlacement({document:d,editorId:mover.editorId}).result.valid;
  let destination;
  for(let x=456;x<500;x++){
    mover.x=x;
    if(classify(f.draftDocument)){destination=x;break;}
  }
  assert.ok(destination,'actual legal destination');
  g.Objects['43']={ID:43,ItemID:40000048,X:destination,Y:228,Orientation:'GridOrientation_Up',State:null};
  f=await build();
  f.draftDocument.objects.find(o=>o.itemId===ITEM).x=destination;
  assert.equal(classify(f.draftDocument),false,'canonical occupied destination');
  return {f,destination,classify};
}

test('storage MOVE cannot export into actual occupied destination by omitting existing object from baseline and draft',async()=>{
  const {f,destination,classify}=await actualStorageFixture();
  f.baselineDocument.objects=f.baselineDocument.objects.filter(o=>o.itemId===ITEM);
  f.draftDocument.objects=f.draftDocument.objects.filter(o=>o.itemId===ITEM);
  assert.equal(classify(f.draftDocument),true,'forged omission would appear clear');
  let review;
  try{review=await reviewStorageSameGridMoveVerifiedExportV125(f);}
  catch(e){assert.match(String(e?.code??e?.message),/WEP_STORAGE_BASELINE_SOURCE_MISMATCH|WEP_STORAGE_INVALID_DESTINATION|WEP_STORAGE_SOURCE_PROFILE_MISMATCH/);return;}
  const result=await commitStorageFurnitureVerifiedExportV125({...f,review,currentSourceEpoch:1});
  const reopened=await openWorldSaveBytes(result.artifacts.edited.bytes,{sourcePlatform:'switch'});
  assert.equal(reopened.profile.World.GridCollection.Grids['3'].Objects['42'].X,destination);
  assert.fail('unsafe storage MOVE exported overlapping destination');
});

test('storage MOVE canonical legal destination exports exact X only, preserves inventory, rejects stale and repeated review',async()=>{
  const {f}=await actualStorageFixture();
  const mover=f.draftDocument.objects.find(o=>o.itemId===ITEM);
  // Choose an independently validated adjacent destination not occupied by
  // the fixture's second object. Its full baseline remains present.
  mover.x=453;
  const valid=f.placementBinding.classifyMinimumTransformPlacement({document:f.draftDocument,editorId:mover.editorId});
  // If the fixture's farther occupant intersects this footprint, move left.
  if(!valid.result.valid) mover.x=451;
  assert.equal(f.placementBinding.classifyMinimumTransformPlacement({document:f.draftDocument,editorId:mover.editorId}).result.valid,true);
  const stale=structuredClone(f.opened);stale.profile.Player.Opaque={changed:true};
  await assert.rejects(()=>reviewStorageSameGridMoveVerifiedExportV125({...f,opened:stale}),/WEP_STORAGE_SOURCE_PROFILE_MISMATCH/);
  const review=await reviewStorageSameGridMoveVerifiedExportV125(f);
  const commit=review=>commitStorageFurnitureVerifiedExportV125({...f,review,currentSourceEpoch:1});
  await assert.rejects(()=>commit(structuredClone(review)),/WEP_STORAGE_REVIEW_STALE/);
  const altered=await reviewStorageSameGridMoveVerifiedExportV125(f);
  altered.change.afterObject.x+=1;
  await assert.rejects(()=>commit(altered),/WEP_STORAGE_REVIEW_STALE/);
  const pending=commit(review);
  await assert.rejects(()=>commit(review),/WEP_STORAGE_REVIEW_STALE/);
  const result=await pending;
  const actual=await openWorldSaveBytes(result.artifacts.edited.bytes,{sourcePlatform:'switch'});
  const expected=structuredClone(f.opened.profile);
  expected.World.GridCollection.Grids['3'].Objects['42'].X=mover.x;
  assert.deepEqual(actual.profile,expected);
  assert.deepEqual(Array.from(result.artifacts.backup.bytes),Array.from(f.sourceBytes));
  await assert.rejects(()=>commit(review),/WEP_STORAGE_REVIEW_STALE/);
});
