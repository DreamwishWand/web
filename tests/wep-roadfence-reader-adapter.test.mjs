import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROADFENCE_READER_MAIN_MERGE_COMMIT,
  createSwitchV125RoadFenceReaderBinding
} from '../src/lib/wep/roadfence-reader-adapter.ts';
import {
  captureScenePreset
} from '../src/lib/wep/scene-capture-runtime.ts';
import {
  validatePublishablePreset
} from '../src/lib/wep/scene-preset-runtime.ts';

function profile() {
  return {
    GameInfo: { Version: 624 },
    Player: {},
    World: {
      GridCollection: {
        Grids: {
          '7': {
            ID: 7,
            GridDataPath: 'GridData/Test/Reader.json',
            TessellationFactor: 1,
            Objects: {
              '100': {
                ID: 100,
                ItemID: 40100068,
                X: 10,
                Y: 10,
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

function document() {
  return {
    schema: 'dreamwish-wand-wep-editor-document',
    version: 1,
    target: {
      gameVersion: '1.25.0',
      platform: 'Nintendo Switch',
      profileSchemaVersion: 624,
      rootGridId: 7,
      areaKey: 'v0:a7',
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
