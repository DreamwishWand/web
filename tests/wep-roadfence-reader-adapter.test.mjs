import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROADFENCE_READER_MAIN_MERGE_COMMIT,
  createDraftAwareNetworkCaptureAdapter,
  createSwitchV125RoadFenceReaderBinding
} from '../src/lib/wep/roadfence-reader-adapter.ts';
import {
  captureScenePreset
} from '../src/lib/wep/scene-capture-runtime.ts';
import {
  validatePublishablePreset
} from '../src/lib/wep/scene-preset-runtime.ts';
import {
  createFencePostLayoutDraft,
  moveFencePost
} from '../src/lib/wep/fence-post-edit-contract.ts';

function profile({
  tessellationFactor = 1,
  roadX = 10,
  roadY = 10
} = {}) {
  return {
    GameInfo: { Version: 624 },
    Player: {},
    World: {
      GridCollection: {
        Grids: {
          '7': {
            ID: 7,
            GridDataPath: 'GridData/Test/Reader.json',
            TessellationFactor: tessellationFactor,
            Objects: {
              '100': {
                ID: 100,
                ItemID: 40100068,
                X: roadX,
                Y: roadY,
                Orientation: 'GridOrientation_Down',
                State: null
              },
              '101': {
                ID: 101,
                ItemID: 40000047,
                X: 30,
                Y: 30,
                Orientation: 'GridOrientation_Up',
                State: {}
              }
            }
          }
        }
      }
    }
  };
}

function portableFenceReader() {
  const networkId = 'fence:40700246:orthogonal:portable';
  const nodes = Array.from({ length: 9 }, (_, index) => ({
    id: `v:${index}:0`,
    x: index,
    y: 0,
    mode: 'orthogonal'
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    a: nodes[index].id,
    b: node.id
  }));
  const nativeObjects = [0, 7, 8].map((index, serial) => ({
    gridObjectId: 9000 + serial,
    itemID: 40700246,
    x: 10 + index * 2,
    y: 10,
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
        unit: 'fence-logical-unit',
        savePitch: 2,
        saveResidueX: 10,
        saveResidueY: 10
      },
      graph: { nodes, edges },
      logicalQuantity: 9,
      persistentWriteAuthorized: false
    }],
    modeBoundaryTouches: [],
    provenance: {
      fences: {
        [networkId]: {
          nativeObjects,
          gridObjectIds: nativeObjects.map(
            (entry) => entry.gridObjectId
          )
        }
      }
    }
  };
}

function portableFenceDocument() {
  const source = document(1);
  source.objects[0].x = 10;
  source.objects[0].y = 10;
  const reader = portableFenceReader();
  const network = structuredClone(reader.fences[0]);
  const captured = createFencePostLayoutDraft(
    reader,
    network.networkId
  );
  const post = captured.draft.representationLayout.posts[0];
  const moved = moveFencePost(
    captured.draft,
    post.nodeId,
    6,
    0
  );
  assert.equal(moved.accepted, true);
  source.networks.fences = {
    schema: 'dreamwish-wand-wep-roadfence-logical-root-draft',
    version: 1,
    kind: 'fences',
    originPolicy: 'native-logical-root',
    coordinatePolicy: 'per-network-reader-coordinate-space',
    networks: [network],
    representationLayouts: {
      [network.networkId]: structuredClone(moved.draft)
    },
    representationLayoutModified: {
      [network.networkId]: true
    },
    representationLayoutInvalidated: {},
    modeBoundaryTouches: [],
    persistentWriteAuthorized: false
  };
  return { source, networkId: network.networkId };
}

function document(tessellationFactor = 1) {
  return {
    schema: 'dreamwish-wand-wep-editor-document',
    version: 1,
    target: {
      gameVersion: '1.25.0',
      platform: 'Nintendo Switch',
      profileSchemaVersion: 624,
      rootGridId: 7,
      areaKey: 'v0:a7',
      tessellationFactor,
      persistentWriteAuthorized: false
    },
    objects: [
      {
        editorId: 'g7:o101',
        itemId: 40000047,
        layer: 'furniture',
        x: 10,
        y: 10,
        orientation: 0,
        footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
        portableState: null,
        dependencyIds: [],
        editability: 'editable',
        source: { gridId: 7, gridObjectId: 101 },
        metadata: {}
      }
    ],
    networks: { roads: null, fences: null },
    capabilities: { worldPersistentWrite: 'unsupported' },
    metadata: {}
  };
}

