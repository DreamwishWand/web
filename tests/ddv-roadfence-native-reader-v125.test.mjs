import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FenceMode,
  buildFencePolyline,
  createFenceNetwork,
  planFenceNativeRepresentation
} from '../src/lib/ddv/core/roadfence/logical.js';
import {
  ROADFENCE_NATIVE_CATALOG_V125_SCHEMA,
  ROADFENCE_NATIVE_READER_V125_SCHEMA,
  captureRoadFenceReaderRegionV125,
  readRoadFenceNativeGridV125
} from '../src/lib/ddv/core/roadfence/native-reader-v125.js';

function catalog() {
  return {
    schema: ROADFENCE_NATIVE_CATALOG_V125_SCHEMA,
    version: 1,
    gameVersion: '1.25.0',
    complete: true,
    roadItems: {
      40100068: {
        familyBaseItemID: 40100068,
        familyName: 'Path_MainStreet'
      }
    },
    fenceItems: {
      40700246: { familyBaseItemID: 40700246, familyName: 'Biome2Fence', role: 'base', gridSizeX: 1, gridSizeY: 1 },
      40700247: { familyBaseItemID: 40700246, familyName: 'Biome2Fence', role: 'ext', key: 1, gridSizeX: 1, gridSizeY: 1 },
      40700248: { familyBaseItemID: 40700246, familyName: 'Biome2Fence', role: 'ext', key: 2, gridSizeX: 2, gridSizeY: 1 },
      40700249: { familyBaseItemID: 40700246, familyName: 'Biome2Fence', role: 'ext', key: 3, gridSizeX: 3, gridSizeY: 1 },
      40700250: { familyBaseItemID: 40700246, familyName: 'Biome2Fence', role: 'ext', key: 4, gridSizeX: 4, gridSizeY: 1 },
      40700251: { familyBaseItemID: 40700246, familyName: 'Biome2Fence', role: 'ext', key: 5, gridSizeX: 5, gridSizeY: 1 },
      40700252: { familyBaseItemID: 40700246, familyName: 'Biome2Fence', role: 'ext', key: 6, gridSizeX: 6, gridSizeY: 1 },
      40700253: { familyBaseItemID: 40700246, familyName: 'Biome2Fence', role: 'diagExt', key: 1, gridSizeX: 1, gridSizeY: 1 },
      40700254: { familyBaseItemID: 40700246, familyName: 'Biome2Fence', role: 'diagExt', key: 2, gridSizeX: 2, gridSizeY: 2 },
      40700255: { familyBaseItemID: 40700246, familyName: 'Biome2Fence', role: 'diagExt', key: 3, gridSizeX: 3, gridSizeY: 3 },
      40700256: { familyBaseItemID: 40700246, familyName: 'Biome2Fence', role: 'diagExt', key: 4, gridSizeX: 4, gridSizeY: 4 }
    }
  };
}

function nativeObject(ID, ItemID, X, Y, Orientation = 'GridOrientation_Down', State = null) {
  return { ID, ItemID, X, Y, Orientation, State };
}

function grid(objects) {
  return {
    ID: 7,
    TessellationFactor: 2,
    Objects: Object.fromEntries(objects.map((object) => [String(object.ID), object]))
  };
}

function diagonalState() {
  return { FenceMode: { Diagonal: true } };
}

