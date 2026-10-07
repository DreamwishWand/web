import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {
  ACTIVE_REFERENCE_EVIDENCE_CONTRACT,
  GRID_OBJECT_TEMPLATE_EVIDENCE_CONTRACT,
  STORAGE_01A_REQUEST_ID,
  STORAGE_01E_REQUEST_ID,
  STORAGE_CONTAINER_CONTRACT,
  STORAGE_TRANSITION,
  compileStorageCrossGridMoveV125,
  compileStoragePutAwayNonemptyV125,
  compileStorageRePlaceNonemptyV125,
  compileStorageSameGridMoveV125,
  resolvePlacedStorageFurnitureV125,
  resolveStoredStorageContainerV125,
  storageContainerUpstreamNeedV125
} from '../src/lib/ddv/core/world/storage-container-v125.js';

const ITEM=40001000,CONTAINER=21,LIST=2,BID='52BD625D9B4E0053';
const source={platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,buildIdentity:BID};
const itemDefinition={itemId:ITEM,concreteType:'FurnitureItemData',interaction:'Container',defaultContainerSize:48};

function storageObject(){
  return {
    ID:42,ItemID:ITEM,X:10,Y:20,Orientation:'GridOrientation_Up',
    State:{Storage:{
      ContainerInventoryID:CONTAINER,
      DefaultContainerInventoryData:'ContainerInventory/Storage/Large',
      UnlockKeyItemID:0,UnlockLocId:'',DesignID:null
    }},
    OpaqueObjectField:{preserve:'exact'}
  };
}
function profile(){
  return {
    GameInfo:{Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
    Player:{
      ContainerInventories:{
        '21':{
          ID:21,Size:48,Inventory:[
            {ItemID:30000001,Amount:10,ItemState:null},
            {ItemID:30000002,Amount:2,ItemState:{Custom:'keep'}}
          ],
          BelongsToPlayer:true,BlockMoveTo:false,ParentItemID:ITEM,ExtraSize:0,
          OpaqueContainer:{keep:true}
        }
      },
      NextContainerInventoryID:100,
      ListInventories:{
        '2':{ID:2,CompatibleItemType:'ItemType_Furniture',Inventory:{
          [String(ITEM)]:{Amount:2,Marker:'None'}
        }}
      }
    },
    World:{GridCollection:{Grids:{
      '3':{ID:3,NextGridObjectID:100,Objects:{'42':storageObject()}},
      '7':{ID:7,NextGridObjectID:80,Objects:{
        '9':{ID:9,ItemID:40000001,X:1,Y:1,Orientation:'GridOrientation_Up',State:null}
      }}
    }}}
  };
}
function refsPlaced(){
  return {
    contract:ACTIVE_REFERENCE_EVIDENCE_CONTRACT,status:'COMPLETE_CURRENT_SAVE',
    containerInventoryId:CONTAINER,references:[{gridId:3,gridObjectId:42,itemId:ITEM}]
  };
}
function refsStored(){
  return {
    contract:ACTIVE_REFERENCE_EVIDENCE_CONTRACT,status:'COMPLETE_CURRENT_SAVE',
    containerInventoryId:CONTAINER,references:[]
  };
}
function placement(gridId,x,y,orientation='GridOrientation_Right'){
  return {status:'VALID',valid:true,clearArea:false,gridId,itemId:ITEM,x,y,orientation};
}
function placed(root=profile(),overrides={}){
  return resolvePlacedStorageFurnitureV125({
    source,profile:root,gridId:3,gridObjectId:42,itemDefinition,
    activeReferenceEvidence:refsPlaced(),listInventoryId:LIST,...overrides
  });
}
function templateEvidence(){return {contract:GRID_OBJECT_TEMPLATE_EVIDENCE_CONTRACT,provenance:'SAME_SAVE_HASH_BOUND',sourceSha256:'a'.repeat(64),itemId:ITEM,containerInventoryId:CONTAINER,gridObject:storageObject()};}
function storedRoot(){
  const root=profile();
  delete root.World.GridCollection.Grids['3'].Objects['42'];
  root.Player.ListInventories['2'].Inventory[String(ITEM)].Amount=3;
  return root;
}

test('placed storage resolves exact outer -> ContainerInventory -> ParentItem linkage',()=>{
  const r=placed();
  assert.equal(r.contract,STORAGE_CONTAINER_CONTRACT);
  assert.equal(r.status,'READY');
  assert.equal(r.state,'PLACED');
  assert.deepEqual(r.address,{gridId:3,gridObjectId:42});
  assert.equal(r.itemId,ITEM);
  assert.equal(r.containerInventoryId,CONTAINER);
  assert.equal(r.container.ID,CONTAINER);
  assert.equal(r.container.ParentItemID,ITEM);
  assert.equal(r.container.Size,48);
  assert.equal(r.contentsNonEmpty,true);
  assert.equal(r.listInventory.amount,2);
  assert.deepEqual(r.activeReferences,[{gridId:3,gridObjectId:42,itemId:ITEM}]);
  assert.equal(r.persistentWriteAuthorized,false);
});

test('same-grid storage move reuses existing GRID_OBJECT writer and preserves storage identity',()=>{
  const root=profile(),r=placed(root);
  const m=compileStorageSameGridMoveV125({
    resolved:r,profile:root,
    destination:{x:12,y:22,orientation:'GridOrientation_Right'},
    placementEvidence:placement(3,12,22)
  });
  assert.equal(m.kind,STORAGE_TRANSITION.SAME_GRID_MOVE);
  assert.equal(m.existing01AReusableWithoutChange,true);
  assert.equal(m.capability,'WRITE_CANDIDATE');
  assert.equal(m.targetKind,'GRID_OBJECT');
  assert.deepEqual(m.allowedChanges.map(x=>x.path),[
    '/World/GridCollection/Grids/3/Objects/42/X',
    '/World/GridCollection/Grids/3/Objects/42/Y',
    '/World/GridCollection/Grids/3/Objects/42/Orientation'
  ]);
  assert.ok(m.exactPreservation.includes('/World/GridCollection/Grids/3/Objects/42/State'));
  assert.ok(m.exactPreservation.includes('/Player/ContainerInventories/21'));
});

test('cross-grid storage move changes GridObject address but preserves exact Storage ContainerInventoryID',()=>{
  const root=profile(),r=placed(root);
  const m=compileStorageCrossGridMoveV125({
    resolved:r,profile:root,
    destination:{gridId:7,x:30,y:40,orientation:'GridOrientation_Right'},
    placementEvidence:placement(7,30,40)
  });
  assert.equal(m.kind,STORAGE_TRANSITION.CROSS_GRID_MOVE);
  assert.equal(m.existing01AReusableWithoutChange,false);
  assert.equal(m.upstreamRequestId,STORAGE_01A_REQUEST_ID);
  assert.deepEqual(m.destinationAddress,{gridId:7,gridObjectId:80});
  assert.equal(m.mutation.add.value.ID,80);
  assert.equal(m.mutation.add.value.ItemID,ITEM);
  assert.equal(m.mutation.add.value.State.Storage.ContainerInventoryID,CONTAINER);
  assert.deepEqual(m.mutation.add.value.OpaqueObjectField,{preserve:'exact'});
  assert.deepEqual(m.mutation.nextGridObjectID,{path:'/World/GridCollection/Grids/7/NextGridObjectID',before:80,after:81});
  assert.ok(m.exactPreservation.includes('/Player/ContainerInventories/21'));
  assert.ok(m.exactPreservation.includes('/Player/ListInventories/2'));
});

test('non-empty put-away removes outer object, increments existing furniture stock, and preserves ContainerInventory',()=>{
  const r=placed();
  const m=compileStoragePutAwayNonemptyV125({resolved:r});
  assert.equal(m.kind,STORAGE_TRANSITION.PUT_AWAY_NONEMPTY);
  assert.deepEqual(m.mutation.remove,{path:'/World/GridCollection/Grids/3/Objects/42'});
  assert.deepEqual(m.mutation.listStock,{
    path:`/Player/ListInventories/2/Inventory/${ITEM}/Amount`,before:2,after:3
  });
  assert.deepEqual(m.exactPreservation,['/Player/ContainerInventories/21']);
  assert.equal(m.postState,'STORED_UNPLACED_NONEMPTY');
});

test('stored non-empty container resolves only with zero active references and hash-bound same-save object template',()=>{
  const root=storedRoot();
  const r=resolveStoredStorageContainerV125({
    source,profile:root,containerInventoryId:CONTAINER,itemDefinition,
    activeReferenceEvidence:refsStored(),listInventoryId:LIST,gridObjectTemplateEvidence:templateEvidence()
  });
  assert.equal(r.status,'READY');
  assert.equal(r.state,'STORED_UNPLACED_NONEMPTY');
  assert.equal(r.containerInventoryId,CONTAINER);
  assert.equal(r.contentsNonEmpty,true);
  assert.equal(r.listInventory.amount,3);
  assert.deepEqual(r.activeReferences,[]);
});

test('explicit re-place binds the selected same-save ContainerInventoryID and decrements existing stock only',()=>{
  const root=storedRoot();
  const r=resolveStoredStorageContainerV125({
    source,profile:root,containerInventoryId:CONTAINER,itemDefinition,
    activeReferenceEvidence:refsStored(),listInventoryId:LIST,gridObjectTemplateEvidence:templateEvidence()
  });
  const m=compileStorageRePlaceNonemptyV125({
    resolvedStored:r,profile:root,
    destination:{gridId:7,x:50,y:60,orientation:'GridOrientation_Right'},
    placementEvidence:placement(7,50,60)
  });
  assert.equal(m.kind,STORAGE_TRANSITION.REPLACE_NONEMPTY);
  assert.equal(m.upstreamRequestId,STORAGE_01A_REQUEST_ID);
  assert.equal(m.mutation.add.value.ID,80);
  assert.equal(m.mutation.add.value.State.Storage.ContainerInventoryID,CONTAINER);
  assert.deepEqual(m.mutation.listStock,{
    path:`/Player/ListInventories/2/Inventory/${ITEM}/Amount`,before:3,after:2
  });
  assert.ok(m.directBindingBoundary.includes('runtime acceptance'));
});

test('storage classifier fails closed for HomeStorage, parent mismatch, non-player and incomplete reference evidence',()=>{
  const home=placed(profile(),{itemDefinition:{...itemDefinition,interaction:'HomeStorage'}});
  assert.equal(home.status,'REJECTED');
  assert.ok(home.reasonCodes.includes('FURNITURE_CONTAINER_INTERACTION_REQUIRED'));

  const parent=profile();
  parent.Player.ContainerInventories['21'].ParentItemID=ITEM+1;
  const badParent=placed(parent);
  assert.equal(badParent.status,'REJECTED');
  assert.ok(badParent.reasonCodes.includes('CONTAINER_PARENT_ITEM_ID_MISMATCH'));

  const nonPlayer=profile();
  nonPlayer.Player.ContainerInventories['21'].BelongsToPlayer=false;
  const badOwner=placed(nonPlayer);
  assert.equal(badOwner.status,'REJECTED');
  assert.ok(badOwner.reasonCodes.includes('PLAYER_OWNED_CONTAINER_REQUIRED'));

  const duplicate=placed(profile(),{activeReferenceEvidence:{
    contract:ACTIVE_REFERENCE_EVIDENCE_CONTRACT,status:'COMPLETE_CURRENT_SAVE',
    containerInventoryId:CONTAINER,references:[
      {gridId:3,gridObjectId:42,itemId:ITEM},{gridId:7,gridObjectId:9,itemId:ITEM}
    ]
  }});
  assert.equal(duplicate.status,'REJECTED');
  assert.ok(duplicate.reasonCodes.includes('EXACTLY_ONE_ACTIVE_STORAGE_REFERENCE_REQUIRED'));
});

test('non-empty-only put-away/re-place contract rejects empty content',()=>{
  const root=profile();
  for(const slot of root.Player.ContainerInventories['21'].Inventory)slot.Amount=0;
  const r=placed(root);
  assert.equal(r.status,'READY');
  assert.equal(r.contentsNonEmpty,false);
  assert.throws(()=>compileStoragePutAwayNonemptyV125({resolved:r}),/NONEMPTY_STORAGE_REQUIRED/);

  delete root.World.GridCollection.Grids['3'].Objects['42'];
  root.Player.ListInventories['2'].Inventory[String(ITEM)].Amount=3;
  const stored=resolveStoredStorageContainerV125({
    source,profile:root,containerInventoryId:CONTAINER,itemDefinition,
    activeReferenceEvidence:refsStored(),listInventoryId:LIST,gridObjectTemplateEvidence:templateEvidence()
  });
  assert.equal(stored.status,'REJECTED');
  assert.ok(stored.reasonCodes.includes('NONEMPTY_STORED_CONTAINER_REQUIRED'));
});

test('placement evidence must be exact and clear-area false',()=>{
  const root=profile(),r=placed(root);
  assert.throws(()=>compileStorageCrossGridMoveV125({
    resolved:r,profile:root,
    destination:{gridId:7,x:30,y:40,orientation:'GridOrientation_Right'},
    placementEvidence:{...placement(7,30,40),clearArea:true}
  }),/EXACT_V125_CLEAR_AREA_FALSE_PLACEMENT_EVIDENCE_REQUIRED/);
});

test('01A and 01E machine requests remain narrow and all hard flags stay false',async()=>{
  const u=storageContainerUpstreamNeedV125();
  assert.equal(u.requestId,STORAGE_01A_REQUEST_ID);
  assert.equal(u.existing01ASufficient.SAME_GRID_MOVE,true);
  assert.equal(u.existing01ASufficient.CROSS_GRID_MOVE,false);
  assert.equal(u.minimumExtension.targetKind,'STORAGE_FURNITURE_TRANSITION');
  assert.equal(u.minimumExtension.genericContainerInventoryWriterRequired,false);
  assert.equal(u.runtimeAfterExtension.requestId,STORAGE_01E_REQUEST_ID);
  for(const v of Object.values(u.hardFlags))assert.equal(v,false);

  const semantic=JSON.parse(await readFile(new URL('../static/ddv/core/world/v1.25/storage-container-semantics-v125.json',import.meta.url),'utf8'));
  assert.equal(semantic.status,'STATIC_CURRENT_NATIVE_CLOSED_SAVE_LAYER_EXTENSION_REQUIRED');
  assert.equal(semantic.saveLayer.additiveRequest,STORAGE_01A_REQUEST_ID);
  assert.equal(semantic.identityLinkage.ownerLink.includes('Furniture ItemID'),true);
  assert.equal(semantic.preservationMatrix.find(x=>x.scenario==='CROSS_GRID_MOVE').containerInventoryId,'PRESERVED');

  const req=JSON.parse(await readFile(new URL('../static/ddv/core/save/v1.25/storage-container-transition-target-extension-request-v125.json',import.meta.url),'utf8'));
  assert.equal(req.minimumAdditiveExtension.targetKind,'STORAGE_FURNITURE_TRANSITION');
  assert.equal(req.minimumAdditiveExtension.newCapabilityEnumRequired,false);
  assert.equal(req.explicitlyNotRequested.includes('generic ContainerInventory writer'),true);

  const runtime=JSON.parse(await readFile(new URL('../static/ddv/core/world/v1.25/storage-container-01e-runtime-request-v125.json',import.meta.url),'utf8'));
  assert.equal(runtime.requestId,STORAGE_01E_REQUEST_ID);
  assert.equal(runtime.status,'FROZEN_WAIT_01A_EXTENSION_AND_01B_ADAPTER');
  assert.deepEqual(runtime.protocol.map(x=>x.case),['A_CROSS_GRID_MOVE','B_PUT_AWAY_THEN_EXPLICIT_REPLACE']);
});
