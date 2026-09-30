import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FenceMode,
  PERSISTENT_WRITE_AUTHORIZED,
  buildFencePolyline,
  buildFenceRectangleOutline,
  buildRoadRegionFill,
  compileFenceLogicalGraph,
  createFenceNetwork,
  createRoadNetwork,
  eraseFenceLogicalUnits,
  eraseRoadCells,
  RoadFenceValidationCode,
  fenceRepresentationQuantity,
  partitionFenceConnectedComponents,
  planFenceNativeRepresentation,
  planFenceStraightRun,
  planFreshRoadFenceGridObjectIds,
  planRoadNativeRepresentation,
  preflightRoadFenceDirectWrite,
  predictConnectedFenceRemoval,
  predictFenceStyleReplacement,
  previewFenceStyleReplacement,
  previewRoadStyleReplacement,
  rasterizeRoadPath,
  rasterizeRoadPolyline,
  requirePersistentRoadFenceWriter,
  roadDiagonalStepCells,
  sampleFenceStyle,
  sampleRoadStyle,
  selectFenceBranch,
  selectFenceConnected,
  selectRoadConnected,
  transformFenceLogicalGraph,
  transformRoadCells,
  validateContainedTopology,
  validateFenceLogicalGraph,
  validateFenceRepresentationPlan,
  validateRoadCells
} from '../src/lib/ddv/core/roadfence/logical.js';

test('one Road diagonal quantum rasterizes to a 2x2 cell rectangle', () => {
  assert.deepEqual(roadDiagonalStepCells({ x: 0, y: 0 }, { x: 1, y: 1 }), [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 0 }
  ]);
  const result = rasterizeRoadPath([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  assert.equal(result.cells.length, 4);
  assert.equal(result.logicalQuantity, 4);
  assert.equal(result.requiresRuntimeTransitionNormalization, false);
  assert.ok(result.cells.every((cell) => cell.mode === FenceMode.DIAGONAL));
});

test('two same-slope Road diagonal quanta deduplicate to seven persistent cells', () => {
  const result = rasterizeRoadPath([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]);
  assert.equal(result.cells.length, 7);
  assert.equal(result.logicalQuantity, 7);
  assert.equal(result.requiresRuntimeTransitionNormalization, false);
});

test('mixed Road cardinal/diagonal path marks transition normalization as runtime-gated', () => {
  const result = rasterizeRoadPath([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }]);
  assert.equal(result.requiresRuntimeTransitionNormalization, true);
  assert.ok(result.cells.some((cell) => cell.mode === 'runtime-gated-transition'));
});

test('Road validator rejects duplicate cells and unsupported diagonal mode', () => {
  const result = validateRoadCells([
    { x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
    { x: 0, y: 0, mode: FenceMode.DIAGONAL }
  ], { supportsDiagonal: false });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === RoadFenceValidationCode.DUPLICATE_ROAD_CELL));
  assert.ok(result.errors.some((error) => error.code === RoadFenceValidationCode.ROAD_MODE_STATE_UNSUPPORTED));
});

test('orthogonal Fence straight generator matches N=1,2,3,8,9,10 closure cases', () => {
  const expectedRoles = new Map([
    [1, ['base']],
    [2, ['base', 'base']],
    [3, ['base', 'ext:1', 'base']],
    [8, ['base', 'ext:6', 'base']],
    [9, ['base', 'ext:6', 'base', 'base']],
    [10, ['base', 'ext:6', 'base', 'ext:1', 'base']]
  ]);
  for (const [quantity, expected] of expectedRoles) {
    const plan = planFenceStraightRun(quantity, FenceMode.ORTHOGONAL);
    const roles = plan.components.map((component) => component.role === 'ext' ? `ext:${component.key}` : component.role);
    assert.deepEqual(roles, expected, `N=${quantity}`);
    assert.equal(fenceRepresentationQuantity(plan.components), quantity);
    assert.equal(validateFenceRepresentationPlan(plan).ok, true);
  }
});

test('diagonal Fence straight generator matches first/max/over-max cases', () => {
  const n3 = planFenceStraightRun(3, FenceMode.DIAGONAL);
  assert.deepEqual(n3.components.map((c) => c.role === 'diagExt' ? `diagExt:${c.key}` : c.role), ['base', 'diagExt:1', 'base']);
  const n6 = planFenceStraightRun(6, FenceMode.DIAGONAL);
  assert.deepEqual(n6.components.map((c) => c.role === 'diagExt' ? `diagExt:${c.key}` : c.role), ['base', 'diagExt:4', 'base']);
  const n7 = planFenceStraightRun(7, FenceMode.DIAGONAL);
  assert.deepEqual(n7.components.map((c) => c.role === 'diagExt' ? `diagExt:${c.key}` : c.role), ['base', 'diagExt:4', 'base', 'base']);
  assert.equal(fenceRepresentationQuantity(n7.components), 7);
});

test('Fence connected components stop at orthogonal/diagonal mode boundary', () => {
  const components = partitionFenceConnectedComponents([
    { id: 'o1', mode: FenceMode.ORTHOGONAL },
    { id: 'o2', mode: FenceMode.ORTHOGONAL },
    { id: 'd1', mode: FenceMode.DIAGONAL },
    { id: 'd2', mode: FenceMode.DIAGONAL }
  ], [
    { a: 'o1', b: 'o2' },
    { a: 'o2', b: 'd1' },
    { a: 'd1', b: 'd2' }
  ]);
  assert.deepEqual(components, [
    { mode: FenceMode.ORTHOGONAL, nodeIds: ['o1', 'o2'] },
    { mode: FenceMode.DIAGONAL, nodeIds: ['d1', 'd2'] }
  ]);
});

test('connected remove refunds logical Fence quantity, not serialized object count', () => {
  const plan = planFenceStraightRun(8, FenceMode.ORTHOGONAL);
  assert.equal(plan.components.length, 3);
  const prediction = predictConnectedFenceRemoval({ components: plan.components, gridObjectIds: [10, 11, 12] });
  assert.equal(prediction.removedLogicalQuantity, 8);
  assert.equal(prediction.nativeOracleRefundLogicalQuantity, 8);
  assert.equal(prediction.wandListInventoryDelta, 0);
  assert.equal(prediction.ownershipMutationRequired, false);
  assert.deepEqual(prediction.removedGridObjectIds, [10, 11, 12]);
  assert.equal(prediction.persistentWriteAuthorized, false);
});

