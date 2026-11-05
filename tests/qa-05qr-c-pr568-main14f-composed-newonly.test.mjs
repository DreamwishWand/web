import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectW1SceneAreaReferences as inspect,
  W1_SCENE_AREA_REFERENCE_CONTRACT,
  W1_SCENE_AREA_SOURCE
} from '../src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';

// Independent QA of PR568 exact main14f+accepted PR539 TWO Git blobs only.
// Previous Source PR539 independent six/6 QA564 is reused, NOT rerun.
// All inputs are synthetic. No genuine encrypted P1G/native V3/product writer.
const context = () => ({
  platform: 'Nintendo Switch', gameVersion: '1.25.3',
  bid: '9A239D3DB569756D', schema: 626,
  sourceSha256: 'c'.repeat(64), sourceRevision: 'qa-composite-only'
});
const fixture = () => ({
  GameInfo: { Version: 626 },
  World: {
    Villages: [
      { SceneItemId: 1540000000, Areas: {
        '7': { Unlocked: false, GridIDs: [700] },
        '1': { Unlocked: true, GridIDs: [100] }
      }},
      { SceneItemId: 1540000001, Areas: {
        '20': { Unlocked: true, GridIDs: [200] }
      }}
    ],
    GridCollection: {
      Grids: {
        '100': { ID: 100, Objects: {} },
        '700': { ID: 700, Objects: {} },
        '200': { ID: 200, Objects: {} }
      },
      DiffGrids: {
        '100': { ID: 100, ModifiedObjects: {}, RemovedObjects: {} }
      }
    }
  }
});
function assertNoPrivilege(result) {
  for (const key of [
    'actualWetlandAreaVerified', 'nativeEffectiveGridVerified',
    'nativeSoftwoodQuotaVerified', 'nativeProducerConsumerVerified',
    'inputAuthenticatedByThisReader', 'sourceRevisionCasVerified',
    'productWriterAuthorized', 'productEditedCopyAuthorized',
    'originalOverwriteAuthorized', 'automatic2126RepairAuthorized'
  ]) assert.equal(result[key], false, key);
}
function assertRefused(result) {
  assert.equal(result.status, 'SOURCE_STRUCTURE_REJECTED', JSON.stringify(result));
  assertNoPrivilege(result);
}

test('main14f composed 01E export/source contract and normal nested JSON read-only candidate remain exact', () => {
  const p = fixture();
  p.World.Villages[0].Areas['1'].extra = { nested: [null, false, 0, { v: [1, 'ok'] }] };
  const original = JSON.stringify(p);
  const r = inspect(p, context());
  assert.equal(W1_SCENE_AREA_REFERENCE_CONTRACT, 'wand.01e.w1-scene-area-reference@1');
  assert.equal(W1_SCENE_AREA_SOURCE.sourceEventId, 2010000021);
  assert.equal(W1_SCENE_AREA_SOURCE.originalNativeVillageSceneId, 1540000000);
  assert.equal(W1_SCENE_AREA_SOURCE.sourceSoftwoodItemId, 31700014);
  assert.equal(r.status, 'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.deepEqual(r.sourceCandidates.map(x => x.saveAreaKey), ['1', '7']);
  assert.equal(r.sourceCandidates[0].sourceGridRefs[0].sourceKind, 'GRIDS_AND_DIFF_UNRESOLVED');
  assert.equal(r.selectedNativeWetlandAreaKey, null);
  assert.equal(r.nativeClockLastNextVerified, false);
  assert.ok(Object.isFrozen(r.sourceCandidates));
  assertNoPrivilege(r);
  assert.equal(JSON.stringify(p), original);
});

test('current main composition does not allow caller-supplied native/Writer/clock hints to promote Source evidence', () => {
  const p = fixture();
  p.nativeProducerConsumerVerified = true;
  p.productWriterAuthorized = true;
  const r = inspect(p, {...context(), productWriterAuthorized: true,
    sourceRevisionCasVerified: true, nativeClockLastNextVerified: true });
  assert.equal(r.status, 'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
  assert.equal(r.nativeClockLastNextVerified, false);
  assertNoPrivilege(r);
  assertRefused(inspect(p, {...context(), bid: '52BD625D9B4E0053'}));
  assertRefused(inspect(p, {...context(), schema: 624}));
  assertRefused(inspect({...p, GameInfo: {Version: 624}}, context()));
});

test('composed GridIDs Proxy get(length) never mutates caller Scene or GridCollection before rejection', () => {
  const p = fixture(), area = p.World.Villages[0].Areas['1'];
  let calls = 0;
  area.GridIDs = new Proxy([100], { get(target, key, receiver) {
    if (key === 'length') {
      calls++;
      area.Unlocked = false;
      p.World.GridCollection.Grids['100'].ID = 999;
    }
    return Reflect.get(target, key, receiver);
  }});
  const r = inspect(p, context());
  assertRefused(r);
  assert.equal(r.reason, 'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
  assert.equal(calls, 0);
  assert.equal(area.Unlocked, true);
  assert.equal(p.World.GridCollection.Grids['100'].ID, 100);
});

test('composed Village Proxy get(length) does not alter another product-owned source value', () => {
  const p = fixture();
  p.World.localWorkspacePresets = { version: 3, quantity: 2 };
  let calls = 0;
  p.World.Villages = new Proxy(p.World.Villages, { get(target, key, receiver) {
    if (key === 'length') {
      calls++;
      p.World.localWorkspacePresets.quantity = 999;
    }
    return Reflect.get(target, key, receiver);
  }});
  const r = inspect(p, context());
  assert.equal(calls, 0);
  assert.equal(p.World.localWorkspacePresets.quantity, 2);
  assertNoPrivilege(r);
  assert.ok(['SOURCE_STRUCTURE_REJECTED', 'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY'].includes(r.status));
});

test('composed selected Areas nested Proxy array get(length) cannot touch current-area GridIDs', () => {
  const p = fixture(), area = p.World.Villages[0].Areas['1'];
  let calls = 0;
  area.extra = { metadata: new Proxy([null, {ok:true}], { get(target, key, receiver) {
    if (key === 'length') {
      calls++;
      area.GridIDs[0] = 200;
    }
    return Reflect.get(target, key, receiver);
  }}) };
  const r = inspect(p, context());
  assertRefused(r);
  assert.equal(r.reason, 'SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
  assert.equal(calls, 0);
  assert.deepEqual(area.GridIDs, [100]);
});

test('composed source still rejects divergent DiffGrid ID and duplicate scene, without native claims', () => {
  const p = fixture();
  p.World.GridCollection.DiffGrids['100'].ID = 999;
  const a = inspect(p, context());
  assertRefused(a);
  assert.equal(a.reason, 'SOURCE_GRID_MAP_ID_MISMATCH');
  const q = fixture();
  q.World.Villages[1].SceneItemId = 1540000000;
  assertRefused(inspect(q, context()));
});
