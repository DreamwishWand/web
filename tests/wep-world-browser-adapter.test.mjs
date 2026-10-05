import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  WORLD_ADAPTER_V16_SOURCE_SHA256,
  WORLD_DIRECT_ROOT_EDITOR_DOCUMENT_V116_SHA256,
  WORLD_GRIDDATA_DIMENSIONS_V125_SHA256,
  WORLD_READ_SWITCH_V125_SHA256,
  WORLD_ROLE_AUTHORITY_V125_SHA256,
  createSwitchWorldReadAdapter,
  projectSwitchAreaGrid,
  projectSwitchFloatingIslandGrid
} from '../src/lib/wep/world-browser-adapter.ts';
import { openWorldSaveBytes } from '../src/lib/wep/world-save-source.ts';

const root = new URL('../', import.meta.url);

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

const profile = {
  GameInfo: {
    Version: 624,
    InitialVersion: 624,
    LastSaveDeviceInfo: { deviceType: 'DeviceType_Switch' }
  },
  Player: {},
  World: {
    GridCollection: {
      Grids: {
        '10': {
          ID: 10,
          GridDataPath: 'GridData/Villages/Village04-BeachLevel-GridData.json',
          GridDefaultLayoutPath: '',
          TessellationFactor: 1,
          NextGridObjectID: 101,
          Objects: {
            '100': {
              ID: 100,
              ItemID: 40000047,
              X: 2,
              Y: 3,
              Orientation: 'GridOrientation_Up',
              State: {}
            }
          }
        }
      }
    },
    Villages: [
      {
        Areas: {
          '7': {
            GridIDs: [10],
            Unlocked: true,
            EnvironmentEffectItemID: 0,
            EnvironmentEffectOrientation: 'GridOrientation_Up'
          }
        }
      }
    ]
  }
};

test('canonical adapter source and static inputs retain pinned bytes', async () => {
  assert.equal(
    hash(await repoFile('./src/lib/ddv/core/world/runtime-v125/adapter-v125.js')),
    WORLD_ADAPTER_V16_SOURCE_SHA256
  );
  assert.equal(
    hash(
      await repoFile(
        './src/lib/ddv/core/world/runtime-v125/direct-root-editor-document-v125.js'
      )
    ),
    WORLD_DIRECT_ROOT_EDITOR_DOCUMENT_V116_SHA256
  );
  assert.equal(
    hash(await repoFile('./static/ddv/core/world/v1.25/grid-role-authority-v125.json')),
    WORLD_ROLE_AUTHORITY_V125_SHA256
  );
  assert.equal(
    hash(await repoFile('./static/ddv/v1.25/world-read-switch.json')),
    WORLD_READ_SWITCH_V125_SHA256
  );
  assert.equal(
    hash(
      await repoFile(
        './static/ddv/core/world/v1.25/griddata-dimensions-v125.json'
      )
    ),
    WORLD_GRIDDATA_DIMENSIONS_V125_SHA256
  );
});

test('Switch read binding verifies and expands compact canonical data', async () => {
  const binding = await createSwitchWorldReadAdapter({
    basePath: '',
    fetchImpl: localFetch
  });
  assert.equal(binding.source.platform, 'Nintendo Switch');
  assert.equal(binding.source.profileSchemaVersion, 624);
  assert.equal(binding.provenance.readDataBuildID, '52BD625D9B4E0053');
  assert.equal(binding.provenance.adapterContractVersion, '01B-v1.7');
  assert.equal(binding.provenance.gridDataDimensionRecordCount, 152);
  assert.equal(
    binding.provenance.directRootEditorDocumentContract,
    'DDV-DIRECT-ROOT-EDITOR-DOCUMENT-V125-V1_16'
  );
  assert.equal(
    binding.provenance.directRootEditorDocumentSha256,
    WORLD_DIRECT_ROOT_EDITOR_DOCUMENT_V116_SHA256
  );
});

test('raw Switch save projects to read-only browser EditorDocument', async () => {
  const opened = await openWorldSaveBytes(
    new TextEncoder().encode(JSON.stringify(profile)),
    { sourcePlatform: 'switch' }
  );
  const binding = await createSwitchWorldReadAdapter({
    basePath: '',
    fetchImpl: localFetch
  });
  const document = projectSwitchAreaGrid(
    opened,
    opened.areas[0],
    10,
    binding
  );

  assert.equal(document.schema, 'dreamwish-wand-wep-editor-document');
  assert.equal(document.objects.length, 1);
  assert.equal(document.objects[0].itemId, 40000047);
  assert.equal(document.objects[0].metadata.geometryStatus, 'RESOLVED');
  assert.equal(document.target.exactBuildKnown, false);
  assert.equal(document.target.persistentWriteAuthorized, false);
  assert.equal(
    document.capabilities.worldDryRunMutation,
    'browser-disabled-exact-build-unproven'
  );
  assert.equal(document.capabilities.worldPersistentWrite, 'unsupported');
  assert.deepEqual(document.metadata.rootGridBounds, {
    x: 0,
    y: 0,
    w: 400,
    h: 350,
    status: 'AUTHORITATIVE_GRIDDATAPATH'
  });
  assert.equal(document.metadata.browserBinding.gridDataDimensionsBound, true);
  assert.equal(
    document.metadata.browserBinding.gridDataDimensionsSha256,
    WORLD_GRIDDATA_DIMENSIONS_V125_SHA256
  );
  assert.equal(document.metadata.browserBinding.roadFenceLogicalBinding, true);
});



