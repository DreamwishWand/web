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


function logicalEdgeKey(a, b) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function sortLogicalNodes(nodeById, ids) {
  return [...ids].sort((a, b) => {
    const na = nodeById.get(a);
    const nb = nodeById.get(b);
    return na.y - nb.y || na.x - nb.x || String(a).localeCompare(String(b));
  });
}

function isValidFenceStep(a, b, mode) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (mode === FenceMode.ORTHOGONAL) return Math.abs(dx) + Math.abs(dy) === 1;
  return Math.abs(dx) === 1 && Math.abs(dy) === 1;
}

function isStraightThrough(node, neighborA, neighborB) {
  const ax = neighborA.x - node.x;
  const ay = neighborA.y - node.y;
  const bx = neighborB.x - node.x;
  const by = neighborB.y - node.y;
  return ax === -bx && ay === -by;
}

export function validateFenceLogicalGraph({ nodes = [], edges = [] } = {}) {
  const errors = [];
  const nodeById = new Map();
  const coordinateByMode = new Set();

  for (const node of nodes) {
    if (!node?.id || nodeById.has(node.id)) {
      errors.push({ code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED, reason: 'duplicate or missing Fence logical node id', node });
      continue;
    }
    try {
      assertIntegerCoordinate(node, `node ${node.id}`);
      normalizeMode(node.mode);
    } catch (error) {
      errors.push({ code: RoadFenceValidationCode.INVALID_GRID_QUANTUM, reason: error.message, node });
      continue;
    }
    const coordinateModeKey = `${node.mode}:${coordinateKey(node)}`;
    if (coordinateByMode.has(coordinateModeKey)) {
      errors.push({ code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED, reason: 'duplicate Fence logical coordinate inside one mode', node });
    }
    coordinateByMode.add(coordinateModeKey);
    nodeById.set(node.id, node);
  }

  const seenEdges = new Set();
  for (const edge of edges) {
    const a = nodeById.get(edge?.a);
    const b = nodeById.get(edge?.b);
    if (!a || !b || edge.a === edge.b) {
      errors.push({ code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED, reason: 'Fence edge references an unknown/self node', edge });
      continue;
    }
    const key = logicalEdgeKey(edge.a, edge.b);
    if (seenEdges.has(key)) {
      errors.push({ code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED, reason: 'duplicate Fence logical edge', edge });
      continue;
    }
    seenEdges.add(key);

    if (a.mode === b.mode && !isValidFenceStep(a, b, a.mode)) {
      errors.push({ code: RoadFenceValidationCode.INVALID_GRID_QUANTUM, reason: 'same-mode Fence edge is not one logical quantum', edge });
    }
  }

  return { ok: errors.length === 0, errors };
}

