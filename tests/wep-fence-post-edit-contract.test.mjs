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
  setFencePostPinned
} from '../src/lib/wep/fence-post-edit-contract.ts';
import {
  FENCE_REPRESENTATION_INTENT,
  FENCE_REPRESENTATION_LAYOUT_ERROR,
  FENCE_REPRESENTATION_POLICY
} from '../src/lib/ddv/core/roadfence/representation-layout-v125.ts';

function straightReader({
  networkId = 'fence:40700246:orthogonal:0',
  quantity = 9,
  baseIndexes = [0, 7, 8]
} = {}) {
  const nodes = Array.from({ length: quantity }, (_, index) => ({
    id: `v:${index}:0`,
    x: index,
    y: 0,
    mode: 'orthogonal'
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    a: nodes[index].id,
    b: node.id
  }));
  const nativeObjects = baseIndexes.map((index, serial) => ({
    gridObjectId: 1000 + serial,
    itemID: 40700246,
    x: index * 2,
    y: 0,
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
      logicalQuantity: quantity,
      persistentWriteAuthorized: false
    }],
    modeBoundaryTouches: [],
    provenance: {
      fences: {
        [networkId]: {
          nativeObjects,
          gridObjectIds: nativeObjects.map((x) => x.gridObjectId)
        }
      }
    }
  };
}

test('WEP constraint display is a consumer alias over the promoted Core catalog result', () => {
  const result = fenceFamilyPostConstraints(
    40700246,
    'orthogonal'
  );
  assert.equal(result.ok, true);
  assert.equal(
    result.maxInterval,
    result.maximumPostInterval
  );
  assert.equal(
    result.maxExtensionKey,
    Math.max(...result.exactExtensionKeys)
  );
  assert.equal(
    result.source,
    '01C_CORE_PROMOTED_REPRESENTATION_LAYOUT'
  );
  assert.equal(result.persistentWriteAuthorized, false);
});

test('captured WEP session preserves the Core exact-preservation model', () => {
  const result = createFencePostLayoutDraft(
    straightReader(),
    'fence:40700246:orthogonal:0'
  );
  assert.equal(result.validation.ok, true);
  assert.equal(
    result.draft.representationLayout.intent,
    FENCE_REPRESENTATION_INTENT.EXACT_PRESERVATION
  );
  assert.equal(
    result.draft.representationLayout.policy,
    FENCE_REPRESENTATION_POLICY.PRESERVE_EXISTING
  );
  assert.equal(
    result.draft.representationLayout.posts[0].pinned,
    true
  );
  assert.equal(
    result.binding.coreContract,
    'ddv.fence-representation-layout@1'
  );
});

test('WEP manual operations delegate to Core and keep rejected over-max removal fail-closed', () => {
  const captured = createFencePostLayoutDraft(
    straightReader(),
    'fence:40700246:orthogonal:0'
  );
  const post =
    captured.draft.representationLayout.posts[0];

  const moved = moveFencePost(
    captured.draft,
    post.nodeId,
    6,
    0
  );
  assert.equal(moved.accepted, true);
  assert.equal(moved.validation.ok, true);
  assert.deepEqual(
    moved.draft.representationLayout.posts.map((x) => x.x),
    [6]
  );

  const inserted = insertFencePost(
    moved.draft,
    7,
    0
  );
  assert.equal(inserted.accepted, true);
  assert.deepEqual(
    inserted.draft.representationLayout.posts
      .map((x) => x.x)
      .sort((a, b) => a - b),
    [6, 7]
  );

  const rejected = removeFencePost(
    captured.draft,
    post.nodeId
  );
  assert.equal(rejected.accepted, false);
  assert.equal(
    rejected.issues.some(
      (x) =>
        x.code ===
        FENCE_REPRESENTATION_LAYOUT_ERROR.INTERVAL_OVER_MAX
    ),
    true
  );
  assert.deepEqual(rejected.draft, captured.draft);
});

test('pinning is WEP authoring metadata and never changes logical topology', () => {
  const captured = createFencePostLayoutDraft(
    straightReader(),
    'fence:40700246:orthogonal:0'
  );
  const post =
    captured.draft.representationLayout.posts[0];
  const topology = structuredClone(captured.draft.logicalTopology);

  const unpinned = setFencePostPinned(
    captured.draft,
    post.nodeId,
    false
  );
  assert.equal(unpinned.accepted, true);
  assert.equal(
    unpinned.draft.representationLayout.posts[0].pinned,
    false
  );
  assert.deepEqual(unpinned.draft.logicalTopology, topology);
  assert.equal(unpinned.draft.persistentWriteAuthorized, false);
});

test('PRESERVE_EXISTING auto-layout is an explicit no-op', () => {
  const captured = createFencePostLayoutDraft(
    straightReader(),
    'fence:40700246:orthogonal:0'
  );
  const preserved = applyFencePostAutoLayout(
    captured.draft,
    FENCE_POST_AUTO_LAYOUT.PRESERVE_EXISTING
  );
  assert.equal(preserved.accepted, true);
  assert.deepEqual(preserved.draft, captured.draft);
  assert.equal(
    preserved.draft.representationLayout.intent,
    FENCE_REPRESENTATION_INTENT.EXACT_PRESERVATION
  );
});

test('explicit CENTERED_BALANCED mode preserves pinned posts and creates only a generated-design layout', () => {
  const captured = createFencePostLayoutDraft(
    straightReader({
      quantity: 16,
      baseIndexes: [0, 15]
    }),
    'fence:40700246:orthogonal:0'
  );
  assert.equal(captured.validation.ok, false);

  const manual = insertFencePost(
    captured.draft,
    4,
    0,
    { pinned: true }
  );
  assert.equal(manual.accepted, false);

  const seed = structuredClone(captured.draft);
  seed.representationLayout.posts.push({
    kind: 'DEGREE2_INTERIOR_POST',
    nodeId: 'v:4:0',
    runId: seed.logicalTopology.runs[0].runId,
    x: 4,
    y: 0,
    pinned: true,
    source: 'MANUAL'
  });

  const balanced = applyFencePostAutoLayout(
    seed,
    FENCE_POST_AUTO_LAYOUT.CENTERED_BALANCED
  );
  assert.equal(balanced.accepted, true);
  assert.equal(balanced.validation.ok, true);
  assert.equal(
    balanced.draft.representationLayout.intent,
    FENCE_REPRESENTATION_INTENT.GENERATED_DESIGN
  );
  assert.equal(
    balanced.draft.representationLayout.policy,
    FENCE_REPRESENTATION_POLICY.CENTERED_BALANCED
  );
  assert.equal(
    balanced.draft.representationLayout.posts.some(
      (x) => x.x === 4 && x.pinned === true
    ),
    true
  );
  assert.equal(
    balanced.draft.representationLayout.posts.some(
      (x) => x.source === 'AUTO_CENTERED_BALANCED'
    ),
    true
  );
  assert.deepEqual(
    balanced.draft.logicalTopology,
    captured.draft.logicalTopology
  );
  assert.equal(balanced.draft.persistentWriteAuthorized, false);
});
