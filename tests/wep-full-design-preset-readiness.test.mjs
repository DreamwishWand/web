import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFullDesignPresetReadiness, currentV125FullDesignBaseline } from '../src/lib/wep/full-design-preset-readiness.ts';

const complete = () => ({
  directGrids:{status:'complete',evidenceStatus:'CONFIRMED',contract:'x'},
  rootObjects:{status:'complete',evidenceStatus:'CONFIRMED',contract:'x'},
  roads:{status:'complete',evidenceStatus:'CONFIRMED',contract:'x'},
  fences:{status:'complete',evidenceStatus:'CONFIRMED',contract:'x'},
  buildings:{status:'complete',evidenceStatus:'CONFIRMED',contract:'x'},
  environment:{status:'complete',evidenceStatus:'CONFIRMED',contract:'x'}
});

test('Biome uses semantic SceneItemId + AreaType rather than GridID', () => {
  const r=assessFullDesignPresetReadiness({type:'biome',semanticIdentity:{villageSceneItemId:1,villageAreaType:2},coverage:complete()});
  assert.equal(r.ok,true);
  assert.deepEqual(r.semanticIdentity,{villageSceneItemId:1,villageAreaType:2});
  assert.equal(r.applyReady,false);
});

test('Floating Island identity remains Core-owned', () => {
  const r=assessFullDesignPresetReadiness({type:'floating_island',semanticIdentity:{x:1},coverage:complete()});
  assert.equal(r.ok,false);
  assert.equal(r.issues.some((x)=>x.code==='FLOATING_ISLAND_IDENTITY_CONTRACT_UNAVAILABLE'),true);
});

test('Current v1.25 full-design baseline stays blocked', () => {
  const r=currentV125FullDesignBaseline('biome',{villageSceneItemId:1,villageAreaType:2});
  assert.equal(r.ok,false);
  assert.equal(r.issues.some((x)=>x.category==='buildings'),true);
  assert.equal(r.issues.some((x)=>x.category==='environment'),true);
});