test('style replacement preserves logical quantity while refunding source and consuming target', () => {
  const plan = planFenceStraightRun(8, FenceMode.ORTHOGONAL);
  const prediction = predictFenceStyleReplacement({
    sourceComponents: plan.components,
    sourceGridObjectIds: [10, 11, 12],
    targetAvailableLogicalQuantity: 9
  });
  assert.deepEqual(prediction, {
    ok: true,
    logicalQuantity: 8,
    nativeOracleRequiredTargetQuantity: 8,
    nativeOracleAvailableTargetQuantity: 9,
    nativeOracleInventorySufficient: true,
    nativeOracleWouldRejectForShortage: false,
    nativeOracleSourceInventoryDelta: 8,
    nativeOracleTargetInventoryDelta: -8,
    wandSourceInventoryDelta: 0,
    wandTargetInventoryDelta: 0,
    ownershipMutationRequired: false,
    replacedGridObjectIds: [10, 11, 12],
    requiresFreshTargetGridObjectIds: 3,
    persistentWriteAuthorized: false
  });
});

test('Fence target shortage is native-oracle diagnostics, not a Wand preview blocker', () => {
  const plan = planFenceStraightRun(8, FenceMode.ORTHOGONAL);
  const prediction = predictFenceStyleReplacement({ sourceComponents: plan.components, targetAvailableLogicalQuantity: 7 });
  assert.equal(prediction.ok, true);
  assert.equal(prediction.nativeOracleRequiredTargetQuantity, 8);
  assert.equal(prediction.nativeOracleAvailableTargetQuantity, 7);
  assert.equal(prediction.nativeOracleInventorySufficient, false);
  assert.equal(prediction.nativeOracleWouldRejectForShortage, true);
  assert.equal(prediction.wandSourceInventoryDelta, 0);
  assert.equal(prediction.wandTargetInventoryDelta, 0);
  assert.equal(prediction.ownershipMutationRequired, false);
});

test('Capture Region topology clipping fails closed', () => {
  assert.deepEqual(validateContainedTopology(['a', 'b', 'c'], ['a', 'b']), {
    ok: false,
    code: RoadFenceValidationCode.TOPOLOGY_CLIPPED_UNSUPPORTED
  });
  assert.deepEqual(validateContainedTopology(['a', 'b', 'c'], ['a', 'b', 'c']), { ok: true, code: null });
  assert.deepEqual(validateContainedTopology(['a', 'b', 'c'], []), { ok: true, code: null });
});

