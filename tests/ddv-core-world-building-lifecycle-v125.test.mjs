import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const lifecycle=require('../static/ddv/core/world/v1.25/building-lifecycle-v125.cjs');
const restoration=require('../static/ddv/core/world/v1.25/restoration-v125.cjs');
const contract=JSON.parse(fs.readFileSync(new URL('../static/ddv/core/world/v1.25/building-lifecycle-v125.json',import.meta.url),'utf8'));

let passed=0;
const t=(name,fn)=>{fn();passed++;console.log('PASS',name);};
const ordinaryHouse={buildingItemType:'House',characterHouse:false,fastTravel:false,sharedSynchronizer:false,globalStateBinding:false,unmodeledSpecialLifecycle:false};
const ordinaryOther={buildingItemType:'Other',characterHouse:false,fastTravel:false,sharedSynchronizer:false,globalStateBinding:false,unmodeledSpecialLifecycle:false};

t('machine contract is exact-build read/model/preflight only',()=>{
 assert.equal(contract.schema,'ddv.building-lifecycle-semantics@1');
 assert.deepEqual(contract.scope,['read','model','preflight']);
 assert.equal(contract.target.buildId,'52BD625D9B4E0053');
 assert.equal(contract.writerBoundary.persistentWriteAuthorized,false);
 assert.equal(contract.writerBoundary.worldPersistentWriteV125,false);
 assert.equal(contract.writerBoundary.authorizesApply,false);
 assert.equal(contract.writerBoundary.authorizesEntitlementMutation,false);
});

t('definition ItemID is portable but GridObject.ID is not',()=>{
 const x=lifecycle.portableBuildingIdentity({itemId:20300008,gridObjectId:999});
 assert.equal(x.status,'VALID');
 assert.deepEqual(x.identity,{itemId:20300008});
 assert.deepEqual(x.excludedIdentity,['GridObject.ID']);
 assert.equal(x.persistentWriteAuthorized,false);
});

t('known special BuildingItemType values classify fail-closed away from ordinary',()=>{
 assert.equal(lifecycle.classifyBuilding({buildingItemType:'PlayerHouse'}).class,lifecycle.CLASSES.SPECIAL);
 assert.equal(lifecycle.classifyBuilding({buildingItemType:'Stall'}).class,lifecycle.CLASSES.SPECIAL);
 assert.equal(lifecycle.classifyBuilding({buildingItemType:'Garden'}).class,lifecycle.CLASSES.SPECIAL);
 assert.equal(lifecycle.classifyBuilding({buildingItemType:'OffGridBuilding'}).class,lifecycle.CLASSES.OFF_GRID);
});

t('House and Other require explicit absence of every known special binding before ordinary classification',()=>{
 assert.equal(lifecycle.classifyBuilding(ordinaryHouse).class,lifecycle.CLASSES.ORDINARY);
 assert.equal(lifecycle.classifyBuilding(ordinaryOther).class,lifecycle.CLASSES.ORDINARY);
 const incomplete=lifecycle.classifyBuilding({buildingItemType:'House',characterHouse:false});
 assert.equal(incomplete.class,lifecycle.CLASSES.UNKNOWN);
 assert.equal(incomplete.blockers[0].code,'BUILDING_CLASSIFICATION_EVIDENCE_INCOMPLETE');
});

t('semantic flags force House or Other into special classification',()=>{
 assert.equal(lifecycle.classifyBuilding({...ordinaryHouse,characterHouse:true}).class,lifecycle.CLASSES.SPECIAL);
 assert.equal(lifecycle.classifyBuilding({...ordinaryOther,fastTravel:true}).class,lifecycle.CLASSES.SPECIAL);
 assert.equal(lifecycle.classifyBuilding({...ordinaryOther,sharedSynchronizer:true}).class,lifecycle.CLASSES.SPECIAL);
 assert.equal(lifecycle.classifyBuilding({...ordinaryOther,globalStateBinding:true}).class,lifecycle.CLASSES.SPECIAL);
});

t('PlayerHouse destination binding uses HouseItemID and accepts index zero',()=>{
 const x=lifecycle.resolveDestinationPlayerHouseBinding({
  houseItemId:20500005,
  destinationPlayerHouses:[{HouseItemID:20500005},{HouseItemID:20500109}]
 });
 assert.equal(x.status,'BIND_EXISTING_DESTINATION_INTERIOR');
 assert.deepEqual(x.binding,{houseItemId:20500005,playerHouseIndex:0});
 assert.equal(x.persistentWriteAuthorized,false);
});

t('PlayerHouse missing interior does not silently authorize CreatePlayerHouse',()=>{
 const x=lifecycle.resolveDestinationPlayerHouseBinding({houseItemId:20500005,destinationPlayerHouses:[]});
 assert.equal(x.status,'BLOCKED');
 assert.equal(x.blockers[0].code,'PLAYER_HOUSE_INTERIOR_CREATE_POLICY_UNRESOLVED');
 assert.equal(x.nativeObservedFallback,'CreatePlayerHouse');
});

t('duplicate destination PlayerHouse interior identity fails closed',()=>{
 const x=lifecycle.resolveDestinationPlayerHouseBinding({
  houseItemId:20500005,
  destinationPlayerHouses:[{HouseItemID:20500005},{HouseItemID:20500005}]
 });
 assert.equal(x.status,'UNKNOWN_UNSUPPORTED');
 assert.equal(x.blockers[0].code,'PLAYER_HOUSE_MULTIPLE_INTERIOR_BINDINGS_UNRESOLVED');
});

