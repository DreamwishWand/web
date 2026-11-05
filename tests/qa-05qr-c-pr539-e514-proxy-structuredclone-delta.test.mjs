import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectW1SceneAreaReferences as inspect} from '../src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';

// Independent 05 QR-C repair delta ONLY, synthetic caller JS objects.
// Prior fixed PR546 5 PASS and 2 RED retained as ancestor; no P1G/private save.
const context=()=>({
  platform:'Nintendo Switch',gameVersion:'1.25.3',
  bid:'9A239D3DB569756D',schema:626,
  sourceSha256:'c'.repeat(64),sourceRevision:'synthetic-index-generation-0'
});
const fixture=()=>({
  GameInfo:{Version:626},
  World:{
    Villages:[
      {SceneItemId:1540000000,Areas:{
        '1':{Unlocked:true,GridIDs:[100]},
        '7':{Unlocked:false,GridIDs:[200]}
      }},
      {SceneItemId:1540000001,Areas:{'20':{Unlocked:true,GridIDs:[200]}}}
    ],
    GridCollection:{
      Grids:{'100':{ID:100,Objects:{}},'200':{ID:200,Objects:{}}},
      DiffGrids:{'100':{ID:100,ModifiedObjects:{},RemovedObjects:{}}}
    }
  }
});
const forbidden=['inputAuthenticatedByThisReader','sourceRevisionCasVerified',
  'actualWetlandAreaVerified','nativeEffectiveGridVerified',
  'nativeSoftwoodQuotaVerified','nativeProducerConsumerVerified',
  'productWriterAuthorized','productEditedCopyAuthorized',
  'originalOverwriteAuthorized','automatic2126RepairAuthorized'];
function denied(result,reason){
  assert.equal(result.status,'SOURCE_STRUCTURE_REJECTED',JSON.stringify(result));
  if(reason) assert.equal(result.reason,reason);
  assert.equal(result.sourceSceneReferenceMatched,false);
  for(const field of forbidden)assert.equal(result[field],false,field);
}
function scopedPositive(result){
  assert.equal(result.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(result.sceneId,1540000000);
  assert.equal(result.nativeWetlandAreaEnum,1);
  assert.equal(result.selectedNativeWetlandAreaKey,null);
  assert.equal(result.nativeClockLastNextVerified,false);
  for(const field of forbidden)assert.equal(result[field],false,field);
}

test('historical TRUE RED #6: Proxy hides a genuine enumerable Area, no partial positive witness',()=>{
  const p=fixture();
  const raw=p.World.Villages[0].Areas;
  raw['8']={Unlocked:true,GridIDs:[100]};
  p.World.Villages[0].Areas=new Proxy(raw,{ownKeys(){return ['1','7'];}});
  const before=raw['8'];
  const result=inspect(p,context());
  denied(result,'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
  assert.equal(raw['8'],before);
});

test('historical TRUE RED #7: Proxy invents nonexistent Area through descriptors, no synthetic positive',()=>{
  const p=fixture();
  const target={};
  p.World.Villages[0].Areas=new Proxy(target,{
    ownKeys(){return ['1'];},
    getOwnPropertyDescriptor(_t,key){
      if(key==='1')return {
        configurable:true,enumerable:true,writable:true,
        value:{Unlocked:true,GridIDs:[100]}
      };
    }
  });
  denied(inspect(p,context()),'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
  assert.deepEqual(Object.keys(target),[]);
});

test('new clone boundary: untrusted enumerable accessor on Area metadata must not execute or mutate source',()=>{
  const p=fixture();
  const area=p.World.Villages[0].Areas['1'];
  const before=JSON.stringify(p);
  let calls=0;
  Object.defineProperty(area,'unusedGet',{enumerable:true,configurable:true,
    get(){calls++;area.GridIDs[0]=999;return 42;}
  });
  const result=inspect(p,context());
  denied(result);
  assert.equal(calls,0,'structuredClone must not run untrusted accessor after source snapshot');
  assert.equal(area.GridIDs[0],100,'source GridIDs must remain byte-for-byte semantically unchanged');
  const after=p.World.Villages[0].Areas['1'].GridIDs[0];
  assert.equal(after,100);
  assert.ok(before.includes('\"GridIDs\":[100]'));
});

test('new clone boundary: nested transparent Proxy in unreferenced metadata must not create positive witness',()=>{
  const p=fixture();
  p.World.Villages[0].Areas['1'].extra=new Proxy({x:1},{});
  denied(inspect(p,context()),'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
});

test('new clone positive: complete plain JSON Area tree stays source-only, bounded and untouched',()=>{
  const p=fixture();
  const before=JSON.stringify(p);
  const r=inspect(p,context());
  scopedPositive(r);
  assert.deepEqual(r.sourceCandidates.map(a=>a.saveAreaKey),['1','7']);
  assert.equal(r.sourceCandidates[0].sourceGridRefs[0].sourceKind,'GRIDS_AND_DIFF_UNRESOLVED');
  assert.equal(r.sourceCandidates[1].savedUnlockedRaw,false);
  assert.equal(r.sourceCandidates[1].sourceGridRefs[0].sourceKind,'GRIDS_ONLY');
  assert.equal(JSON.stringify(p),before);
});

test('new clone unsupported Source fails closed rather than inferring Native or granting Writer',()=>{
  const p=fixture();
  const before=JSON.stringify(p);
  const clone=globalThis.structuredClone;
  try{
    Object.defineProperty(globalThis,'structuredClone',{configurable:true,writable:true,value:undefined});
    denied(inspect(p,context()),'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
  }finally{
    Object.defineProperty(globalThis,'structuredClone',{configurable:true,writable:true,value:clone});
  }
  assert.equal(JSON.stringify(p),before);
});
