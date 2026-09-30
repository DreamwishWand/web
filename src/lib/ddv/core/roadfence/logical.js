export const ROADFENCE_LOGICAL_CONTRACT_VERSION = 'v1.25.0';
export const PERSISTENT_WRITE_AUTHORIZED = false;

export const RoadFenceValidationCode = Object.freeze({
  ROADFENCE_WRITER_DISABLED: 'ROADFENCE_WRITER_DISABLED',
  UNSUPPORTED_GAME_VERSION: 'UNSUPPORTED_GAME_VERSION',
  UNKNOWN_ROADFENCE_FAMILY: 'UNKNOWN_ROADFENCE_FAMILY',
  INVALID_GRID_QUANTUM: 'INVALID_GRID_QUANTUM',
  DUPLICATE_ROAD_CELL: 'DUPLICATE_ROAD_CELL',
  ROAD_MODE_STATE_UNSUPPORTED: 'ROAD_MODE_STATE_UNSUPPORTED',
  FENCE_VARIATION_FAMILY_MISMATCH: 'FENCE_VARIATION_FAMILY_MISMATCH',
  FENCE_EXTENSION_KEY_UNSUPPORTED: 'FENCE_EXTENSION_KEY_UNSUPPORTED',
  FENCE_ANCHOR_ORIENTATION_MISMATCH: 'FENCE_ANCHOR_ORIENTATION_MISMATCH',
  FENCE_MODE_MISMATCH: 'FENCE_MODE_MISMATCH',
  FENCE_COMPONENT_BOUNDARY_MISMATCH: 'FENCE_COMPONENT_BOUNDARY_MISMATCH',
  TOPOLOGY_CLIPPED_UNSUPPORTED: 'TOPOLOGY_CLIPPED_UNSUPPORTED',
  INVENTORY_SHORTAGE: 'INVENTORY_SHORTAGE',
  ID_REMAP_UNRESOLVED: 'ID_REMAP_UNRESOLVED',
  READ_ONLY_UNSUPPORTED: 'READ_ONLY_UNSUPPORTED'
});

export const FenceMode = Object.freeze({
  ORTHOGONAL: 'orthogonal',
  DIAGONAL: 'diagonal'
});

const ORTHOGONAL_KMAX = 6;
const DIAGONAL_KMAX = 4;

function assertIntegerCoordinate(point, label) {
  if (!point || !Number.isInteger(point.x) || !Number.isInteger(point.y)) {
    throw new TypeError(`${label} must contain integer x/y logical coordinates`);
  }
}

function coordinateKey({ x, y }) {
  return `${x},${y}`;
}

function normalizeMode(mode) {
  if (mode !== FenceMode.ORTHOGONAL && mode !== FenceMode.DIAGONAL) {
    throw new RangeError(`unsupported mode: ${mode}`);
  }
  return mode;
}

export function roadDiagonalStepCells(previous, current) {
  assertIntegerCoordinate(previous, 'previous');
  assertIntegerCoordinate(current, 'current');
  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  if (Math.abs(dx) !== 1 || Math.abs(dy) !== 1) {
    throw new RangeError('road diagonal quantum must move exactly one logical unit on both axes');
  }
  return [
    { x: previous.x, y: previous.y },
    { x: current.x, y: current.y },
    { x: previous.x, y: current.y },
    { x: current.x, y: previous.y }
  ];
}

