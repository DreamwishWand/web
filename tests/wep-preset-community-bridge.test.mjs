import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createPresetCommunityBridge } from '../src/lib/wep/preset-community-bridge.ts';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const artifact = {
  schema: 'dreamwish-wand-preset',
  artifactVersion: 1,
  type: 'scene',
  title: 'Bridge Scene',
  source: { gameVersion: '1.25.0', platform: 'synthetic', areaKey: 'demo' },
  bounds: { w: 1, h: 1 },
  originPolicy: 'capture-region-top-left',
  objects: [
    {
      artifactObjectId: 'o0',
      itemId: 10,
      layer: 'furniture',
      localX: 0,
      localY: 0,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      portableState: null,
      dependencyIds: []
    }
  ],
  networks: { roads: null, fences: null },
  requirements: {
    itemQuantities: { 10: 1 },
    roadTopology: false,
    fenceTopology: false
  },
  normalization: {
    sourceGridIdsRemoved: true,
    sourceGridObjectIdsRemoved: true,
    dependencyClosureIncluded: true
  }
};

const json = JSON.stringify(artifact);
const bytes = new TextEncoder().encode(json);
const checksum = Array.from(
  new Uint8Array(await webcrypto.subtle.digest('SHA-256', bytes)),
  (byte) => byte.toString(16).padStart(2, '0')
).join('');

function makeHarness(overrides = {}) {
  const calls = [];
  const community = {
    async preset(action, payload) {
      calls.push(['preset', action, payload]);
      if (action === 'prepare') {
        return {
          ok: true,
          storageKey: 'staging/u/a.json',
          signedUpload: { signedUrl: 'https://upload.invalid' }
        };
      }
      if (action === 'publish') {
        return {
          ok: true,
          data: {
            presetArtifactId: 'pa1',
            presetRevisionId: 'pr1',
            workId: 'w1',
            workRevisionId: 'wr1',
            storageKey: 'published/u/x.json',
            checksumSha256: checksum,
            byteSize: bytes.length
          }
        };
      }
      if (action === 'resolveWork') {
        return {
          ok: true,
          preset: {
            presetArtifactId: 'pa1',
            presetRevisionId: 'pr1',
            presetType: 'scene',
            schemaVersion: 1,
            byteSize: bytes.length,
            checksumSha256: checksum
          }
        };
      }
      if (action === 'read') {
        return {
          ok: true,
          preset: {
            presetArtifactId: 'pa1',
            presetRevisionId: 'pr1',
            presetType: 'scene',
            schemaVersion: 1,
            byteSize: bytes.length,
            checksumSha256: checksum,
            signedUrl: 'https://read.invalid',
            expiresIn: 300
          }
        };
      }
      if (action === 'discard') return { ok: true };
      throw new Error('unexpected preset action ' + action);
    },
    async command(command, payload) {
      calls.push(['command', command, payload]);
      return {
        ok: true,
        data: {
          targetEntityId: payload.targetEntityId,
          saved: command === 'saveEntity'
        }
      };
    },
    async query(query) {
      if (query === 'saved') {
        return {
          ok: true,
          data: [
            {
              targetEntityId: 'pa1',
              accessible: true,
              savedAt: 'now'
            }
          ]
        };
      }
      if (query === 'preset') {
        return {
          ok: true,
          data: {
            presetArtifactId: 'pa1',
            presetRevisionId: 'pr1',
            presetType: 'scene',
            schemaVersion: 1,
            contentType: 'application/json',
            byteSize: bytes.length,
            checksumSha256: checksum,
            title: 'Bridge Scene'
          }
        };
      }
      throw new Error('unexpected query ' + query);
    },
    async searchPublicWorks(options) {
      calls.push(['search', options]);
      return [
        {
          work_id: 'w1',
          creator_profile_id: 'cp1',
          title: 'Bridge Scene',
          text_content: 'desc',
          tags: [],
          facets: {},
          published_at: '2026-09-30T00:00:00Z'
        }
      ];
    },
    ...overrides.community
  };

  const hooks = {
    buildPublishEnvelope(value) {
      if (value?.objects?.[0]?.artifactObjectId !== 'o0') {
        return {
          ok: false,
          issues: [{ code: 'SCENE_OBJECT_ID_INVALID' }]
        };
      }
      return {
        ok: true,
        presetType: 'scene',
        schemaVersion: 1,
        issues: [],
        envelope: {
          contentType: 'application/json',
          byteSize: bytes.length,
          json
        }
      };
    },
    validatePublishablePreset(value) {
      return {
        ok: value?.type === 'scene' && value?.objects?.[0]?.artifactObjectId === 'o0',
        presetType: value?.type ?? null,
        schemaVersion: value?.artifactVersion ?? null,
        issues: []
      };
    },
    preflightScene(value) {
      return {
        ok: value?.type === 'scene',
        issues: [],
        placements: [],
        writeReady: false,
        reason: 'CORE_COMMIT_ADAPTER_NOT_BOUND'
      };
    },
    ...overrides.hooks
  };

  const fetchImpl =
    overrides.fetchImpl ??
    (async (url) => {
      if (url === 'https://upload.invalid') {
        return { ok: true, status: 200, text: async () => '' };
      }
      if (url === 'https://read.invalid') {
        return {
          ok: true,
          status: 200,
          text: async () => '',
          arrayBuffer: async () =>
            bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        };
      }
      return { ok: false, status: 404, text: async () => 'not found' };
    });

  return {
    calls,
    bridge: createPresetCommunityBridge({ community, hooks, fetchImpl })
  };
}