test('WEP binding consumes merged 01C reader without authorizing writes', () => {
  const binding = createSwitchV125RoadFenceReaderBinding({
    profile: profile(),
    rootGridId: 7
  });

  assert.equal(
    binding.source.mergeCommit,
    ROADFENCE_READER_MAIN_MERGE_COMMIT
  );
  assert.equal(binding.summary.status, 'supported');
  assert.equal(binding.summary.roadNetworkCount, 1);
  assert.equal(binding.summary.coverage.roadNativeObjectCount, 1);
  assert.equal(binding.persistentWriteAuthorized, false);
});

test('contained Scene Road capture uses Core portable network envelope and strips save-local IDs', () => {
  const binding = createSwitchV125RoadFenceReaderBinding({
    profile: profile(),
    rootGridId: 7
  });

  const result = captureScenePreset(
    document(),
    {
      selectionIds: ['g7:o101'],
      captureRegion: { x: 10, y: 10, w: 2, h: 2 },
      includeRoads: true,
      networkAdapter: binding.networkAdapter
    },
    validatePublishablePreset
  );

  assert.equal(result.captureReady, true);
  assert.equal(result.publicationReady, true);
  assert.equal(
    result.artifact.networks.roads.schema,
    'dreamwish-wand-wep-network-capture'
  );
  assert.equal(result.artifact.networks.roads.kind, 'roads');
  assert.deepEqual(
    result.artifact.networks.roads.networks[0].cells,
    [{ x: 0, y: 0, mode: 'orthogonal' }]
  );
  const serialized = JSON.stringify(result.artifact.networks.roads);
  assert.equal(serialized.includes('gridObjectId'), false);
  assert.equal(serialized.includes('"100"'), false);
});

test('Core TOPOLOGY_CLIPPED_UNSUPPORTED is propagated unchanged by Scene capture', () => {
  const binding = createSwitchV125RoadFenceReaderBinding({
    profile: profile(),
    rootGridId: 7
  });

  const result = captureScenePreset(
    document(),
    {
      selectionIds: ['g7:o101'],
      captureRegion: { x: 10, y: 10, w: 1, h: 1 },
      includeRoads: true,
      networkAdapter: binding.networkAdapter
    },
    validatePublishablePreset
  );

  assert.equal(result.captureReady, false);
  assert.equal(result.publicationReady, false);
  assert.equal(
    result.issues.some(
      (entry) => entry.code === 'TOPOLOGY_CLIPPED_UNSUPPORTED'
    ),
    true
  );
  assert.equal(result.artifact.networks.roads, null);
});

test('binding refuses a Scene document for a different root Grid', () => {
  const binding = createSwitchV125RoadFenceReaderBinding({
    profile: profile(),
    rootGridId: 7
  });
  const other = document();
  other.target.rootGridId = 8;

  const result = captureScenePreset(
    other,
    {
      selectionIds: ['g7:o101'],
      captureRegion: { x: 10, y: 10, w: 2, h: 2 },
      includeRoads: true,
      networkAdapter: binding.networkAdapter
    },
    validatePublishablePreset
  );

  assert.equal(result.captureReady, false);
  assert.equal(
    result.issues.some(
      (entry) => entry.code === 'WEP_ROADFENCE_DOCUMENT_TARGET_MISMATCH'
    ),
    true
  );
});

test('WEP exposes the Integrator-promoted Fence representation-layout binding separately from Scene network capture', () => {
  const binding = createSwitchV125RoadFenceReaderBinding({
    profile: profile(),
    rootGridId: 7
  });
  assert.equal(
    binding.fenceRepresentationLayout.contract,
    'ddv.fence-representation-layout@1'
  );
  assert.equal(
    binding.fenceRepresentationLayout.promotionDocumentId,
    '15ddjUrtZFYFi5KZpmzsrVBArLy0BjBHnmF9_iCbi104'
  );
  assert.equal(
    binding.fenceRepresentationLayout.scope,
    'read-model-preflight'
  );
  assert.equal(
    binding.fenceRepresentationLayout.persistentWriteAuthorized,
    false
  );
  assert.equal(
    binding.fencePostEditor,
    binding.fenceRepresentationLayout
  );
});


test('full-root Road/Fence draft capture uses authoritative root bounds and remains writer-disabled', () => {
  const binding = createSwitchV125RoadFenceReaderBinding({
    profile: profile(),
    rootGridId: 7
  });
  const source = document();
  source.metadata.rootGridBounds = {
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    status: 'AUTHORITATIVE_GRIDDATAPATH'
  };
  const result = binding.captureRootDraft(source);
  assert.equal(result.status, 'supported');
  assert.equal(result.networks.roads.kind, 'roads');
  assert.equal(result.networks.fences.kind, 'fences');
  assert.equal(result.persistentWriteAuthorized, false);
  assert.equal(
    JSON.stringify(result.networks).includes('gridObjectId'),
    false
  );
});

