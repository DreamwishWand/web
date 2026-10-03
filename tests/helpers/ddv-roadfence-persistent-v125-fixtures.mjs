import { FenceMode } from '../../src/lib/ddv/core/roadfence/logical.js';

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

export function straightFenceLayout(
  quantity,
  postIndexes,
  policy = 'EXACT_PRESERVATION',
  mode = FenceMode.ORTHOGONAL
) {
  return {
    contract: 'ddv.fence-representation-layout@1',
    policy,
    runs: [
      {
        mode,
        fromNodeId: 'n0',
        toNodeId: 'n' + String(quantity - 1),
        postNodeIds: postIndexes.map(
          (index) => 'n' + String(index)
        )
      }
    ]
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
