import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCurrentV125FullDesignCapturePlan } from '../src/lib/wep/full-design-preset-planning.ts';
import { validateCurrentV125FullDesignManifest } from '../src/lib/wep/full-design-preset-manifest.ts';
import { preflightCurrentV125FullDesignManifest } from '../src/lib/wep/full-design-preset-preflight.ts';

function makeProfile({
  firstGridId = 10,
  secondGridId = 11,
  islandGridId = 20,
  environmentEffectItemID = 0
} = {}) {
  return {
    GameInfo: { Version: 624 },
    Player: {},
    World: {
      PlayerHouses: [],
      GridCollection: {
        Grids: {
          [String(firstGridId)]: {
            ID: firstGridId,
            GridDataPath: 'GridData/Test/Biome-A.json',
            TessellationFactor: 1,
            Objects: {}
          },
          [String(secondGridId)]: {
            ID: secondGridId,
            GridDataPath: 'GridData/Test/Biome-B.json',
            TessellationFactor: 1,
            Objects: {}
          },
          [String(islandGridId)]: {
            ID: islandGridId,
            GridDataPath: 'GridData/Test/FloatingIsland.json',
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
              GridIDs: [firstGridId, secondGridId],
              Unlocked: true,
              EnvironmentEffectItemID: environmentEffectItemID,
              EnvironmentEffectOrientation: 'GridOrientation_Up'
            }
          }
        }
      ],
      FloatingIslands: {
        '1540000100': {
          SceneItemId: 1540000100,
          GridIDs: [islandGridId],
          Unlocked: true,
          EnvironmentEffectItemID: 0,
          EnvironmentEffectOrientation: 'GridOrientation_Right'
        }
      }
    }
  };
}

function makeBiomeManifest(profile = makeProfile()) {
  return buildCurrentV125FullDesignCapturePlan({
    profile,
    rootGridId: profile.World.Villages[0].Areas['7'].GridIDs[0],
    sourcePlatform: 'switch'
  }).manifest;
}

function addRestorationObjects(profile) {
  const rootId = profile.World.Villages[0].Areas['7'].GridIDs[0];
  profile.World.PlayerHouses = [{ HouseItemID: 20500005 }];
  profile.World.GridCollection.Grids[String(rootId)].Objects = {
    '501': {
      ID: 501,
      ItemID: 20500001,
      X: 5,
      Y: 7,
      Orientation: 'GridOrientation_Up',
      State: {
        BuildingWithSkinData: {
          CurrentSkinItemID: 20510001,
          UpgradeState: { Level: 7 }
        }
      }
    },
    '502': {
      ID: 502,
      ItemID: 20500005,
      X: 10,
      Y: 12,
      Orientation: 'GridOrientation_Right',
      State: {
        HouseData: {
          PlayerHouseIndex: 0,
          Built: true,
          UpgradeState: { Level: 9 }
        }
      }
    }
  };
  return profile;
}

test('generated Switch v1.25 full-design manifest passes strict validation', () => {
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: makeProfile(),
    rootGridId: 10,
    sourcePlatform: 'switch'
  });

  assert.equal(plan.manifestReady, true);
  assert.equal(plan.manifestValidation.ok, true);
  const validation = validateCurrentV125FullDesignManifest(plan.manifest);
  assert.equal(validation.ok, true);
  assert.equal(validation.persistentWriteAuthorized, false);
});

test('strict validation rejects save-local IDs even when nested in otherwise valid data', () => {
  const manifest = structuredClone(makeBiomeManifest());
  manifest.categories.rootObjects.debug = {
    sourceGridId: 10,
    gridObjectId: 1234
  };

  const validation = validateCurrentV125FullDesignManifest(manifest);
  assert.equal(validation.ok, false);
  assert.equal(
    validation.issues.filter(
      (issue) => issue.code === 'FULL_DESIGN_SAVE_LOCAL_IDENTITY_FORBIDDEN'
    ).length,
    2
  );
});

test('strict validation rejects duplicate direct-root routes and count inconsistency', () => {
  const manifest = structuredClone(makeBiomeManifest());
  manifest.directRootRoutes[1] = structuredClone(manifest.directRootRoutes[0]);

  const validation = validateCurrentV125FullDesignManifest(manifest);
  assert.equal(validation.ok, false);
  assert.equal(
    validation.issues.some(
      (issue) => issue.code === 'FULL_DESIGN_DIRECT_ROOT_PATH_DUPLICATE'
    ),
    true
  );
  assert.equal(
    validation.issues.some(
      (issue) => issue.code === 'FULL_DESIGN_DIRECT_ROOT_COUNT_MISMATCH'
    ),
    true
  );
});

test('current validator does not generalize the browser full-design source contract to Steam or unknown', () => {
  for (const platform of ['steam-windows', 'unknown']) {
    const manifest = structuredClone(makeBiomeManifest());
    manifest.source.sourcePlatform = platform;
    const validation = validateCurrentV125FullDesignManifest(manifest);
    assert.equal(validation.ok, false);
    assert.equal(
      validation.issues.some(
        (issue) =>
          issue.code === 'FULL_DESIGN_SOURCE_PLATFORM_CONTRACT_UNAVAILABLE'
      ),
      true
    );
  }
});

