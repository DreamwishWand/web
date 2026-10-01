import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROADFENCE_AUTHORING_CAPABILITIES,
  ROADFENCE_AUTHORING_CONTRACT,
  previewFencePolyline,
  previewFenceRectangleOutline,
  previewFenceSegmentDelete,
  previewRoadCellDelete,
  previewRoadPolyline,
  previewRoadRectangleOutline
} from '../src/lib/wep/roadfence-authoring-contract.ts';

test('Road/Fence authoring contract separates topology, representation and selection layers', () => {
  assert.equal(
    ROADFENCE_AUTHORING_CONTRACT,
    'dreamwish-wand-wep-roadfence-authoring@1'
  );
  assert.equal(
    ROADFENCE_AUTHORING_CAPABILITIES.fenceRepresentationPosts.operationLayer,
    'representationLayout'
  );
  assert.equal(
    ROADFENCE_AUTHORING_CAPABILITIES.topologySegmentDeleteSplit.operationLayer,
    'logicalTopology'
  );
  assert.equal(
    ROADFENCE_AUTHORING_CAPABILITIES.explicitSpacing.silentNormalizationAllowed,
    false
  );
  for (const capability of Object.values(
    ROADFENCE_AUTHORING_CAPABILITIES
  )) {
    assert.equal(capability.persistentWriteAuthorized, false);
  }
});

test('line/polyline and rectangle outline remain read/model previews only', () => {
  const roadLine = previewRoadPolyline([
    { x: 0, y: 0 },
    { x: 3, y: 0 }
  ]);
  assert.equal(roadLine.persistentWriteAuthorized, false);
  assert.equal(roadLine.cells.length, 4);

  const fenceLine = previewFencePolyline(
    [
      { x: 0, y: 0 },
      { x: 3, y: 0 }
    ],
    'orthogonal'
  );
  assert.equal(fenceLine.persistentWriteAuthorized, false);
  assert.equal(fenceLine.compiled.ok, true);

  const roadRect = previewRoadRectangleOutline({
    minX: 0,
    minY: 0,
    maxX: 3,
    maxY: 2
  });
  assert.equal(roadRect.persistentWriteAuthorized, false);

  const fenceRect = previewFenceRectangleOutline({
    minX: 0,
    minY: 0,
    maxX: 3,
    maxY: 2
  });
  assert.equal(fenceRect.persistentWriteAuthorized, false);
  assert.equal(fenceRect.compiled.ok, true);
});

test('Fence segment delete is a topology-changing preview and invalidates representation layout', () => {
  const fence = previewFencePolyline(
    [
      { x: 0, y: 0 },
      { x: 4, y: 0 }
    ],
    'orthogonal'
  );
  const target = fence.graph.nodes.find((node) => node.x === 2);
  assert.ok(target);

  const deleted = previewFenceSegmentDelete({
    graph: fence.graph,
    nodeIds: [target.id]
  });
  assert.equal(deleted.ok, true);
  assert.equal(deleted.operationLayer, 'logicalTopology');
  assert.equal(deleted.topologyChanged, true);
  assert.equal(deleted.representationLayoutInvalidated, true);
  assert.equal(deleted.persistentWriteAuthorized, false);
});


test('Road cell delete stays a topology-only preview with writer disabled', () => {
  const road = previewRoadPolyline([
    { x: 0, y: 0 },
    { x: 4, y: 0 }
  ]);
  const deleted = previewRoadCellDelete({
    cells: road.cells,
    coordinates: [{ x: 2, y: 0 }]
  });
  assert.equal(deleted.topologyChanged, true);
  assert.equal(deleted.logicalQuantity, road.cells.length - 1);
  assert.equal(deleted.operationLayer, 'logicalTopology');
  assert.equal(deleted.persistentWriteAuthorized, false);
});
