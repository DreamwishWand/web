import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  WORLD_LOCATION_V16_SOURCE_SHA256,
  WORLD_RESTORATION_V15_SOURCE_SHA256,
  V125_PORTABLE_CONTRACTS,
  captureV125OutdoorLocation,
  resolveV125OutdoorLocation,
  resolveV125DestinationDirectRoot,
  captureV125AreaEnvironment,
  captureV125FloatingIslandEnvironment,
  captureV125ObjectRestoration,
  preflightV125PortableRestoration,
  currentV125FloatingIslandIdentityAdapter
} from '../src/lib/wep/world-portable-contracts.ts';

const root = new URL('../', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const repoFile = (path) => readFile(new URL(path, root));

function makeProfile() {
  return {
    GameInfo: { Version: 624 },
    Player: {},
    World: {
      PlayerHouses: [{ HouseItemID: 20000001 }],
      GridCollection: {
        Grids: {
          '10': {
            ID: 10,
            GridDataPath: 'GridData/Test/Biome.json',
            TessellationFactor: 1,
            Objects: {
              '100': {
                ID: 100,
                ItemID: 20000001,
                X: 1,
                Y: 2,
                Orientation: 'GridOrientation_Up',
                State: {
                  HouseData: {
                    PlayerHouseIndex: 0,
                    Built: true,
                    UpgradeState: 9
                  }
                }
              },
              '101': {
                ID: 101,
                ItemID: 20000002,
                X: 3,
                Y: 4,
                Orientation: 'GridOrientation_Up',
                State: {
                  BuildingWithSkinData: {
                    CurrentSkinItemID: 40000077,
                    UpgradeState: 8
                  }
                }
              }
            }
          },
          '20': {
            ID: 20,
            GridDataPath: 'GridData/Test/Island.json',
            TessellationFactor: 1,
            Objects: {}
          }
        }
      },
      Villages: [
        {
          SceneItemId: 1540000000,
          Areas: {
            '7': {
              GridIDs: [10],
              Unlocked: true,
              EnvironmentEffectItemID: 0,
              EnvironmentEffectOrientation: 'GridOrientation_Up'
            }
          }
        }
      ],
      FloatingIslands: {
        '1540000100': {
          SceneItemId: 1540000100,
          GridIDs: [20],
          Unlocked: true,
          EnvironmentEffectItemID: 0,
          EnvironmentEffectOrientation: 'GridOrientation_Right'
        }
      }
    }
  };
}

test('runtime World portable modules retain Integrator-approved source bytes', async () => {
  assert.equal(
    hash(await repoFile('./src/lib/ddv/core/world/runtime-v125/location-v125.js')),
    WORLD_LOCATION_V16_SOURCE_SHA256
  );
  assert.equal(
    hash(await repoFile('./src/lib/ddv/core/world/runtime-v125/restoration-v125.js')),
    WORLD_RESTORATION_V15_SOURCE_SHA256
  );
});

test('Biome location capture uses semantic identity plus exact direct-root route', () => {
  const profile = makeProfile();
  const result = captureV125OutdoorLocation(profile, 10);
  assert.equal(result.status, 'RESOLVED');
  assert.deepEqual(result.locationRef, {
    codec: 'ddv.outdoor-location-ref@1',
    kind: 'BIOME',
    villageSceneItemId: 1540000000,
    villageAreaType: 7
  });
  assert.deepEqual(result.directRootRoute, {
    codec: 'ddv.direct-grid-route@1',
    gridDataPath: 'GridData/Test/Biome.json'
  });
  assert.equal(result.persistentWriteAuthorized, false);
});

test('semantic location resolver exposes all direct roots without authorizing writes', () => {
  const profile = makeProfile();
  profile.World.GridCollection.Grids['11'] = {
    ID: 11,
    GridDataPath: 'GridData/Test/BiomeSecondary.json',
    TessellationFactor: 1,
    Objects: {}
  };
  profile.World.Villages[0].Areas['7'].GridIDs = [10, 11];

  const captured = captureV125OutdoorLocation(profile, 10);
  const resolved = resolveV125OutdoorLocation(profile, captured.locationRef);

  assert.equal(resolved.status, 'RESOLVED');
  assert.deepEqual(
    resolved.directRoots.map((root) => root.gridDataPath),
    ['GridData/Test/Biome.json', 'GridData/Test/BiomeSecondary.json']
  );
  assert.equal(resolved.persistentWriteAuthorized, false);
});

test('destination route resolves destination-local GridID instead of reusing source ID', () => {
  const source = makeProfile();
  const captured = captureV125OutdoorLocation(source, 10);
  const destination = makeProfile();
  destination.World.GridCollection.Grids['99'] = {
    ...destination.World.GridCollection.Grids['10'],
    ID: 99
  };
  delete destination.World.GridCollection.Grids['10'];
  destination.World.Villages[0].Areas['7'].GridIDs = [99];

  const resolved = resolveV125DestinationDirectRoot(
    destination,
    captured.locationRef,
    captured.directRootRoute
  );
  assert.equal(resolved.status, 'RESOLVED');
  assert.equal(resolved.destinationGridId, 99);
  assert.equal(resolved.persistentWriteAuthorized, false);
});

test('Floating Island identity is SceneItemId-backed and no longer WEP-unknown', () => {
  const adapted = currentV125FloatingIslandIdentityAdapter(
    'floating_island',
    { sceneItemId: 1540000100 }
  );
  assert.equal(adapted.status, 'supported');
  assert.deepEqual(adapted.identity, {
    codec: 'ddv.outdoor-location-ref@1',
    kind: 'FLOATING_ISLAND',
    sceneItemId: 1540000100
  });
});

test('Area and Floating Island environment capture excludes unrelated gameplay state', () => {
  const profile = makeProfile();
  const area = captureV125AreaEnvironment(profile, 0, 7);
  const island = captureV125FloatingIslandEnvironment(profile, 1540000100);

  assert.equal(area.status, 'CAPTURED');
  assert.deepEqual(area.portableState, {
    codec: 'ddv.environment-effect@1',
    targetKind: 'AREA',
    effectItemId: 0,
    orientation: 0
  });
  assert.equal(island.status, 'CAPTURED');
  assert.deepEqual(island.portableState, {
    codec: 'ddv.environment-effect@1',
    targetKind: 'FLOATING_ISLAND',
    effectItemId: 0,
    orientation: 4
  });
});

test('PlayerHouse capture binds by World.PlayerHouses semantic identity including index zero', () => {
  const profile = makeProfile();
  const result = captureV125ObjectRestoration(profile, 10, 100);
  assert.equal(result.status, 'CAPTURED');
  assert.equal(result.kind, 'PLAYER_HOUSE');
  assert.deepEqual(result.portableState, {
    codec: 'ddv.player-house-binding@1',
    houseItemId: 20000001
  });
  assert.deepEqual(result.excludedSourceFields, [
    'Built',
    'UpgradeState',
    'PlayerHouseIndex'
  ]);
});

test('Building skin capture keeps only CurrentSkinItemID semantic state', () => {
  const profile = makeProfile();
  const result = captureV125ObjectRestoration(profile, 10, 101);
  assert.equal(result.status, 'CAPTURED');
  assert.deepEqual(result.portableState, {
    codec: 'ddv.building-skin@1',
    targetBuildingItemId: 20000002,
    skinItemId: 40000077
  });
  assert.deepEqual(result.excludedSourceFields, ['UpgradeState']);
});

test('portable restoration preflight remains fail-closed without required validator/binder', () => {
  const profile = makeProfile();
  const building = captureV125ObjectRestoration(profile, 10, 101);
  const blocked = preflightV125PortableRestoration(
    profile,
    building.portableState
  );
  assert.equal(blocked.status, 'UNKNOWN_UNSUPPORTED');
  assert.equal(
    blocked.blockers.some((x) => x.code === 'BUILDING_SKIN_VALIDATOR_NOT_BOUND'),
    true
  );
  assert.equal(blocked.persistentWriteAuthorized, false);

  const noneEnvironment = captureV125AreaEnvironment(profile, 0, 7);
  const safeNoEffect = preflightV125PortableRestoration(
    profile,
    noneEnvironment.portableState
  );
  assert.equal(safeNoEffect.status, 'VALID');
  assert.equal(safeNoEffect.persistentWriteAuthorized, false);
});

test('published contract constants never advertise a writer', () => {
  assert.equal(V125_PORTABLE_CONTRACTS.location.persistentWriteAuthorized, false);
  assert.equal(V125_PORTABLE_CONTRACTS.restoration.persistentWriteAuthorized, false);
});