function compileFenceModeComponent({ mode, nodeIds, nodeById, adjacency }) {
  const componentSet = new Set(nodeIds);
  const baseVertexIds = new Set();

  for (const id of nodeIds) {
    const neighbors = [...(adjacency.get(id) ?? [])].filter((next) => componentSet.has(next));
    if (neighbors.length !== 2) {
      baseVertexIds.add(id);
      continue;
    }
    const node = nodeById.get(id);
    if (!isStraightThrough(node, nodeById.get(neighbors[0]), nodeById.get(neighbors[1]))) {
      baseVertexIds.add(id);
    }
  }

  const sameModeEdgeKeys = new Set();
  for (const id of nodeIds) {
    for (const next of adjacency.get(id) ?? []) {
      if (componentSet.has(next)) sameModeEdgeKeys.add(logicalEdgeKey(id, next));
    }
  }

  if (nodeIds.length > 1 && baseVertexIds.size === 0) {
    return {
      ok: false,
      errors: [{ code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED, reason: 'Fence component has no serializable Base vertex' }]
    };
  }

  const bases = new Map();
  const extensions = [];
  const spans = [];
  const visitedEdges = new Set();

  const addBase = (id, separator = false) => {
    const node = nodeById.get(id);
    const existing = bases.get(id);
    bases.set(id, {
      role: 'base',
      nodeId: id,
      x: node.x,
      y: node.y,
      mode,
      semanticVertex: baseVertexIds.has(id),
      separator: Boolean(separator || existing?.separator)
    });
  };

  if (nodeIds.length === 1) addBase(nodeIds[0]);

  for (const startId of sortLogicalNodes(nodeById, baseVertexIds)) {
    addBase(startId);
    const startNeighbors = sortLogicalNodes(nodeById, adjacency.get(startId) ?? []);
    for (const firstId of startNeighbors) {
      if (!componentSet.has(firstId)) continue;
      const firstEdgeKey = logicalEdgeKey(startId, firstId);
      if (visitedEdges.has(firstEdgeKey)) continue;

      const path = [startId];
      let previousId = startId;
      let currentId = firstId;
      visitedEdges.add(firstEdgeKey);

      while (true) {
        path.push(currentId);
        if (baseVertexIds.has(currentId)) break;
        const candidates = sortLogicalNodes(
          nodeById,
          [...(adjacency.get(currentId) ?? [])].filter((id) => componentSet.has(id) && id !== previousId)
        );
        if (candidates.length !== 1) {
          return {
            ok: false,
            errors: [{ code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED, reason: 'Fence span traversal became ambiguous', nodeId: currentId }]
          };
        }
        const nextId = candidates[0];
        visitedEdges.add(logicalEdgeKey(currentId, nextId));
        previousId = currentId;
        currentId = nextId;
      }

      const straightPlan = planFenceStraightRun(path.length, mode);
      const spanIndex = spans.length;
      spans.push({ spanIndex, mode, nodeIds: [...path] });

      for (const part of straightPlan.components) {
        if (part.role === 'base') {
          const nodeId = path[part.logicalOffset];
          addBase(nodeId, part.separator);
          continue;
        }
        extensions.push({
          role: part.role,
          mode,
          key: part.key,
          spanIndex,
          fromNodeId: path[part.fromOffset],
          toNodeId: path[part.toOffset],
          anchorOrientationResolutionRequired: true
        });
      }
    }
  }

  if (visitedEdges.size !== sameModeEdgeKeys.size) {
    return {
      ok: false,
      errors: [{
        code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED,
        reason: 'Fence component contains uncompiled edges',
        visitedEdges: visitedEdges.size,
        expectedEdges: sameModeEdgeKeys.size
      }]
    };
  }

  const representation = [
    ...sortLogicalNodes(nodeById, bases.keys()).map((id) => bases.get(id)),
    ...extensions
  ];
  const serializedLogicalQuantity = fenceRepresentationQuantity(representation);
  if (serializedLogicalQuantity !== nodeIds.length) {
    return {
      ok: false,
      errors: [{
        code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED,
        reason: 'Fence graph compiler quantity invariant failed',
        serializedLogicalQuantity,
        logicalQuantity: nodeIds.length
      }]
    };
  }

  return {
    ok: true,
    mode,
    nodeIds: sortLogicalNodes(nodeById, nodeIds),
    logicalQuantity: nodeIds.length,
    serializedLogicalQuantity,
    bases: sortLogicalNodes(nodeById, bases.keys()).map((id) => bases.get(id)),
    extensions,
    spans,
    representation
  };
}

