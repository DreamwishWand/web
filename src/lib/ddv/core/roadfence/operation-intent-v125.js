// 01C-owned, read-only intent-to-topology boundary. This is NOT a Save writer.
// Native storage/producer/recompile claims belong to separately proven 01E V3.
import {
  createFenceNetwork,
  createRoadNetwork,
  partitionFenceConnectedComponents,
  selectRoadConnected,
  transformFenceLogicalGraph,
  transformRoadCells
} from './logical.js';
import {
  normalizeBuildIdentity,
  topologyFingerprintIgnoringFamily
} from './persistent-v125/common.js';
import { RoadFencePersistentOperation } from './persistent-v125/constants.js';

export const ROADFENCE_OPERATION_INTENT_CONTRACT = 'ddv.roadfence-operation-intent@1';

export const RoadFenceEditIntent = Object.freeze({
  ADD: 'ADD',
  MOVE: 'MOVE',
  ROTATE: 'ROTATE',
  ERASE: 'ERASE',
  CONNECT: 'CONNECT',
  DISCONNECT: 'DISCONNECT',
  RECOMPILE: 'RECOMPILE'
});

const EDIT_INTENTS = new Set(Object.values(RoadFenceEditIntent));

function reject(code) {
  const e = new Error(code);
  e.code = code;
  throw e;
}

function requireNetwork(kind, value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    reject('ROADFENCE_OPERATION_NETWORK_REQUIRED');
  }
  const result =
    kind === 'road'
      ? createRoadNetwork(value)
      : createFenceNetwork(value);
  if (!result.ok) reject('ROADFENCE_OPERATION_TOPOLOGY_INVALID');
  return result.network;
}

function roadKey(cell) {
  return JSON.stringify([cell.x, cell.y, cell.mode]);
}

function nodeKey(node) {
  return JSON.stringify([String(node.id), node.x, node.y, node.mode]);
}

function edgeKey(edge) {
  return JSON.stringify([String(edge.a), String(edge.b)].sort());
}

function features(kind, network) {
  if (kind === 'road') {
    return {
      vertices: new Set(network.cells.map(roadKey)),
      edges: new Set()
    };
  }
  return {
    vertices: new Set(network.graph.nodes.map(nodeKey)),
    edges: new Set(network.graph.edges.map(edgeKey))
  };
}

function difference(left, right) {
  return [...left].filter((value) => !right.has(value));
}

function roadComponents(cells) {
  const pending = new Map(cells.map((cell) => [roadKey(cell), cell]));
  let components = 0;
  while (pending.size) {
    const seed = pending.values().next().value;
    const result = selectRoadConnected([...pending.values()], {
      x: seed.x,
      y: seed.y
    });
    if (!result.ok || !result.cells.length) reject('ROADFENCE_OPERATION_COMPONENT_INVALID');
    for (const cell of result.cells) pending.delete(roadKey(cell));
    components += 1;
  }
  return components;
}

function componentCount(kind, network) {
  return kind === 'road'
    ? roadComponents(network.cells)
    : partitionFenceConnectedComponents(
        network.graph.nodes,
        network.graph.edges
      ).length;
}

function sameTopology(a, b) {
  return topologyFingerprintIgnoringFamily(a) ===
    topologyFingerprintIgnoringFamily(b);
}

function requireMoveOrRotate(kind, intent, source, desired, motion) {
  if (!motion || typeof motion !== 'object' || Array.isArray(motion)) {
    reject('ROADFENCE_OPERATION_EXPLICIT_TRANSFORM_REQUIRED');
  }
  const unexpected = Object.keys(motion).filter((key) => ![
    'pivot', 'rotateQuarterTurns', 'translateX', 'translateY'
  ].includes(key));
  if (unexpected.length) reject('ROADFENCE_OPERATION_TRANSFORM_UNRECOGNIZED_FIELD');
  const turns = motion.rotateQuarterTurns ?? 0;
  const dx = motion.translateX ?? 0;
  const dy = motion.translateY ?? 0;
  if (!Number.isInteger(turns) || !Number.isInteger(dx) || !Number.isInteger(dy)) {
    reject('ROADFENCE_OPERATION_TRANSFORM_INVALID');
  }
  if (intent === RoadFenceEditIntent.MOVE) {
    if (turns !== 0 || (dx === 0 && dy === 0)) {
      reject('ROADFENCE_OPERATION_MOVE_TRANSFORM_INVALID');
    }
  } else if (
    (turns % 4) === 0 ||
    dx !== 0 ||
    dy !== 0
  ) {
    reject('ROADFENCE_OPERATION_ROTATE_TRANSFORM_INVALID');
  }

  const result = kind === 'road'
    ? transformRoadCells(source.cells, motion)
    : transformFenceLogicalGraph(source.graph, motion);
  if (!result.ok) reject('ROADFENCE_OPERATION_TRANSFORM_INVALID');
  const transformed = kind === 'road'
    ? { ...source, cells: result.cells }
    : { ...source, graph: result.graph };
  if (!sameTopology(transformed, desired) || sameTopology(source, desired)) {
    reject('ROADFENCE_OPERATION_TRANSFORM_MISMATCH');
  }
}

