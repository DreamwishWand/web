import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureScenePreset,
  sanitizePortableState
} from '../src/lib/wep/scene-capture-runtime.ts';
import { validatePublishablePreset } from '../src/lib/wep/scene-preset-runtime.ts';

function document() {
  return {
    target: {
      gameVersion: '1.25.0',
      platform: 'synthetic',
      areaKey: 'meadow'
    },
    objects: [
      {
        editorId: 'g7:o100',
        itemId: 10,
        layer: 'furniture',
        x: 5,
        y: 8,
        orientation: 0,
        footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        portableState: null,
        dependencyIds: ['g7:o101'],
        editability: 'editable',
        source: { gridId: 7, gridObjectId: 100 }
      },
      {
        editorId: 'g7:o101',
        itemId: 11,
        layer: 'furniture',
        x: 6,
        y: 8,
        orientation: 0,
        footprint: [{ x: 0, y: 0 }],
        portableState: null,
        dependencyIds: [],
        editability: 'editable',
        source: { gridId: 7, gridObjectId: 101 }
      }
    ]
  };
}

test('Scene capture closes dependencies and replaces save-local root identity', () => {
  const result = captureScenePreset(document(), {
    selectionIds: ['g7:o100'],
    title: 'Portable Scene'
  }, validatePublishablePreset);
  assert.equal(result.publicationReady, true);
  assert.deepEqual(
    result.artifact.objects.map((object) => object.artifactObjectId),
    ['o0', 'o1']
  );
  assert.deepEqual(result.artifact.objects[0].dependencyIds, ['o1']);
  assert.equal(JSON.stringify(result.artifact).includes('gridObjectId'), false);
  assert.equal(JSON.stringify(result.artifact).includes('editorId'), false);
});

test('Scene capture normalizes positions to occupied-cell bounds', () => {
  const result = captureScenePreset(document(), {
    selectionIds: ['g7:o100']
  }, validatePublishablePreset);
  assert.deepEqual(result.region, { x: 5, y: 8, w: 2, h: 1 });
  assert.deepEqual(
    result.artifact.objects.map((object) => [object.localX, object.localY]),
    [[0, 0], [1, 0]]
  );
});

test('explicit Capture Region becomes artifact coordinate origin', () => {
  const result = captureScenePreset(document(), {
    selectionIds: ['g7:o100'],
    captureRegion: { x: 4, y: 7, w: 5, h: 4 }
  }, validatePublishablePreset);
  assert.equal(result.artifact.objects[0].localX, 1);
  assert.equal(result.artifact.objects[0].localY, 1);
  assert.deepEqual(result.artifact.bounds, { w: 5, h: 4 });
});

test('serialized SubGrid children receive deterministic local cN identity', () => {
  const state = sanitizePortableState({
    codec: 'subgrid.serialized-local-child@1',
    child: {
      width: 4,
      height: 4,
      tessellationFactor: 1,
      objects: [
        {
          itemId: 30,
          localX: 2,
          localY: 1,
          orientation: 0,
          footprint: [{ x: 0, y: 0 }]
        },
        {
          itemId: 20,
          localX: 0,
          localY: 0,
          orientation: 0,
          footprint: [{ x: 0, y: 0 }]
        }
      ]
    }
  });
  assert.deepEqual(
    state.child.objects.map((object) => [object.artifactObjectId, object.itemId]),
    [['c0', 20], ['c1', 30]]
  );
});

test('unknown portable-state codec fails closed', () => {
  const bad = document();
  bad.objects[0].portableState = { codec: 'unknown@1' };
  assert.throws(
    () => captureScenePreset(bad, { selectionIds: ['g7:o100'] }, validatePublishablePreset),
    /PORTABLE_STATE_CODEC_UNSUPPORTED/
  );
});

test('readonly and network objects cannot masquerade as ordinary roots', () => {
  const readOnly = document();
  readOnly.objects[0].editability = 'readonly';
  assert.throws(
    () => captureScenePreset(readOnly, { selectionIds: ['g7:o100'] }, validatePublishablePreset),
    /SELECTION_BLOCKED/
  );

  const road = document();
  road.objects[0].layer = 'road';
  assert.throws(
    () => captureScenePreset(road, { selectionIds: ['g7:o100'] }, validatePublishablePreset),
    /SELECTION_BLOCKED/
  );
});

test('requested topology without Core network adapter blocks publication', () => {
  const result = captureScenePreset(document(), {
    selectionIds: ['g7:o100'],
    includeRoads: true
  }, validatePublishablePreset);
  assert.equal(result.captureReady, false);
  assert.equal(result.publicationReady, false);
  assert.equal(
    result.issues.some((entry) => entry.code === 'ROADS_TOPOLOGY_CAPTURE_UNAVAILABLE'),
    true
  );
});

test('supported network capture is forwarded into publication validation', () => {
  const network = {
    schema: 'dreamwish-wand-wep-network-capture',
    version: 1,
    kind: 'roads',
    originPolicy: 'capture-region-top-left',
    networks: [
      {
        networkId: 'r0',
        familyBaseItemID: 40100068,
        cells: [{ x: 0, y: 0, mode: 'orthogonal' }]
      }
    ]
  };

  const result = captureScenePreset(document(), {
    selectionIds: ['g7:o100'],
    includeRoads: true,
    networkAdapter: {
      capture(kind) {
        assert.equal(kind, 'roads');
        return { status: 'supported', data: network };
      }
    }
  }, validatePublishablePreset);

  assert.equal(result.publicationReady, true);
  assert.deepEqual(result.artifact.networks.roads, network);
});