test('reader separates cardinal and diagonal Road components and preserves persistent cell modes', () => {
  const result = readRoadFenceNativeGridV125({
    grid: grid([
      nativeObject(1, 40100068, 328, 52),
      nativeObject(2, 40100068, 332, 52),
      nativeObject(3, 40100068, 336, 52),
      nativeObject(4, 40100068, 328, 60, 'GridOrientation_Down', diagonalState()),
      nativeObject(5, 40100068, 332, 60, 'GridOrientation_Down', diagonalState()),
      nativeObject(6, 40100068, 328, 64, 'GridOrientation_Down', diagonalState()),
      nativeObject(7, 40100068, 332, 64, 'GridOrientation_Down', diagonalState())
    ]),
    catalog: catalog()
  });

  assert.equal(result.schema, ROADFENCE_NATIVE_READER_V125_SCHEMA);
  assert.equal(result.ok, true);
  assert.equal(result.roads.length, 2);
  assert.deepEqual(result.roads.map((network) => network.logicalQuantity), [3, 4]);
  assert.equal(result.roads[0].cells.every((cell) => cell.mode === FenceMode.ORTHOGONAL), true);
  assert.equal(result.roads[1].cells.every((cell) => cell.mode === FenceMode.DIAGONAL), true);
  assert.equal(result.persistentWriteAuthorized, false);
  assert.equal(JSON.stringify(result.roads).includes('gridObjectId'), false);
  assert.deepEqual(result.provenance.roads[result.roads[0].networkId].gridObjectIds, [1, 2, 3]);
});

test('reader reconstructs confirmed orthogonal N=9 first-over-max Fence into nine logical vertices', () => {
  const result = readRoadFenceNativeGridV125({
    grid: grid([
      nativeObject(15862, 40700246, 360, 60),
      nativeObject(15863, 40700252, 360, 62, 'GridOrientation_Left'),
      nativeObject(15864, 40700246, 360, 74),
      nativeObject(15865, 40700246, 360, 76)
    ]),
    catalog: catalog()
  });

  assert.equal(result.ok, true);
  assert.equal(result.fences.length, 1);
  const network = result.fences[0];
  assert.equal(network.mode, FenceMode.ORTHOGONAL);
  assert.equal(network.logicalQuantity, 9);
  assert.equal(network.graph.nodes.length, 9);
  assert.equal(network.graph.edges.length, 8);
  assert.deepEqual(result.provenance.fences[network.networkId].gridObjectIds, [15862, 15863, 15864, 15865]);
});

test('reader reconstructs confirmed positive diagonal N=6 maximum Fence', () => {
  const result = readRoadFenceNativeGridV125({
    grid: grid([
      nativeObject(20, 40700246, 368, 80, 'GridOrientation_Down', diagonalState()),
      nativeObject(21, 40700256, 370, 82, 'GridOrientation_Down', diagonalState()),
      nativeObject(22, 40700246, 378, 90, 'GridOrientation_Down', diagonalState())
    ]),
    catalog: catalog()
  });

  assert.equal(result.ok, true);
  assert.equal(result.fences.length, 1);
  const network = result.fences[0];
  assert.equal(network.mode, FenceMode.DIAGONAL);
  assert.equal(network.logicalQuantity, 6);
  assert.equal(network.graph.nodes.length, 6);
  assert.equal(network.graph.edges.length, 5);
});

test('reader round-trips a same-mode orthogonal corner from the forward compiler', () => {
  const built = buildFencePolyline(
    [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }],
    FenceMode.ORTHOGONAL
  );
  const network = createFenceNetwork({
    familyBaseItemID: 40700246,
    graph: built.graph
  }).network;
  const plan = planFenceNativeRepresentation({
    network,
    originSave: { x: 500, y: 100 },
    pitchX: 2,
    pitchY: 2,
    tessellationFactor: 2,
    baseSpanX: 2,
    baseSpanY: 2,
    orthogonalExtensions: {
      1: { itemID: 40700247, gridSizeX: 1, gridSizeY: 1 },
      2: { itemID: 40700248, gridSizeX: 2, gridSizeY: 1 },
      3: { itemID: 40700249, gridSizeX: 3, gridSizeY: 1 },
      4: { itemID: 40700250, gridSizeX: 4, gridSizeY: 1 },
      5: { itemID: 40700251, gridSizeX: 5, gridSizeY: 1 },
      6: { itemID: 40700252, gridSizeX: 6, gridSizeY: 1 }
    },
    diagonalExtensions: {
      1: { itemID: 40700253, gridSizeX: 1, gridSizeY: 1 },
      2: { itemID: 40700254, gridSizeX: 2, gridSizeY: 2 },
      3: { itemID: 40700255, gridSizeX: 3, gridSizeY: 3 },
      4: { itemID: 40700256, gridSizeX: 4, gridSizeY: 4 }
    }
  });
  assert.equal(plan.ok, true);

  const objects = plan.objects.map((object, index) =>
    nativeObject(
      100 + index,
      object.itemID,
      object.x,
      object.y,
      object.orientation,
      object.state
    )
  );
  const result = readRoadFenceNativeGridV125({
    grid: grid(objects),
    catalog: catalog()
  });

  assert.equal(result.ok, true);
  assert.equal(result.fences.length, 1);
  assert.equal(result.fences[0].logicalQuantity, built.graph.nodes.length);
  assert.equal(result.fences[0].graph.edges.length, built.graph.edges.length);
});