test('full-root Road/Fence draft capture fails closed without authoritative bounds', () => {
  const binding = createSwitchV125RoadFenceReaderBinding({
    profile: profile(),
    rootGridId: 7
  });
  const result = binding.captureRootDraft(document());
  assert.equal(result.status, 'blocked');
  assert.equal(result.code, 'WEP_ROADFENCE_ROOT_BOUNDS_REQUIRED');
  assert.equal(result.persistentWriteAuthorized, false);
});


test('edited full-root Road draft is the Scene capture source instead of stale native reader data', () => {
  const binding = createSwitchV125RoadFenceReaderBinding({
    profile: profile(),
    rootGridId: 7
  });
  const source = document();
  source.metadata.rootGridBounds = {
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    status: 'AUTHORITATIVE_GRIDDATAPATH'
  };
  const rootDraft = binding.captureRootDraft(source);
  assert.equal(rootDraft.status, 'supported');
  source.networks = structuredClone(rootDraft.networks);
  source.networks.roads.networks[0].cells = [
    { x: 6, y: 5, mode: 'orthogonal' }
  ];

  const adapter = createDraftAwareNetworkCaptureAdapter(
    binding.networkAdapter
  );
  const result = captureScenePreset(
    source,
    {
      selectionIds: ['g7:o101'],
      captureRegion: { x: 10, y: 10, w: 4, h: 2 },
      includeRoads: true,
      networkAdapter: adapter
    },
    validatePublishablePreset
  );

  assert.equal(result.captureReady, true);
  assert.equal(result.publicationReady, true);
  assert.deepEqual(
    result.artifact.networks.roads.networks[0].cells,
    [{ x: 2, y: 0, mode: 'orthogonal' }]
  );
  assert.equal(
    result.artifact.networks.roads.persistentWriteAuthorized,
    false
  );
});

test('draft-aware Scene capture keeps contained-only topology fail-closed', () => {
  const binding = createSwitchV125RoadFenceReaderBinding({
    profile: profile(),
    rootGridId: 7
  });
  const source = document();
  source.metadata.rootGridBounds = {
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    status: 'AUTHORITATIVE_GRIDDATAPATH'
  };
  const rootDraft = binding.captureRootDraft(source);
  source.networks = structuredClone(rootDraft.networks);
  source.networks.roads.networks[0].cells = [
    { x: 5, y: 5, mode: 'orthogonal' },
    { x: 6, y: 5, mode: 'orthogonal' }
  ];

  const result = captureScenePreset(
    source,
    {
      selectionIds: ['g7:o101'],
      captureRegion: { x: 10, y: 10, w: 2, h: 2 },
      includeRoads: true,
      networkAdapter: createDraftAwareNetworkCaptureAdapter(
        binding.networkAdapter
      )
    },
    validatePublishablePreset
  );

  assert.equal(result.captureReady, false);
  assert.equal(result.publicationReady, false);
  assert.equal(
    result.issues.some(
      (entry) => entry.code === 'TOPOLOGY_CLIPPED_UNSUPPORTED'
    ),
    true
  );
});

test('draft-aware adapter falls back to native reader only when no draft container exists', () => {
  const binding = createSwitchV125RoadFenceReaderBinding({
    profile: profile(),
    rootGridId: 7
  });
  const source = document();
  const adapter = createDraftAwareNetworkCaptureAdapter(
    binding.networkAdapter
  );
  const result = adapter.capture(
    'roads',
    source,
    { x: 10, y: 10, w: 2, h: 2 }
  );
  assert.equal(result.status, 'supported');
  assert.deepEqual(
    result.data.networks[0].cells,
    [{ x: 0, y: 0, mode: 'orthogonal' }]
  );
});