t('ordinary same-grid transform is model-eligible but never writer-authorized',()=>{
 const x=lifecycle.preflightBuildingOperation(ordinaryHouse,'SAME_GRID_TRANSFORM');
 assert.equal(x.status,'MODEL_ELIGIBLE_WRITER_DISABLED');
 assert.equal(x.requiresNativeOperation,'UpdateGridObjectTransform');
 assert.equal(x.persistentWriteAuthorized,false);
});

t('special same-grid transform remains blocked on unverified lifecycle side effects',()=>{
 const x=lifecycle.preflightBuildingOperation({buildingItemType:'Stall'},'SAME_GRID_TRANSFORM');
 assert.equal(x.status,'BLOCKED');
 assert.equal(x.blockers[0].code,'BUILDING_SPECIAL_LIFECYCLE_UNSUPPORTED');
});

t('ordinary placement requires native placement, stock and multiplicity validation',()=>{
 const missing=lifecycle.preflightBuildingOperation(ordinaryOther,'ADD_PLACEMENT',{});
 assert.equal(missing.status,'BLOCKED');
 assert.deepEqual(new Set(missing.blockers.map(x=>x.code)),new Set([
  'BUILDING_NATIVE_STOCK_VALIDATION_REQUIRED',
  'BUILDING_NATIVE_MULTIPLICITY_VALIDATION_REQUIRED',
  'BUILDING_NATIVE_PLACEMENT_VALIDATION_REQUIRED'
 ]));
 const valid=lifecycle.preflightBuildingOperation(ordinaryOther,'ADD_PLACEMENT',{
  stockStatus:'VALID',multiplicityStatus:'VALID',nativePlacementStatus:'NATIVE_VALID_CLEAR'
 });
 assert.equal(valid.status,'PREFLIGHT_VALID_WRITER_DISABLED');
 assert.equal(valid.persistentWriteAuthorized,false);
});

t('PlayerHouse placement stays product-policy blocked even with an existing destination interior',()=>{
 const x=lifecycle.preflightBuildingOperation(
  {buildingItemType:'PlayerHouse',itemId:20500005},
  'ADD_PLACEMENT',
  {
   houseItemId:20500005,
   destinationPlayerHouses:[{HouseItemID:20500005}],
   multiplicityStatus:'VALID',
   nativePlacementStatus:'NATIVE_VALID_CLEAR'
  }
 );
 assert.equal(x.status,'BLOCKED');
 assert.equal(x.binding.playerHouseIndex,0);
 assert.ok(x.blockers.some(b=>b.code==='PLAYER_HOUSE_PLACEMENT_POLICY_UNRESOLVED'));
});

t('cross-grid, remove, base replacement, duplicate and persistent Apply all remain blocked',()=>{
 const expected=[
  ['CROSS_GRID_TRANSFER','BUILDING_CROSS_GRID_LIFECYCLE_REQUIRED'],
  ['REMOVE','BUILDING_REMOVAL_NATIVE_LIFECYCLE_REQUIRED'],
  ['BASE_REPLACE','BUILDING_BASE_REPLACEMENT_UNRESOLVED'],
  ['DUPLICATE','BUILDING_DUPLICATION_POLICY_UNRESOLVED'],
  ['PERSISTENT_APPLY','PERSISTENT_WRITE_UNAUTHORIZED']
 ];
 for(const [op,code] of expected){
  const x=lifecycle.preflightBuildingOperation(ordinaryHouse,op);
  assert.equal(x.status,'BLOCKED');
  assert.equal(x.blockers[0].code,code);
  assert.equal(x.persistentWriteAuthorized,false);
 }
});

t('promoted lifecycle contract remains compatible with existing Building skin portable codec',()=>{
 const world={PlayerHouses:[]};
 const x=restoration.captureObjectRestorationState({
  ItemID:20300008,
  State:{BuildingWithSkinData:{UpgradeState:{Level:4},CurrentSkinItemID:170200005}}
 },world);
 assert.deepEqual(x.portableState,{codec:'ddv.building-skin@1',targetBuildingItemId:20300008,skinItemId:170200005});
 assert.equal(contract.portableState.buildingSkin.codec,x.portableState.codec);
});

t('promoted lifecycle contract remains compatible with existing PlayerHouse portable codec',()=>{
 const world={PlayerHouses:[{HouseItemID:20500005}]};
 const x=restoration.captureObjectRestorationState({
  ItemID:20500005,
  State:{HouseData:{Built:true,UpgradeState:{Level:4},PlayerHouseIndex:0}}
 },world);
 assert.deepEqual(x.portableState,{codec:'ddv.player-house-binding@1',houseItemId:20500005});
 assert.equal(contract.portableState.playerHouseBinding.codec,x.portableState.codec);
});

t('unresolved writer-sensitive semantics remain explicit owner returns',()=>{
 const byId=new Map(contract.unresolved.map(x=>[x.id,x]));
 assert.equal(byId.get('STALL_SHOP_PRECEDENCE').owner,'01B');
 assert.equal(byId.get('PLAYER_HOUSE_CROSS_WORLD').owner,'01B');
 assert.match(byId.get('SPECIAL_BUILDING_RUNTIME_SIDE_EFFECTS').owner,/01E/);
 assert.match(byId.get('WELL_REMOVAL_REPLACEMENT_RUNTIME').owner,/01E/);
});

console.log(`RESULT ${passed}/${passed} PASS`);