export function compileFenceLogicalGraph(graph = {}) {
  const validation = validateFenceLogicalGraph(graph);
  if (!validation.ok) return { ok: false, errors: validation.errors, persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED };

  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  if (nodes.length === 0) {
    return {
      ok: true,
      logicalQuantity: 0,
      components: [],
      modeBoundaries: [],
      persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
    };
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const sameModeAdjacency = new Map(nodes.map((node) => [node.id, new Set()]));
  const modeBoundaries = [];

  for (const edge of edges) {
    const a = nodeById.get(edge.a);
    const b = nodeById.get(edge.b);
    if (a.mode !== b.mode) {
      modeBoundaries.push({ a: edge.a, b: edge.b });
      continue;
    }
    sameModeAdjacency.get(edge.a).add(edge.b);
    sameModeAdjacency.get(edge.b).add(edge.a);
  }

  const visited = new Set();
  const components = [];

  for (const seed of sortLogicalNodes(nodeById, nodeById.keys())) {
    if (visited.has(seed)) continue;
    const mode = nodeById.get(seed).mode;
    const queue = [seed];
    const ids = [];
    visited.add(seed);
    while (queue.length) {
      const id = queue.shift();
      ids.push(id);
      for (const next of sameModeAdjacency.get(id) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    const compiled = compileFenceModeComponent({
      mode,
      nodeIds: ids,
      nodeById,
      adjacency: sameModeAdjacency
    });
    if (!compiled.ok) return { ...compiled, persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED };
    components.push(compiled);
  }

  const logicalQuantity = components.reduce((sum, component) => sum + component.logicalQuantity, 0);
  return {
    ok: true,
    logicalQuantity,
    components,
    modeBoundaries,
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}

export function eraseFenceLogicalUnits(graph = {}, nodeIdsToErase = []) {
  const eraseSet = new Set(nodeIdsToErase);
  const sourceNodes = graph.nodes ?? [];
  const existingIds = new Set(sourceNodes.map((node) => node.id));
  const unknownIds = [...eraseSet].filter((id) => !existingIds.has(id));
  if (unknownIds.length) {
    return {
      ok: false,
      errors: [{ code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED, reason: 'erase references unknown Fence logical units', nodeIds: unknownIds }],
      persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
    };
  }

  const nodes = sourceNodes.filter((node) => !eraseSet.has(node.id));
  const edges = (graph.edges ?? []).filter((edge) => !eraseSet.has(edge.a) && !eraseSet.has(edge.b));
  const compiled = compileFenceLogicalGraph({ nodes, edges });
  if (!compiled.ok) return compiled;

  return {
    ok: true,
    graph: { nodes, edges },
    refundLogicalQuantity: eraseSet.size,
    remainingLogicalQuantity: nodes.length,
    compiled,
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}


function expandPolylineControlPoints(controlPoints, mode = null) {
  if (!Array.isArray(controlPoints) || controlPoints.length === 0) {
    throw new TypeError('controlPoints must contain at least one logical coordinate');
  }
  controlPoints.forEach((point, index) => assertIntegerCoordinate(point, `controlPoints[${index}]`));
  if (mode !== null) normalizeMode(mode);

  const expanded = [{ x: controlPoints[0].x, y: controlPoints[0].y }];
  for (let i = 1; i < controlPoints.length; i += 1) {
    const from = controlPoints[i - 1];
    const to = controlPoints[i];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (dx === 0 && dy === 0) continue;

    const cardinal = dx === 0 || dy === 0;
    const diagonal = Math.abs(dx) === Math.abs(dy);
    if (!cardinal && !diagonal) {
      throw new RangeError('polyline segment must be cardinal or 45-degree diagonal');
    }
    if (mode === FenceMode.ORTHOGONAL && !cardinal) {
      throw new RangeError('orthogonal Fence polyline cannot contain diagonal segments');
    }
    if (mode === FenceMode.DIAGONAL && !diagonal) {
      throw new RangeError('diagonal Fence polyline cannot contain cardinal segments');
    }

    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    for (let step = 1; step <= steps; step += 1) {
      expanded.push({ x: from.x + sx * step, y: from.y + sy * step });
    }
  }
  return expanded;
}

export function rasterizeRoadPolyline(controlPoints) {
  return rasterizeRoadPath(expandPolylineControlPoints(controlPoints));
}

export function buildFencePolyline(controlPoints, mode) {
  normalizeMode(mode);
  const points = expandPolylineControlPoints(controlPoints, mode);
  const nodesByCoordinate = new Map();
  const edgesByKey = new Map();
  let previousId = null;

  for (const point of points) {
    const id = coordinateKey(point);
    if (!nodesByCoordinate.has(id)) {
      nodesByCoordinate.set(id, { id, x: point.x, y: point.y, mode });
    }
    if (previousId !== null && previousId !== id) {
      const key = logicalEdgeKey(previousId, id);
      if (!edgesByKey.has(key)) edgesByKey.set(key, { a: previousId, b: id });
    }
    previousId = id;
  }

  const graph = {
    nodes: [...nodesByCoordinate.values()],
    edges: [...edgesByKey.values()]
  };
  const compiled = compileFenceLogicalGraph(graph);
  return {
    graph,
    compiled,
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}

export function buildFenceRectangleOutline({ minX, minY, maxX, maxY }) {
  for (const [name, value] of Object.entries({ minX, minY, maxX, maxY })) {
    if (!Number.isInteger(value)) throw new TypeError(`${name} must be an integer logical coordinate`);
  }
  if (maxX <= minX || maxY <= minY) {
    throw new RangeError('Fence rectangle outline requires positive width and height');
  }

  return buildFencePolyline([
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
    { x: minX, y: minY }
  ], FenceMode.ORTHOGONAL);
}


export function buildRoadRegionFill({ minX, minY, maxX, maxY }) {
  for (const [name, value] of Object.entries({ minX, minY, maxX, maxY })) {
    if (!Number.isInteger(value)) throw new TypeError(`${name} must be an integer logical coordinate`);
  }
  if (maxX < minX || maxY < minY) {
    throw new RangeError('Road region fill requires non-negative width and height');
  }

  const cells = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      cells.push({
        x,
        y,
        mode: FenceMode.ORTHOGONAL,
        modeClaims: [FenceMode.ORTHOGONAL]
      });
    }
  }

  return {
    cells,
    inventoryQuantity: cells.length,
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}

export function eraseRoadCells(cells = [], coordinatesToErase = []) {
  const eraseKeys = new Set((coordinatesToErase ?? []).map((point, index) => {
    assertIntegerCoordinate(point, `coordinatesToErase[${index}]`);
    return coordinateKey(point);
  }));
  const existingKeys = new Set((cells ?? []).map((cell) => coordinateKey(cell)));
  const missing = [...eraseKeys].filter((key) => !existingKeys.has(key));
  if (missing.length) {
    return {
      ok: false,
      errors: [{
        code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED,
        reason: 'Road erase references cells that are not present',
        coordinates: missing
      }],
      persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
    };
  }

  const remaining = (cells ?? []).filter((cell) => !eraseKeys.has(coordinateKey(cell)));
  return {
    ok: true,
    cells: remaining,
    refundLogicalQuantity: eraseKeys.size,
    remainingLogicalQuantity: remaining.length,
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}

export function selectFenceConnected(graph = {}, seedNodeId) {
  const validation = validateFenceLogicalGraph(graph);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
    };
  }

  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const seed = nodeById.get(seedNodeId);
  if (!seed) {
    return {
      ok: false,
      errors: [{
        code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED,
        reason: 'Fence connected selection seed does not exist',
        seedNodeId
      }],
      persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
    };
  }

  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const edge of edges) {
    const a = nodeById.get(edge.a);
    const b = nodeById.get(edge.b);
    if (a.mode !== b.mode) continue;
    adjacency.get(a.id).add(b.id);
    adjacency.get(b.id).add(a.id);
  }

  const selected = new Set([seedNodeId]);
  const queue = [seedNodeId];
  while (queue.length) {
    const id = queue.shift();
    for (const next of adjacency.get(id) ?? []) {
      if (!selected.has(next)) {
        selected.add(next);
        queue.push(next);
      }
    }
  }

  const nodeIds = sortLogicalNodes(nodeById, selected);
  const selectedSet = new Set(nodeIds);
  const selectedEdges = edges.filter((edge) => selectedSet.has(edge.a) && selectedSet.has(edge.b) && nodeById.get(edge.a).mode === nodeById.get(edge.b).mode);

  return {
    ok: true,
    mode: seed.mode,
    nodeIds,
    edges: selectedEdges,
    logicalQuantity: nodeIds.length,
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}

function normalizeQuarterTurns(value = 0) {
  if (!Number.isInteger(value)) throw new TypeError('rotateQuarterTurns must be an integer');
  return ((value % 4) + 4) % 4;
}

function transformLogicalPoint(point, {
  pivot = { x: 0, y: 0 },
  rotateQuarterTurns = 0,
  translateX = 0,
  translateY = 0
} = {}) {
  assertIntegerCoordinate(point, 'point');
  assertIntegerCoordinate(pivot, 'pivot');
  if (!Number.isInteger(translateX) || !Number.isInteger(translateY)) {
    throw new TypeError('logical translation must use integer units');
  }

  const turns = normalizeQuarterTurns(rotateQuarterTurns);
  let x = point.x - pivot.x;
  let y = point.y - pivot.y;
  for (let i = 0; i < turns; i += 1) {
    [x, y] = [-y, x];
  }

  return {
    x: x + pivot.x + translateX,
    y: y + pivot.y + translateY
  };
}

export function transformRoadCells(cells = [], options = {}) {
  const transformed = (cells ?? []).map((cell) => ({
    ...cell,
    ...transformLogicalPoint(cell, options),
    modeClaims: Array.isArray(cell.modeClaims) ? [...cell.modeClaims] : cell.modeClaims
  }));
  const validation = validateRoadCells(transformed);
  return {
    ok: validation.ok,
    errors: validation.errors,
    cells: transformed,
    inventoryQuantity: transformed.length,
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}

export function transformFenceLogicalGraph(graph = {}, options = {}) {
  const validation = validateFenceLogicalGraph(graph);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
    };
  }

  const nodes = (graph.nodes ?? []).map((node) => ({
    ...node,
    ...transformLogicalPoint(node, options)
  }));
  const edges = (graph.edges ?? []).map((edge) => ({ ...edge }));
  const transformed = { nodes, edges };
  const compiled = compileFenceLogicalGraph(transformed);

  return {
    ok: compiled.ok,
    errors: compiled.errors ?? [],
    graph: transformed,
    compiled,
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}

export function previewFenceStyleReplacement({
  graph = {},
  seedNodeId,
  sourceFamilyBaseItemID,
  targetFamilyBaseItemID,
  targetAvailableLogicalQuantity = Number.POSITIVE_INFINITY
}) {
  if (sourceFamilyBaseItemID === undefined || targetFamilyBaseItemID === undefined) {
    throw new TypeError('source and target Fence family Base ItemIDs are required');
  }
  if (sourceFamilyBaseItemID === targetFamilyBaseItemID) {
    return {
      ok: false,
      code: RoadFenceValidationCode.READ_ONLY_UNSUPPORTED,
      reason: 'source and target Fence families are identical',
      persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
    };
  }

  const selected = selectFenceConnected(graph, seedNodeId);
  if (!selected.ok) return selected;
  const quantity = selected.logicalQuantity;
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
    sourceFamilyBaseItemID,
    targetFamilyBaseItemID,
    mode: selected.mode,
    nodeIds: selected.nodeIds,
    logicalQuantity: quantity,
    sourceInventoryDelta: quantity,
    targetInventoryDelta: -quantity,
    graph,
    persistentWriteAuthorized: PERSISTENT_WRITE_AUTHORIZED
  };
}