test('strict validation rejects environment target mismatch and write authorization promotion', () => {
  const manifest = structuredClone(makeBiomeManifest());
  manifest.categories.environment.portableState.targetKind = 'FLOATING_ISLAND';
  manifest.persistentWriteAuthorized = true;

  const validation = validateCurrentV125FullDesignManifest(manifest);
  assert.equal(validation.ok, false);
  assert.equal(
    validation.issues.some(
      (issue) => issue.code === 'FULL_DESIGN_ENVIRONMENT_TARGET_KIND_MISMATCH'
    ),
    true
  );
  assert.equal(
    validation.issues.some(
      (issue) =>
        issue.code === 'FULL_DESIGN_PERSISTENT_WRITE_AUTHORIZATION_FORBIDDEN'
    ),
    true
  );
});

test('Building skin and PlayerHouse restoration capture is portable and save-ID free', () => {
  const profile = addRestorationObjects(makeProfile());
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile,
    rootGridId: 10,
    sourcePlatform: 'switch'
  });

  assert.equal(plan.manifestValidation.ok, true);
  assert.equal(plan.categories.rootObjects.directRootObjectCount, 2);
  assert.deepEqual(
    plan.categories.rootObjects.routeObjectCounts.map((x) => ({
      path: x.directRootRoute.gridDataPath,
      objectCount: x.objectCount
    })),
    [
      { path: 'GridData/Test/Biome-A.json', objectCount: 2 },
      { path: 'GridData/Test/Biome-B.json', objectCount: 0 }
    ]
  );

  const capture = plan.categories.buildings.restorationCapture;
  assert.equal(capture.entries.length, 2);
  assert.equal(capture.unresolved.length, 0);
  assert.deepEqual(
    capture.entries.map((entry) => ({
      id: entry.artifactRestorationId,
      kind: entry.kind,
      itemId: entry.itemId,
      localX: entry.localX,
      localY: entry.localY,
      path: entry.directRootRoute.gridDataPath,
      codec: entry.portableState.codec
    })),
    [
      {
        id: 'r0',
        kind: 'BUILDING_SKIN',
        itemId: 20500001,
        localX: 5,
        localY: 7,
        path: 'GridData/Test/Biome-A.json',
        codec: 'ddv.building-skin@1'
      },
      {
        id: 'r1',
        kind: 'PLAYER_HOUSE',
        itemId: 20500005,
        localX: 10,
        localY: 12,
        path: 'GridData/Test/Biome-A.json',
        codec: 'ddv.player-house-binding@1'
      }
    ]
  );

  const serialized = JSON.stringify(plan.manifest);
  assert.equal(serialized.includes('PlayerHouseIndex'), false);
  assert.equal(serialized.includes('UpgradeState'), false);
  assert.equal(serialized.includes('"ID":501'), false);
  assert.equal(serialized.includes('"ID":502'), false);
  assert.equal(plan.publicationReady, false);
  assert.equal(plan.applyReady, false);
});

test('strict validator rejects Building restoration routes outside the semantic location', () => {
  const manifest = structuredClone(
    makeBiomeManifest(addRestorationObjects(makeProfile()))
  );
  manifest.categories.buildings.restorationCapture.entries[0].directRootRoute.gridDataPath =
    'GridData/Test/Other.json';

  const validation = validateCurrentV125FullDesignManifest(manifest);
  assert.equal(validation.ok, false);
  assert.equal(
    validation.issues.some(
      (issue) =>
        issue.code ===
        'FULL_DESIGN_BUILDING_RESTORATION_ROUTE_OUTSIDE_LOCATION'
    ),
    true
  );
});

test('Building and PlayerHouse destination restoration can preflight without enabling Apply', () => {
  const manifest = makeBiomeManifest(addRestorationObjects(makeProfile()));
  const destination = makeProfile({
    firstGridId: 99,
    secondGridId: 100,
    islandGridId: 120
  });

  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: destination,
    destinationPlatform: 'switch',
    manifest,
    restorationContext: {
      validateBuildingSkin: ({ skinItemId, targetBuildingItemId }) => ({
        status:
          skinItemId === 20510001 && targetBuildingItemId === 20500001
            ? 'VALID'
            : 'INVALID',
        issues: []
      }),
      bindPlayerHouse: ({ houseItemId }) => ({
        status: 'VALID',
        binding: {
          playerHouseIndex: 3,
          houseItemId
        },
        issues: []
      })
    }
  });

  assert.equal(preflight.buildingRestorationPreflightReady, true);
  assert.equal(preflight.destinationPreflightReady, true);
  assert.equal(preflight.categoryClosureReady, false);
  assert.equal(preflight.ok, false);
  assert.deepEqual(
    preflight.destination.buildingRestorationPreflights.map((entry) => ({
      id: entry.artifactRestorationId,
      kind: entry.kind,
      status: entry.status
    })),
    [
      { id: 'r0', kind: 'BUILDING_SKIN', status: 'VALID' },
      { id: 'r1', kind: 'PLAYER_HOUSE', status: 'VALID' }
    ]
  );
  assert.equal(preflight.applyReady, false);
});