test('promoted v1.16 Floating Island direct root projects into the normal browser EditorDocument without Area identity', async () => {
  const floating = structuredClone(profile);
  floating.World.GridCollection.Grids['760'] = {
    ID: 760,
    GridDataPath:
      'GridData/FloatingIslands/FloatingIsland_Urban/FloatingIsland_UrbanGrid-GridData.json',
    GridDefaultLayoutPath: '',
    TessellationFactor: 2,
    NextGridObjectID: 2,
    Objects: {
      '1': {
        ID: 1,
        ItemID: 40000047,
        X: 12,
        Y: 14,
        Orientation: 'GridOrientation_Up',
        State: null
      }
    }
  };
  floating.World.FloatingIslands = {
    '1540000147': {
      SceneItemId: 1540000147,
      GridIDs: [760],
      Unlocked: true,
      CustomLocationPositionsPath:
        'SceneLayouts/FloatingIslands/FloatingIsland_Urban/CustomLocations.json'
    }
  };

  const opened = await openWorldSaveBytes(
    new TextEncoder().encode(JSON.stringify(floating)),
    { sourcePlatform: 'switch' }
  );
  const binding = await createSwitchWorldReadAdapter({
    basePath: '',
    fetchImpl: localFetch
  });
  const island = opened.floatingIslands.find(
    (entry) => entry.sceneItemId === 1540000147
  );
  assert.ok(island);
  const document = projectSwitchFloatingIslandGrid(
    opened,
    island,
    island.roots[0],
    binding
  );

  assert.equal(document.schema, 'dreamwish-wand-wep-editor-document');
  assert.equal(document.objects.length, 1);
  assert.equal(document.target.directRootRole, 'FLOATING_ISLAND_DIRECT_ROOT');
  assert.equal(document.target.rootGridId, 760);
  assert.equal(
    document.target.gridDataPath,
    'GridData/FloatingIslands/FloatingIsland_Urban/FloatingIsland_UrbanGrid-GridData.json'
  );
  assert.equal('villageIndex' in document.target, false);
  assert.equal('areaId' in document.target, false);
  assert.equal('areaKey' in document.target, false);
  assert.equal(document.target.persistentWriteAuthorized, false);
  assert.equal(
    document.capabilities.worldDryRunMutation,
    'not-authorized-by-projector'
  );
  assert.equal(document.capabilities.worldPersistentWrite, 'unsupported');
  assert.deepEqual(document.metadata.rootGridBounds, {
    x: 0,
    y: 0,
    w: 260,
    h: 260,
    status: 'AUTHORITATIVE_GRIDDATAPATH'
  });
  assert.equal(
    document.metadata.browserBinding.directRootEditorDocumentContract,
    'DDV-DIRECT-ROOT-EDITOR-DOCUMENT-V125-V1_16'
  );
});

test('v1.7 explicit Village04 single-grid alias is resolved from authority v2', async () => {
  const aliasProfile = structuredClone(profile);
  aliasProfile.World.GridCollection.Grids = {
    '0': {
      ...aliasProfile.World.GridCollection.Grids['10'],
      ID: 0,
      GridDataPath: 'GridData/Villages/Village04-SnowLevel-GridData.json'
    }
  };
  aliasProfile.World.Villages[0].Areas['7'].GridIDs = [0];

  const opened = await openWorldSaveBytes(
    new TextEncoder().encode(JSON.stringify(aliasProfile)),
    { sourcePlatform: 'switch' }
  );
  const binding = await createSwitchWorldReadAdapter({
    basePath: '',
    fetchImpl: localFetch
  });
  const document = projectSwitchAreaGrid(
    opened,
    opened.areas[0],
    0,
    binding
  );

  assert.equal(
    document.target.rootGridRole.status,
    'SINGLE_GRID_EXPLICIT_DERIVED_ALIAS'
  );
  assert.equal(
    document.target.rootGridRole.evidenceStatus,
    'CONFIRMED_STATIC_DERIVED_ALIAS'
  );
  assert.equal(document.metadata.browserBinding.adapter, '01B-v1.7-integrator-approved');
  assert.deepEqual(document.metadata.rootGridBounds, {
    x: 0,
    y: 0,
    w: 230,
    h: 175,
    status: 'AUTHORITATIVE_GRIDDATAPATH'
  });
  assert.equal(document.target.persistentWriteAuthorized, false);
});