export function rasterizeRoadPath(points) {
  if (!Array.isArray(points) || points.length === 0) {
    throw new TypeError('points must contain at least one logical coordinate');
  }
  points.forEach((point, index) => assertIntegerCoordinate(point, `points[${index}]`));

  const claims = new Map();
  const addClaim = (point, mode) => {
    const key = coordinateKey(point);
    let entry = claims.get(key);
    if (!entry) {
      entry = { x: point.x, y: point.y, modeClaims: new Set() };
      claims.set(key, entry);
    }
    entry.modeClaims.add(mode);
  };

  if (points.length === 1) addClaim(points[0], FenceMode.ORTHOGONAL);

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const cardinal = Math.abs(dx) + Math.abs(dy) === 1;
    const diagonal = Math.abs(dx) === 1 && Math.abs(dy) === 1;
    if (!cardinal && !diagonal) {
      throw new RangeError('road path steps must be unit cardinal or unit diagonal quanta');
    }
    if (cardinal) {
      addClaim(previous, FenceMode.ORTHOGONAL);
      addClaim(current, FenceMode.ORTHOGONAL);
    } else {
      for (const cell of roadDiagonalStepCells(previous, current)) addClaim(cell, FenceMode.DIAGONAL);
    }
  }

  const cells = [...claims.values()]
    .map((entry) => {
      const modes = [...entry.modeClaims].sort();
      return {
        x: entry.x,
        y: entry.y,
        mode: modes.length === 1 ? modes[0] : 'runtime-gated-transition',
        modeClaims: modes
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);

  return {
    cells,
    inventoryQuantity: cells.length,
    requiresRuntimeTransitionNormalization: cells.some((cell) => cell.modeClaims.length > 1)
  };
}

export function validateRoadCells(cells, { supportsDiagonal = true } = {}) {
  const errors = [];
  const seen = new Set();
  for (const cell of cells ?? []) {
    if (!Number.isInteger(cell?.x) || !Number.isInteger(cell?.y)) {
      errors.push({ code: RoadFenceValidationCode.INVALID_GRID_QUANTUM, cell });
      continue;
    }
    const key = coordinateKey(cell);
    if (seen.has(key)) errors.push({ code: RoadFenceValidationCode.DUPLICATE_ROAD_CELL, cell });
    seen.add(key);
    if (cell.mode === FenceMode.DIAGONAL && !supportsDiagonal) {
      errors.push({ code: RoadFenceValidationCode.ROAD_MODE_STATE_UNSUPPORTED, cell });
    }
    if (![FenceMode.ORTHOGONAL, FenceMode.DIAGONAL, 'runtime-gated-transition'].includes(cell.mode)) {
      errors.push({ code: RoadFenceValidationCode.ROAD_MODE_STATE_UNSUPPORTED, cell });
    }
  }
  return { ok: errors.length === 0, errors };
}

export function fenceRepresentationWeight(component) {
  if (!component || typeof component !== 'object') throw new TypeError('component is required');
  if (component.role === 'base') return 1;
  if (component.role === 'ext' || component.role === 'diagExt') {
    if (!Number.isInteger(component.key) || component.key < 1) {
      throw new RangeError('extension key must be a positive integer');
    }
    return component.key;
  }
  throw new RangeError(`unsupported Fence representation role: ${component.role}`);
}

export function fenceRepresentationQuantity(components) {
  return (components ?? []).reduce((sum, component) => sum + fenceRepresentationWeight(component), 0);
}

export function planFenceStraightRun(quantity, mode) {
  normalizeMode(mode);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError('Fence logical quantity must be a positive integer');
  }

  const kmax = mode === FenceMode.DIAGONAL ? DIAGONAL_KMAX : ORTHOGONAL_KMAX;
  const extRole = mode === FenceMode.DIAGONAL ? 'diagExt' : 'ext';
  const components = [{ role: 'base', mode, logicalOffset: 0 }];
  let remaining = quantity - 1;
  let cursor = 0;

  while (remaining > kmax + 1) {
    components.push({ role: extRole, mode, key: kmax, fromOffset: cursor, toOffset: cursor + kmax + 1 });
    cursor += kmax + 1;
    components.push({ role: 'base', mode, logicalOffset: cursor, separator: true });
    remaining -= kmax + 1;
  }

  if (remaining === 0) return finalizeFencePlan(quantity, mode, components);

  if (remaining === 1) {
    cursor += 1;
    components.push({ role: 'base', mode, logicalOffset: cursor });
    return finalizeFencePlan(quantity, mode, components);
  }

  const key = remaining - 1;
  components.push({ role: extRole, mode, key, fromOffset: cursor, toOffset: cursor + remaining });
  cursor += remaining;
  components.push({ role: 'base', mode, logicalOffset: cursor });
  return finalizeFencePlan(quantity, mode, components);
}

function finalizeFencePlan(quantity, mode, components) {
  const serializedLogicalQuantity = fenceRepresentationQuantity(components);
  if (serializedLogicalQuantity !== quantity) {
    throw new Error(`internal Fence compiler invariant failed: ${serializedLogicalQuantity} != ${quantity}`);
  }
  return {
    mode,
    logicalQuantity: quantity,
    serializedLogicalQuantity,
    components
  };
}

