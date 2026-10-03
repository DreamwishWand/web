import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FenceRepresentationPolicy,
  RoadFencePersistentOperation,
  RoadFenceWriterSupportStatus,
  compileFenceMutationV125,
  compileFenceNetworkBatchV125,
  compileRoadMutationV125,
  roadFencePersistentCompilerMetadataV125,
  roadFenceStructuralTransactionExtensionRequestV125
} from '../src/lib/ddv/core/roadfence/persistent-compiler-v125.js';
import {
  FenceMode,
  buildFenceRectangleOutline
} from '../src/lib/ddv/core/roadfence/logical.js';
import { ROADFENCE_NATIVE_CATALOG_SWITCH_V125 } from '../src/lib/ddv/core/roadfence/catalog-v125-switch.js';
import { readRoadFenceNativeGridV125 } from '../src/lib/ddv/core/roadfence/native-reader-v125.js';
import {
  fenceLogicalTopologyFingerprint
} from '../src/lib/ddv/core/roadfence/representation-layout-v125.ts';
import {
  BUILD_V125_SWITCH,
  applyMutation,
  lineFence,
  makeGrid,
  makeObject,
  orthogonalRectCells,
  generatedFenceLayoutRequest,
  roadNetwork,
  straightFenceLayout
} from './helpers/ddv-roadfence-persistent-v125-fixtures.mjs';

function compileRoad({
  source = makeGrid(),
  sourceObjectIds = [],
  sourceNetwork = null,
  desiredNetwork,
  operation = RoadFencePersistentOperation.ROAD_SET_TOPOLOGY,
  transform = { originSave: { x: 0, y: 0 }, pitchX: 4 }
}) {
  return compileRoadMutationV125({
    buildIdentity: BUILD_V125_SWITCH,
    sourceGrid: source,
    sourceObjectIds,
    sourceNetwork,
    desiredNetwork,
    operation,
    transform,
    targetSurfaceValidated: true
  });
}

function compileFence({
  source = makeGrid(),
  sourceObjectIds = [],
  sourceNetwork = null,
  desiredNetwork,
  representationLayout = generatedFenceLayoutRequest(),
  operation = RoadFencePersistentOperation.FENCE_SET_TOPOLOGY,
  transform = { originSave: { x: 0, y: 0 }, pitchX: 2, pitchY: 2 }
}) {
  return compileFenceMutationV125({
    buildIdentity: BUILD_V125_SWITCH,
    sourceGrid: source,
    sourceObjectIds,
    sourceNetwork,
    desiredNetwork,
    representationLayout,
    operation,
    transform,
    targetSurfaceValidated: true
  });
}

function sourceFrom(result, base = makeGrid([], 100)) {
  return applyMutation(base, result);
}

function diagonalCornerQ5() {
  return {
    familyBaseItemID: 40700246,
    graph: {
      nodes: [
        { id: 'a', x: 0, y: 0, mode: FenceMode.DIAGONAL },
        { id: 'b', x: 1, y: 1, mode: FenceMode.DIAGONAL },
        { id: 'c', x: 2, y: 2, mode: FenceMode.DIAGONAL },
        { id: 'd', x: 3, y: 1, mode: FenceMode.DIAGONAL },
        { id: 'e', x: 4, y: 0, mode: FenceMode.DIAGONAL }
      ],
      edges: [
        { a: 'a', b: 'b' },
        { a: 'b', b: 'c' },
        { a: 'c', b: 'd' },
        { a: 'd', b: 'e' }
      ]
    }
  };
}

function diagonalCornerQ7() {
  return {
    familyBaseItemID: 40700246,
    graph: {
      nodes: [
        { id: 'a', x: 0, y: 0, mode: FenceMode.DIAGONAL },
        { id: 'b', x: 1, y: 1, mode: FenceMode.DIAGONAL },
        { id: 'c', x: 2, y: 2, mode: FenceMode.DIAGONAL },
        { id: 'd', x: 3, y: 3, mode: FenceMode.DIAGONAL },
        { id: 'e', x: 4, y: 2, mode: FenceMode.DIAGONAL },
        { id: 'f', x: 5, y: 1, mode: FenceMode.DIAGONAL },
        { id: 'g', x: 6, y: 0, mode: FenceMode.DIAGONAL }
      ],
      edges: [
        { a: 'a', b: 'b' },
        { a: 'b', b: 'c' },
        { a: 'c', b: 'd' },
        { a: 'd', b: 'e' },
        { a: 'e', b: 'f' },
        { a: 'f', b: 'g' }
      ]
    }
  };
}

