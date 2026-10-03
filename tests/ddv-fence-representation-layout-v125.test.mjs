import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FENCE_REPRESENTATION_INTENT,
  FENCE_REPRESENTATION_LAYOUT_ERROR,
  FENCE_REPRESENTATION_LAYOUT_SCHEMA,
  FENCE_REPRESENTATION_POLICY,
  applyFenceRepresentationLayoutOperation,
  captureFenceRepresentationLayoutModel,
  exactFenceExtensionKeys,
  fenceRepresentationCatalogConstraints,
  validateFenceRepresentationLayoutModel
} from '../src/lib/ddv/core/roadfence/representation-layout-v125.ts';
import {
  ROADFENCE_NATIVE_CATALOG_SWITCH_V125
} from '../src/lib/ddv/core/roadfence/catalog-v125-switch.js';

function straightReader({
  networkId = 'fence:40700246:orthogonal:0',
  familyBaseItemID = 40700246,
  familyName = 'Biome2Fence',
  mode = 'orthogonal',
  quantity = 9,
  baseIndexes = [0, 7, 8],
  modeBoundaryIndexes = []
} = {}) {
  const pitch = 2;
  const nodes = Array.from({ length: quantity }, (_, index) => ({
    id: `v:${index}:0`,
    x: index,
    y: 0,
    mode
  }));
  const edges = Array.from({ length: quantity - 1 }, (_, index) => ({
    a: nodes[index].id,
    b: nodes[index + 1].id
  }));
  const nativeObjects = baseIndexes.map((index, serial) => ({
    gridObjectId: 1000 + serial,
    itemID: familyBaseItemID,
    x: index * pitch,
    y: 0,
    role: 'base'
  }));
  const boundaryTouches = modeBoundaryIndexes.map((index) => ({
    a: {
      networkId,
      x: index,
      y: 0,
      mode
    },
    b: {
      networkId: 'other-mode',
      x: index + 1,
      y: 1,
      mode: mode === 'orthogonal' ? 'diagonal' : 'orthogonal'
    }
  }));
  return {
    status: 'supported',
    ok: true,
    persistentWriteAuthorized: false,
    fences: [{
      networkId,
      kind: 'fence',
      familyBaseItemID,
      familyName,
      mode,
      coordinateSpace: {
        savePitch: pitch,
        saveResidueX: 0,
        saveResidueY: 0
      },
      graph: { nodes, edges },
      logicalQuantity: quantity,
      persistentWriteAuthorized: false
    }],
    modeBoundaryTouches: boundaryTouches,
    provenance: {
      fences: {
        [networkId]: {
          gridObjectIds: nativeObjects.map((x) => x.gridObjectId),
          nativeObjects
        }
      }
    }
  };
}

function turnReader() {
  const networkId = 'fence:40700246:orthogonal:turn';
  const coords = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [4, 1],
    [4, 2],
    [4, 3],
    [4, 4]
  ];
  const nodes = coords.map(([x, y]) => ({
    id: `v:${x}:${y}`,
    x,
    y,
    mode: 'orthogonal'
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    a: nodes[index].id,
    b: node.id
  }));
  const bases = [
    [0, 0],
    [2, 0],
    [4, 0],
    [4, 2],
    [4, 4]
  ];
  const nativeObjects = bases.map(([x, y], index) => ({
    gridObjectId: 2000 + index,
    itemID: 40700246,
    x: x * 2,
    y: y * 2,
    role: 'base'
  }));
  return {
    status: 'supported',
    ok: true,
    persistentWriteAuthorized: false,
    fences: [{
      networkId,
      kind: 'fence',
      familyBaseItemID: 40700246,
      familyName: 'Biome2Fence',
      mode: 'orthogonal',
      coordinateSpace: {
        savePitch: 2,
        saveResidueX: 0,
        saveResidueY: 0
      },
      graph: { nodes, edges },
      logicalQuantity: nodes.length,
      persistentWriteAuthorized: false
    }],
    modeBoundaryTouches: [],
    provenance: {
      fences: {
        [networkId]: {
          gridObjectIds: nativeObjects.map((x) => x.gridObjectId),
          nativeObjects
        }
      }
    }
  };
}

