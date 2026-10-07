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