export function validateFenceRepresentationPlan(plan) {
  const errors = [];
  if (!plan || !Array.isArray(plan.components)) {
    return { ok: false, errors: [{ code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED }] };
  }
  let mode;
  try {
    mode = normalizeMode(plan.mode);
  } catch {
    errors.push({ code: RoadFenceValidationCode.FENCE_MODE_MISMATCH });
  }
  const maxKey = mode === FenceMode.DIAGONAL ? DIAGONAL_KMAX : ORTHOGONAL_KMAX;
  for (const component of plan.components) {
    if (component.mode !== mode) errors.push({ code: RoadFenceValidationCode.FENCE_MODE_MISMATCH, component });
    if (component.role === 'ext' && mode === FenceMode.DIAGONAL) {
      errors.push({ code: RoadFenceValidationCode.FENCE_MODE_MISMATCH, component });
    }
    if (component.role === 'diagExt' && mode === FenceMode.ORTHOGONAL) {
      errors.push({ code: RoadFenceValidationCode.FENCE_MODE_MISMATCH, component });
    }
    if ((component.role === 'ext' || component.role === 'diagExt') && (!Number.isInteger(component.key) || component.key < 1 || component.key > maxKey)) {
      errors.push({ code: RoadFenceValidationCode.FENCE_EXTENSION_KEY_UNSUPPORTED, component });
    }
  }
  try {
    if (fenceRepresentationQuantity(plan.components) !== plan.logicalQuantity) {
      errors.push({ code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED, reason: 'logical quantity mismatch' });
    }
  } catch {
    errors.push({ code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED, reason: 'unknown representation role' });
  }
  return { ok: errors.length === 0, errors };
}

export function partitionFenceConnectedComponents(nodes, edges) {
  const nodeById = new Map();
  for (const node of nodes ?? []) {
    if (!node?.id) throw new TypeError('Fence node id is required');
    nodeById.set(node.id, { ...node, mode: normalizeMode(node.mode) });
  }

  const adjacency = new Map([...nodeById.keys()].map((id) => [id, new Set()]));
  for (const edge of edges ?? []) {
    const a = nodeById.get(edge.a);
    const b = nodeById.get(edge.b);
    if (!a || !b) throw new RangeError('Fence edge references an unknown node');
    if (a.mode !== b.mode) continue;
    adjacency.get(a.id).add(b.id);
    adjacency.get(b.id).add(a.id);
  }

  const visited = new Set();
  const components = [];
  for (const node of nodeById.values()) {
    if (visited.has(node.id)) continue;
    const queue = [node.id];
    const ids = [];
    visited.add(node.id);
    while (queue.length) {
      const id = queue.shift();
      ids.push(id);
      for (const next of adjacency.get(id)) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    components.push({ mode: node.mode, nodeIds: ids.sort() });
  }
  return components;
}

export function validateContainedTopology(componentNodeIds, includedNodeIds) {
  const component = new Set(componentNodeIds ?? []);
  const included = new Set(includedNodeIds ?? []);
  let includedCount = 0;
  for (const id of component) if (included.has(id)) includedCount += 1;
  const clipped = includedCount > 0 && includedCount < component.size;
  return clipped
    ? { ok: false, code: RoadFenceValidationCode.TOPOLOGY_CLIPPED_UNSUPPORTED }
    : { ok: true, code: null };
}

export function predictConnectedFenceRemoval({ components, gridObjectIds = [] }) {
  const refund = fenceRepresentationQuantity(components);
  return {
    refundLogicalQuantity: refund,
    removedGridObjectIds: [...gridObjectIds],
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}

export function predictFenceStyleReplacement({
  sourceComponents,
  sourceGridObjectIds = [],
  targetAvailableLogicalQuantity = Number.POSITIVE_INFINITY
}) {
  const quantity = fenceRepresentationQuantity(sourceComponents);
  if (targetAvailableLogicalQuantity < quantity) {
    return {
      ok: false,
      code: RoadFenceValidationCode.INVENTORY_SHORTAGE,
      requiredLogicalQuantity: quantity,
      availableLogicalQuantity: targetAvailableLogicalQuantity,
      persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
    };
  }
  return {
    ok: true,
    logicalQuantity: quantity,
    sourceInventoryDelta: quantity,
    targetInventoryDelta: -quantity,
    replacedGridObjectIds: [...sourceGridObjectIds],
    requiresFreshTargetGridObjectIds: sourceGridObjectIds.length,
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}

export function requirePersistentRoadFenceWriter() {
  return {
    ok: false,
    code: RoadFenceValidationCode.ROADFENCE_WRITER_DISABLED,
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}