test('Scene publish uses prepare/upload/publish and returns stable IDs', async () => {
  const { bridge, calls } = makeHarness();
  const result = await bridge.publishScene({
    artifact,
    creatorProfileId: 'cp1',
    visibility: 'public',
    title: 'Bridge Scene',
    idempotencyKey: 'idem-1'
  });
  assert.equal(result.presetArtifactId, 'pa1');
  assert.equal(
    calls.some((call) => call[0] === 'preset' && call[1] === 'prepare'),
    true
  );
});

test('Discover is scoped to Community preset works', async () => {
  const { bridge, calls } = makeHarness();
  const rows = await bridge.discover({ query: 'Bridge' });
  assert.equal(rows[0].workId, 'w1');
  assert.equal(calls.find((call) => call[0] === 'search')[1].workType, 'preset');
});

test('Discover work resolves to PresetArtifact before Library save', async () => {
  const { bridge, calls } = makeHarness();
  await bridge.saveDiscoveredWork('w1');
  assert.equal(
    calls.some(
      (call) =>
        call[0] === 'command' &&
        call[1] === 'saveEntity' &&
        call[2].targetEntityId === 'pa1'
    ),
    true
  );
});

test('Library returns SavedItem accessibility without granting access', async () => {
  const { bridge } = makeHarness();
  assert.deepEqual(await bridge.listLibrary(), [
    {
      targetEntityId: 'pa1',
      accessible: true,
      savedAt: 'now'
    }
  ]);
});

test('Signed read verifies byte size, SHA-256 and WEP artifact validation', async () => {
  const { bridge } = makeHarness();
  const result = await bridge.loadPreset('pa1');
  assert.equal(result.checksumSha256, checksum);
  assert.equal(result.artifact.type, 'scene');
});

test('Downloaded Scene flows into WEP preflight and stays non-writing', async () => {
  const { bridge } = makeHarness();
  const result = await bridge.preflightPreset('pa1');
  assert.equal(result.preflight.ok, true);
  assert.equal(result.preflight.writeReady, false);
});

test('Checksum mismatch fails closed', async () => {
  const { bridge } = makeHarness({
    community: {
      async preset(action) {
        if (action === 'read') {
          return {
            ok: true,
            preset: {
              presetArtifactId: 'pa1',
              presetRevisionId: 'pr1',
              presetType: 'scene',
              schemaVersion: 1,
              byteSize: bytes.length,
              checksumSha256: '0'.repeat(64),
              signedUrl: 'https://read.invalid'
            }
          };
        }
        if (action === 'resolveWork') {
          return {
            ok: true,
            preset: {
              presetArtifactId: 'pa1',
              presetRevisionId: 'pr1',
              presetType: 'scene',
              schemaVersion: 1,
              byteSize: bytes.length,
              checksumSha256: checksum
            }
          };
        }
        throw new Error('unexpected action');
      }
    }
  });
  await assert.rejects(() => bridge.loadPreset('pa1'), /CHECKSUM_MISMATCH/);
});

test('Local artifact validation blocks transport before prepare', async () => {
  const { bridge, calls } = makeHarness();
  const invalid = structuredClone(artifact);
  invalid.objects[0].artifactObjectId = 'g5:o99';
  await assert.rejects(
    () =>
      bridge.publishScene({
        artifact: invalid,
        creatorProfileId: 'cp1',
        title: 'bad',
        idempotencyKey: 'bad-1'
      }),
    /NOT_PUBLISHABLE/
  );
  assert.equal(
    calls.some((call) => call[0] === 'preset' && call[1] === 'prepare'),
    false
  );
});
