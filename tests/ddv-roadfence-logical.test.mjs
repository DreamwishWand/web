import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FenceMode,
  PERSISTENT_WRITE_AUTHORIZED,
  RoadFenceValidationCode,
  fenceRepresentationQuantity,
  partitionFenceConnectedComponents,
  planFenceStraightRun,
  predictConnectedFenceRemoval,
  predictFenceStyleReplacement,
  rasterizeRoadPath,
  requirePersistentRoadFenceWriter,
  roadDiagonalStepCells,
  validateContainedTopology,
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
  assert.equal(result.inventoryQuantity, 4);
  assert.equal(result.requiresRuntimeTransitionNormalization, false);
  assert.ok(result.cells.every((cell) => cell.mode === FenceMode.DIAGONAL));
});

test('two same-slope Road diagonal quanta deduplicate to seven persistent cells', () => {
  const result = rasterizeRoadPath([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]);
  assert.equal(result.cells.length, 7);
  assert.equal(result.inventoryQuantity, 7);
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
  assert.equal(prediction.refundLogicalQuantity, 8);
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
    sourceInventoryDelta: 8,
    targetInventoryDelta: -8,
    replacedGridObjectIds: [10, 11, 12],
    requiresFreshTargetGridObjectIds: 3,
    persistentWriteAuthorized: false
  });
});

test('style replacement fails closed on target inventory shortage', () => {
  const plan = planFenceStraightRun(8, FenceMode.ORTHOGONAL);
  const prediction = predictFenceStyleReplacement({ sourceComponents: plan.components, targetAvailableLogicalQuantity: 7 });
  assert.equal(prediction.ok, false);
  assert.equal(prediction.code, RoadFenceValidationCode.INVENTORY_SHORTAGE);
});

test('Capture Region topology clipping fails closed', () => {
  assert.deepEqual(validateContainedTopology(['a', 'b', 'c'], ['a', 'b']), {
    ok: false,
    code: RoadFenceValidationCode.TOPOLOGY_CLIPPED_UNSUPPORTED
  });
  assert.deepEqual(validateContainedTopology(['a', 'b', 'c'], ['a', 'b', 'c']), { ok: true, code: null });
  assert.deepEqual(validateContainedTopology(['a', 'b', 'c'], []), { ok: true, code: null });
});

test('persistent Road/Fence writer remains hard-disabled', () => {
  assert.equal(PERSISTENT_WRITE_AUTHORIZED, false);
  assert.deepEqual(requirePersistentRoadFenceWriter(), {
    ok: false,
    code: RoadFenceValidationCode.ROADFENCE_WRITER_DISABLED,
    persistentWriteAuthorized: false
  });
});
