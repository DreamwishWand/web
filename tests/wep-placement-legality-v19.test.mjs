import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  GRIDDATA_FLOOR_MAP_V125_SHA256,
  GRIDDATA_FLOOR_BINDER_V18_SHA256,
  PLACEMENT_LEGALITY_V19_SHA256,
  PLACEMENT_GEOMETRY_V125_SHA256,
  PLACEMENT_GEOMETRY_V125_RECORD_COUNT,
  PLACEMENT_GEOMETRY_BASE_V125_SHA256,
  PLACEMENT_GEOMETRY_BASE_V125_RECORD_COUNT,
  NATIVE_PLACEMENT_CLASSES,
  createSwitchV125PlacementLegalityBinding
} from '../src/lib/wep/placement-legality-v19.ts';

const root = new URL('../', import.meta.url);
const GRID_DATA_PATH =
  'GridData/FloatingIslands/FloatingIlsnad_Desert/FloatingIsland_DesertGrid-GridData.json';
const ITEM_ID = 40000178;

async function repoFile(path) {
  return new Uint8Array(await readFile(new URL(path, root)));
}

async function localFetch(url) {
  const pathname = new URL(String(url), 'https://wand.invalid').pathname;
  const bytes = await repoFile(`./static${pathname}`);
  return new Response(bytes, { status: 200 });
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function profile(objects = {}) {
  return {
    GameInfo: { Version: 624 },
    World: {
      GridCollection: {
        Grids: {
          '10': {
            ID: 10,
            GridDataPath: GRID_DATA_PATH,
            TessellationFactor: 1,
            Objects: objects
          }
        }
      }
    }
  };
}

function candidate(overrides = {}) {
  return {
    artifactObjectId: 'o0',
    itemId: ITEM_ID,
    localX: 0,
    localY: 0,
    orientation: 0,
    ...overrides
  };
}

test('promoted v1.8/v1.9 Core and static inputs retain pinned bytes', async () => {
  assert.equal(
    hash(
      await repoFile(
        './src/lib/ddv/core/world/runtime-v125/griddata-floor-v125.js'
      )
    ),
    GRIDDATA_FLOOR_BINDER_V18_SHA256
  );
  assert.equal(
    hash(
      await repoFile(
        './src/lib/ddv/core/world/runtime-v125/placement-legality-v125.js'
      )
    ),
    PLACEMENT_LEGALITY_V19_SHA256
  );
  assert.equal(
    hash(
      await repoFile(
        './static/ddv/core/world/v1.25/griddata-floor-maps-v125.json'
      )
    ),
    GRIDDATA_FLOOR_MAP_V125_SHA256
  );
  assert.equal(
    hash(
      await repoFile(
        './static/ddv/core/world/v1.25/placement-geometry-switch-v125.json'
      )
    ),
    PLACEMENT_GEOMETRY_V125_SHA256
  );
  assert.equal(
    hash(await repoFile('./static/ddv/v1.25/world-read-switch.json')),
    PLACEMENT_GEOMETRY_BASE_V125_SHA256
  );
});

test('v1.8/v1.9 binding joins approved geometry inputs without write authorization', async () => {
  const binding = await createSwitchV125PlacementLegalityBinding({
    fetchImpl: localFetch
  });

  assert.equal(binding.platform, 'switch');
  assert.equal(binding.gameVersion, '1.25.0');
  assert.equal(binding.buildID, '52BD625D9B4E0053');
  assert.equal(binding.profileSchemaVersion, 624);
  assert.equal(
    binding.provenance.geometryRecordCount,
    PLACEMENT_GEOMETRY_V125_RECORD_COUNT
  );
  assert.equal(
    binding.provenance.geometryBaseRecordCount,
    PLACEMENT_GEOMETRY_BASE_V125_RECORD_COUNT
  );
  assert.deepEqual(
    binding.provenance.geometryKnownUnresolvedItemIds,
    [20000039, 40006180]
  );
  assert.equal(binding.persistentWriteAuthorized, false);
});

test('v1.9 keeps clear, invalid and unknown placement classes separate', async () => {
  const binding = await createSwitchV125PlacementLegalityBinding({
    fetchImpl: localFetch
  });

  const clear = binding.classify({
    profile: profile(),
    destinationGridId: 10,
    gridDataPath: GRID_DATA_PATH,
    candidate: candidate()
  });
  assert.equal(clear.nativeClass, NATIVE_PLACEMENT_CLASSES.VALID_CLEAR);
  assert.equal(clear.persistentWriteAuthorized, false);

  const invalid = binding.classify({
    profile: profile(),
    destinationGridId: 10,
    gridDataPath: GRID_DATA_PATH,
    candidate: candidate({ localX: 129 })
  });
  assert.equal(invalid.nativeClass, NATIVE_PLACEMENT_CLASSES.INVALID);
  assert.equal(invalid.persistentWriteAuthorized, false);

  const nonCardinal = binding.classify({
    profile: profile(),
    destinationGridId: 10,
    gridDataPath: GRID_DATA_PATH,
    candidate: candidate({ orientation: 1 })
  });
  assert.equal(
    nonCardinal.nativeClass,
    NATIVE_PLACEMENT_CLASSES.UNKNOWN
  );
  assert.equal(nonCardinal.persistentWriteAuthorized, false);
});

test('unresolved object clearability remains UNKNOWN and is never promoted to VALID', async () => {
  const binding = await createSwitchV125PlacementLegalityBinding({
    fetchImpl: localFetch
  });
  const existing = {
    '50': {
      ID: 50,
      ItemID: ITEM_ID,
      X: 0,
      Y: 0,
      Orientation: 'GridOrientation_Up'
    }
  };

  const unknown = binding.classify({
    profile: profile(existing),
    destinationGridId: 10,
    gridDataPath: GRID_DATA_PATH,
    candidate: candidate()
  });
  assert.equal(
    unknown.nativeClass,
    NATIVE_PLACEMENT_CLASSES.UNKNOWN
  );
  assert.equal(unknown.clearabilityResolved, false);
  assert.equal(unknown.persistentWriteAuthorized, false);

  const replaceOrRemove = binding.classify({
    profile: profile(existing),
    destinationGridId: 10,
    gridDataPath: GRID_DATA_PATH,
    candidate: candidate(),
    clearabilityResolver: () => true
  });
  assert.equal(
    replaceOrRemove.nativeClass,
    NATIVE_PLACEMENT_CLASSES
      .VALID_REPLACES_OR_REMOVES_EXISTING
  );
  assert.equal(replaceOrRemove.clearabilityResolved, true);
  assert.equal(replaceOrRemove.persistentWriteAuthorized, false);
});

test('placement binding fails closed on any pinned static-data checksum mismatch', async () => {
  const brokenFetch = async (url) => {
    const response = await localFetch(url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (String(url).includes('griddata-floor-maps-v125.json')) {
      bytes[0] ^= 1;
    }
    return new Response(bytes, { status: 200 });
  };

  await assert.rejects(
    () =>
      createSwitchV125PlacementLegalityBinding({
        fetchImpl: brokenFetch
      }),
    /WEP_V125_PLACEMENT_STATIC_DATA_HASH_MISMATCH/
  );
});


function editorDocument({
  exactBuildKnown = false,
  x = 0,
  y = 0,
  orientation = 0,
  objects = []
} = {}) {
  return {
    target: {
      gameVersion: '1.25.0',
      platform: 'Nintendo Switch',
      profileSchemaVersion: 624,
      gridDataPath: GRID_DATA_PATH,
      tessellationFactor: 1,
      exactBuildKnown
    },
    objects: [
      {
        editorId: 'candidate',
        itemId: ITEM_ID,
        x,
        y,
        orientation,
        layer: 'furniture',
        footprint: [{ x: 0, y: 0 }],
        dependencyIds: [],
        editability: 'editable',
        metadata: {}
      },
      ...objects
    ]
  };
}

test('editor candidate preflight preserves exact-build unknown instead of promoting native VALID', async () => {
  const binding = await createSwitchV125PlacementLegalityBinding({
    fetchImpl: localFetch
  });
  const result = binding.classifyEditorCandidates({
    document: editorDocument(),
    candidateIds: ['candidate']
  });
  assert.equal(
    result.results[0].result.nativeClass,
    NATIVE_PLACEMENT_CLASSES.VALID_CLEAR
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.issues[0].code,
    'NATIVE_EXACT_BUILD_UNVERIFIED'
  );
  assert.equal(result.persistentWriteAuthorized, false);
});

test('editor candidate preflight accepts current promoted clear placement only when exact build is explicitly known', async () => {
  const binding = await createSwitchV125PlacementLegalityBinding({
    fetchImpl: localFetch
  });
  const result = binding.classifyEditorCandidates({
    document: editorDocument({ exactBuildKnown: true }),
    candidateIds: ['candidate']
  });
  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
  assert.equal(
    result.results[0].result.nativeClass,
    NATIVE_PLACEMENT_CLASSES.VALID_CLEAR
  );
});

test('editor draft validator keeps replacement or unknown placement policy blocked', async () => {
  const binding = await createSwitchV125PlacementLegalityBinding({
    fetchImpl: localFetch
  });
  const validator = binding.createEditorDraftValidator();
  const blocked = validator(
    editorDocument({
      exactBuildKnown: true,
      objects: [
        {
          editorId: 'existing',
          itemId: ITEM_ID,
          x: 0,
          y: 0,
          orientation: 0,
          layer: 'furniture',
          footprint: [{ x: 0, y: 0 }],
          dependencyIds: [],
          editability: 'editable',
          metadata: {}
        }
      ]
    }),
    { kind: 'MOVE', ids: ['candidate'], result: {} }
  );
  assert.equal(blocked.ok, false);
  assert.equal(
    blocked.issues.some(
      (issue) => issue.code === 'NATIVE_PLACEMENT_UNVERIFIED'
    ),
    true
  );
  assert.equal(blocked.persistentWriteAuthorized, false);
});

test('editor draft delete is model-only and never authorizes persistence', async () => {
  const binding = await createSwitchV125PlacementLegalityBinding({
    fetchImpl: localFetch
  });
  const validator = binding.createEditorDraftValidator();
  const result = validator(
    editorDocument(),
    { kind: 'DELETE', ids: ['candidate'], result: { removedIds: ['candidate'] } }
  );
  assert.equal(result.ok, true);
  assert.equal(result.status, 'DRAFT_MODEL_ONLY');
  assert.equal(result.persistentWriteAuthorized, false);
});
