import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectW1SceneAreaReferences, W1_SCENE_AREA_REFERENCE_CONTRACT,
  W1_SCENE_AREA_SOURCE
} from '../src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';

const context = Object.freeze({
  platform:'Nintendo Switch',gameVersion:'1.25.3',
  bid:'9A239D3DB569756D',schema:626,
  sourceSha256:'a'.repeat(64),sourceRevision:'index-generation-5'
});
function fixture(){
  return {
    GameInfo:{Version:626},
    World:{
      Villages:[
        {SceneItemId:1540000000,Areas:{
          '7':{Unlocked:true,GridIDs:[700]},
          '1':{Unlocked:true,GridIDs:[100]},
          '0':{Unlocked:false,GridIDs:[101]}
        }},
        {SceneItemId:1540000001,Areas:{'20':{Unlocked:true,GridIDs:[200]}}}
      ],
      GridCollection:{
        Grids:{'700':{ID:700,Objects:{}},'100':{ID:100,Objects:{}},'101':{ID:101,Objects:{}}},
        DiffGrids:{'200':{ID:200,ModifiedObjects:{},RemovedObjects:{}}}
      }
    }
  };
}
const inspect=p=>inspectW1SceneAreaReferences(p,context);
const denies=r=>{
  assert.equal(r.status,'SOURCE_STRUCTURE_REJECTED');
  assert.equal(r.actualWetlandAreaVerified,false);
  assert.equal(r.productWriterAuthorized,false);
  assert.equal(r.productEditedCopyAuthorized,false);
  assert.equal(r.automatic2126RepairAuthorized,false);
};
test('exact SceneItemId identifies a unique saved Village with candidate Area refs, not Native Wetland',()=>{
  const p=fixture(); const r=inspect(p);
  assert.equal(r.contract,W1_SCENE_AREA_REFERENCE_CONTRACT);
  assert.equal(r.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(r.sceneId,1540000000);
  assert.equal(r.villageIndex,0);
  assert.deepEqual(r.sourceCandidates.map(a=>a.saveAreaKey),['0','1','7']);
  assert.deepEqual(r.sourceCandidates.map(a=>a.savedUnlockedRaw),[false,true,true]);
  assert.deepEqual(r.sourceCandidates.map(a=>a.sourceGridRefs[0].gridId),[101,100,700]);
  assert.equal(r.nativeWetlandAreaEnum,1);
  assert.equal(r.selectedNativeWetlandAreaKey,null);
  assert.equal(r.actualWetlandAreaVerified,false);
  assert.equal(r.nativeEffectiveGridVerified,false);
  assert.equal(r.nativeSoftwoodQuotaVerified,false);
  assert.equal(r.nativeClockLastNextVerified,false);
  assert.equal(r.productWriterAuthorized,false);
  assert.equal(r.inputAuthenticatedByThisReader,false);
  assert.ok(Object.isFrozen(r.sourceCandidates));
  assert.ok(Object.isFrozen(r.sourceCandidates[0]));
  assert.ok(Object.isFrozen(r.sourceCandidates[0].sourceGridRefs[0]));
});
test('wrong external BID, schema, full version, platform or missing provenance are denied',()=>{
  for(const [k,value] of [
    ['platform','Steam'],['gameVersion','1.25.0'],
    ['bid','52BD625D9B4E0053'],['schema',624],
    ['sourceRevision',''],['sourceSha256','fake']
  ]){
    const r=inspectW1SceneAreaReferences(fixture(),{...context,[k]:value});
    denies(r);
  }
  const p=fixture();p.GameInfo.Version=624;denies(inspect(p));
});
test('missing, duplicate or forged SceneItemId cannot select a village',()=>{
  const patches=[
    p=>p.World.Villages[0].SceneItemId=1540000002,
    p=>p.World.Villages[1].SceneItemId=1540000000,
    p=>delete p.World.Villages[0].SceneItemId,
    p=>p.World.Villages[0].SceneItemId='1540000000',
    p=>p.World.Villages[0].Areas=null,
    p=>p.World.Villages=[]
  ];
  for(const f of patches){const p=fixture();f(p);denies(inspect(p));}
});
test('invalid or noncanonical Area keys, unlocked values, grid IDs and map IDs fail closed',()=>{
  const patches=[
    p=>p.World.Villages[0].Areas['01']={Unlocked:true,GridIDs:[100]},
    p=>p.World.Villages[0].Areas['1'].GridIDs=[100,100],
    p=>p.World.Villages[0].Areas['1'].GridIDs=[999],
    p=>p.World.Villages[0].Areas['1'].GridIDs=['100'],
    p=>p.World.Villages[0].Areas['1'].Unlocked=1,
    p=>p.World.GridCollection.Grids['100'].ID=999,
    p=>p.World.GridCollection.DiffGrids=null
  ];
  for(const f of patches){const p=fixture();f(p);denies(inspect(p));}
});
test('overlapping GRIDS+DiffGrids or diff-only remain source-only, no effective object or quota claim',()=>{
  const p=fixture();
  p.World.GridCollection.DiffGrids['100']={ID:100,ModifiedObjects:{},RemovedObjects:{}};
  delete p.World.GridCollection.Grids['101'];
  p.World.GridCollection.DiffGrids['101']={ID:101,ModifiedObjects:{},RemovedObjects:{}};
  const r=inspect(p);
  assert.equal(r.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  const area1=r.sourceCandidates.find(a=>a.saveAreaKey==='1');
  const area0=r.sourceCandidates.find(a=>a.saveAreaKey==='0');
  assert.equal(area1.sourceGridRefs[0].sourceKind,'GRIDS_AND_DIFF_UNRESOLVED');
  assert.equal(area0.sourceGridRefs[0].sourceKind,'DIFF_ONLY_DEFAULT_UNRESOLVED');
  assert.equal(r.nativeEffectiveGridVerified,false);
  assert.equal(r.nativeSoftwoodQuotaVerified,false);
  assert.equal(r.productEditedCopyAuthorized,false);
});
test('overlapping Grid and DiffGrid IDs must each match the referenced map key',()=>{
  for(const change of [
    p=>p.World.GridCollection.DiffGrids['100']={ID:999,ModifiedObjects:{},RemovedObjects:{}},
    p=>{p.World.GridCollection.Grids['100'].ID=999;
        p.World.GridCollection.DiffGrids['100']={ID:100,ModifiedObjects:{},RemovedObjects:{}};},
    p=>p.World.GridCollection.DiffGrids['100']=null
  ]){
    const p=fixture();change(p);
    const r=inspect(p);denies(r);
    assert.equal(r.reason,'SOURCE_GRID_MAP_ID_MISMATCH');
  }
  const p=fixture();
  p.World.GridCollection.DiffGrids['100']={ID:100,ModifiedObjects:{},RemovedObjects:{}};
  const r=inspect(p);
  assert.equal(r.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(r.sourceCandidates.find(a=>a.saveAreaKey==='1').sourceGridRefs[0].sourceKind,'GRIDS_AND_DIFF_UNRESOLVED');
  assert.equal(r.nativeEffectiveGridVerified,false);
  assert.equal(r.productWriterAuthorized,false);
});
test('source evidence cannot be promoted using caller fake Native/Writer/Clock flags',()=>{
  const p=fixture();p.NativeV3Accepted=true;p.productWriterAuthorized=true;
  const r=inspectW1SceneAreaReferences(p,{...context,fullDocumentVerified:true,nativeClockLastNextVerified:true,productWriterAuthorized:true});
  assert.equal(r.sourceSceneReferenceMatched,true);
  assert.equal(r.nativeProducerConsumerVerified,false);
  assert.equal(r.nativeClockLastNextVerified,false);
  assert.equal(r.sourceRevisionCasVerified,false);
  assert.equal(r.productWriterAuthorized,false);
  assert.equal(r.productEditedCopyAuthorized,false);
  assert.equal(r.originalOverwriteAuthorized,false);
  assert.equal(r.automatic2126RepairAuthorized,false);
  assert.equal(W1_SCENE_AREA_SOURCE.sourceEventId,2010000021);
});


test('a changing SceneItemId getter may not impersonate Village04',()=>{
  // Change the ORIGINAL target Village04, so the old parent getter path
  // falsely accepts this same Village without a duplicate-target guard.
  const p=fixture(),v=p.World.Villages[0];
  let hits=0;
  Object.defineProperty(v,'SceneItemId',{enumerable:true,configurable:true,
    get(){return ++hits===1?1540000001:1540000000;}});
  const result=inspect(p);
  denies(result);
  assert.equal(hits,0,'never execute untrusted SceneItemId getter');
});
test('serialized references reject inherited fields, mutable GridIDs and hidden area',()=>{
  const cases=[
    p=>{const v=p.World.Villages[0];
      v.SceneItemId=undefined;Object.setPrototypeOf(v,{SceneItemId:1540000000});delete v.SceneItemId;},
    p=>{const a=p.World.Villages[0].Areas['1'];let hits=0;
      Object.defineProperty(a,'GridIDs',{enumerable:true,
        get(){return ++hits===1?[100]:[999];}});},
    p=>{const grid=p.World.GridCollection.Grids['100'];
      delete grid.ID;Object.setPrototypeOf(grid,{ID:100});},
    p=>{Object.defineProperty(p.World.Villages[0].Areas,'8',{
      enumerable:false,value:{Unlocked:true,GridIDs:[100]}});}
  ];
  for(const edit of cases){const p=fixture();edit(p);denies(inspect(p));}
});
test('own map/grid ID getters and alternate hidden keys never mint a reference',()=>{
  const p=fixture(),g=p.World.GridCollection.Grids['100'];
  let reads=0;
  Object.defineProperty(g,'ID',{enumerable:true,
    get(){return ++reads===1?100:999;}});
  const result=inspect(p);denies(result);
  assert.equal(reads,0);
  const q=fixture();
  Object.defineProperty(q.World.Villages[0].Areas,Symbol('hidden'),{
    value:{Unlocked:true,GridIDs:[100]},enumerable:false
  });
  denies(inspect(q));
});
test('plain own JSON data remains read-only and preserves paired map distinction',()=>{
  const p=fixture();
  p.World.GridCollection.DiffGrids['100']={ID:100,ModifiedObjects:{},RemovedObjects:{}};
  const before=JSON.stringify(p);
  const r=inspect(p);
  assert.equal(r.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(r.sourceCandidates.find(a=>a.saveAreaKey==='1').sourceGridRefs[0].sourceKind,
    'GRIDS_AND_DIFF_UNRESOLVED');
  assert.equal(r.nativeWetlandAreaEnum,1);
  assert.equal(r.selectedNativeWetlandAreaKey,null);
  assert.equal(r.productWriterAuthorized,false);
  assert.equal(JSON.stringify(p),before);
});


test('Proxy ownKeys hiding real serialized Area must not yield partial positive reference',()=>{
  const p=fixture(),actual=p.World.Villages[0].Areas;
  actual['8']={Unlocked:true,GridIDs:[100]};
  p.World.Villages[0].Areas=new Proxy(actual,{
    ownKeys(){return ['0','1','7'];}
  });
  const result=inspect(p);
  denies(result);
  assert.equal(result.reason,'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
});
test('Proxy ownKeys/descriptor cannot fabricate absent serialized Area record',()=>{
  const p=fixture();
  p.World.Villages[0].Areas=new Proxy({},{
    ownKeys(){return ['1'];},
    getOwnPropertyDescriptor(_target,key){
      if(key==='1')return {configurable:true,enumerable:true,writable:true,
        value:{Unlocked:true,GridIDs:[100]}};
    }
  });
  const result=inspect(p);
  denies(result);
  assert.equal(result.reason,'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
});
test('plain JSON Areas snapshots retain complete canonical read-only candidates',()=>{
  const p=fixture(),before=JSON.stringify(p);
  const result=inspect(p);
  assert.equal(result.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.deepEqual(result.sourceCandidates.map(a=>a.saveAreaKey),['0','1','7']);
  assert.equal(result.selectedNativeWetlandAreaKey,null);
  assert.equal(result.nativeEffectiveGridVerified,false);
  assert.equal(result.productWriterAuthorized,false);
  assert.equal(JSON.stringify(p),before);
});


test('unused enumerable Area metadata getter must not execute during clone attestation',()=>{
  const p=fixture(),area=p.World.Villages[0].Areas['1'];
  let calls=0;
  Object.defineProperty(area,'unusedGet',{enumerable:true,configurable:true,
    get(){calls++;area.GridIDs[0]=999;return 42;}});
  const r=inspect(p);
  denies(r);
  assert.equal(r.reason,'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
  assert.equal(calls,0);
  assert.equal(area.GridIDs[0],100);
});
test('nested unused metadata accessor is rejected without mutation or getter execution',()=>{
  const p=fixture(),area=p.World.Villages[0].Areas['1'];
  area.opaque={metadata:{}};
  let calls=0;
  Object.defineProperty(area.opaque.metadata,'unstable',{enumerable:true,
    get(){calls++;area.Unlocked=false;return 'changed';}});
  const r=inspect(p);
  denies(r);
  assert.equal(r.reason,'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
  assert.equal(calls,0);
  assert.equal(area.Unlocked,true);
});
test('selected Areas subtree with cycle, non-JSON symbol or excessive metadata fails closed',()=>{
  const p=fixture();
  p.World.Villages[0].Areas['1'].unknown={};
  p.World.Villages[0].Areas['1'].unknown.self=
    p.World.Villages[0].Areas['1'].unknown;
  denies(inspect(p));
  const q=fixture();
  q.World.Villages[0].Areas['1'].unknown=Symbol('synthetic');
  denies(inspect(q));
  const large=fixture();
  large.World.Villages[0].Areas['1'].unknown=Array(10001).fill(0);
  denies(inspect(large));
});
test('additional plain JSON area metadata is accepted without native/writer promotion',()=>{
  const p=fixture(),area=p.World.Villages[0].Areas['1'];
  area.unknown={nested:['original',null,7,false]};
  const before=JSON.stringify(p),r=inspect(p);
  assert.equal(r.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(r.nativeEffectiveGridVerified,false);
  assert.equal(r.productWriterAuthorized,false);
  assert.equal(r.selectedNativeWetlandAreaKey,null);
  assert.equal(JSON.stringify(p),before);
});
