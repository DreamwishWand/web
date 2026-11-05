import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {inspectW1SceneAreaReferences as inspect} from '../src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';

// Independent 05 QR-C PR539 NEW-ONLY. All fixtures are synthetic hostile JS caller
// objects, NOT genuine JSON.parse encrypted owner P1G, Product Native V3, or Writer.
const BID='9A239D3DB569756D';
const ctx=()=>({platform:'Nintendo Switch',gameVersion:'1.25.3',bid:BID,
  schema:626,sourceSha256:'a'.repeat(64),sourceRevision:'independent-qa-research-only'});
const profile=()=>({
  GameInfo:{Version:626},World:{
    Villages:[
      {SceneItemId:1540000001,Areas:{'7':{Unlocked:false,GridIDs:[200]}}},
      {SceneItemId:1540000000,Areas:{'1':{Unlocked:true,GridIDs:[100]}}}
    ],
    GridCollection:{
      Grids:{'100':{ID:100,Objects:{}},'200':{ID:200,Objects:{}}},
      DiffGrids:{'100':{ID:100,ModifiedObjects:{},RemovedObjects:{}}}
    }
  }
});
const denied=(r)=>{
  assert.equal(r.status,'SOURCE_STRUCTURE_REJECTED',JSON.stringify(r));
  for(const k of ['actualWetlandAreaVerified','nativeEffectiveGridVerified',
    'nativeSoftwoodQuotaVerified','nativeProducerConsumerVerified',
    'inputAuthenticatedByThisReader','sourceRevisionCasVerified',
    'productWriterAuthorized','productEditedCopyAuthorized',
    'originalOverwriteAuthorized','automatic2126RepairAuthorized'])
    assert.equal(r[k],false,k);
};
const readOnly=(r)=>{
  assert.equal(r.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY',JSON.stringify(r));
  assert.equal(r.selectedNativeWetlandAreaKey,null);
  assert.equal(r.nativeWetlandAreaEnum,1);
  for(const k of ['actualWetlandAreaVerified','nativeEffectiveGridVerified',
    'nativeSoftwoodQuotaVerified','nativeClockLastNextVerified',
    'nativeProducerConsumerVerified','inputAuthenticatedByThisReader',
    'sourceRevisionCasVerified','productWriterAuthorized',
    'productEditedCopyAuthorized','originalOverwriteAuthorized',
    'automatic2126RepairAuthorized'])assert.equal(r[k],false,k);
};

test('old fixed main SceneItemId TOCTOU has proven false positive; new Source rejects without invoking getter',async()=>{
  const legacyPath=process.env.QA_PR539_PARENT_MODULE;
  assert.ok(legacyPath,'CI must pin a byte-identical old protected main helper, never reconstruct its semantics');
  const old=await import(pathToFileURL(legacyPath).href);
  const p=profile();
  p.World.Villages[1].SceneItemId=1540000001;
  let reads=0;
  Object.defineProperty(p.World.Villages[1],'SceneItemId',{
    configurable:true,enumerable:true,
    get(){return ++reads===1?1540000001:1540000000;}
  });
  const oldResult=old.inspectW1SceneAreaReferences(p,ctx());
  assert.equal(oldResult.status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY',
    'old main accepts a getter that impersonates target Scene only on second read');
  assert.equal(oldResult.villageIndex,1);
  assert.ok(reads>=2);
  reads=0;
  denied(inspect(p,ctx()));
  assert.equal(reads,0,'new Source does not execute untrusted changing Scene getter');
});

test('top-level World and context source revision getters cannot execute to mint an apparent verified source',()=>{
  const p=profile();let hits=0;
  Object.defineProperty(p,'World',{enumerable:true,
    get(){hits++;return profile().World;}});
  denied(inspect(p,ctx()));
  assert.equal(hits,0);
  const c=ctx();let contextHits=0;
  Object.defineProperty(c,'sourceRevision',{enumerable:true,
    get(){contextHits++;return 'source-trusted-by-caller';}});
  denied(inspect(profile(),c));
  assert.equal(contextHits,0);
  const clone=ctx();delete clone.sourceSha256;
  Object.setPrototypeOf(clone,{sourceSha256:'a'.repeat(64)});
  denied(inspect(profile(),clone));
});

test('sparse, inherited, and accessor GridIDs array elements fail closed without invoking getters',()=>{
  const inherited=profile();
  const inheritedIds=new Array(1);
  Object.setPrototypeOf(inheritedIds,Object.assign(Object.create(Array.prototype),{'0':100}));
  inherited.World.Villages[1].Areas['1'].GridIDs=inheritedIds;
  denied(inspect(inherited,ctx()));
  const sparse=profile();
  sparse.World.Villages[1].Areas['1'].GridIDs=Array(1);
  denied(inspect(sparse,ctx()));
  const getter=profile();let calls=0;
  Object.defineProperty(getter.World.Villages[1].Areas['1'].GridIDs,'0',{
    enumerable:true,configurable:true,get(){calls++;return 100;}
  });
  denied(inspect(getter,ctx()));
  assert.equal(calls,0);
});

test('revoked and throwing descriptor Proxy fail closed without any unhandled exception or Writer promotion',()=>{
  const p=profile();
  const revocable=Proxy.revocable(p.World.GridCollection.Grids['100'],{});
  p.World.GridCollection.Grids['100']=revocable.proxy;
  revocable.revoke();
  const result=inspect(p,ctx());
  denied(result);
  assert.equal(result.reason,'SOURCE_OBJECT_DESCRIPTOR_UNSAFE');
  const q=profile();
  q.World.Villages[1].Areas=new Proxy(q.World.Villages[1].Areas,{
    ownKeys(){throw Error('hostile ownKeys trap');}
  });
  const trapped=inspect(q,ctx());
  denied(trapped);
  assert.equal(trapped.reason,'SOURCE_OBJECT_DESCRIPTOR_UNSAFE');
});

test('plain own JSON data preserves overlap/default UNKNOWN and does not mutate source or infer native enum1 area1',()=>{
  const p=profile(),before=JSON.stringify(p);
  const result=inspect(p,ctx());
  readOnly(result);
  assert.equal(result.villageIndex,1);
  assert.equal(result.sourceCandidates.length,1);
  assert.equal(result.sourceCandidates[0].saveAreaKey,'1');
  assert.equal(result.sourceCandidates[0].savedUnlockedRaw,true);
  assert.equal(result.sourceCandidates[0].sourceGridRefs[0].gridId,100);
  assert.equal(result.sourceCandidates[0].sourceGridRefs[0].sourceKind,'GRIDS_AND_DIFF_UNRESOLVED');
  assert.equal(result.sourceCandidates[0].nativeTreeEligibilityVerified,false);
  assert.equal(JSON.stringify(p),before);
});

test('descriptor-ownKeys Proxy must not hide serialized Area record from Source candidate list',()=>{
  const p=profile();
  const original=p.World.Villages[1].Areas;
  original['8']={Unlocked:true,GridIDs:[200]};
  // This is a valid JS Proxy trap for an extensible object with configurable
  // properties. It conceals a real serialized Area from Reflect.ownKeys.
  const concealed=new Proxy(original,{
    ownKeys(){return ['1'];}
  });
  p.World.Villages[1].Areas=concealed;
  const result=inspect(p,ctx());
  denied(result);
});

test('descriptor Proxy may not synthesize an Area own data property absent in the backing object',()=>{
  const p=profile();
  const actual={};
  p.World.Villages[1].Areas=new Proxy(actual,{
    ownKeys(){return ['1'];},
    getOwnPropertyDescriptor(_target,key){
      if(key==='1')return {
        enumerable:true,configurable:true,writable:true,
        value:{Unlocked:true,GridIDs:[100]}
      };
    }
  });
  const result=inspect(p,ctx());
  denied(result);
});