test('Core derives exact Fence extension vocabulary and max interval from versioned family+mode catalog', () => {
  for (const [mode, role] of [
    ['orthogonal', 'ext'],
    ['diagonal', 'diagExt']
  ]) {
    const expected = Object.values(
      ROADFENCE_NATIVE_CATALOG_SWITCH_V125.fenceItems
    )
      .filter(
        (entry) =>
          entry.familyBaseItemID === 40700246 &&
          entry.role === role
      )
      .map((entry) => Number(entry.key))
      .sort((a, b) => a - b);
    const keys = exactFenceExtensionKeys(40700246, mode);
    const constraints =
      fenceRepresentationCatalogConstraints(40700246, mode);
    assert.deepEqual(keys, expected);
    assert.deepEqual(constraints.exactExtensionKeys, expected);
    assert.equal(
      constraints.maximumPostInterval,
      1 + Math.max(...expected)
    );
    assert.deepEqual(
      constraints.supportedIntervals,
      [1, ...expected.map((key) => key + 1)]
    );
    assert.equal(constraints.persistentWriteAuthorized, false);
  }
});

test('captured native layout binds as logicalTopology + representationLayout with exact preservation', () => {
  const result = captureFenceRepresentationLayoutModel(
    straightReader(),
    'fence:40700246:orthogonal:0'
  );
  assert.equal(result.model.schema, FENCE_REPRESENTATION_LAYOUT_SCHEMA);
  assert.equal(result.validation.ok, true);
  assert.equal(
    result.model.representationLayout.intent,
    FENCE_REPRESENTATION_INTENT.EXACT_PRESERVATION
  );
  assert.equal(
    result.model.representationLayout.policy,
    FENCE_REPRESENTATION_POLICY.PRESERVE_EXISTING
  );
  assert.deepEqual(
    result.model.logicalTopology.semanticAnchors.map((x) => ({
      x: x.x,
      reason: x.reason
    })),
    [
      { x: 0, reason: 'ENDPOINT' },
      { x: 8, reason: 'ENDPOINT' }
    ]
  );
  assert.deepEqual(
    result.model.representationLayout.posts.map((x) => ({
      x: x.x,
      pinned: x.pinned,
      kind: x.kind
    })),
    [
      {
        x: 7,
        pinned: true,
        kind: 'DEGREE2_INTERIOR_POST'
      }
    ]
  );
  const serialized = JSON.stringify(result.model);
  assert.equal(serialized.includes('gridObjectId'), false);
  assert.equal(serialized.includes('1000'), false);
  assert.equal(result.model.persistentWriteAuthorized, false);
});

test('REMOVE_POST fails closed with canonical over-max code and preserves accepted model', () => {
  const captured = captureFenceRepresentationLayoutModel(
    straightReader(),
    'fence:40700246:orthogonal:0'
  );
  const post =
    captured.model.representationLayout.posts[0];
  const result = applyFenceRepresentationLayoutOperation(
    captured.model,
    {
      type: 'REMOVE_POST',
      nodeId: post.nodeId
    }
  );
  assert.equal(result.accepted, false);
  assert.equal(
    result.issues.some(
      (x) =>
        x.code ===
        FENCE_REPRESENTATION_LAYOUT_ERROR.INTERVAL_OVER_MAX
    ),
    true
  );
  assert.deepEqual(result.model, captured.model);
  assert.equal(result.persistentWriteAuthorized, false);
});

test('semantic anchors reject representation-only insert with canonical code', () => {
  const captured = captureFenceRepresentationLayoutModel(
    straightReader(),
    'fence:40700246:orthogonal:0'
  );
  const result = applyFenceRepresentationLayoutOperation(
    captured.model,
    { type: 'INSERT_POST', x: 0, y: 0 }
  );
  assert.equal(result.accepted, false);
  assert.equal(
    result.issues[0].code,
    FENCE_REPRESENTATION_LAYOUT_ERROR
      .SEMANTIC_ANCHOR_IMMUTABLE
  );
});

