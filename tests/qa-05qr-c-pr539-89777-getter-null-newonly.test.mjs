import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectW1SceneAreaReferences as inspect} from '../src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';

// 05 QR-C: independent new-only repair QA for PR539 Source 8977705.
// Historical QA546 5 PASS/2 RED and QA555 5 PASS/1 RED remain unchanged.
// These are synthetic, untrusted JS caller shapes, NOT actual encrypted P1G.
const ctx=()=>({platform:'Nintendo Switch',gameVersion:'1.25.3',
  bid:'9A239D3DB569756D',schema:626,
  sourceSha256:'b'.repeat(64),sourceRevision:'qa-fixed-head-synthetic'});
const profile=()=>({GameInfo:{Version:626},World:{
  Villages:[
    {SceneItemId:1540000000,Areas:{
      '1':{Unlocked:true,GridIDs:[100]},
      '7':{Unlocked:false,GridIDs:[700]}
    }},
    {SceneItemId:1540000001,Areas:{
      '20':{Unlocked:true,GridIDs:[200]}
    }}
  ],
  GridCollection:{
    Grids:{'100':{ID:100,Objects:{}},'700':{ID:700,Objects:{}},
      '200':{ID:200,Objects:{}}},
    DiffGrids:{'100':{ID:100,ModifiedObjects:{},RemovedObjects:{}}}
  }
}});
const notGranted=[
  'actualWetlandAreaVerified','nativeEffectiveGridVerified',
  'nativeSoftwoodQuotaVerified','nativeProducerConsumerVerified',
  'inputAuthenticatedByThisReader','sourceRevisionCasVerified',
  'productWriterAuthorized','productEditedCopyAuthorized',
  'originalOverwriteAuthorized','automatic2126RepairAuthorized'
];
function denied(r,reason='SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED'){
  assert.equal(r.status,'SOURCE_STRUCTURE_REJECTED',JSON.stringify(r));
  assert.equal(r.reason,reason);
  assert.equal(r.sourceSceneReferenceMatched,false);
  for(const k of notGranted)assert.equal(r[k],false,k);
}
function positive(r){
  assert.equal(r.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY',JSON.stringify(r));
  assert.equal(r.sourceSceneReferenceMatched,true);
  assert.equal(r.nativeWetlandAreaEnum,1);
  assert.equal(r.selectedNativeWetlandAreaKey,null);
  assert.equal(r.nativeClockLastNextVerified,false);
  for(const k of notGranted)assert.equal(r[k],false,k);
}

test('new RED repair: previously unused enumerable Area getter must never mutate GridIDs or execute',()=>{
  const p=profile(),area=p.World.Villages[0].Areas['1'];
  let reads=0;
  Object.defineProperty(area,'unusedGet',{configurable:true,enumerable:true,
    get(){reads++;area.GridIDs[0]=999;return 'bad';}
  });
  denied(inspect(p,ctx()));
  assert.equal(reads,0,'selected Area unknown getter must remain uncalled');
  assert.deepEqual(area.GridIDs,[100]);
  assert.equal(area.Unlocked,true);
});

test('nested unreferenced enumerable getter cannot mutate saved Unlocked or source object',()=>{
  const p=profile(),area=p.World.Villages[0].Areas['1'];
  area.opaque={nested:{sentinel:null}};
  let reads=0;
  Object.defineProperty(area.opaque.nested,'surprise',{enumerable:true,
    configurable:true,get(){reads++;area.Unlocked=false;return 42;}
  });
  denied(inspect(p,ctx()));
  assert.equal(reads,0);
  assert.equal(area.Unlocked,true);
  assert.deepEqual(area.GridIDs,[100]);
});

test('positive: honest JSON unknown nested null, arrays and explicit false stay accepted read-only',()=>{
  const p=profile(),area=p.World.Villages[0].Areas['1'];
  area.other={levels:[null,{nullable:null,bool:false,count:7,words:['a','b']}]};
  const before=JSON.stringify(p);
  const r=inspect(p,ctx());
  positive(r);
  assert.deepEqual(r.sourceCandidates.map(a=>a.saveAreaKey),['1','7']);
  assert.equal(r.sourceCandidates[0].sourceGridRefs[0].gridId,100);
  assert.equal(r.sourceCandidates[0].sourceGridRefs[0].sourceKind,
    'GRIDS_AND_DIFF_UNRESOLVED');
  assert.equal(r.sourceCandidates[1].sourceGridRefs[0].sourceKind,'GRIDS_ONLY');
  assert.equal(JSON.stringify(p),before,'reader must preserve whole synthetic JSON');
});

test('selected Areas only: sibling nonselected Village and unrelated World data remain untouched',()=>{
  const p=profile();
  let reads=0;
  Object.defineProperty(p.World.Villages[1].Areas['20'],'unused',{enumerable:true,
    get(){reads++;throw new Error('must never snapshot unrelated village');}});
  Object.defineProperty(p.World,'largeUnrelated',{enumerable:true,
    get(){reads++;throw new Error('must never clone whole Save');}});
  const r=inspect(p,ctx());
  positive(r);
  assert.equal(r.villageIndex,0);
  assert.equal(reads,0);
});

test('bounded JSON scanner rejects deep cyclic and oversized selected Areas before clone, no promotions',()=>{
  const p=profile(),area=p.World.Villages[0].Areas['1'];
  area.opaque={name:'cyclic'};
  area.opaque.self=area.opaque;
  denied(inspect(p,ctx()));
  const big=profile(),bigArea=big.World.Villages[0].Areas['1'];
  bigArea.opaque=Array(10001).fill(null);
  denied(inspect(big,ctx()));
  assert.deepEqual(bigArea.GridIDs,[100]);
});

test('nested object with non-data descriptor rejects rather than invoking accessor to fill a missing value',()=>{
  const p=profile(),area=p.World.Villages[0].Areas['1'];
  area.unknown={deep:{}};
  let calls=0;
  Object.defineProperty(area.unknown.deep,'untrusted',{enumerable:true,
    get(){calls++;return {GridIDs:[999]};}
  });
  const r=inspect(p,ctx());
  denied(r);
  assert.equal(calls,0);
  assert.deepEqual(area.GridIDs,[100]);
});