test('tessellation x2 root draft preserves logical adjacency and delegates save projection back to Core capture', () => {
  const binding = createSwitchV125RoadFenceReaderBinding({
    profile: profile({
      tessellationFactor: 2,
      roadX: 10,
      roadY: 10
    }),
    rootGridId: 7
  });
  const source = document(2);
  source.metadata.rootGridBounds = {
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    status: 'AUTHORITATIVE_GRIDDATAPATH'
  };

  const rootDraft = binding.captureRootDraft(source);
  assert.equal(rootDraft.status, 'supported');
  assert.equal(
    rootDraft.networks.roads.schema,
    'dreamwish-wand-wep-roadfence-logical-root-draft'
  );
  assert.equal(
    rootDraft.networks.roads.originPolicy,
    'native-logical-root'
  );
  const road = rootDraft.networks.roads.networks[0];
  assert.deepEqual(
    road.cells,
    [{ x: 2, y: 2, mode: 'orthogonal' }]
  );
  assert.equal(road.coordinateSpace.savePitch, 4);
  assert.equal(road.coordinateSpace.saveResidueX, 2);
  assert.equal(road.coordinateSpace.saveResidueY, 2);

  source.networks = structuredClone(rootDraft.networks);
  source.networks.roads.networks[0].cells = [
    { x: 3, y: 2, mode: 'orthogonal' }
  ];

  const adapter = createDraftAwareNetworkCaptureAdapter(
    binding.networkAdapter
  );
  const result = captureScenePreset(
    source,
    {
      selectionIds: ['g7:o101'],
      captureRegion: { x: 10, y: 10, w: 8, h: 4 },
      includeRoads: true,
      networkAdapter: adapter
    },
    validatePublishablePreset
  );

  assert.equal(result.captureReady, true);
  assert.equal(result.publicationReady, true);
  assert.deepEqual(
    result.artifact.networks.roads.networks[0].cells,
    [{ x: 4, y: 0, mode: 'orthogonal' }]
  );
  assert.equal(
    JSON.stringify(result.artifact.networks.roads)
      .includes('coordinateSpace'),
    false
  );
});


test('edited Fence representation layout is rebased into portable Scene artifact and Core-revalidated', () => {
  const { source } = portableFenceDocument();

  const result = captureScenePreset(
    source,
    {
      selectionIds: ['g7:o101'],
      captureRegion: { x: 10, y: 10, w: 18, h: 2 },
      includeFences: true,
      networkAdapter: createDraftAwareNetworkCaptureAdapter()
    },
    validatePublishablePreset
  );

  assert.equal(result.captureReady, true);
  assert.equal(result.publicationReady, true);
  const fence =
    result.artifact.networks.fences.networks[0];
  assert.equal(
    fence.representationLayout.schema,
    'ddv.fence-representation-layout@1'
  );
  assert.equal(
    fence.representationLayout.networkId,
    fence.networkId
  );
  assert.equal(
    fence.representationLayout.representationLayout.intent,
    'GENERATED_DESIGN'
  );
  assert.equal(
    fence.representationLayout.representationLayout.posts[0].x,
    12
  );
  assert.equal(
    fence.representationLayout.representationLayout.posts[0].nodeId,
    'n6'
  );
  assert.equal(
    fence.representationLayout.persistentWriteAuthorized,
    false
  );
  const serialized = JSON.stringify(fence);
  assert.equal(serialized.includes('gridObjectId'), false);
  assert.equal(serialized.includes('v:6:0'), false);
  assert.equal(
    result.artifact.networks.fences.normalization
      .fenceRepresentationLayoutPortable,
    true
  );
});

test('captured Fence without a portable representation model fails closed instead of inventing post layout', () => {
  const { source, networkId } = portableFenceDocument();
  delete source.networks.fences.representationLayouts[networkId];

  const result = captureScenePreset(
    source,
    {
      selectionIds: ['g7:o101'],
      captureRegion: { x: 10, y: 10, w: 18, h: 2 },
      includeFences: true,
      networkAdapter: createDraftAwareNetworkCaptureAdapter()
    },
    validatePublishablePreset
  );

  assert.equal(result.captureReady, false);
  assert.equal(result.publicationReady, false);
  assert.equal(
    result.issues.some(
      (entry) =>
        entry.code ===
        'WEP_FENCE_REPRESENTATION_LAYOUT_PRESET_NOT_BOUND'
    ),
    true
  );
});

test('Fence topology invalidation also blocks Scene capture until representation portability is rebound', () => {
  const binding = createSwitchV125RoadFenceReaderBinding({
    profile: profile(),
    rootGridId: 7
  });
  const source = document();
  source.networks.fences = {
    schema: 'dreamwish-wand-wep-roadfence-logical-root-draft',
    version: 1,
    kind: 'fences',
    originPolicy: 'native-logical-root',
    coordinatePolicy: 'per-network-reader-coordinate-space',
    networks: [],
    representationLayoutModified: {},
    representationLayoutInvalidated: {
      'fence:40700246:orthogonal:0': true
    },
    persistentWriteAuthorized: false
  };

  const result = captureScenePreset(
    source,
    {
      selectionIds: ['g7:o101'],
      captureRegion: { x: 10, y: 10, w: 2, h: 2 },
      includeFences: true,
      networkAdapter: createDraftAwareNetworkCaptureAdapter(
        binding.networkAdapter
      )
    },
    validatePublishablePreset
  );

  assert.equal(result.captureReady, false);
  assert.equal(
    result.issues.some(
      (entry) =>
        entry.code ===
        'FENCE_POST_LAYOUT_TOPOLOGY_CHANGED'
    ),
    true
  );
});