test('MOVE_POST cannot cross a straight semantic run', () => {
  const reader = turnReader();
  const captured = captureFenceRepresentationLayoutModel(
    reader,
    'fence:40700246:orthogonal:turn'
  );
  const source = captured.model.representationLayout.posts.find(
    (post) => post.x === 2 && post.y === 0
  );
  assert.ok(source);
  const result = applyFenceRepresentationLayoutOperation(
    captured.model,
    {
      type: 'MOVE_POST',
      nodeId: source.nodeId,
      x: 4,
      y: 2
    }
  );
  assert.equal(result.accepted, false);
  assert.equal(
    result.issues[0].code,
    FENCE_REPRESENTATION_LAYOUT_ERROR.OFF_RUN
  );
  assert.deepEqual(result.model, captured.model);
});

test('manual MOVE_POST within the same run preserves topology and quantity but enters generated-design intent', () => {
  const captured = captureFenceRepresentationLayoutModel(
    straightReader(),
    'fence:40700246:orthogonal:0'
  );
  const source =
    captured.model.representationLayout.posts[0];
  const result = applyFenceRepresentationLayoutOperation(
    captured.model,
    {
      type: 'MOVE_POST',
      nodeId: source.nodeId,
      x: 6,
      y: 0
    }
  );
  assert.equal(result.accepted, true);
  assert.equal(result.validation.ok, true);
  assert.equal(result.validation.topologyPreserved, true);
  assert.equal(result.validation.logicalQuantityPreserved, true);
  assert.equal(
    result.model.representationLayout.intent,
    FENCE_REPRESENTATION_INTENT.GENERATED_DESIGN
  );
  assert.equal(
    result.model.representationLayout.policy,
    FENCE_REPRESENTATION_POLICY.MANUAL_PINNED_POSTS
  );
  assert.deepEqual(
    result.model.representationLayout.posts.map((x) => x.x),
    [6]
  );
});

test('topology and quantity tampering fail with the promoted invariant codes', () => {
  const captured = captureFenceRepresentationLayoutModel(
    straightReader(),
    'fence:40700246:orthogonal:0'
  );

  const topologyChanged = structuredClone(captured.model);
  topologyChanged.logicalTopology.graph.edges.pop();
  const topologyValidation =
    validateFenceRepresentationLayoutModel(topologyChanged);
  assert.equal(topologyValidation.ok, false);
  assert.equal(
    topologyValidation.issues.some(
      (x) =>
        x.code ===
        FENCE_REPRESENTATION_LAYOUT_ERROR.TOPOLOGY_CHANGED
    ),
    true
  );

  const quantityChanged = structuredClone(captured.model);
  quantityChanged.logicalTopology.logicalQuantity += 1;
  const quantityValidation =
    validateFenceRepresentationLayoutModel(quantityChanged);
  assert.equal(quantityValidation.ok, false);
  assert.equal(
    quantityValidation.issues.some(
      (x) =>
        x.code ===
        FENCE_REPRESENTATION_LAYOUT_ERROR.QUANTITY_CHANGED
    ),
    true
  );
});

test('unsupported family+mode vocabulary fails closed instead of inventing a span', () => {
  const captured = captureFenceRepresentationLayoutModel(
    straightReader(),
    'fence:40700246:orthogonal:0'
  );
  const unsupported = structuredClone(captured.model);
  unsupported.logicalTopology.familyBaseItemID = 999999999;
  unsupported.invariants.sourceTopologyFingerprint =
    JSON.stringify({
      familyBaseItemID: 999999999
    });
  const constraints =
    fenceRepresentationCatalogConstraints(
      999999999,
      'orthogonal'
    );
  assert.equal(constraints.ok, false);
  assert.equal(
    constraints.issues[0].code,
    FENCE_REPRESENTATION_LAYOUT_ERROR.INTERVAL_UNSUPPORTED
  );
});

test('mode-boundary node is semantic even when it is degree two in local geometry', () => {
  const captured = captureFenceRepresentationLayoutModel(
    straightReader({
      baseIndexes: [0, 4, 8],
      modeBoundaryIndexes: [4]
    }),
    'fence:40700246:orthogonal:0'
  );
  assert.equal(
    captured.model.logicalTopology.semanticAnchors.some(
      (x) => x.x === 4 && x.reason === 'MODE_BOUNDARY'
    ),
    true
  );
  assert.equal(
    captured.model.representationLayout.posts.some(
      (x) => x.x === 4
    ),
    false
  );
});