test('reader keeps FM01 orthogonal and diagonal sides as separate native-connected networks', () => {
  const result = readRoadFenceNativeGridV125({
    grid: grid([
      nativeObject(15901, 40700246, 400, 60),
      nativeObject(15902, 40700247, 400, 62, 'GridOrientation_Left'),
      nativeObject(15903, 40700246, 400, 64),
      nativeObject(15904, 40700246, 402, 66, 'GridOrientation_Down', diagonalState())
    ]),
    catalog: catalog()
  });

  assert.equal(result.ok, true);
  assert.equal(result.fences.length, 2);
  assert.deepEqual(
    result.fences.map((network) => [network.mode, network.logicalQuantity]),
    [
      [FenceMode.ORTHOGONAL, 3],
      [FenceMode.DIAGONAL, 1]
    ]
  );
  assert.equal(result.modeBoundaryTouches.length, 1);
  assert.equal(result.modeBoundaryTouches[0].authoritativeConnectedEdge, false);
  assert.equal(result.modeBoundaryTouches[0].classification, 'geometric-cross-mode-touch');
  assert.equal(JSON.stringify(result.fences).includes('1590'), false);
});

test('reader fails closed when a persistent Fence variation cannot resolve unique Base endpoints', () => {
  const result = readRoadFenceNativeGridV125({
    grid: grid([
      nativeObject(30, 40700246, 600, 60),
      nativeObject(31, 40700247, 700, 70, 'GridOrientation_Left')
    ]),
    catalog: catalog()
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.fences.length, 0);
  assert.equal(
    result.issues.some((issue) => issue.code === 'FENCE_NATIVE_EXTENSION_ENDPOINTS_UNRESOLVED'),
    true
  );
});

test('reader ignores non-Road/Fence native objects and never upgrades read support into writer authorization', () => {
  const result = readRoadFenceNativeGridV125({
    grid: grid([
      nativeObject(40, 12345678, 20, 20),
      nativeObject(41, 40100068, 328, 52)
    ]),
    catalog: catalog()
  });

  assert.equal(result.ok, true);
  assert.equal(result.coverage.matchedNativeObjectCount, 1);
  assert.equal(result.roads.length, 1);
  assert.equal(result.fences.length, 0);
  assert.equal(result.persistentWriteAuthorized, false);
});


test('contained-only Road capture localizes a full component to Capture Region coordinates', () => {
  const reader = readRoadFenceNativeGridV125({
    grid: grid([
      nativeObject(1, 40100068, 328, 60, 'GridOrientation_Down', diagonalState()),
      nativeObject(2, 40100068, 332, 60, 'GridOrientation_Down', diagonalState()),
      nativeObject(3, 40100068, 328, 64, 'GridOrientation_Down', diagonalState()),
      nativeObject(4, 40100068, 332, 64, 'GridOrientation_Down', diagonalState())
    ]),
    catalog: catalog()
  });
  const capture = captureRoadFenceReaderRegionV125(
    reader,
    'roads',
    { x: 328, y: 60, w: 8, h: 8 }
  );

  assert.equal(capture.status, 'supported');
  assert.equal(capture.data.schema, 'dreamwish-wand-wep-network-capture');
  assert.equal(capture.data.kind, 'roads');
  assert.equal(capture.data.originPolicy, 'capture-region-top-left');
  assert.deepEqual(capture.data.networks, [{
    networkId: 'r0',
    familyBaseItemID: 40100068,
    familyName: 'Path_MainStreet',
    cells: [
      { x: 0, y: 0, mode: FenceMode.DIAGONAL },
      { x: 4, y: 0, mode: FenceMode.DIAGONAL },
      { x: 0, y: 4, mode: FenceMode.DIAGONAL },
      { x: 4, y: 4, mode: FenceMode.DIAGONAL }
    ]
  }]);
  assert.equal(JSON.stringify(capture.data).includes('gridObjectId'), false);
  assert.equal(capture.data.persistentWriteAuthorized, false);
});

test('contained-only topology capture blocks a clipped Road component', () => {
  const reader = readRoadFenceNativeGridV125({
    grid: grid([
      nativeObject(1, 40100068, 328, 60, 'GridOrientation_Down', diagonalState()),
      nativeObject(2, 40100068, 332, 60, 'GridOrientation_Down', diagonalState()),
      nativeObject(3, 40100068, 328, 64, 'GridOrientation_Down', diagonalState()),
      nativeObject(4, 40100068, 332, 64, 'GridOrientation_Down', diagonalState())
    ]),
    catalog: catalog()
  });
  const capture = captureRoadFenceReaderRegionV125(
    reader,
    'roads',
    { x: 328, y: 60, w: 4, h: 8 }
  );

  assert.equal(capture.status, 'blocked');
  assert.equal(capture.code, 'TOPOLOGY_CLIPPED_UNSUPPORTED');
  assert.equal(
    capture.issues.every((issue) => issue.code === 'TOPOLOGY_CLIPPED_UNSUPPORTED'),
    true
  );
});

test('contained-only Fence capture emits portable nN identity and preserves FM01 touch as non-connectivity', () => {
  const reader = readRoadFenceNativeGridV125({
    grid: grid([
      nativeObject(15901, 40700246, 400, 60),
      nativeObject(15902, 40700247, 400, 62, 'GridOrientation_Left'),
      nativeObject(15903, 40700246, 400, 64),
      nativeObject(15904, 40700246, 402, 66, 'GridOrientation_Down', diagonalState())
    ]),
    catalog: catalog()
  });

  const capture = captureRoadFenceReaderRegionV125(
    reader,
    'fences',
    { x: 400, y: 60, w: 4, h: 8 }
  );
  assert.equal(capture.status, 'supported');
  assert.equal(capture.data.networks.length, 2);
  assert.deepEqual(
    capture.data.networks.map((network) => [
      network.networkId,
      network.mode,
      network.graph.nodes.length
    ]),
    [
      ['f0', FenceMode.ORTHOGONAL, 3],
      ['f1', FenceMode.DIAGONAL, 1]
    ]
  );
  assert.deepEqual(
    capture.data.networks[0].graph.nodes.map((node) => [node.id, node.x, node.y]),
    [['n0',0,0],['n1',0,2],['n2',0,4]]
  );
  assert.equal(capture.data.modeBoundaryTouches.length, 1);
  assert.equal(capture.data.modeBoundaryTouches[0].authoritativeConnectedEdge, false);
  assert.deepEqual(
    [capture.data.modeBoundaryTouches[0].a.networkId, capture.data.modeBoundaryTouches[0].b.networkId],
    ['f0','f1']
  );
  assert.equal(JSON.stringify(capture.data).includes('1590'), false);
});

test('contained-only Fence capture blocks when an intersecting native component crosses the region boundary', () => {
  const reader = readRoadFenceNativeGridV125({
    grid: grid([
      nativeObject(15862, 40700246, 360, 60),
      nativeObject(15863, 40700252, 360, 62, 'GridOrientation_Left'),
      nativeObject(15864, 40700246, 360, 74),
      nativeObject(15865, 40700246, 360, 76)
    ]),
    catalog: catalog()
  });

  const capture = captureRoadFenceReaderRegionV125(
    reader,
    'fences',
    { x: 360, y: 60, w: 2, h: 10 }
  );
  assert.equal(capture.status, 'blocked');
  assert.equal(capture.code, 'TOPOLOGY_CLIPPED_UNSUPPORTED');
});
