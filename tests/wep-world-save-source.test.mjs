import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEP_WORLD_READ_DATA_SWITCH_DRIVE_ID,
  WEP_WORLD_READ_PROFILE_SCHEMA,
  listWorldAreaRoutes,
  openWorldSaveBytes
} from '../src/lib/wep/world-save-source.ts';

const profile = {
  GameInfo: {
    Version: 624,
    InitialVersion: 624,
    LastSaveDeviceInfo: {
      deviceType: 'DeviceType_Switch'
    }
  },
  Player: {},
  World: {
    GridCollection: {
      Grids: {
        '10': {
          ID: 10,
          GridDataPath: 'GridData/Village/Test.json',
          GridDefaultLayoutPath: 'Layouts/Test.json',
          TessellationFactor: 1,
          Objects: {
            '100': {
              ID: 100,
              ItemID: 40000173,
              X: 2,
              Y: 3,
              Orientation: 'GridOrientation_Up',
              State: {}
            }
          }
        },
        '11': {
          ID: 11,
          GridDataPath: 'GridData/Village/Technical.json',
          TessellationFactor: 2,
          Objects: {}
        }
      }
    },
    Villages: [
      {
        Areas: {
          '7': {
            GridIDs: [10, 11],
            Unlocked: true,
            EnvironmentEffectItemID: 0,
            EnvironmentEffectOrientation: 'GridOrientation_Up'
          }
        }
      }
    ]
  }
};

test('lists Village/Area/direct Grid routes without inventing role semantics', () => {
  const routes = listWorldAreaRoutes(profile);
  assert.equal(routes.length, 1);
  assert.deepEqual(routes[0], {
    villageIndex: 0,
    areaId: 7,
    unlocked: true,
    gridIds: [10, 11],
    roots: [
      {
        gridId: 10,
        gridDataPath: 'GridData/Village/Test.json',
        gridDefaultLayoutPath: 'Layouts/Test.json',
        tessellationFactor: 1,
        objectCount: 1
      },
      {
        gridId: 11,
        gridDataPath: 'GridData/Village/Technical.json',
        gridDefaultLayoutPath: null,
        tessellationFactor: 2,
        objectCount: 0
      }
    ]
  });
});

test('opens plaintext current-v1.25 schema read-only', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(profile));
  const opened = await openWorldSaveBytes(bytes);

  assert.equal(opened.inputFormat, 'plain-json');
  assert.equal(opened.profileSchemaVersion, WEP_WORLD_READ_PROFILE_SCHEMA);
  assert.equal(opened.saveIdentity.lastSavePlatform, 'switch');
  assert.equal(opened.compatibility.gameVersion, '1.25.0');
  assert.equal(opened.compatibility.exactBuildKnown, false);
  assert.equal(opened.compatibility.persistentWriteAuthorized, false);
  assert.equal(opened.areas.length, 1);
});

test('rejects unsupported profile schema before World projection', async () => {
  const other = structuredClone(profile);
  other.GameInfo.Version = 623;
  const bytes = new TextEncoder().encode(JSON.stringify(other));

  await assert.rejects(
    () => openWorldSaveBytes(bytes),
    /WEP_WORLD_PROFILE_SCHEMA_UNSUPPORTED/
  );
});

test('requires GameInfo, Player and World root sections', async () => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      GameInfo: { Version: 624 },
      World: profile.World
    })
  );

  await assert.rejects(
    () => openWorldSaveBytes(bytes),
    /WEP_WORLD_PROFILE_REQUIRED_SECTIONS_MISSING/
  );
});

test('browser read-data pin remains explicit and separate from code', () => {
  assert.equal(
    WEP_WORLD_READ_DATA_SWITCH_DRIVE_ID,
    '1gkaPeA3uWcOtdQMK0jVcwVffN6W89Hui'
  );
});
