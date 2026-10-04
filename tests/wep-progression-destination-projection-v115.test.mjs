import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PROGRESSION_REFERENCE_INDEX_V10_SOURCE_SHA256,
  buildSwitchV125DestinationProgressionProjection
} from '../src/lib/wep/progression-destination-projection-v115.ts';

function fragmentFetch(input) {
  const url = String(input);
  const marker = '/ddv/core/save/v1.25/';
  const index = url.indexOf(marker);
  if (index < 0) return Promise.resolve(new Response('', { status: 404 }));
  const rel = url.slice(index);
  const bytes = readFileSync(
    new URL('../static' + rel, import.meta.url)
  );
  return Promise.resolve(
    new Response(bytes, {
      status: 200,
      headers: { 'content-type': 'text/plain' }
    })
  );
}

function baseProfile(itemId) {
  return {
    GameInfo: {
      Version: 624,
      Revision: 1,
      Session: 1
    },
    Player: {},
    ConditionalEventHistory: { ActiveEvents: {} },
    World: {
      GridCollection: {
        Grids: {
          '10': {
            ID: 10,
            GridDataPath: 'GridData/Test.json',
            TessellationFactor: 1,
            Objects: {
              '100': {
                ID: 100,
                ItemID: itemId,
                X: 1,
                Y: 1,
                Orientation: 'GridOrientation_Up',
                State: {}
              }
            }
          }
        },
        DiffGrids: {}
      },
      MissionSlots: {},
      QuestInfo: {},
      Keyholes: {}
    }
  };
}

test('exact promoted 01A source fragments reassemble and protect definition-risk destination objects', async () => {
  assert.equal(
    PROGRESSION_REFERENCE_INDEX_V10_SOURCE_SHA256,
    '7a7d9fb0e83d0b6607fe2015d14ba288c9408411fa839031fbeffbc4a9fff152'
  );

  const profile = baseProfile(40001060);
  const result =
    await buildSwitchV125DestinationProgressionProjection({
      profile,
      progressionScopeIndex: {
        '40001060': {
          isMissionItem: true,
          explicitGridEditRestriction: null,
          nativePresetKnownRejectReasons: []
        }
      },
      fetchImpl: fragmentFetch
    });

  const record = result.projection.byAddress['10:100'];
  assert.equal(record.ownershipClass, 'QUEST_OWNED');
  assert.equal(record.destinationProtected, true);
  assert.ok(
    record.operationVetoes.DESTINATION_OVERWRITE.includes(
      'PROTECTED_PROGRESSION_OBJECT_CONFLICT'
    )
  );
  assert.equal(result.positivePermissionGranted, false);
  assert.equal(result.persistentWriteAuthorized, false);
});

test('active exact-address reference from promoted 01A extractor creates destination veto without ItemID heuristics', async () => {
  const profile = baseProfile(40000047);
  profile.ConditionalEventHistory.ActiveEvents['1520000001'] = {
    SpawnState: {
      SpawnedObjects: [
        { GridID: 10, GridObjectID: 100 }
      ]
    }
  };

  const result =
    await buildSwitchV125DestinationProgressionProjection({
      profile,
      progressionScopeIndex: {
        '40000047': {
          isMissionItem: false,
          explicitGridEditRestriction: null,
          nativePresetKnownRejectReasons: []
        }
      },
      fetchImpl: fragmentFetch
    });

  const record = result.projection.byAddress['10:100'];
  assert.equal(
    record.activeReferenceDisposition,
    'ACTIVE_EXACT_ADDRESS'
  );
  assert.equal(record.destinationProtected, true);
  assert.ok(
    record.operationVetoes.DESTINATION_OVERWRITE.includes(
      'PROTECTED_PROGRESSION_OBJECT_CONFLICT'
    )
  );
  assert.equal(record.positivePermission, false);
  assert.equal(
    result.projection.semantics.absenceOfVetoIsPermission,
    false
  );
  assert.equal(
    result.projection.writerBoundary.persistentWriteAuthorized,
    false
  );
});