function fm01Network() {
  return {
    familyBaseItemID: 40700246,
    graph: {
      nodes: [
        { id: 'a', x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
        { id: 'm', x: 0, y: 1, mode: FenceMode.ORTHOGONAL },
        { id: 'p', x: 0, y: 2, mode: FenceMode.ORTHOGONAL },
        { id: 'c', x: 1, y: 3, mode: FenceMode.DIAGONAL }
      ],
      edges: [
        { a: 'a', b: 'm' },
        { a: 'm', b: 'p' },
        { a: 'p', b: 'c' }
      ]
    }
  };
}

test('metadata exposes structural dependency without enabling Apply', () => {
  const meta = roadFencePersistentCompilerMetadataV125();
  assert.equal(meta.compilerProducesStructuralMutationSet, true);
  assert.equal(meta.bindsToCurrent01aWriteCandidate, false);
  assert.equal(meta.structuralTransactionDependency, 'DDV-SAFE-STRUCTURAL-GRID-OBJECT-TRANSACTION-EXTENSION-V125-V1_0');
  assert.equal(meta.persistentWriteAuthorized, false);
  assert.equal(meta.WORLD_PERSISTENT_WRITE_V125, false);
  assert.equal(meta.productApplyAuthorized, false);
});

test('01A extension request is minimal declared identity-delta support', () => {
  const request = roadFenceStructuralTransactionExtensionRequestV125();
  assert.equal(request.minimumAdditiveCapability.capability, 'STRUCTURAL_WRITE_CANDIDATE');
  assert.equal(request.minimumAdditiveCapability.identityPolicy, 'ALLOW_DECLARED_GRID_OBJECT_SET_DELTA');
  assert.ok(request.minimumAdditiveCapability.verification.includes('deleted IDs are never reused'));
  assert.ok(request.explicitlyNotRequested.includes('arbitrary JSON patch'));
  assert.equal(request.persistentWriteAuthorized, false);
});

test('Road 5x5 orthogonal region is deterministic and reader-round-trips', () => {
  const desired = roadNetwork(40100068, orthogonalRectCells(0, 0, 4, 4));
  const a = compileRoad({ desiredNetwork: desired });
  const b = compileRoad({ desiredNetwork: desired });
  assert.equal(a.ok, true);
  assert.equal(a.support.status, RoadFenceWriterSupportStatus.ROAD_CONFIRMED_WRITABLE);
  assert.deepEqual(a, b);
  assert.equal(a.logicalQuantity.after, 25);
  assert.equal(a.nativeObjectCount.after, 25);
  assert.deepEqual(a.createdObjectIdentities, Array.from({ length: 25 }, (_, index) => 100 + index));
  assert.deepEqual(a.nextGridObjectID, { before: 100, after: 125 });

  const output = applyMutation(makeGrid(), a);
  const read = readRoadFenceNativeGridV125({
    grid: output,
    catalog: ROADFENCE_NATIVE_CATALOG_SWITCH_V125
  });
  assert.equal(read.ok, true);
  assert.equal(read.roads.length, 1);
  assert.equal(read.roads[0].logicalQuantity, 25);
});

test('Road hollow 9x9 ring is confirmed writable', () => {
  const result = compileRoad({
    desiredNetwork: roadNetwork(40100068, orthogonalRectCells(0, 0, 8, 8, true))
  });
  assert.equal(result.ok, true);
  assert.equal(result.logicalQuantity.after, 32);
  assert.equal(result.support.reason, 'ROAD_ORTHOGONAL_CELL_GRAPH_CONFIRMED');
});

test('Path_Gold q9 merge requires and preserves an exact native same-family seed', () => {
  const source = makeGrid([
    makeObject(4, 40100038, 0, 0, 'GridOrientation_Down', null, { Opaque: { keep: true } })
  ], 5);
  const desired = roadNetwork(40100038, orthogonalRectCells(0, 0, 2, 2));
  const result = compileRoad({
    source,
    sourceObjectIds: [4],
    desiredNetwork: desired,
    operation: RoadFencePersistentOperation.ROAD_SAME_FAMILY_MERGE
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.preservedObjectIdentities, [4]);
  assert.equal(result.preservedObjects[0].sourceObject.Opaque.keep, true);
  assert.equal(result.createdObjectIdentities.length, 8);

  const missingSeed = compileRoad({
    source: makeGrid([makeObject(4, 40100038, 40, 40)], 5),
    sourceObjectIds: [4],
    desiredNetwork: desired,
    operation: RoadFencePersistentOperation.ROAD_SAME_FAMILY_MERGE
  });
  assert.equal(missingSeed.ok, false);
  assert.equal(missingSeed.failClosedReason.code, 'ROAD_NATIVE_SEED_NOT_PRESERVED');
});

test('confirmed positive mixed Road q5 passes; mirrored q5 remains runtime-required', () => {
  const positive = roadNetwork(40100068, [
    { x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
    { x: 1, y: 0, mode: FenceMode.DIAGONAL },
    { x: 2, y: 0, mode: FenceMode.DIAGONAL },
    { x: 1, y: 1, mode: FenceMode.DIAGONAL },
    { x: 2, y: 1, mode: FenceMode.DIAGONAL }
  ]);
  const pass = compileRoad({ desiredNetwork: positive });
  assert.equal(pass.ok, true);
  assert.equal(pass.support.reason, 'ROAD_POSITIVE_MIXED_Q5_CONFIRMED');

  const mirrored = roadNetwork(40100068, [
    { x: 0, y: 1, mode: FenceMode.ORTHOGONAL },
    { x: 1, y: 1, mode: FenceMode.DIAGONAL },
    { x: 2, y: 1, mode: FenceMode.DIAGONAL },
    { x: 1, y: 0, mode: FenceMode.DIAGONAL },
    { x: 2, y: 0, mode: FenceMode.DIAGONAL }
  ]);
  const blocked = compileRoad({ desiredNetwork: mirrored });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, RoadFenceWriterSupportStatus.RUNTIME_REQUIRED);
});

test('transform pitch cannot mirror or rescale the evidence-backed writer class', () => {
  const desired = roadNetwork(40100068, [{ x: 0, y: 0, mode: FenceMode.ORTHOGONAL }]);
  const negative = compileRoad({
    desiredNetwork: desired,
    transform: { originSave: { x: 0, y: 0 }, pitchX: 4, pitchY: -4 }
  });
  assert.equal(negative.ok, false);
  assert.equal(negative.failClosedReason.code, 'ROADFENCE_INVALID_GRID_QUANTUM');

  const wrongScale = compileRoad({
    desiredNetwork: desired,
    transform: { originSave: { x: 0, y: 0 }, pitchX: 2, pitchY: 2 }
  });
  assert.equal(wrongScale.ok, false);
  assert.equal(wrongScale.failClosedReason.code, 'ROADFENCE_INVALID_GRID_QUANTUM');
});

test('Road erase preserves surviving exact IDs and never reuses a deleted ID', () => {
  const source = makeGrid([
    makeObject(10, 40100068, 0, 0),
    makeObject(11, 40100068, 4, 0, 'GridOrientation_Down', null, { Unknown: 77 }),
    makeObject(12, 40100068, 8, 0)
  ], 20);
  const result = compileRoad({
    source,
    sourceObjectIds: [10, 11, 12],
    desiredNetwork: roadNetwork(40100068, [
      { x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
      { x: 1, y: 0, mode: FenceMode.ORTHOGONAL }
    ]),
    operation: RoadFencePersistentOperation.ROAD_ERASE
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.preservedObjectIdentities, [10, 11]);
  assert.deepEqual(result.deletedObjectIdentities, [12]);
  assert.deepEqual(result.createdObjectIdentities, []);
  assert.deepEqual(result.nextGridObjectID, { before: 20, after: 20 });
});

test('source family replacement cannot bypass the explicit writer operation', () => {
  const roadSource = makeGrid([makeObject(10, 40100038, 0, 0)], 20);
  const roadBlocked = compileRoad({
    source: roadSource,
    sourceObjectIds: [10],
    desiredNetwork: roadNetwork(40100068, [{ x: 0, y: 0, mode: FenceMode.ORTHOGONAL }])
  });
  assert.equal(roadBlocked.ok, false);
  assert.equal(roadBlocked.failClosedReason.code, 'ROAD_SOURCE_OBJECT_FAMILY_MISMATCH');

  const fenceSource = makeGrid([makeObject(10, 40700268, 0, 0)], 20);
  const fenceBlocked = compileFence({
    source: fenceSource,
    sourceObjectIds: [10],
    desiredNetwork: lineFence(1)
  });
  assert.equal(fenceBlocked.ok, false);
  assert.equal(fenceBlocked.failClosedReason.code, 'FENCE_SOURCE_OBJECT_FAMILY_MISMATCH');
});

test('source object-map key integrity and monotonic NextGridObjectID are mandatory', () => {
  const badKey = makeGrid([makeObject(10, 40100068, 0, 0)], 20);
  badKey.Objects['9'] = badKey.Objects['10'];
  delete badKey.Objects['10'];
  const keyBlocked = compileRoad({
    source: badKey,
    desiredNetwork: roadNetwork(40100068, [{ x: 0, y: 0, mode: FenceMode.ORTHOGONAL }])
  });
  assert.equal(keyBlocked.ok, false);
  assert.equal(keyBlocked.failClosedReason.code, 'ROADFENCE_SOURCE_OBJECT_MAP_KEY_MISMATCH');

  const staleCounter = makeGrid([makeObject(150, 12345678, 900, 900)], 100);
  const counterBlocked = compileRoad({
    source: staleCounter,
    desiredNetwork: roadNetwork(40100068, [{ x: 0, y: 0, mode: FenceMode.ORTHOGONAL }])
  });
  assert.equal(counterBlocked.ok, false);
  assert.equal(counterBlocked.failClosedReason.code, 'GRIDOBJECT_ID_ALLOCATION_INVALID');
});

test('duplicate Road coordinate and unrelated Road/Fence anchor fail closed', () => {
  const duplicate = compileRoad({
    desiredNetwork: roadNetwork(40100068, [
      { x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
      { x: 0, y: 0, mode: FenceMode.ORTHOGONAL }
    ])
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.failClosedReason.code, 'ROAD_CELL_VALIDATION_FAILED');

  const occupied = compileRoad({
    source: makeGrid([makeObject(90, 40700246, 0, 0)], 100),
    desiredNetwork: roadNetwork(40100068, [{ x: 0, y: 0, mode: FenceMode.ORTHOGONAL }])
  });
  assert.equal(occupied.ok, false);
  assert.equal(occupied.failClosedReason.code, 'ROADFENCE_UNRELATED_COORDINATE_OCCUPIED');
});

test('Fence q33 exact captured layout round-trips without identity churn', () => {
  const network = lineFence(33);
  const layout = straightFenceLayout(33, [7, 14, 21, 28]);
  const first = compileFence({ desiredNetwork: network, representationLayout: layout });
  assert.equal(first.ok, true);
  assert.equal(first.logicalQuantity.after, 33);
  assert.equal(first.nativeObjectCount.after, 11);

  const source = sourceFrom(first);
  const again = compileFence({
    source,
    sourceObjectIds: first.createdObjectIdentities,
    sourceNetwork: network,
    desiredNetwork: network,
    representationLayout: layout
  });
  assert.equal(again.ok, true);
  assert.deepEqual(again.preservedObjectIdentities, first.createdObjectIdentities);
  assert.deepEqual(again.createdObjectIdentities, []);
  assert.deepEqual(again.deletedObjectIdentities, []);

  const read = readRoadFenceNativeGridV125({
    grid: source,
    catalog: ROADFENCE_NATIVE_CATALOG_SWITCH_V125
  });
  assert.equal(read.ok, true);
  assert.equal(read.fences[0].logicalQuantity, 33);
});

test('Fence q33 alternative partition changes representation but not topology/quantity', () => {
  const network = lineFence(33);
  const first = compileFence({
    desiredNetwork: network,
    representationLayout: straightFenceLayout(33, [7, 14, 21, 28])
  });
  const source = sourceFrom(first);
  const changed = compileFence({
    source,
    sourceObjectIds: first.createdObjectIdentities,
    sourceNetwork: network,
    desiredNetwork: network,
    representationLayout: straightFenceLayout(
      33,
      [6, 13, 19, 26],
      FenceRepresentationPolicy.EXPLICIT_USER_LAYOUT
    ),
    operation: RoadFencePersistentOperation.FENCE_MOVE_POST
  });
  assert.equal(changed.ok, true);
  assert.deepEqual(changed.logicalQuantity, { before: 33, after: 33 });
  assert.deepEqual(changed.nativeObjectCount, { before: 11, after: 11 });
  assert.ok(changed.deletedObjectIdentities.length > 0);
  assert.ok(changed.createdObjectIdentities.every((id) => id >= first.nextGridObjectID.after));
  assert.equal(changed.quantityInvariant.wandInventoryDelta, 0);
});

test('Fence MOVE_POST, INSERT_POST and REMOVE_POST preserve logical quantity', () => {
  const network = lineFence(21);
  const original = compileFence({
    desiredNetwork: network,
    representationLayout: straightFenceLayout(21, [7, 14])
  });
  const source = sourceFrom(original);

  const moved = compileFence({
    source,
    sourceObjectIds: original.createdObjectIdentities,
    sourceNetwork: network,
    desiredNetwork: network,
    representationLayout: straightFenceLayout(21, [6, 13], FenceRepresentationPolicy.EXPLICIT_USER_LAYOUT),
    operation: RoadFencePersistentOperation.FENCE_MOVE_POST
  });
  assert.equal(moved.ok, true);
  assert.equal(moved.logicalQuantity.before, moved.logicalQuantity.after);

  const inserted = compileFence({
    source,
    sourceObjectIds: original.createdObjectIdentities,
    sourceNetwork: network,
    desiredNetwork: network,
    representationLayout: straightFenceLayout(21, [7, 14, 18], FenceRepresentationPolicy.EXPLICIT_USER_LAYOUT),
    operation: RoadFencePersistentOperation.FENCE_INSERT_POST
  });
  assert.equal(inserted.ok, true);
  assert.equal(inserted.logicalQuantity.after, 21);

  const removeOriginal = compileFence({
    source: makeGrid([], 300),
    desiredNetwork: network,
    representationLayout: straightFenceLayout(21, [6, 13, 19])
  });
  const removeSource = applyMutation(makeGrid([], 300), removeOriginal);
  const removed = compileFence({
    source: removeSource,
    sourceObjectIds: removeOriginal.createdObjectIdentities,
    sourceNetwork: network,
    desiredNetwork: network,
    representationLayout: straightFenceLayout(21, [6, 13], FenceRepresentationPolicy.EXPLICIT_USER_LAYOUT),
    operation: RoadFencePersistentOperation.FENCE_REMOVE_POST
  });
  assert.equal(removed.ok, true);
  assert.equal(removed.logicalQuantity.after, 21);
});

test('Fence representation edits reject over-max spans, semantic anchors and topology change', () => {
  const overMax = compileFence({
    desiredNetwork: lineFence(9),
    representationLayout: straightFenceLayout(
      9,
      [],
      FenceRepresentationPolicy.EXPLICIT_USER_LAYOUT
    )
  });
  assert.equal(overMax.ok, false);
  assert.equal(overMax.failClosedReason.code, 'FENCE_POST_INTERVAL_OVER_MAX');

  const corner = {
    familyBaseItemID: 40700246,
    graph: {
      nodes: [
        { id: 'a', x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
        { id: 'b', x: 1, y: 0, mode: FenceMode.ORTHOGONAL },
        { id: 'c', x: 2, y: 0, mode: FenceMode.ORTHOGONAL },
        { id: 'd', x: 2, y: 1, mode: FenceMode.ORTHOGONAL },
        { id: 'e', x: 2, y: 2, mode: FenceMode.ORTHOGONAL }
      ],
      edges: [
        { a: 'a', b: 'b' },
        { a: 'b', b: 'c' },
        { a: 'c', b: 'd' },
        { a: 'd', b: 'e' }
      ]
    }
  };
  const endpointModel = straightFenceLayout(
    3,
    [],
    FenceRepresentationPolicy.EXPLICIT_USER_LAYOUT
  );
  endpointModel.representationLayout.posts.push({
    kind: 'DEGREE2_INTERIOR_POST',
    nodeId: 'n0',
    runId: 'run:0',
    x: 0,
    y: 0,
    pinned: true,
    source: 'MANUAL'
  });
  const anchorBlocked = compileFence({
    desiredNetwork: lineFence(3),
    representationLayout: endpointModel
  });
  assert.equal(anchorBlocked.ok, false);
  assert.equal(
    anchorBlocked.failClosedReason.code,
    'FENCE_REPRESENTATION_LAYOUT_INVALID'
  );

  const topologyBlocked = compileFence({
    sourceNetwork: lineFence(4),
    desiredNetwork: lineFence(5),
    representationLayout: straightFenceLayout(5, []),
    operation: RoadFencePersistentOperation.FENCE_MOVE_POST
  });
  assert.equal(topologyBlocked.ok, false);
  assert.equal(topologyBlocked.failClosedReason.code, 'FENCE_POST_LAYOUT_TOPOLOGY_CHANGED');
});

test('confirmed orthogonal closed rectangle compiles and reader-round-trips', () => {
  const built = buildFenceRectangleOutline({ minX: 0, minY: 0, maxX: 8, maxY: 4 });
  const network = { familyBaseItemID: 40700246, graph: built.graph };
  const result = compileFence({ desiredNetwork: network });
  assert.equal(result.ok, true);
  assert.equal(result.support.status, RoadFenceWriterSupportStatus.FENCE_CONFIRMED_WRITABLE);
  const output = applyMutation(makeGrid(), result);
  const read = readRoadFenceNativeGridV125({
    grid: output,
    catalog: ROADFENCE_NATIVE_CATALOG_SWITCH_V125
  });
  assert.equal(read.ok, true);
  assert.equal(read.fences.length, 1);
  assert.equal(read.fences[0].logicalQuantity, network.graph.nodes.length);
});

test('confirmed diagonal N3 both slopes and positive N6 compile; unpromoted negative N6 does not', () => {
  const positiveN3 = compileFence({ desiredNetwork: lineFence(3, FenceMode.DIAGONAL) });
  assert.equal(positiveN3.ok, true);

  const negativeN3Network = {
    familyBaseItemID: 40700246,
    graph: {
      nodes: [
        { id: 'n0', x: 0, y: 2, mode: FenceMode.DIAGONAL },
        { id: 'n1', x: 1, y: 1, mode: FenceMode.DIAGONAL },
        { id: 'n2', x: 2, y: 0, mode: FenceMode.DIAGONAL }
      ],
      edges: [{ a: 'n0', b: 'n1' }, { a: 'n1', b: 'n2' }]
    }
  };
  assert.equal(compileFence({ desiredNetwork: negativeN3Network }).ok, true);
  assert.equal(compileFence({ desiredNetwork: lineFence(6, FenceMode.DIAGONAL) }).ok, true);

  const negativeN6 = {
    familyBaseItemID: 40700246,
    graph: {
      nodes: Array.from({ length: 6 }, (_, i) => ({ id: 'n' + i, x: i, y: 5 - i, mode: FenceMode.DIAGONAL })),
      edges: Array.from({ length: 5 }, (_, i) => ({ a: 'n' + i, b: 'n' + (i + 1) }))
    }
  };
  const blocked = compileFence({ desiredNetwork: negativeN6 });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, RoadFenceWriterSupportStatus.RUNTIME_REQUIRED);
});

test('diagonal 90-degree writer class is constrained to the confirmed q5 corner', () => {
  const q5 = compileFence({ desiredNetwork: diagonalCornerQ5() });
  assert.equal(q5.ok, true);
  assert.equal(q5.support.reason, 'FENCE_DIAGONAL_90_CORNER_Q5_CONFIRMED');

  const q7 = compileFence({ desiredNetwork: diagonalCornerQ7() });
  assert.equal(q7.ok, false);
  assert.equal(q7.status, RoadFenceWriterSupportStatus.RUNTIME_REQUIRED);
});

test('FM01 materializes the orthogonal q3 plus singleton diagonal Base exactly', () => {
  const result = compileFence({ desiredNetwork: fm01Network() });
  assert.equal(result.ok, true);
  assert.equal(result.support.reason, 'FENCE_FM01_MODE_BOUNDARY_CONFIRMED');
  assert.equal(result.logicalQuantity.after, 4);
  assert.equal(result.nativeObjectCount.after, 4);
  const descriptors = result.resultingNativeDescriptors.map((entry) => entry.descriptor);
  assert.equal(descriptors.filter((entry) => entry.role === 'base').length, 3);
  assert.equal(descriptors.filter((entry) => entry.role === 'ext').length, 1);
  assert.equal(
    descriptors.some((entry) => entry.role === 'base' && entry.state?.FenceMode?.Diagonal === true),
    true
  );
});

test('confirmed Biome2Fence to FairyLightFence N3 style replacement is explicit and inventory-invariant', () => {
  const sourceNetwork = lineFence(3, FenceMode.ORTHOGONAL, 40700246);
  const sourceCompile = compileFence({ desiredNetwork: sourceNetwork });
  const source = sourceFrom(sourceCompile);
  const target = lineFence(3, FenceMode.ORTHOGONAL, 40700268);
  const result = compileFence({
    source,
    sourceObjectIds: sourceCompile.createdObjectIdentities,
    sourceNetwork,
    desiredNetwork: target,
    operation: RoadFencePersistentOperation.FENCE_STYLE_REPLACE
  });
  assert.equal(result.ok, true);
  assert.equal(result.support.reason, 'FENCE_FRP01_STYLE_REPLACEMENT_CONFIRMED');
  assert.deepEqual(result.deletedObjectIdentities, sourceCompile.createdObjectIdentities);
  assert.equal(result.createdObjectIdentities.length, 3);
  assert.equal(result.quantityInvariant.wandInventoryDelta, 0);
  assert.equal(result.preservation.listInventory, 'EXACT_UNCHANGED');
  assert.equal(result.preservation.collection, 'EXACT_UNCHANGED');
  assert.equal(result.preservation.entitlement, 'EXACT_UNCHANGED');
});

test('other Fence family structural generation remains runtime-required', () => {
  const result = compileFence({
    desiredNetwork: lineFence(3, FenceMode.ORTHOGONAL, 40700000)
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, RoadFenceWriterSupportStatus.RUNTIME_REQUIRED);
});

test('structural output declares only owned object roots and NextGridObjectID', () => {
  const result = compileRoad({
    desiredNetwork: roadNetwork(40100068, [
      { x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
      { x: 1, y: 0, mode: FenceMode.ORTHOGONAL }
    ])
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.allowedSemanticPaths, [
    '/World/GridCollection/Grids/7/NextGridObjectID',
    '/World/GridCollection/Grids/7/Objects/100',
    '/World/GridCollection/Grids/7/Objects/101'
  ]);
  assert.equal(result.allowedSemanticPaths.some((path) => path.includes('ListInventories')), false);
  assert.equal(result.allowedSemanticPaths.some((path) => path.includes('GameInfo')), false);
});

test('unrelated GridObject and opaque Grid metadata survive application unchanged', () => {
  const unrelated = makeObject(77, 12345678, 900, 900, 'GridOrientation_Down', null, {
    Opaque: { secret: 'keep' }
  });
  const source = makeGrid([unrelated], 100);
  const result = compileRoad({
    source,
    desiredNetwork: roadNetwork(40100068, [
      { x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
      { x: 1, y: 0, mode: FenceMode.ORTHOGONAL }
    ])
  });
  const output = applyMutation(source, result);
  assert.deepEqual(output.Objects['77'], unrelated);
  assert.deepEqual(output.OpaqueGridField, { keep: 'yes' });
  assert.equal(output.Objects['100'].ID, 100);
  assert.equal(output.Objects['101'].ID, 101);
  assert.equal(Object.values(output.Objects).filter((entry) => entry.ID === 100).length, 1);
  assert.equal(Object.values(output.Objects).filter((entry) => entry.ID === 101).length, 1);
});

test('Fence writer requires an explicit representation contract; no implicit greedy layout', () => {
  const network = lineFence(3);
  const result = compileFenceMutationV125({
    buildIdentity: BUILD_V125_SWITCH,
    sourceGrid: makeGrid(),
    desiredNetwork: network,
    representationLayout: null,
    transform: { originSave: { x: 0, y: 0 }, pitchX: 2, pitchY: 2 },
    targetSurfaceValidated: true
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.failClosedReason.code,
    'FENCE_REPRESENTATION_LAYOUT_REQUIRED'
  );
});

test('canonical q33 representation model is the writer input contract', () => {
  const network = lineFence(33);
  const model = straightFenceLayout(33, [6, 13, 19, 26]);
  const result = compileFence({
    desiredNetwork: network,
    representationLayout: model
  });
  assert.equal(result.ok, true);
  assert.equal(
    result.input.representationLayout.schema,
    'ddv.fence-representation-layout@1'
  );
  assert.equal(result.nativeObjectCount.after, 11);
});

test('FM01 WEP-shaped mode-homogeneous networks compile as one atomic batch', () => {
  const orthogonal = {
    networkId: 'orth',
    ...lineFence(3, FenceMode.ORTHOGONAL)
  };
  const diagonal = {
    networkId: 'diag',
    familyBaseItemID: 40700246,
    graph: {
      nodes: [
        { id: 'n0', x: 3, y: 1, mode: FenceMode.DIAGONAL }
      ],
      edges: []
    }
  };
  const orthLayout = straightFenceLayout(
    3,
    [],
    FenceRepresentationPolicy.EXACT_PRESERVATION,
    FenceMode.ORTHOGONAL,
    40700246,
    ['n2']
  );
  orthLayout.networkId = 'orth';

  const diagTopology = {
    familyBaseItemID: 40700246,
    mode: FenceMode.DIAGONAL,
    logicalQuantity: 1,
    graph: structuredClone(diagonal.graph),
    modeBoundaryNodeIds: ['n0'],
    semanticAnchors: [
      { nodeId: 'n0', x: 3, y: 1, reason: 'MODE_BOUNDARY' }
    ],
    runs: []
  };
  const diagonalLayout = {
    schema: 'ddv.fence-representation-layout@1',
    contractSource: {
      gameVersion: '1.25.0',
      platform: 'Nintendo Switch'
    },
    networkId: 'diag',
    logicalTopology: diagTopology,
    representationLayout: {
      intent: 'EXACT_PRESERVATION',
      policy: 'PRESERVE_EXISTING',
      posts: []
    },
    invariants: {
      sourceTopologyFingerprint:
        fenceLogicalTopologyFingerprint(diagTopology),
      sourceLogicalQuantity: 1
    },
    provenance: { fixture: true },
    persistentWriteAuthorized: false
  };

  const result = compileFenceNetworkBatchV125({
    buildIdentity: BUILD_V125_SWITCH,
    sourceGrid: makeGrid(),
    components: [
      {
        desiredNetwork: orthogonal,
        representationLayout: orthLayout,
        sourceObjectIds: [],
        transform: { originSave: { x: 0, y: 0 }, pitchX: 2, pitchY: 2 }
      },
      {
        desiredNetwork: diagonal,
        representationLayout: diagonalLayout,
        sourceObjectIds: [],
        transform: { originSave: { x: 0, y: 0 }, pitchX: 2, pitchY: 2 }
      }
    ],
    modeBoundaryTouches: [
      {
        familyBaseItemID: 40700246,
        classification: 'geometric-cross-mode-touch',
        authoritativeConnectedEdge: false,
        a: {
          networkId: 'orth',
          x: 2,
          y: 0,
          mode: FenceMode.ORTHOGONAL
        },
        b: {
          networkId: 'diag',
          x: 3,
          y: 1,
          mode: FenceMode.DIAGONAL
        }
      }
    ],
    targetSurfaceValidated: true
  });
  assert.equal(result.ok, true);
  assert.equal(result.batch, true);
  assert.equal(result.componentCount, 2);
  assert.equal(result.logicalQuantity.after, 4);
  assert.equal(result.nativeObjectCount.after, 4);
  assert.ok(result.evidence.some((entry) => entry.id === 'DW-FM01'));
});

test('mode-boundary batch outside exact FM01 shape remains runtime-required', () => {
  const orthogonal = {
    networkId: 'orth',
    ...lineFence(2, FenceMode.ORTHOGONAL)
  };
  const diagonal = {
    networkId: 'diag',
    familyBaseItemID: 40700246,
    graph: {
      nodes: [
        { id: 'n0', x: 2, y: 1, mode: FenceMode.DIAGONAL }
      ],
      edges: []
    }
  };
  const orthLayout = straightFenceLayout(
    2,
    [],
    FenceRepresentationPolicy.EXACT_PRESERVATION,
    FenceMode.ORTHOGONAL,
    40700246,
    ['n1']
  );
  orthLayout.networkId = 'orth';
  const diagTopology = {
    familyBaseItemID: 40700246,
    mode: FenceMode.DIAGONAL,
    logicalQuantity: 1,
    graph: structuredClone(diagonal.graph),
    modeBoundaryNodeIds: ['n0'],
    semanticAnchors: [
      { nodeId: 'n0', x: 2, y: 1, reason: 'MODE_BOUNDARY' }
    ],
    runs: []
  };
  const diagonalLayout = {
    schema: 'ddv.fence-representation-layout@1',
    contractSource: { gameVersion: '1.25.0', platform: 'Nintendo Switch' },
    networkId: 'diag',
    logicalTopology: diagTopology,
    representationLayout: {
      intent: 'EXACT_PRESERVATION',
      policy: 'PRESERVE_EXISTING',
      posts: []
    },
    invariants: {
      sourceTopologyFingerprint:
        fenceLogicalTopologyFingerprint(diagTopology),
      sourceLogicalQuantity: 1
    },
    provenance: { fixture: true },
    persistentWriteAuthorized: false
  };
  const result = compileFenceNetworkBatchV125({
    buildIdentity: BUILD_V125_SWITCH,
    sourceGrid: makeGrid(),
    components: [
      {
        desiredNetwork: orthogonal,
        representationLayout: orthLayout,
        sourceObjectIds: [],
        transform: { originSave: { x: 0, y: 0 }, pitchX: 2, pitchY: 2 }
      },
      {
        desiredNetwork: diagonal,
        representationLayout: diagonalLayout,
        sourceObjectIds: [],
        transform: { originSave: { x: 0, y: 0 }, pitchX: 2, pitchY: 2 }
      }
    ],
    modeBoundaryTouches: [
      {
        familyBaseItemID: 40700246,
        classification: 'geometric-cross-mode-touch',
        authoritativeConnectedEdge: false,
        a: { networkId: 'orth', x: 1, y: 0, mode: FenceMode.ORTHOGONAL },
        b: { networkId: 'diag', x: 2, y: 1, mode: FenceMode.DIAGONAL }
      }
    ],
    targetSurfaceValidated: true
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, RoadFenceWriterSupportStatus.RUNTIME_REQUIRED);
});

test('deleting/replacing an owned Road/Fence object with unknown fields fails closed', () => {
  const source = makeGrid([
    makeObject(
      10,
      40100068,
      0,
      0,
      'GridOrientation_Down',
      null,
      { UnknownFutureField: { keep: true } }
    )
  ], 11);
  const result = compileRoad({
    source,
    sourceObjectIds: [10],
    sourceNetwork: roadNetwork(40100068, [
      { x: 0, y: 0, mode: FenceMode.ORTHOGONAL }
    ]),
    desiredNetwork: roadNetwork(40100068, [
      { x: 1, y: 0, mode: FenceMode.ORTHOGONAL }
    ])
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.failClosedReason.code,
    'ROADFENCE_SOURCE_OBJECT_UNKNOWN_FIELD_REPLACEMENT_UNSUPPORTED'
  );
});

test('exact build and external surface gates fail closed', () => {
  const desired = roadNetwork(40100068, [{ x: 0, y: 0, mode: FenceMode.ORTHOGONAL }]);
  const badBuild = compileRoadMutationV125({
    buildIdentity: { ...BUILD_V125_SWITCH, bid: 'WRONG' },
    sourceGrid: makeGrid(),
    desiredNetwork: desired,
    transform: { originSave: { x: 0, y: 0 }, pitchX: 4 },
    targetSurfaceValidated: true
  });
  assert.equal(badBuild.ok, false);
  assert.equal(badBuild.failClosedReason.code, 'ROADFENCE_UNSUPPORTED_BUILD_IDENTITY');

  const noSurface = compileRoadMutationV125({
    buildIdentity: BUILD_V125_SWITCH,
    sourceGrid: makeGrid(),
    desiredNetwork: desired,
    transform: { originSave: { x: 0, y: 0 }, pitchX: 4 },
    targetSurfaceValidated: false
  });
  assert.equal(noSurface.ok, false);
  assert.equal(noSurface.failClosedReason.code, 'TARGET_SURFACE_UNVERIFIED');
});