test('native accounting is separated from Wand ownership mutation', () => {
  const road = rasterizeRoadPath([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  assert.equal(road.logicalQuantity, 4);
  assert.equal(road.nativeOracleInventoryCost, 4);

  const fence = planFenceStraightRun(8, FenceMode.ORTHOGONAL);
  const remove = predictConnectedFenceRemoval({ components: fence.components, gridObjectIds: [1, 2, 3] });
  assert.equal(remove.removedLogicalQuantity, 8);
  assert.equal(remove.nativeOracleRefundLogicalQuantity, 8);
  assert.equal(remove.wandListInventoryDelta, 0);
  assert.equal(remove.ownershipMutationRequired, false);

  const replace = predictFenceStyleReplacement({
    sourceComponents: fence.components,
    sourceGridObjectIds: [1, 2, 3],
    targetAvailableLogicalQuantity: 8
  });
  assert.equal(replace.nativeOracleSourceInventoryDelta, 8);
  assert.equal(replace.nativeOracleTargetInventoryDelta, -8);
  assert.equal(replace.wandSourceInventoryDelta, 0);
  assert.equal(replace.wandTargetInventoryDelta, 0);
  assert.equal(replace.ownershipMutationRequired, false);
});

test('persistent Road/Fence writer remains hard-disabled', () => {
  assert.equal(PERSISTENT_WRITE_AUTHORIZED, false);
  assert.deepEqual(requirePersistentRoadFenceWriter(), {
    ok: false,
    code: RoadFenceValidationCode.ROADFENCE_WRITER_DISABLED,
    persistentWriteAuthorized: false
  });
});


test('general Fence graph compiler emits Base vertices at an orthogonal turn', () => {
  const graph = {
    nodes: [
      { id: 'a', x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
      { id: 'b', x: 1, y: 0, mode: FenceMode.ORTHOGONAL },
      { id: 'c', x: 1, y: 1, mode: FenceMode.ORTHOGONAL }
    ],
    edges: [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }]
  };
  assert.equal(validateFenceLogicalGraph(graph).ok, true);
  const compiled = compileFenceLogicalGraph(graph);
  assert.equal(compiled.ok, true);
  assert.equal(compiled.logicalQuantity, 3);
  assert.equal(compiled.components.length, 1);
  assert.equal(compiled.components[0].bases.length, 3);
  assert.equal(compiled.components[0].extensions.length, 0);
  assert.equal(compiled.components[0].spans.length, 2);
});

test('general Fence graph compiler emits one shared Base for a three-way junction', () => {
  const graph = {
    nodes: [
      { id: 'p', x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
      { id: 'l', x: -1, y: 0, mode: FenceMode.ORTHOGONAL },
      { id: 'r', x: 1, y: 0, mode: FenceMode.ORTHOGONAL },
      { id: 'u', x: 0, y: 1, mode: FenceMode.ORTHOGONAL }
    ],
    edges: [{ a: 'p', b: 'l' }, { a: 'p', b: 'r' }, { a: 'p', b: 'u' }]
  };
  const compiled = compileFenceLogicalGraph(graph);
  assert.equal(compiled.ok, true);
  assert.equal(compiled.logicalQuantity, 4);
  assert.equal(compiled.components[0].bases.length, 4);
  assert.equal(compiled.components[0].spans.length, 3);
  assert.equal(compiled.components[0].serializedLogicalQuantity, 4);
});

test('general Fence graph compiler applies over-max segmentation to a long straight component', () => {
  const nodes = Array.from({ length: 10 }, (_, x) => ({ id: `n${x}`, x, y: 0, mode: FenceMode.ORTHOGONAL }));
  const edges = Array.from({ length: 9 }, (_, x) => ({ a: `n${x}`, b: `n${x + 1}` }));
  const compiled = compileFenceLogicalGraph({ nodes, edges });
  assert.equal(compiled.ok, true);
  assert.equal(compiled.logicalQuantity, 10);
  assert.equal(compiled.components[0].serializedLogicalQuantity, 10);
  assert.deepEqual(compiled.components[0].extensions.map((part) => part.key), [6, 1]);
  assert.deepEqual(compiled.components[0].bases.map((part) => part.nodeId), ['n0', 'n7', 'n9']);
});

test('interior Fence logical erase splits and recompiles surviving components', () => {
  const nodes = Array.from({ length: 10 }, (_, x) => ({ id: `n${x}`, x, y: 0, mode: FenceMode.ORTHOGONAL }));
  const edges = Array.from({ length: 9 }, (_, x) => ({ a: `n${x}`, b: `n${x + 1}` }));
  const erased = eraseFenceLogicalUnits({ nodes, edges }, ['n4']);
  assert.equal(erased.ok, true);
  assert.equal(erased.nativeOracleRefundLogicalQuantity, 1);
  assert.equal(erased.remainingLogicalQuantity, 9);
  assert.equal(erased.compiled.components.length, 2);
  assert.deepEqual(erased.compiled.components.map((component) => component.logicalQuantity).sort((a, b) => a - b), [4, 5]);
  assert.equal(erased.compiled.logicalQuantity, 9);
  assert.equal(erased.persistentWriteAuthorized, false);
});

test('general Fence graph compiler partitions an explicit orthogonal/diagonal boundary', () => {
  const graph = {
    nodes: [
      { id: 'o1', x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
      { id: 'o2', x: 1, y: 0, mode: FenceMode.ORTHOGONAL },
      { id: 'd1', x: 2, y: 1, mode: FenceMode.DIAGONAL },
      { id: 'd2', x: 3, y: 2, mode: FenceMode.DIAGONAL }
    ],
    edges: [
      { a: 'o1', b: 'o2' },
      { a: 'o2', b: 'd1' },
      { a: 'd1', b: 'd2' }
    ]
  };
  const compiled = compileFenceLogicalGraph(graph);
  assert.equal(compiled.ok, true);
  assert.equal(compiled.components.length, 2);
  assert.deepEqual(compiled.components.map((component) => component.mode), [FenceMode.ORTHOGONAL, FenceMode.DIAGONAL]);
  assert.deepEqual(compiled.modeBoundaries, [{ a: 'o2', b: 'd1' }]);
  assert.equal(compiled.logicalQuantity, 4);
});


test('Road polyline expands long cardinal and diagonal controls before rasterization', () => {
  const result = rasterizeRoadPolyline([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 4, y: 2 }
  ]);
  assert.equal(result.requiresRuntimeTransitionNormalization, true);
  assert.ok(result.cells.some((cell) => cell.x === 1 && cell.y === 0));
  assert.ok(result.cells.some((cell) => cell.x === 3 && cell.y === 1));
  assert.ok(result.cells.some((cell) => cell.x === 4 && cell.y === 2));
});

test('Fence polyline builds and compiles a multi-segment orthogonal logical graph', () => {
  const result = buildFencePolyline([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 2 }
  ], FenceMode.ORTHOGONAL);
  assert.equal(result.compiled.ok, true);
  assert.equal(result.graph.nodes.length, 6);
  assert.equal(result.graph.edges.length, 5);
  assert.equal(result.compiled.logicalQuantity, 6);
  assert.equal(result.compiled.components.length, 1);
  assert.equal(result.persistentWriteAuthorized, false);
});

test('Fence rectangle outline closes as one orthogonal component without duplicate logical nodes', () => {
  const result = buildFenceRectangleOutline({ minX: 0, minY: 0, maxX: 3, maxY: 2 });
  assert.equal(result.compiled.ok, true);
  assert.equal(result.graph.nodes.length, 10);
  assert.equal(result.graph.edges.length, 10);
  assert.equal(result.compiled.logicalQuantity, 10);
  assert.equal(result.compiled.components.length, 1);
  assert.equal(result.compiled.components[0].bases.length, 4);
});


test('Road region fill creates one persistent logical cell per rectangle coordinate', () => {
  const result = buildRoadRegionFill({ minX: 2, minY: 4, maxX: 4, maxY: 5 });
  assert.equal(result.cells.length, 6);
  assert.equal(result.logicalQuantity, 6);
  assert.ok(result.cells.every((cell) => cell.mode === FenceMode.ORTHOGONAL));
  assert.equal(result.persistentWriteAuthorized, false);
});

test('Road logical erase refunds exactly the erased cell count', () => {
  const filled = buildRoadRegionFill({ minX: 0, minY: 0, maxX: 2, maxY: 1 });
  const erased = eraseRoadCells(filled.cells, [{ x: 1, y: 0 }, { x: 2, y: 1 }]);
  assert.equal(erased.ok, true);
  assert.equal(erased.nativeOracleRefundLogicalQuantity, 2);
  assert.equal(erased.remainingLogicalQuantity, 4);
  assert.equal(erased.cells.length, 4);
});

test('Fence select-connected stops at an orthogonal/diagonal boundary', () => {
  const graph = {
    nodes: [
      { id: 'o1', x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
      { id: 'o2', x: 1, y: 0, mode: FenceMode.ORTHOGONAL },
      { id: 'd1', x: 2, y: 1, mode: FenceMode.DIAGONAL },
      { id: 'd2', x: 3, y: 2, mode: FenceMode.DIAGONAL }
    ],
    edges: [
      { a: 'o1', b: 'o2' },
      { a: 'o2', b: 'd1' },
      { a: 'd1', b: 'd2' }
    ]
  };
  const selectedOrthogonal = selectFenceConnected(graph, 'o2');
  assert.equal(selectedOrthogonal.ok, true);
  assert.deepEqual(selectedOrthogonal.nodeIds, ['o1', 'o2']);
  assert.equal(selectedOrthogonal.logicalQuantity, 2);

  const selectedDiagonal = selectFenceConnected(graph, 'd1');
  assert.equal(selectedDiagonal.ok, true);
  assert.deepEqual(selectedDiagonal.nodeIds, ['d1', 'd2']);
  assert.equal(selectedDiagonal.logicalQuantity, 2);
});

test('Road topology transform rotates and translates cells without changing logical quantity', () => {
  const source = rasterizeRoadPath([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  const transformed = transformRoadCells(source.cells, {
    pivot: { x: 0, y: 0 },
    rotateQuarterTurns: 1,
    translateX: 10,
    translateY: 20
  });
  assert.equal(transformed.ok, true);
  assert.equal(transformed.cells.length, 4);
  assert.equal(transformed.logicalQuantity, 4);
  assert.ok(transformed.cells.some((cell) => cell.x === 10 && cell.y === 20));
  assert.ok(transformed.cells.some((cell) => cell.x === 9 && cell.y === 21));
});

test('Fence topology transform preserves graph connectivity and recompiles after rotation', () => {
  const source = buildFencePolyline([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 2 }
  ], FenceMode.ORTHOGONAL);
  const transformed = transformFenceLogicalGraph(source.graph, {
    pivot: { x: 0, y: 0 },
    rotateQuarterTurns: 1,
    translateX: 5,
    translateY: 7
  });
  assert.equal(transformed.ok, true);
  assert.equal(transformed.graph.nodes.length, source.graph.nodes.length);
  assert.equal(transformed.graph.edges.length, source.graph.edges.length);
  assert.equal(transformed.compiled.logicalQuantity, source.compiled.logicalQuantity);
  assert.equal(transformed.compiled.components.length, 1);
});

test('Fence style replacement preview selects only the rooted native-connected component', () => {
  const graph = {
    nodes: [
      { id: 'o1', x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
      { id: 'o2', x: 1, y: 0, mode: FenceMode.ORTHOGONAL },
      { id: 'o3', x: 2, y: 0, mode: FenceMode.ORTHOGONAL },
      { id: 'd1', x: 3, y: 1, mode: FenceMode.DIAGONAL },
      { id: 'd2', x: 4, y: 2, mode: FenceMode.DIAGONAL }
    ],
    edges: [
      { a: 'o1', b: 'o2' },
      { a: 'o2', b: 'o3' },
      { a: 'o3', b: 'd1' },
      { a: 'd1', b: 'd2' }
    ]
  };
  const preview = previewFenceStyleReplacement({
    graph,
    seedNodeId: 'o2',
    sourceFamilyBaseItemID: 40700246,
    targetFamilyBaseItemID: 40700001,
    targetAvailableLogicalQuantity: 10
  });
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.nodeIds, ['o1', 'o2', 'o3']);
  assert.equal(preview.logicalQuantity, 3);
  assert.equal(preview.nativeOracleSourceInventoryDelta, 3);
  assert.equal(preview.nativeOracleTargetInventoryDelta, -3);
  assert.equal(preview.persistentWriteAuthorized, false);
});


test('Road select-connected uses current eight-neighbor logical adjacency', () => {
  const cells = [
    { x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
    { x: 1, y: 1, mode: FenceMode.DIAGONAL },
    { x: 2, y: 2, mode: FenceMode.DIAGONAL },
    { x: 10, y: 10, mode: FenceMode.ORTHOGONAL }
  ];
  const selected = selectRoadConnected(cells, { x: 0, y: 0 });
  assert.equal(selected.ok, true);
  assert.equal(selected.logicalQuantity, 3);
  assert.deepEqual(selected.cells.map((cell) => [cell.x, cell.y]), [[0, 0], [1, 1], [2, 2]]);
});

test('Road style replacement preview accounts for one eight-neighbor connected component', () => {
  const cells = [
    { x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
    { x: 1, y: 0, mode: FenceMode.ORTHOGONAL },
    { x: 2, y: 1, mode: FenceMode.DIAGONAL },
    { x: 8, y: 8, mode: FenceMode.ORTHOGONAL }
  ];
  const preview = previewRoadStyleReplacement({
    cells,
    seedCoordinate: { x: 1, y: 0 },
    sourceFamilyBaseItemID: 40100068,
    targetFamilyBaseItemID: 40100069,
    targetAvailableLogicalQuantity: 5
  });
  assert.equal(preview.ok, true);
  assert.equal(preview.logicalQuantity, 3);
  assert.equal(preview.nativeOracleRequiredTargetQuantity, 3);
  assert.equal(preview.nativeOracleAvailableTargetQuantity, 5);
  assert.equal(preview.nativeOracleInventorySufficient, true);
  assert.equal(preview.nativeOracleWouldRejectForShortage, false);
  assert.equal(preview.nativeOracleSourceInventoryDelta, 3);
  assert.equal(preview.nativeOracleTargetInventoryDelta, -3);
  assert.equal(preview.wandSourceInventoryDelta, 0);
  assert.equal(preview.wandTargetInventoryDelta, 0);
  assert.equal(preview.ownershipMutationRequired, false);
  assert.equal(preview.cells.length, 3);
  assert.equal(preview.persistentWriteAuthorized, false);
});



test('Road target shortage is native-oracle diagnostics, not a Wand preview blocker', () => {
  const cells = [
    { x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
    { x: 1, y: 0, mode: FenceMode.ORTHOGONAL }
  ];
  const preview = previewRoadStyleReplacement({
    cells,
    seedCoordinate: { x: 0, y: 0 },
    sourceFamilyBaseItemID: 40100068,
    targetFamilyBaseItemID: 40100069,
    targetAvailableLogicalQuantity: 0
  });
  assert.equal(preview.ok, true);
  assert.equal(preview.logicalQuantity, 2);
  assert.equal(preview.nativeOracleInventorySufficient, false);
  assert.equal(preview.nativeOracleWouldRejectForShortage, true);
  assert.equal(preview.wandSourceInventoryDelta, 0);
  assert.equal(preview.wandTargetInventoryDelta, 0);
  assert.equal(preview.ownershipMutationRequired, false);
});

test('Road eyedropper samples portable family identity and logical mode', () => {
  const cells = rasterizeRoadPath([{ x: 0, y: 0 }, { x: 1, y: 1 }]).cells;
  const created = createRoadNetwork({ familyBaseItemID: 40100068, cells });
  assert.equal(created.ok, true);
  const sample = sampleRoadStyle(created.network, { x: 1, y: 0 });
  assert.deepEqual(sample, {
    ok: true,
    kind: 'road',
    familyBaseItemID: 40100068,
    mode: FenceMode.DIAGONAL,
    coordinate: { x: 1, y: 0 }
  });
});

test('Fence eyedropper samples family identity and mode without exposing native variation IDs', () => {
  const built = buildFencePolyline([
    { x: 0, y: 0 },
    { x: 3, y: 0 }
  ], FenceMode.ORTHOGONAL);
  const created = createFenceNetwork({ familyBaseItemID: 40700246, graph: built.graph });
  assert.equal(created.ok, true);
  const sample = sampleFenceStyle(created.network, '1,0');
  assert.deepEqual(sample, {
    ok: true,
    kind: 'fence',
    familyBaseItemID: 40700246,
    mode: FenceMode.ORTHOGONAL,
    nodeId: '1,0',
    coordinate: { x: 1, y: 0 }
  });
});


test('Fence branch selection returns one maximal straight span and stops at a turn', () => {
  const built = buildFencePolyline([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 2 }
  ], FenceMode.ORTHOGONAL);
  const horizontal = selectFenceBranch(built.graph, '1,0', '2,0');
  assert.equal(horizontal.ok, true);
  assert.deepEqual(horizontal.nodeIds, ['0,0', '1,0', '2,0', '3,0']);
  assert.equal(horizontal.logicalQuantity, 4);

  const vertical = selectFenceBranch(built.graph, '3,0', '3,1');
  assert.equal(vertical.ok, true);
  assert.deepEqual(vertical.nodeIds, ['3,0', '3,1', '3,2']);
  assert.equal(vertical.logicalQuantity, 3);
});

test('Fence branch selection refuses a mode-boundary edge', () => {
  const graph = {
    nodes: [
      { id: 'o', x: 0, y: 0, mode: FenceMode.ORTHOGONAL },
      { id: 'd', x: 1, y: 1, mode: FenceMode.DIAGONAL }
    ],
    edges: [{ a: 'o', b: 'd' }]
  };
  const result = selectFenceBranch(graph, 'o', 'd');
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, RoadFenceValidationCode.FENCE_COMPONENT_BOUNDARY_MISMATCH);
});


const BIOME2_FENCE_VARIATIONS = Object.freeze({
  orthogonal: {
    1: { itemID: 40700247, gridSizeX: 1, gridSizeY: 1 },
    2: { itemID: 40700248, gridSizeX: 2, gridSizeY: 1 },
    3: { itemID: 40700249, gridSizeX: 3, gridSizeY: 1 },
    4: { itemID: 40700250, gridSizeX: 4, gridSizeY: 1 },
    5: { itemID: 40700251, gridSizeX: 5, gridSizeY: 1 },
    6: { itemID: 40700252, gridSizeX: 6, gridSizeY: 1 }
  },
  diagonal: {
    1: { itemID: 40700253, gridSizeX: 1, gridSizeY: 1 },
    2: { itemID: 40700254, gridSizeX: 2, gridSizeY: 2 },
    3: { itemID: 40700255, gridSizeX: 3, gridSizeY: 3 },
    4: { itemID: 40700256, gridSizeX: 4, gridSizeY: 4 }
  }
});

test('Road native planner reproduces the current corrected DW-R01 cardinal-3 fixture shape', () => {
  const cells = rasterizeRoadPath([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 }
  ]).cells;
  const network = createRoadNetwork({ familyBaseItemID: 40100068, cells }).network;
  const plan = planRoadNativeRepresentation({
    network,
    originLogical: { x: 0, y: 0 },
    originSave: { x: 328, y: 52 },
    pitchX: 4,
    pitchY: 4
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.logicalQuantity, 3);
  assert.equal(plan.wandListInventoryDelta, 0);
  assert.equal(plan.ownershipMutationRequired, false);
  assert.equal(plan.placementValidity, 'requires-external-world-surface-validation');
  assert.equal(plan.requiresExternalPlacementValidation, true);
  assert.deepEqual(plan.objects, [
    {
      role: 'roadCell',
      itemID: 40100068,
      logical: { x: 0, y: 0 },
      x: 328,
      y: 52,
      orientation: 'GridOrientation_Down',
      state: null
    },
    {
      role: 'roadCell',
      itemID: 40100068,
      logical: { x: 1, y: 0 },
      x: 332,
      y: 52,
      orientation: 'GridOrientation_Down',
      state: null
    },
    {
      role: 'roadCell',
      itemID: 40100068,
      logical: { x: 2, y: 0 },
      x: 336,
      y: 52,
      orientation: 'GridOrientation_Down',
      state: null
    }
  ]);
});

test('Road native planner emits the DW-R02 isolated diagonal 2x2 representation', () => {
  const cells = rasterizeRoadPath([{ x: 0, y: 0 }, { x: 1, y: 1 }]).cells;
  const network = createRoadNetwork({ familyBaseItemID: 40100068, cells }).network;
  const plan = planRoadNativeRepresentation({
    network,
    originSave: { x: 24, y: 24 },
    pitchX: 4
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.logicalQuantity, 4);
  assert.deepEqual(
    plan.objects.map((object) => [object.x, object.y, object.state]),
    [
      [24, 24, { FenceMode: { Diagonal: true } }],
      [28, 24, { FenceMode: { Diagonal: true } }],
      [24, 28, { FenceMode: { Diagonal: true } }],
      [28, 28, { FenceMode: { Diagonal: true } }]
    ]
  );
});

test('Road native planner fails closed on unresolved mixed transition state', () => {
  const cells = rasterizeRoadPath([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 1 }
  ]).cells;
  const network = createRoadNetwork({ familyBaseItemID: 40100068, cells }).network;
  const plan = planRoadNativeRepresentation({
    network,
    originSave: { x: 24, y: 24 },
    pitchX: 4
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.errors[0].code, RoadFenceValidationCode.ROAD_MODE_STATE_UNSUPPORTED);
});

test('Fence native planner reproduces the known Biome2Fence vertical 10-unit representation', () => {
  const built = buildFencePolyline([
    { x: 0, y: 0 },
    { x: 0, y: 9 }
  ], FenceMode.ORTHOGONAL);
  const network = createFenceNetwork({ familyBaseItemID: 40700246, graph: built.graph }).network;
  const plan = planFenceNativeRepresentation({
    network,
    originLogical: { x: 0, y: 0 },
    originSave: { x: 324, y: 48 },
    pitchX: 2,
    pitchY: -2,
    tessellationFactor: 2,
    baseSpanX: 2,
    baseSpanY: 2,
    orthogonalExtensions: BIOME2_FENCE_VARIATIONS.orthogonal,
    diagonalExtensions: BIOME2_FENCE_VARIATIONS.diagonal
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.logicalQuantity, 10);
  assert.equal(plan.placementValidity, 'requires-external-world-surface-validation');
  assert.equal(plan.requiresExternalPlacementValidation, true);

  const simplified = plan.objects
    .map((object) => [object.itemID, object.x, object.y, object.orientation, object.state])
    .sort((a, b) => a[2] - b[2] || a[0] - b[0]);

  assert.deepEqual(simplified, [
    [40700246, 324, 30, 'GridOrientation_Down', null],
    [40700247, 324, 32, 'GridOrientation_Left', null],
    [40700246, 324, 34, 'GridOrientation_Down', null],
    [40700252, 324, 36, 'GridOrientation_Left', null],
    [40700246, 324, 48, 'GridOrientation_Down', null]
  ]);
});

test('Fence native planner resolves positive-slope diagonal extension anchor and state', () => {
  const built = buildFencePolyline([
    { x: 0, y: 0 },
    { x: 2, y: 2 }
  ], FenceMode.DIAGONAL);
  const network = createFenceNetwork({ familyBaseItemID: 40700246, graph: built.graph }).network;
  const plan = planFenceNativeRepresentation({
    network,
    originSave: { x: 0, y: 0 },
    pitchX: 2,
    pitchY: 2,
    tessellationFactor: 2,
    baseSpanX: 2,
    baseSpanY: 2,
    orthogonalExtensions: BIOME2_FENCE_VARIATIONS.orthogonal,
    diagonalExtensions: BIOME2_FENCE_VARIATIONS.diagonal
  });
  assert.equal(plan.ok, true);
  const ext = plan.objects.find((object) => object.role === 'diagExt');
  assert.deepEqual(
    [ext.itemID, ext.x, ext.y, ext.orientation, ext.state],
    [40700253, 2, 2, 'GridOrientation_Down', { FenceMode: { Diagonal: true } }]
  );
});

test('Fence native planner resolves negative-slope diagonal extension anchor and state', () => {
  const built = buildFencePolyline([
    { x: 0, y: 0 },
    { x: 2, y: -2 }
  ], FenceMode.DIAGONAL);
  const network = createFenceNetwork({ familyBaseItemID: 40700246, graph: built.graph }).network;
  const plan = planFenceNativeRepresentation({
    network,
    originSave: { x: 0, y: 4 },
    pitchX: 2,
    pitchY: 2,
    tessellationFactor: 2,
    baseSpanX: 2,
    baseSpanY: 2,
    orthogonalExtensions: BIOME2_FENCE_VARIATIONS.orthogonal,
    diagonalExtensions: BIOME2_FENCE_VARIATIONS.diagonal
  });
  assert.equal(plan.ok, true);
  const ext = plan.objects.find((object) => object.role === 'diagExt');
  assert.deepEqual(
    [ext.itemID, ext.x, ext.y, ext.orientation, ext.state],
    [40700253, 2, 2, 'GridOrientation_Left', { FenceMode: { Diagonal: true } }]
  );
});


function canonicalNativeObjectSet(plan) {
  return plan.objects
    .map((object) => [object.itemID, object.x, object.y, object.orientation, object.state])
    .sort((a, b) =>
      a[1] - b[1] ||
      a[2] - b[2] ||
      a[0] - b[0] ||
      String(a[3]).localeCompare(String(b[3]))
    );
}

function planBiome2FencePolyline(controlPoints, mode, originSave = { x: 100, y: 100 }) {
  const built = buildFencePolyline(controlPoints, mode);
  const network = createFenceNetwork({ familyBaseItemID: 40700246, graph: built.graph }).network;
  return planFenceNativeRepresentation({
    network,
    originSave,
    pitchX: 2,
    pitchY: 2,
    tessellationFactor: 2,
    baseSpanX: 2,
    baseSpanY: 2,
    orthogonalExtensions: BIOME2_FENCE_VARIATIONS.orthogonal,
    diagonalExtensions: BIOME2_FENCE_VARIATIONS.diagonal
  });
}

test('Fence native planner normalizes horizontal span regardless of authoring direction', () => {
  const forward = planBiome2FencePolyline([{ x: 0, y: 0 }, { x: 2, y: 0 }], FenceMode.ORTHOGONAL);
  const reverse = planBiome2FencePolyline([{ x: 2, y: 0 }, { x: 0, y: 0 }], FenceMode.ORTHOGONAL);
  assert.equal(forward.ok, true);
  assert.equal(reverse.ok, true);
  assert.deepEqual(canonicalNativeObjectSet(forward), canonicalNativeObjectSet(reverse));
  const ext = forward.objects.find((object) => object.role === 'ext');
  assert.deepEqual(
    [ext.itemID, ext.x, ext.y, ext.orientation, ext.state],
    [40700247, 102, 100, 'GridOrientation_Down', null]
  );
});

test('Fence native planner normalizes vertical span regardless of authoring direction', () => {
  const forward = planBiome2FencePolyline([{ x: 0, y: 0 }, { x: 0, y: 2 }], FenceMode.ORTHOGONAL);
  const reverse = planBiome2FencePolyline([{ x: 0, y: 2 }, { x: 0, y: 0 }], FenceMode.ORTHOGONAL);
  assert.equal(forward.ok, true);
  assert.equal(reverse.ok, true);
  assert.deepEqual(canonicalNativeObjectSet(forward), canonicalNativeObjectSet(reverse));
  const ext = forward.objects.find((object) => object.role === 'ext');
  assert.deepEqual(
    [ext.itemID, ext.x, ext.y, ext.orientation, ext.state],
    [40700247, 100, 102, 'GridOrientation_Left', null]
  );
});

test('Fence native planner normalizes positive-slope diagonal span regardless of authoring direction', () => {
  const forward = planBiome2FencePolyline([{ x: 0, y: 0 }, { x: 2, y: 2 }], FenceMode.DIAGONAL);
  const reverse = planBiome2FencePolyline([{ x: 2, y: 2 }, { x: 0, y: 0 }], FenceMode.DIAGONAL);
  assert.equal(forward.ok, true);
  assert.equal(reverse.ok, true);
  assert.deepEqual(canonicalNativeObjectSet(forward), canonicalNativeObjectSet(reverse));
});

test('Fence native planner normalizes negative-slope diagonal span regardless of authoring direction', () => {
  const forward = planBiome2FencePolyline([{ x: 0, y: 2 }, { x: 2, y: 0 }], FenceMode.DIAGONAL);
  const reverse = planBiome2FencePolyline([{ x: 2, y: 0 }, { x: 0, y: 2 }], FenceMode.DIAGONAL);
  assert.equal(forward.ok, true);
  assert.equal(reverse.ok, true);
  assert.deepEqual(canonicalNativeObjectSet(forward), canonicalNativeObjectSet(reverse));
  const ext = forward.objects.find((object) => object.role === 'diagExt');
  assert.equal(ext.orientation, 'GridOrientation_Left');
  assert.deepEqual(ext.state, { FenceMode: { Diagonal: true } });
});

test('Fence over-max native plan preserves logical quantity and deterministic separator representation', () => {
  const plan = planBiome2FencePolyline([{ x: 0, y: 0 }, { x: 9, y: 0 }], FenceMode.ORTHOGONAL);
  assert.equal(plan.ok, true);
  assert.equal(plan.logicalQuantity, 10);
  assert.deepEqual(
    plan.objects
      .map((object) => object.role === 'ext' ? `ext:${object.key}` : object.role)
      .sort(),
    ['base', 'base', 'base', 'ext:1', 'ext:6'].sort()
  );
  assert.equal(plan.nativeOracleInventoryCost, 10);
  assert.equal(plan.wandListInventoryDelta, 0);
});


test('fresh Road/Fence ID planner reproduces current DW-R01 identity allocation', () => {
  const cells = rasterizeRoadPath([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 }
  ]).cells;
  const network = createRoadNetwork({ familyBaseItemID: 40100068, cells }).network;
  const nativePlan = planRoadNativeRepresentation({
    network,
    originSave: { x: 328, y: 52 },
    pitchX: 4
  });
  const identityPlan = planFreshRoadFenceGridObjectIds(nativePlan, { nextGridObjectID: 15845 });
  assert.equal(identityPlan.ok, true);
  assert.deepEqual(identityPlan.allocatedGridObjectIDs, [15845, 15846, 15847]);
  assert.equal(identityPlan.resultingNextGridObjectID, 15848);
  assert.deepEqual(identityPlan.objects.map((object) => [object.id, object.x, object.y]), [
    [15845, 328, 52],
    [15846, 332, 52],
    [15847, 336, 52]
  ]);
  assert.equal(identityPlan.persistentWriteAuthorized, false);
});

test('direct-write preflight blocks a native plan until world surface is externally validated', () => {
  const cells = rasterizeRoadPath([{ x: 0, y: 0 }, { x: 1, y: 0 }]).cells;
  const network = createRoadNetwork({ familyBaseItemID: 40100068, cells }).network;
  const nativePlan = planRoadNativeRepresentation({
    network,
    originSave: { x: 328, y: 52 },
    pitchX: 4
  });
  const blocked = preflightRoadFenceDirectWrite({
    nativePlan,
    targetSurfaceValidated: false,
    nextGridObjectID: 15845
  });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.issues.some((issue) => issue.code === RoadFenceValidationCode.TARGET_SURFACE_UNVERIFIED));
  assert.equal(blocked.preserveOwnershipState, true);
  assert.equal(blocked.preserveCollectionState, true);
  assert.equal(blocked.preserveEntitlementState, true);
  assert.equal(blocked.persistentWriteAuthorized, false);
});

test('direct-write preflight returns identity plan only after explicit external surface validation', () => {
  const cells = rasterizeRoadPath([{ x: 0, y: 0 }, { x: 1, y: 1 }]).cells;
  const network = createRoadNetwork({ familyBaseItemID: 40100068, cells }).network;
  const nativePlan = planRoadNativeRepresentation({
    network,
    originSave: { x: 328, y: 52 },
    pitchX: 4
  });
  const accepted = preflightRoadFenceDirectWrite({
    nativePlan,
    targetSurfaceValidated: true,
    nextGridObjectID: 15845
  });
  assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.identityPlan.allocatedGridObjectIDs, [15845, 15846, 15847, 15848]);
  assert.equal(accepted.identityPlan.resultingNextGridObjectID, 15849);
  assert.equal(accepted.preserveOwnershipState, true);
  assert.equal(accepted.persistentWriteAuthorized, false);
});

test('fresh ID planner rejects invalid or unsafe NextGridObjectID input', () => {
  const cells = rasterizeRoadPath([{ x: 0, y: 0 }]).cells;
  const network = createRoadNetwork({ familyBaseItemID: 40100068, cells }).network;
  const nativePlan = planRoadNativeRepresentation({
    network,
    originSave: { x: 328, y: 52 },
    pitchX: 4
  });
  const invalid = planFreshRoadFenceGridObjectIds(nativePlan, { nextGridObjectID: 0 });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors[0].code, RoadFenceValidationCode.GRIDOBJECT_ID_ALLOCATION_INVALID);
});


test('DW-F01 fixture matches Fence descriptor set independent of fresh ID order', () => {
  const plan = planBiome2FencePolyline(
    [{ x: 0, y: 0 }, { x: 0, y: 2 }],
    FenceMode.ORTHOGONAL,
    { x: 344, y: 60 }
  );
  assert.equal(plan.ok, true);

  const fixtureObjects = [
    {
      id: 15856,
      itemID: 40700246,
      x: 344,
      y: 60,
      orientation: 'GridOrientation_Down',
      state: null
    },
    {
      id: 15857,
      itemID: 40700247,
      x: 344,
      y: 62,
      orientation: 'GridOrientation_Left',
      state: null
    },
    {
      id: 15858,
      itemID: 40700246,
      x: 344,
      y: 64,
      orientation: 'GridOrientation_Down',
      state: null
    }
  ];

  const canonical = (objects) => objects
    .map((object) => [object.itemID, object.x, object.y, object.orientation, object.state])
    .sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);

  assert.deepEqual(canonical(plan.objects), canonical(fixtureObjects));

  const identityPlan = planFreshRoadFenceGridObjectIds(plan, { nextGridObjectID: 15856 });
  assert.equal(identityPlan.ok, true);
  assert.equal(identityPlan.resultingNextGridObjectID, 15859);
  assert.deepEqual(identityPlan.allocatedGridObjectIDs, [15856, 15857, 15858]);
  assert.ok(
    JSON.stringify(identityPlan.objects.map((object) => [object.id, object.itemID])) !==
    JSON.stringify(fixtureObjects.map((object) => [object.id, object.itemID]))
  );
  assert.equal(identityPlan.persistentWriteAuthorized, false);
});


test('Fence native planner locks orthogonal N=8 max-extension blueprint', () => {
  const plan = planBiome2FencePolyline(
    [{ x: 0, y: 0 }, { x: 0, y: 7 }],
    FenceMode.ORTHOGONAL,
    { x: 100, y: 100 }
  );
  assert.equal(plan.ok, true);
  assert.equal(plan.logicalQuantity, 8);
  assert.deepEqual(canonicalNativeObjectSet(plan), [
    [40700246, 100, 100, 'GridOrientation_Down', null],
    [40700252, 100, 102, 'GridOrientation_Left', null],
    [40700246, 100, 114, 'GridOrientation_Down', null]
  ]);
});

test('Fence native planner locks orthogonal N=9 first over-max blueprint', () => {
  const plan = planBiome2FencePolyline(
    [{ x: 0, y: 0 }, { x: 0, y: 8 }],
    FenceMode.ORTHOGONAL,
    { x: 100, y: 100 }
  );
  assert.equal(plan.ok, true);
  assert.equal(plan.logicalQuantity, 9);
  assert.deepEqual(canonicalNativeObjectSet(plan), [
    [40700246, 100, 100, 'GridOrientation_Down', null],
    [40700252, 100, 102, 'GridOrientation_Left', null],
    [40700246, 100, 114, 'GridOrientation_Down', null],
    [40700246, 100, 116, 'GridOrientation_Down', null]
  ]);
});

test('Fence native planner locks positive-slope diagonal N=3 blueprint', () => {
  const plan = planBiome2FencePolyline(
    [{ x: 0, y: 0 }, { x: 2, y: 2 }],
    FenceMode.DIAGONAL,
    { x: 100, y: 100 }
  );
  assert.equal(plan.ok, true);
  assert.equal(plan.logicalQuantity, 3);
  assert.deepEqual(canonicalNativeObjectSet(plan), [
    [40700246, 100, 100, 'GridOrientation_Down', { FenceMode: { Diagonal: true } }],
    [40700253, 102, 102, 'GridOrientation_Down', { FenceMode: { Diagonal: true } }],
    [40700246, 104, 104, 'GridOrientation_Down', { FenceMode: { Diagonal: true } }]
  ]);
});


test('Fence native planner locks negative-slope diagonal N=3 blueprint', () => {
  const plan = planBiome2FencePolyline(
    [{ x: 0, y: 2 }, { x: 2, y: 0 }],
    FenceMode.DIAGONAL,
    { x: 100, y: 100 }
  );
  assert.equal(plan.ok, true);
  assert.equal(plan.logicalQuantity, 3);
  assert.deepEqual(canonicalNativeObjectSet(plan), [
    [40700246, 100, 104, 'GridOrientation_Down', { FenceMode: { Diagonal: true } }],
    [40700253, 102, 102, 'GridOrientation_Left', { FenceMode: { Diagonal: true } }],
    [40700246, 104, 100, 'GridOrientation_Down', { FenceMode: { Diagonal: true } }]
  ]);
});

test('Fence native planner locks positive-slope diagonal N=6 maximum blueprint', () => {
  const plan = planBiome2FencePolyline(
    [{ x: 0, y: 0 }, { x: 5, y: 5 }],
    FenceMode.DIAGONAL,
    { x: 100, y: 100 }
  );
  assert.equal(plan.ok, true);
  assert.equal(plan.logicalQuantity, 6);
  assert.deepEqual(canonicalNativeObjectSet(plan), [
    [40700246, 100, 100, 'GridOrientation_Down', { FenceMode: { Diagonal: true } }],
    [40700256, 102, 102, 'GridOrientation_Down', { FenceMode: { Diagonal: true } }],
    [40700246, 110, 110, 'GridOrientation_Down', { FenceMode: { Diagonal: true } }]
  ]);
  assert.equal(plan.nativeOracleInventoryCost, 6);
  assert.equal(plan.wandListInventoryDelta, 0);
});


test('Fence style replacement locks Biome2Fence to FairyLightFence N=3 contract', () => {
  const built = buildFencePolyline(
    [{ x: 0, y: 0 }, { x: 0, y: 2 }],
    FenceMode.ORTHOGONAL
  );
  const preview = previewFenceStyleReplacement({
    graph: built.graph,
    seedNodeId: built.graph.nodes[0].id,
    sourceFamilyBaseItemID: 40700246,
    targetFamilyBaseItemID: 40700268,
    targetAvailableLogicalQuantity: 3200
  });
  assert.equal(preview.ok, true);
  assert.equal(preview.mode, FenceMode.ORTHOGONAL);
  assert.equal(preview.logicalQuantity, 3);
  assert.equal(preview.nativeOracleSourceInventoryDelta, 3);
  assert.equal(preview.nativeOracleTargetInventoryDelta, -3);
  assert.equal(preview.wandSourceInventoryDelta, 0);
  assert.equal(preview.wandTargetInventoryDelta, 0);
  assert.equal(preview.ownershipMutationRequired, false);
  assert.equal(preview.persistentWriteAuthorized, false);

  const targetNetwork = createFenceNetwork({
    familyBaseItemID: 40700268,
    graph: built.graph
  }).network;
  const targetPlan = planFenceNativeRepresentation({
    network: targetNetwork,
    originSave: { x: 344, y: 60 },
    pitchX: 2,
    pitchY: 2,
    tessellationFactor: 2,
    baseSpanX: 2,
    baseSpanY: 2,
    orthogonalExtensions: {
      1: { itemID: 40700269, gridSizeX: 1, gridSizeY: 1 },
      2: { itemID: 40700270, gridSizeX: 2, gridSizeY: 1 },
      3: { itemID: 40700271, gridSizeX: 3, gridSizeY: 1 },
      4: { itemID: 40700272, gridSizeX: 4, gridSizeY: 1 },
      5: { itemID: 40700273, gridSizeX: 5, gridSizeY: 1 },
      6: { itemID: 40700274, gridSizeX: 6, gridSizeY: 1 }
    },
    diagonalExtensions: {
      1: { itemID: 40700275, gridSizeX: 1, gridSizeY: 1 },
      2: { itemID: 40700276, gridSizeX: 2, gridSizeY: 2 },
      3: { itemID: 40700277, gridSizeX: 3, gridSizeY: 3 },
      4: { itemID: 40700278, gridSizeX: 4, gridSizeY: 4 }
    }
  });
  assert.equal(targetPlan.ok, true);
  assert.deepEqual(canonicalNativeObjectSet(targetPlan), [
    [40700268, 344, 60, 'GridOrientation_Down', null],
    [40700269, 344, 62, 'GridOrientation_Left', null],
    [40700268, 344, 64, 'GridOrientation_Down', null]
  ]);
  assert.equal(targetPlan.wandListInventoryDelta, 0);
  assert.equal(targetPlan.ownershipMutationRequired, false);
});
