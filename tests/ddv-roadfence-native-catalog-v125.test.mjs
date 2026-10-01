import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROADFENCE_CATALOG_SWITCH_V125_SOURCE,
  ROADFENCE_NATIVE_CATALOG_SWITCH_V125
} from '../src/lib/ddv/core/roadfence/catalog-v125-switch.js';
import {
  ROADFENCE_NATIVE_CATALOG_V125_SCHEMA,
  readRoadFenceNativeGridV125
} from '../src/lib/ddv/core/roadfence/native-reader-v125.js';

test('Switch v1.25 Road/Fence catalog is complete and pinned to 01D canonical query data', () => {
  const catalog = ROADFENCE_NATIVE_CATALOG_SWITCH_V125;
  assert.equal(catalog.schema, ROADFENCE_NATIVE_CATALOG_V125_SCHEMA);
  assert.equal(catalog.version, 1);
  assert.equal(catalog.gameVersion, '1.25.0');
  assert.equal(catalog.platform, 'Nintendo Switch');
  assert.equal(catalog.buildID, '52BD625D9B4E0053');
  assert.equal(catalog.complete, true);
  assert.deepEqual(catalog.coverage, {
    roadFamilies: 49,
    roadPersistentItems: 49,
    fenceFamilies: 24,
    fencePersistentItems: 264
  });
  assert.equal(Object.keys(catalog.roadItems).length, 49);
  assert.equal(Object.keys(catalog.fenceItems).length, 264);
  assert.equal(
    ROADFENCE_CATALOG_SWITCH_V125_SOURCE.queryIndexSha256,
    'f3472e53bfcd55f13249cc79ddeae83ea71168fcb356c7038a0c0935eca2d06e'
  );
});

test('every current Fence family contains one Base, Ext keys 1..6 and DiagExt keys 1..4', () => {
  const byFamily = new Map();
  for (const descriptor of Object.values(ROADFENCE_NATIVE_CATALOG_SWITCH_V125.fenceItems)) {
    const list = byFamily.get(descriptor.familyBaseItemID) ?? [];
    list.push(descriptor);
    byFamily.set(descriptor.familyBaseItemID, list);
  }

  assert.equal(byFamily.size, 24);
  for (const [familyBaseItemID, descriptors] of byFamily) {
    const bases = descriptors.filter((entry) => entry.role === 'base');
    const ext = descriptors.filter((entry) => entry.role === 'ext').map((entry) => entry.key).sort((a,b)=>a-b);
    const diag = descriptors.filter((entry) => entry.role === 'diagExt').map((entry) => entry.key).sort((a,b)=>a-b);
    assert.equal(bases.length, 1, `family ${familyBaseItemID}`);
    assert.equal(bases[0].familyBaseItemID, familyBaseItemID);
    assert.deepEqual(ext, [1,2,3,4,5,6], `family ${familyBaseItemID}`);
    assert.deepEqual(diag, [1,2,3,4], `family ${familyBaseItemID}`);
  }
});

test('canonical catalog directly drives the native reader for confirmed Biome2Fence N=3', () => {
  const grid = {
    ID: 7,
    TessellationFactor: 2,
    Objects: {
      15856: { ID:15856, ItemID:40700246, X:344, Y:60, Orientation:'GridOrientation_Down', State:null },
      15857: { ID:15857, ItemID:40700247, X:344, Y:62, Orientation:'GridOrientation_Left', State:null },
      15858: { ID:15858, ItemID:40700246, X:344, Y:64, Orientation:'GridOrientation_Down', State:null }
    }
  };

  const result = readRoadFenceNativeGridV125({
    grid,
    catalog: ROADFENCE_NATIVE_CATALOG_SWITCH_V125
  });
  assert.equal(result.ok, true);
  assert.equal(result.roads.length, 0);
  assert.equal(result.fences.length, 1);
  assert.equal(result.fences[0].familyBaseItemID, 40700246);
  assert.equal(result.fences[0].logicalQuantity, 3);
});
