import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FENCE_POST_AUTO_LAYOUT,
  applyFencePostAutoLayout,
  createFencePostLayoutDraft,
  fenceFamilyPostConstraints,
  insertFencePost,
  moveFencePost,
  removeFencePost,
  setFencePostPinned,
  validateFencePostLayoutDraft
} from '../src/lib/wep/fence-post-edit-contract.ts';
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
    orientation: 'GridOrientation_Down',
    role: 'base',
    key: null
  }));
  const boundaryTouches = modeBoundaryIndexes.map((index) => ({
    familyBaseItemID,
    classification: 'geometric-cross-mode-touch',
    authoritativeConnectedEdge: false,
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
        unit: 'fence-logical-unit',
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
          gridObjectIds: nativeObjects.map((entry) => entry.gridObjectId),
          nativeObjects
        }
      }
    }
  };
}

test('Fence max span is derived from the Core catalog variation set', () => {
  for (const [mode, role] of [
    ['orthogonal', 'ext'],
    ['diagonal', 'diagExt']
  ]) {
    const contract = fenceFamilyPostConstraints(40700246, mode);
    const keys = Object.values(
      ROADFENCE_NATIVE_CATALOG_SWITCH_V125.fenceItems
    )
      .filter(
        (entry) =>
          entry.familyBaseItemID === 40700246 &&
          entry.role === role
      )
      .map((entry) => Number(entry.key));
    assert.equal(contract.maxExtensionKey, Math.max(...keys));
    assert.equal(contract.maxInterval, Math.max(...keys) + 1);
    assert.equal(contract.source, '01C_CORE_CATALOG_VARIATION_SET');
    assert.equal(contract.persistentWriteAuthorized, false);
  }
});

test('captured degree-2 native Base becomes a pinned representation post while endpoints stay semantic', () => {
  const result = createFencePostLayoutDraft(straightReader(), 'fence:40700246:orthogonal:0');

  assert.equal(result.validation.ok, true);
  assert.deepEqual(
    result.draft.semanticAnchors.map((entry) => ({
      x: entry.x,
      reason: entry.reason
    })),
    [
      { x: 0, reason: 'ENDPOINT' },
      { x: 8, reason: 'ENDPOINT' }
    ]
  );
  assert.deepEqual(
    result.draft.posts.map((entry) => ({
      x: entry.x,
      pinned: entry.pinned,
      source: entry.source
    })),
    [
      { x: 7, pinned: true, source: 'CAPTURED_NATIVE_BASE' }
    ]
  );
  const serialized = JSON.stringify(result.draft);
  assert.equal(serialized.includes('gridObjectId'), false);
  assert.equal(serialized.includes('1000'), false);
  assert.equal(result.draft.persistentWriteAuthorized, false);
});

test('removing a representation post is blocked by catalog-derived max span when merged interval is too long', () => {
  const created = createFencePostLayoutDraft(straightReader(), 'fence:40700246:orthogonal:0');
  const postId = created.draft.posts[0].nodeId;
  const removed = removeFencePost(created.draft, postId);

  assert.equal(removed.validation.ok, false);
  assert.equal(
    removed.validation.issues.some(
      (issue) => issue.code === 'FENCE_POST_MAX_SPAN_EXCEEDED'
    ),
    true
  );
  assert.equal(removed.draft.persistentWriteAuthorized, false);
});

test('insert and move post change representation partition only and preserve topology/logical quantity', () => {
  const created = createFencePostLayoutDraft(straightReader(), 'fence:40700246:orthogonal:0');
  const postId = created.draft.posts[0].nodeId;

  const moved = moveFencePost(created.draft, postId, 6, 0);
  assert.equal(moved.validation.ok, true);
  assert.deepEqual(moved.draft.posts.map((entry) => entry.x), [6]);
  assert.deepEqual(moved.draft.graph, created.draft.graph);
  assert.equal(moved.draft.logicalQuantity, created.draft.logicalQuantity);
  assert.equal(moved.validation.topologyPreserved, true);
  assert.equal(moved.validation.logicalQuantityPreserved, true);

  const inserted = insertFencePost(moved.draft, 7, 0);
  assert.equal(inserted.validation.ok, true);
  assert.deepEqual(
    inserted.draft.posts.map((entry) => entry.x).sort((a, b) => a - b),
    [6, 7]
  );
  assert.deepEqual(inserted.draft.graph, created.draft.graph);
  assert.equal(inserted.draft.persistentWriteAuthorized, false);
});