test('Building and PlayerHouse restoration fail closed when destination validators are not bound', () => {
  const manifest = makeBiomeManifest(addRestorationObjects(makeProfile()));
  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: makeProfile({
      firstGridId: 99,
      secondGridId: 100,
      islandGridId: 120
    }),
    destinationPlatform: 'switch',
    manifest
  });

  assert.equal(preflight.routeResolutionReady, true);
  assert.equal(preflight.buildingRestorationPreflightReady, false);
  assert.equal(preflight.destinationResolved, false);
  assert.equal(
    preflight.issues.filter(
      (issue) =>
        issue.code ===
        'FULL_DESIGN_DESTINATION_BUILDING_RESTORATION_BLOCKED'
    ).length,
    2
  );
  assert.equal(preflight.applyReady, false);
});

test('destination preflight re-resolves portable direct roots to destination-local GridIDs', () => {
  const manifest = makeBiomeManifest(makeProfile());
  const destination = makeProfile({
    firstGridId: 99,
    secondGridId: 100,
    islandGridId: 120
  });

  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: destination,
    destinationPlatform: 'switch',
    manifest
  });

  assert.equal(preflight.manifestValid, true);
  assert.equal(preflight.routeResolutionReady, true);
  assert.equal(preflight.buildingRestorationPreflightReady, true);
  assert.equal(preflight.environmentPreflightReady, true);
  assert.equal(preflight.destinationResolved, true);
  assert.equal(preflight.destinationPreflightReady, true);
  assert.equal(preflight.categoryClosureReady, false);
  assert.equal(preflight.ok, false);
  assert.deepEqual(
    preflight.destination.directRootResolutions.map((x) => ({
      gridDataPath: x.gridDataPath,
      destinationGridId: x.destinationGridId
    })),
    [
      {
        gridDataPath: 'GridData/Test/Biome-A.json',
        destinationGridId: 99
      },
      {
        gridDataPath: 'GridData/Test/Biome-B.json',
        destinationGridId: 100
      }
    ]
  );
  assert.equal(
    preflight.categoryBlockers.some(
      (x) => x.code === 'AUTHORITATIVE_GRIDDATAPATH_BOUNDS_NOT_BOUND'
    ),
    true
  );
  assert.equal(preflight.applyReady, false);
  assert.equal(
    preflight.applyReason,
    'FULL_DESIGN_CATEGORY_CLOSURE_INCOMPLETE'
  );
  assert.equal(preflight.persistentWriteAuthorized, false);
});

test('destination preflight remains fail-closed when platform contract is unavailable', () => {
  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: makeProfile(),
    destinationPlatform: 'steam-windows',
    manifest: makeBiomeManifest()
  });

  assert.equal(preflight.destinationResolved, false);
  assert.equal(preflight.routeResolutionReady, false);
  assert.equal(
    preflight.issues.some(
      (issue) =>
        issue.code === 'FULL_DESIGN_DESTINATION_PLATFORM_CONTRACT_UNAVAILABLE'
    ),
    true
  );
  assert.equal(preflight.applyReady, false);
});

test('nonzero environment effect blocks without the required destination validator', () => {
  const source = makeProfile({ environmentEffectItemID: 777 });
  const manifest = makeBiomeManifest(source);
  const destination = makeProfile({ environmentEffectItemID: 0 });

  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: destination,
    destinationPlatform: 'switch',
    manifest
  });

  assert.equal(preflight.routeResolutionReady, true);
  assert.equal(preflight.environmentPreflightReady, false);
  assert.equal(preflight.destinationResolved, false);
  assert.equal(
    preflight.issues.some(
      (issue) => issue.code === 'FULL_DESIGN_DESTINATION_ENVIRONMENT_BLOCKED'
    ),
    true
  );
  assert.equal(
    preflight.destination.environmentPreflight.blockers.some(
      (issue) =>
        issue.code === 'ENVIRONMENT_EFFECT_OWNERSHIP_VALIDATOR_NOT_BOUND'
    ),
    true
  );
});

test('invalid manifest is rejected before destination resolution is attempted', () => {
  const manifest = structuredClone(makeBiomeManifest());
  manifest.semanticIdentity.sourceGridId = 10;

  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: makeProfile(),
    destinationPlatform: 'switch',
    manifest
  });

  assert.equal(preflight.manifestValid, false);
  assert.equal(preflight.destination, null);
  assert.equal(preflight.applyReason, 'FULL_DESIGN_MANIFEST_INVALID');
  assert.equal(preflight.persistentWriteAuthorized, false);
});
