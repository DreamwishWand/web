import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectW1SceneAreaReferences as inspect} from '../src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';

// 05 QR-C independent NEW-ONLY PR539 SHA133898; synthetic hostile JS only.
// Reuse earlier fixed QA561 6/6 scoped tests; no private encrypted P1G.
const context=()=>({platform:'Nintendo Switch',gameVersion:'1.25.3',
 bid:'9A239D3DB569756D',schema:626,
 sourceSha256:'b'.repeat(64),sourceRevision:'independent-source-only'});
const fixture=()=>({GameInfo:{Version:626},World:{
 Villages:[
  {SceneItemId:1540000000,Areas:{
    '1':{Unlocked:true,GridIDs:[100]},
    '7':{Unlocked:false,GridIDs:[700]}
  }},
  {SceneItemId:1540000001,Areas:{'20':{Unlocked:true,GridIDs:[200]}}}
 ],
 GridCollection:{Grids:{
   '100':{ID:100,Objects:{}},'700':{ID:700,Objects:{}},'200':{ID:200,Objects:{}}
 },DiffGrids:{'100':{ID:100,ModifiedObjects:{},RemovedObjects:{}}}}
}});
const deniedFields=['actualWetlandAreaVerified','nativeEffectiveGridVerified',
 'nativeSoftwoodQuotaVerified','nativeProducerConsumerVerified',
 'inputAuthenticatedByThisReader','sourceRevisionCasVerified',
 'productWriterAuthorized','productEditedCopyAuthorized',
 'originalOverwriteAuthorized','automatic2126RepairAuthorized'];
function denied(result,reason){
 assert.equal(result.status,'SOURCE_STRUCTURE_REJECTED',JSON.stringify(result));
 if(reason)assert.equal(result.reason,reason);
 assert.equal(result.sourceSceneReferenceMatched,false);
 for(const field of deniedFields) assert.equal(result[field],false,field);
}
function sourceOnly(result){
 assert.equal(result.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY',JSON.stringify(result));
 assert.equal(result.nativeWetlandAreaEnum,1);
 assert.equal(result.selectedNativeWetlandAreaKey,null);
 assert.equal(result.nativeClockLastNextVerified,false);
 for(const field of deniedFields)assert.equal(result[field],false,field);
}

test('09P-caught TRUE RED GridIDs Proxy get(length) cannot mutate saved Area.Unlocked',()=>{
 const p=fixture(),area=p.World.Villages[0].Areas['1'];
 let getLengthCalls=0;
 area.GridIDs=new Proxy([100],{
  get(target,key,receiver){
   if(key==='length'){getLengthCalls++;area.Unlocked=false;}
   return Reflect.get(target,key,receiver);
  }
 });
 const result=inspect(p,context());
 denied(result,'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
 assert.equal(getLengthCalls,0,'no direct Proxy get(length) during bounds, iteration or attestation');
 assert.equal(area.Unlocked,true);
 assert.equal(area.GridIDs[0],100);
});

test('Villages Proxy get(length) must not run even when Scene remains structurally valid',()=>{
 const p=fixture();
 let calls=0;
 p.World.Villages=new Proxy(p.World.Villages,{
  get(target,key,receiver){
   if(key==='length'){calls++;p.World.GridCollection.Grids['100'].ID=999;}
   return Reflect.get(target,key,receiver);
  }
 });
 const result=inspect(p,context());
 assert.equal(calls,0,'untrusted top-level array length cannot execute a getter trap');
 assert.equal(p.World.GridCollection.Grids['100'].ID,100);
 assert.equal(result.productWriterAuthorized,false);
 assert.equal(result.inputAuthenticatedByThisReader,false);
 assert.ok(['SOURCE_STRUCTURE_REJECTED','SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY'].includes(result.status),
  'structural reader may refuse Proxy but cannot authorize native/product');
});

test('selected Areas nested array Proxy get(length) never executes during bounded descriptor scan',()=>{
 const p=fixture(),area=p.World.Villages[0].Areas['1'];
 let calls=0;
 area.opaque={nested:new Proxy([null,'ok'],{
  get(target,key,receiver){
   if(key==='length'){calls++;area.GridIDs[0]=999;}
   return Reflect.get(target,key,receiver);
  }
 })};
 denied(inspect(p,context()),'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
 assert.equal(calls,0);
 assert.deepEqual(area.GridIDs,[100]);
});

test('synthetic regular arrays with nested null, false, object and paired DiffGrid remain source-only',()=>{
 const p=fixture(),area=p.World.Villages[0].Areas['1'];
 area.metadata={unknown:[null,false,0,{deep:['a',null,7]}]};
 const before=JSON.stringify(p);
 const result=inspect(p,context());
 sourceOnly(result);
 assert.deepEqual(result.sourceCandidates.map(a=>a.saveAreaKey),['1','7']);
 assert.equal(result.sourceCandidates[0].sourceGridRefs[0].sourceKind,'GRIDS_AND_DIFF_UNRESOLVED');
 assert.equal(result.sourceCandidates[1].sourceGridRefs[0].sourceKind,'GRIDS_ONLY');
 assert.equal(JSON.stringify(p),before);
});

test('native length caps fail closed without touching original input or promoting Writer',()=>{
 const a=fixture(),area=a.World.Villages[0].Areas['1'];
 area.GridIDs=Array(2049).fill(100);
 denied(inspect(a,context()),'AREA_KEY_UNLOCK_OR_GRIDIDS_INVALID');
 assert.equal(area.GridIDs.length,2049);
 const b=fixture();
 b.World.Villages=Array(65).fill({SceneItemId:1540000000});
 denied(inspect(b,context()),'VILLAGE_ARRAY_OR_GRID_COLLECTION_INVALID');
 const c=fixture();
 c.World.Villages[0].Areas['1'].metadata=Array(10001).fill(null);
 denied(inspect(c,context()),'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
});

test('get(length) trap configured to throw is not invoked before safe-refusal of selected Proxy array',()=>{
 const p=fixture(),area=p.World.Villages[0].Areas['1'];
 let calls=0;
 area.GridIDs=new Proxy([100],{get(t,k,r){
  if(k==='length'){calls++;throw Error('untrusted length getter');}
  return Reflect.get(t,k,r);
 }});
 denied(inspect(p,context()),'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
 assert.equal(calls,0);
 assert.equal(area.Unlocked,true);
});