test('semantic endpoints and mode boundaries cannot be representation-post edit targets', () => {
  const endpoint = createFencePostLayoutDraft(straightReader(), 'fence:40700246:orthogonal:0');
  assert.throws(
    () => insertFencePost(endpoint.draft, 0, 0),
    /FENCE_POST_TARGET_IS_SEMANTIC_ANCHOR/
  );

  const boundary = createFencePostLayoutDraft(
    straightReader({ modeBoundaryIndexes: [4], baseIndexes: [0, 4, 8] }),
    'fence:40700246:orthogonal:0'
  );
  assert.equal(
    boundary.draft.semanticAnchors.some(
      (entry) => entry.x === 4 && entry.reason === 'MODE_BOUNDARY'
    ),
    true
  );
  assert.equal(
    boundary.draft.posts.some((entry) => entry.x === 4),
    false
  );
});

test('explicit centered-balanced auto-layout preserves pinned posts and resolves over-max spans', () => {
  const created = createFencePostLayoutDraft(
    straightReader({
      quantity: 16,
      baseIndexes: [0, 15]
    }),
    'fence:40700246:orthogonal:0'
  );
  assert.equal(created.validation.ok, false);

  const manual = insertFencePost(created.draft, 4, 0, { pinned: true });
  assert.equal(manual.draft.posts[0].pinned, true);

  const balanced = applyFencePostAutoLayout(
    manual.draft,
    FENCE_POST_AUTO_LAYOUT.CENTERED_BALANCED
  );
  assert.equal(balanced.validation.ok, true);
  assert.equal(
    balanced.draft.posts.some(
      (entry) => entry.x === 4 && entry.pinned === true
    ),
    true
  );
  assert.equal(
    balanced.draft.posts.some(
      (entry) => entry.source === 'AUTO_CENTERED_BALANCED'
    ),
    true
  );
  assert.equal(
    balanced.draft.layoutPolicy,
    FENCE_POST_AUTO_LAYOUT.CENTERED_BALANCED
  );
  assert.equal(balanced.draft.persistentWriteAuthorized, false);
});

test('auto-layout is explicit: preserve-existing is a no-op and pin state is user-controlled', () => {
  const created = createFencePostLayoutDraft(straightReader(), 'fence:40700246:orthogonal:0');
  const postId = created.draft.posts[0].nodeId;
  const unpinned = setFencePostPinned(created.draft, postId, false);
  assert.equal(unpinned.draft.posts[0].pinned, false);

  const preserved = applyFencePostAutoLayout(
    unpinned.draft,
    FENCE_POST_AUTO_LAYOUT.PRESERVE_EXISTING
  );
  assert.deepEqual(preserved.draft, unpinned.draft);
  assert.equal(preserved.validation.ok, true);
});

test('validation rejects representation posts that are not straight degree-2 nodes', () => {
  const created = createFencePostLayoutDraft(straightReader(), 'fence:40700246:orthogonal:0');
  const tampered = structuredClone(created.draft);
  tampered.posts.push({
    nodeId: tampered.semanticAnchors[0].nodeId,
    x: 0,
    y: 0,
    pinned: true,
    source: 'MANUAL'
  });
  const validation = validateFencePostLayoutDraft(tampered);
  assert.equal(validation.ok, false);
  assert.equal(
    validation.issues.some(
      (issue) => issue.code === 'FENCE_POST_REPRESENTATION_POST_INVALID'
    ),
    true
  );
});