test('v1.7 dimensions flow into reachable SubGrid portable child bounds through Core adapter', async () => {
  const fixture = JSON.parse(
    new TextDecoder().decode(
      await repoFile(
        './tests/fixtures/ddv-world/core-world-v125-observed-fixture.json'
      )
    )
  );
  const binding = await createSwitchWorldReadAdapter({
    basePath: '',
    fetchImpl: localFetch
  });
  const document = binding.adapter.loadAreaGrid(fixture.profile, {
    villageIndex: 0,
    areaId: 3,
    rootGridId: 5,
    source: {
      gameVersion: '1.25.0',
      platform: 'Nintendo Switch',
      buildIdentity: '52BD625D9B4E0053',
      profileSchemaVersion: 624
    }
  });

  const bistro = document.objects.find(
    (object) => object.itemId === 40003102
  );
  const ratatouille = document.objects.find(
    (object) => object.itemId === 40000178
  );

  assert.equal(
    bistro.portableState.codec,
    'subgrid.serialized-local-child@1'
  );
  assert.equal(bistro.portableState.child.width, 6);
  assert.equal(bistro.portableState.child.height, 6);
  assert.equal(
    ratatouille.portableState.codec,
    'subgrid.serialized-local-child@1'
  );
  assert.equal(ratatouille.portableState.child.width, 2);
  assert.equal(ratatouille.portableState.child.height, 2);
  assert.equal(document.metadata.rootGridBounds.status, 'AUTHORITATIVE_GRIDDATAPATH');
});

test('unlisted GridDataPath remains bounds-unresolved rather than guessed', async () => {
  const unknownProfile = structuredClone(profile);
  unknownProfile.World.GridCollection.Grids['10'].GridDataPath =
    'GridData/Unknown/NotInV17.json';

  const opened = await openWorldSaveBytes(
    new TextEncoder().encode(JSON.stringify(unknownProfile)),
    { sourcePlatform: 'switch' }
  );
  const binding = await createSwitchWorldReadAdapter({
    basePath: '',
    fetchImpl: localFetch
  });
  const document = projectSwitchAreaGrid(
    opened,
    opened.areas[0],
    10,
    binding
  );

  assert.equal(document.metadata.rootGridBounds, null);
  assert.equal(
    document.metadata.diagnostics.some(
      (issue) => issue.code === 'ROOT_GRID_BOUNDS_UNRESOLVED'
    ),
    true
  );
  assert.equal(document.metadata.browserBinding.gridDataDimensionsBound, true);
});

test('Switch projection rejects unknown/cross-save source platform', async () => {
  const opened = await openWorldSaveBytes(
    new TextEncoder().encode(JSON.stringify(profile))
  );
  const binding = await createSwitchWorldReadAdapter({
    basePath: '',
    fetchImpl: localFetch
  });

  assert.throws(
    () => projectSwitchAreaGrid(opened, opened.areas[0], 10, binding),
    /WEP_WORLD_SWITCH_SOURCE_PLATFORM_REQUIRED/
  );
});

test('static-data checksum mismatch fails closed', async () => {
  const brokenFetch = async (url) => {
    const response = await localFetch(url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (String(url).includes('world-read-switch')) bytes[0] ^= 1;
    return new Response(bytes, { status: 200 });
  };

  await assert.rejects(
    () =>
      createSwitchWorldReadAdapter({
        basePath: '',
        fetchImpl: brokenFetch
      }),
    /WEP_WORLD_STATIC_DATA_HASH_MISMATCH/
  );
});

test('Decorate Stage 1 placement source uses canonical geometry/scope without ownership gating', async () => {
  const binding = await createSwitchWorldReadAdapter({
    basePath: '',
    fetchImpl: localFetch
  });
  const ordinary = binding.resolveDraftPlacementSource(40000047, 1);
  assert.equal(ordinary.status, 'SUPPORTED');
  assert.equal(ordinary.canonicalIdentity.kind, 'DDV_ITEM_ID');
  assert.equal(ordinary.canonicalIdentity.itemId, 40000047);
  assert.deepEqual(ordinary.footprintSize, { w: 3, h: 2 });
  assert.equal(ordinary.draftPlacementSupported, true);
  assert.equal(ordinary.verifiedReplacementExportSupported, false);
  assert.equal(ordinary.persistentWriteAuthorized, false);
  assert.equal('owned' in ordinary, false);
  assert.equal('favorite' in ordinary, false);
  assert.equal('hidden' in ordinary, false);

  const subgrid = binding.resolveDraftPlacementSource(40003102, 1);
  assert.equal(subgrid.draftPlacementSupported, false);
  assert.equal(subgrid.reasons.includes('SUBGRID_CREATION_CONTRACT_UNBOUND'), true);

  const unknown = binding.resolveDraftPlacementSource(999999999, 1);
  assert.equal(unknown.draftPlacementSupported, false);
  assert.equal(unknown.reasons.includes('GEOMETRY_UNRESOLVED'), true);
});
