import { FenceMode } from '../../src/lib/ddv/core/roadfence/logical.js';
import {
  fenceLogicalTopologyFingerprint
} from '../../src/lib/ddv/core/roadfence/representation-layout-v125.ts';

export const BUILD_V125_SWITCH = Object.freeze({
  platform: 'Nintendo Switch',
  gameVersion: '1.25.0',
  tid: '0100D39012C1A000',
  bid: '52BD625D9B4E0053',
  profileSchema: 624
});

export function makeGrid(objects = [], nextGridObjectID = 100) {
  return {
    ID: 7,
    TessellationFactor: 2,
    NextGridObjectID: nextGridObjectID,
    OpaqueGridField: { keep: 'yes' },
    Objects: Object.fromEntries(
      objects.map((object) => [
        String(object.ID),
        structuredClone(object)
      ])
    )
  };
}

export function makeObject(
  ID,
  ItemID,
  X,
  Y,
  Orientation = 'GridOrientation_Down',
  State = null,
  extra = {}
) {
  return {
    ID,
    ItemID,
    X,
    Y,
    Orientation,
    State,
    ...structuredClone(extra)
  };
}

export function roadNetwork(familyBaseItemID, cells) {
  return { familyBaseItemID, cells };
}

export function orthogonalRectCells(
  minX,
  minY,
  maxX,
  maxY,
  hollow = false
) {
  const cells = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (
        !hollow ||
        x === minX ||
        x === maxX ||
        y === minY ||
        y === maxY
      ) {
        cells.push({
          x,
          y,
          mode: FenceMode.ORTHOGONAL
        });
      }
    }
  }
  return cells;
}

export function lineFence(
  quantity,
  mode = FenceMode.ORTHOGONAL,
  familyBaseItemID = 40700246
) {
  const nodes = Array.from(
    { length: quantity },
    (_, index) => ({
      id: 'n' + String(index),
      x: index,
      y: mode === FenceMode.DIAGONAL ? index : 0,
      mode
    })
  );
  const edges = Array.from(
    { length: Math.max(0, quantity - 1) },
    (_, index) => ({
      a: 'n' + String(index),
      b: 'n' + String(index + 1)
    })
  );
  return {
    familyBaseItemID,
    graph: { nodes, edges }
  };
}

export function generatedFenceLayoutRequest() {
  return {
    contract: 'ddv.fence-generated-layout-request@1',
    policy: 'GENERATED_NATIVE_GREEDY',
    explicitUserAction: true
  };
}

export function straightFenceLayout(
  quantity,
  postIndexes,
  policy = 'EXACT_PRESERVATION',
  mode = FenceMode.ORTHOGONAL,
  familyBaseItemID = 40700246,
  modeBoundaryNodeIds = []
) {
  const nodes = Array.from(
    { length: quantity },
    (_, index) => ({
      id: 'n' + String(index),
      x: index,
      y: mode === FenceMode.DIAGONAL ? index : 0,
      mode
    })
  );
  const edges = Array.from(
    { length: Math.max(0, quantity - 1) },
    (_, index) => ({
      a: 'n' + String(index),
      b: 'n' + String(index + 1)
    })
  );
  const boundary = new Set(modeBoundaryNodeIds.map(String));
  const anchors = [];
  if (quantity >= 1) {
    anchors.push({
      nodeId: 'n0',
      x: nodes[0].x,
      y: nodes[0].y,
      reason: boundary.has('n0') ? 'MODE_BOUNDARY' : 'ENDPOINT'
    });
  }
  if (quantity > 1) {
    const lastId = 'n' + String(quantity - 1);
    anchors.push({
      nodeId: lastId,
      x: nodes.at(-1).x,
      y: nodes.at(-1).y,
      reason: boundary.has(lastId) ? 'MODE_BOUNDARY' : 'ENDPOINT'
    });
  }
  const runs = quantity > 1
    ? [{
        runId: 'run:0',
        mode,
        nodeIds: nodes.map((node) => node.id),
        startAnchorNodeId: 'n0',
        endAnchorNodeId: 'n' + String(quantity - 1),
        intervalLength: quantity - 1
      }]
    : [];
  const logicalTopology = {
    familyBaseItemID,
    mode,
    logicalQuantity: quantity,
    graph: { nodes, edges },
    modeBoundaryNodeIds: [...boundary],
    semanticAnchors: anchors,
    runs
  };
  const manual =
    policy === 'EXPLICIT_USER_LAYOUT' ||
    policy === 'MANUAL_PINNED_POSTS';
  return {
    schema: 'ddv.fence-representation-layout@1',
    contractSource: {
      gameVersion: '1.25.0',
      platform: 'Nintendo Switch'
    },
    networkId: 'fixture',
    logicalTopology,
    representationLayout: {
      intent: manual ? 'GENERATED_DESIGN' : 'EXACT_PRESERVATION',
      policy: manual ? 'MANUAL_PINNED_POSTS' : 'PRESERVE_EXISTING',
      posts: postIndexes.map((index) => ({
        kind: 'DEGREE2_INTERIOR_POST',
        nodeId: 'n' + String(index),
        runId: 'run:0',
        x: nodes[index]?.x,
        y: nodes[index]?.y,
        pinned: true,
        source: manual ? 'MANUAL' : 'CAPTURED_NATIVE_BASE'
      }))
    },
    invariants: {
      sourceTopologyFingerprint:
        fenceLogicalTopologyFingerprint(logicalTopology),
      sourceLogicalQuantity: quantity
    },
    provenance: { fixture: true },
    persistentWriteAuthorized: false
  };
}

export function applyMutation(source, result) {
  if (!result.ok) throw new Error('cannot apply blocked compiler result');
  const output = structuredClone(source);
  for (const entry of result.deletedObjects) {
    delete output.Objects[String(entry.gridObjectId)];
  }
  for (const entry of result.createdObjects) {
    output.Objects[String(entry.gridObjectId)] =
      structuredClone(entry.object);
  }
  output.NextGridObjectID = result.nextGridObjectID.after;
  return output;
}
