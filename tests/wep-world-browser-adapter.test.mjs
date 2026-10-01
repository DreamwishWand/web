import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  WORLD_ADAPTER_V16_SOURCE_SHA256,
  WORLD_GRIDDATA_DIMENSIONS_V125_SHA256,
  WORLD_READ_SWITCH_V125_SHA256,
  WORLD_ROLE_AUTHORITY_V125_SHA256,
  createSwitchWorldReadAdapter,
  projectSwitchAreaGrid
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


test('v1.6 explicit Village04 single-grid alias is resolved from authority v2', async () => {
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