function assertIntent(kind, intent, source, desired, motion, before, after) {
  const a = features(kind, source);
  const b = features(kind, desired);
  const added = difference(b.vertices, a.vertices);
  const removed = difference(a.vertices, b.vertices);
  const newEdges = difference(b.edges, a.edges);
  const lostEdges = difference(a.edges, b.edges);
  const oldComponents = componentCount(kind, source);
  const newComponents = componentCount(kind, desired);
  const sameFamily = source.familyBaseItemID === desired.familyBaseItemID;
  if (!sameFamily) reject('ROADFENCE_OPERATION_FAMILY_CHANGED');

  switch (intent) {
    case RoadFenceEditIntent.ADD:
      if (!added.length || removed.length || lostEdges.length) {
        reject('ROADFENCE_OPERATION_ADD_NOT_MONOTONIC');
      }
      break;
    case RoadFenceEditIntent.ERASE:
      if (!removed.length || added.length || newEdges.length) {
        reject('ROADFENCE_OPERATION_ERASE_NOT_MONOTONIC');
      }
      break;
    case RoadFenceEditIntent.MOVE:
    case RoadFenceEditIntent.ROTATE:
      requireMoveOrRotate(kind, intent, source, desired, motion);
      break;
    case RoadFenceEditIntent.CONNECT:
      if (
        newComponents >= oldComponents ||
        removed.length ||
        lostEdges.length ||
        (kind === 'fence'
          ? (added.length > 0 || newEdges.length === 0)
          : added.length === 0)
      ) {
        reject('ROADFENCE_OPERATION_CONNECTION_NOT_PROVEN');
      }
      break;
    case RoadFenceEditIntent.DISCONNECT:
      if (
        newComponents <= oldComponents ||
        added.length ||
        newEdges.length ||
        (kind === 'fence' && (removed.length > 0 || lostEdges.length === 0))
      ) {
        reject('ROADFENCE_OPERATION_DISCONNECTION_NOT_PROVEN');
      }
      break;
    case RoadFenceEditIntent.RECOMPILE:
      if (!sameTopology(source, desired)) {
        reject('ROADFENCE_OPERATION_RECOMPILE_CHANGED_TOPOLOGY');
      }
      break;
    default:
      reject('ROADFENCE_OPERATION_INTENT_UNKNOWN');
  }

  const compilerOperation = kind === 'road'
    ? (intent === RoadFenceEditIntent.ERASE ||
       intent === RoadFenceEditIntent.DISCONNECT
        ? RoadFencePersistentOperation.ROAD_ERASE
        : RoadFencePersistentOperation.ROAD_SET_TOPOLOGY)
    : (intent === RoadFenceEditIntent.ERASE ||
       intent === RoadFenceEditIntent.DISCONNECT
        ? RoadFencePersistentOperation.FENCE_TOPOLOGY_ERASE
        : RoadFencePersistentOperation.FENCE_SET_TOPOLOGY);

  return {
    sourceComponents: oldComponents,
    desiredComponents: newComponents,
    logicalQuantityBefore: a.vertices.size,
    logicalQuantityAfter: b.vertices.size,
    logicalQuantityDelta: b.vertices.size - a.vertices.size,
    addedLogicalElements: added.length,
    removedLogicalElements: removed.length,
    addedExplicitConnections: newEdges.length,
    removedExplicitConnections: lostEdges.length,
    compilerOperation
  };
}

export function assessRoadFenceEditIntentV125({
  buildIdentity,
  kind,
  intent,
  sourceNetwork,
  desiredNetwork,
  motion = null
} = {}) {
  const base = {
    contract: ROADFENCE_OPERATION_INTENT_CONTRACT,
    kind: kind ?? null,
    intent: intent ?? null,
    semanticOwner: '01C CORE',
    layoutPolicy: 'PRESERVE_EXISTING',
    sourceBinding: 'REQUIRES_CORE_SESSION_TYPED_SOURCE_WITNESS',
    compilerSupport: 'MUST_RUN_EXISTING_01C_COMPILER_SEPARATELY',
    nativeProducerConsumerRecompileV3: 'UNKNOWN',
    nativeInventoryCostRefund: 'UNKNOWN',
    wandInventoryDelta: 0,
    writerAuthorized: false,
    persistentWriteAuthorized: false,
    WORLD_PERSISTENT_WRITE_V125: false,
    productApplyAuthorized: false
  };
  try {
    const normalizedBuild = normalizeBuildIdentity(buildIdentity);
    if (kind !== 'road' && kind !== 'fence') {
      reject('ROADFENCE_OPERATION_KIND_UNKNOWN');
    }
    if (!EDIT_INTENTS.has(intent)) {
      reject('ROADFENCE_OPERATION_INTENT_UNKNOWN');
    }
    const source = requireNetwork(kind, sourceNetwork);
    const desired = requireNetwork(kind, desiredNetwork);
    const assessment = assertIntent(
      kind, intent, source, desired, motion
    );
    return {
      ...base,
      status: 'STATIC_INTENT_VALIDATED_ONLY',
      sourceBuildIdentity: normalizedBuild,
      ...assessment,
      nextGate: 'EXACT_COMPILER_SCOPE_AND_01E_SAME_BUILD_V3'
    };
  } catch (error) {
    return {
      ...base,
      status: 'FAIL_CLOSED',
      errorCode: error.code || 'ROADFENCE_OPERATION_UNVERIFIED'
    };
  }
}
