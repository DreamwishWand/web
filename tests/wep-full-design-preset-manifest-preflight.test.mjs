import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCurrentV125FullDesignCapturePlan } from '../src/lib/wep/full-design-preset-planning.ts';
import { validateCurrentV125FullDesignManifest } from '../src/lib/wep/full-design-preset-manifest.ts';
import { preflightCurrentV125FullDesignManifest } from '../src/lib/wep/full-design-preset-preflight.ts';
import {
  createSwitchV125BuildingBindingFromContract
} from '../src/lib/wep/building-v110.ts';

const buildingContract = JSON.parse(
  fs.readFileSync(
    new URL(
      '../static/ddv/core/world/v1.25/building-read-model-preflight-v125.json',
      import.meta.url
    ),
    'utf8'
  )
);
const buildingBinding =
  createSwitchV125BuildingBindingFromContract(buildingContract);

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

function v17PlacementDocument(
  gridDataPath,
  rootGridId,
  { layer = 'furniture', includeObject = true } = {}
) {
  const object = {
    editorId: `g${rootGridId}:o1`,
    itemId: 40000178,
    layer,
    x: 0,
    y: 0,
    orientation: 0,
    footprint: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 }
    ],
    portableState: null,
    dependencyIds: [],
    editability: 'editable',
    metadata: {
      geometryStatus: 'RESOLVED'
    }
  };

  return {
    schema: 'dreamwish-wand-wep-editor-document',
    version: 1,
    target: {
      gameVersion: '1.25.0',
      platform: 'Nintendo Switch',
      profileSchemaVersion: 624,
      rootGridId,
      gridDataPath,
      tessellationFactor: 1,
      persistentWriteAuthorized: false
    },
    objects: includeObject ? [object] : [],
    networks: { roads: null, fences: null },
    capabilities: {
      worldPersistentWrite: 'unsupported'
    },
    metadata: {
      rootGridBounds: {
        x: 0,
        y: 0,
        w: 40,
        h: 30,
        status: 'AUTHORITATIVE_GRIDDATAPATH'
      },
      browserBinding: {
        gridDataDimensionsBound: true,
        gridDataDimensionsSha256:
          '75f33dc20d521d579070aa7919a96c23ce5dd329dbc6f58392f267c9dd0b1aaa'
      }
    }
  };
}

function makePlacementManifest(layer = 'furniture') {
  const profile = makeProfile();
  return buildCurrentV125FullDesignCapturePlan({
    profile,
    rootGridId: 10,
    sourcePlatform: 'switch',
    rootEditorDocuments: [
      v17PlacementDocument(
        'GridData/Test/Biome-A.json',
        10,
        { layer }
      ),
      v17PlacementDocument(
        'GridData/Test/Biome-B.json',
        11,
        { includeObject: false }
      )
    ]
  }).manifest;
}

function v17BuildingDocuments() {
  const first = v17PlacementDocument(
    'GridData/Test/Biome-A.json',
    10,
    { includeObject: false }
  );
  first.objects = [
    {
      editorId: 'g10:o501',
      itemId: 20500001,
      layer: 'building',
      x: 5,
      y: 7,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      portableState: null,
      dependencyIds: [],
      editability: 'readonly',
      metadata: { geometryStatus: 'RESOLVED' }
    },
    {
      editorId: 'g10:o502',
      itemId: 20500005,
      layer: 'building',
      x: 10,
      y: 12,
      orientation: 4,
      footprint: [{ x: 0, y: 0 }],
      portableState: null,
      dependencyIds: [],
      editability: 'readonly',
      metadata: { geometryStatus: 'RESOLVED' }
    }
  ];
  return [
    first,
    v17PlacementDocument(
      'GridData/Test/Biome-B.json',
      11,
      { includeObject: false }
    )
  ];
}

function makeBuildingManifest() {
  const profile = addRestorationObjects(makeProfile());
  return buildCurrentV125FullDesignCapturePlan({
    profile,
    rootGridId: 10,
    sourcePlatform: 'switch',
    rootEditorDocuments: v17BuildingDocuments(),
    buildingBinding
  }).manifest;
}

function v17OrdinaryBuildingDocuments() {
  const first = v17PlacementDocument(
    'GridData/Test/Biome-A.json',
    10,
    { includeObject: false }
  );
  first.objects = [
    {
      editorId: 'g10:ordinary-building',
      itemId: 20000036,
      layer: 'building',
      x: 5,
      y: 7,
      orientation: 0,
      footprint: [{ x: 0, y: 0 }],
      portableState: null,
      dependencyIds: [],
      editability: 'readonly',
      metadata: {
        geometryStatus: 'RESOLVED',
        buildingSemantics: {
          buildingItemType: 'House',
          signals: {
            isPlayerHouse: false,
            isCharacterHouse: false,
            isFastTravel: false,
            hasBuildingStateSynchronizer: false,
            hasOtherGlobalOrSharedBinding: false
          }
        }
      }
    }
  ];
  return [
    first,
    v17PlacementDocument(
      'GridData/Test/Biome-B.json',
      11,
      { includeObject: false }
    )
  ];
}

function makeOrdinaryBuildingManifest() {
  return buildCurrentV125FullDesignCapturePlan({
    profile: makeProfile(),
    rootGridId: 10,
    sourcePlatform: 'switch',
    rootEditorDocuments: v17OrdinaryBuildingDocuments(),
    buildingBinding
  }).manifest;
}

function placementBinding(nativeClass, reasonCodes = []) {
  return {
    contract: 'dreamwish-wand-wep-v125-placement-binding@1',
    persistentWriteAuthorized: false,
    classify() {
      return {
        schema: 'ddv.native-placement-legality@1',
        nativeClass,
        reasonCodes,
        nativeConflictFlagsResolved:
          nativeClass !== 'NATIVE_UNKNOWN_UNVERIFIED',
        clearabilityResolved:
          nativeClass !== 'NATIVE_UNKNOWN_UNVERIFIED',
        persistentWriteAuthorized: false
      };
    }
  };
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

test('Building category uses promoted v1.10 typed classes and preserves typed restoration state', () => {
  const noBuilding = buildCurrentV125FullDesignCapturePlan({
    profile: makeProfile(),
    rootGridId: 10,
    sourcePlatform: 'switch',
    rootEditorDocuments: [
      v17PlacementDocument(
        'GridData/Test/Biome-A.json',
        10,
        { includeObject: false }
      ),
      v17PlacementDocument(
        'GridData/Test/Biome-B.json',
        11,
        { includeObject: false }
      )
    ],
    buildingBinding
  });
  assert.equal(
    noBuilding.categories.buildings.ordinaryPlacement
      .destinationPlacementStatus,
    'NOT_APPLICABLE'
  );
  assert.deepEqual(
    noBuilding.categories.buildings.classificationSummary,
    { ordinary: 0, special: 0, offGrid: 0, unknown: 0 }
  );

  const profile = addRestorationObjects(makeProfile());
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile,
    rootGridId: 10,
    sourcePlatform: 'switch',
    rootEditorDocuments: v17BuildingDocuments(),
    buildingBinding
  });
  const buildings = plan.categories.buildings;

  assert.equal(buildings.ordinaryPlacement.sourceRecognition, 'COMPLETE');
  assert.equal(buildings.ordinaryPlacement.recognizedCount, 2);
  assert.equal(
    buildings.ordinaryPlacement.destinationPlacementStatus,
    'BLOCKED_TYPED_CLASSES'
  );
  assert.deepEqual(
    buildings.classificationSummary,
    { ordinary: 0, special: 1, offGrid: 0, unknown: 1 }
  );
  assert.equal(
    buildings.typedPlacements[0].classification.classification,
    'UNKNOWN_BUILDING_SEMANTICS'
  );
  assert.equal(
    buildings.typedPlacements[1].classification.classification,
    'SPECIAL_GRID_BUILDING'
  );
  assert.equal(
    buildings.typedPlacements[1].classification.subtype,
    'PlayerHouse'
  );

  assert.equal(buildings.buildingSkins.entries.length, 1);
  assert.deepEqual(
    buildings.buildingSkins.entries[0].portableState,
    {
      codec: 'ddv.building-skin@1',
      targetBuildingItemId: 20500001,
      skinItemId: 20510001
    }
  );
  assert.equal(
    buildings.buildingSkins.semanticStatus,
    'V1_10_TYPED_PREFLIGHT'
  );

  assert.equal(buildings.playerHouses.entries.length, 1);
  assert.deepEqual(
    buildings.playerHouses.entries[0].portableState,
    {
      codec: 'ddv.player-house-binding@1',
      houseItemId: 20500005
    }
  );
  assert.equal(
    buildings.playerHouses.semanticStatus,
    'V1_10_SPECIAL_DIAGNOSTIC'
  );

  const serialized = JSON.stringify(plan.manifest);
  assert.equal(serialized.includes('PlayerHouseIndex'), false);
  assert.equal(serialized.includes('UpgradeState'), false);
  assert.equal(serialized.includes('ShopData'), false);
  assert.equal(plan.publicationReady, false);
  assert.equal(plan.applyReady, false);
});

test('required Building category cannot be silently excluded to make publication ready', () => {
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: addRestorationObjects(makeProfile()),
    rootGridId: 10,
    sourcePlatform: 'switch',
    requestedCategories: { buildings: false },
    rootEditorDocuments: v17BuildingDocuments(),
    buildingBinding
  });
  assert.equal(plan.categories.buildings.disposition, 'excluded');
  assert.equal(
    plan.categories.buildings.blockers.includes(
      'FULL_DESIGN_REQUIRED_CATEGORY_EXCLUDED'
    ),
    true
  );
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

test('Building skin and PlayerHouse can preflight while ordinary Building placement remains separately blocked', () => {
  const manifest = makeBuildingManifest();
  const sourceValidation =
    validateCurrentV125FullDesignManifest(manifest);
  assert.equal(
    sourceValidation.ok,
    true,
    JSON.stringify(sourceValidation.issues)
  );
  const destination = makeProfile({
    firstGridId: 99,
    secondGridId: 100,
    islandGridId: 120
  });

  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: destination,
    destinationPlatform: 'switch',
    manifest,
    buildingBinding,
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

  assert.equal(preflight.ordinaryBuildingPlacementReady, false);
  assert.equal(preflight.buildingSemanticClosureReady, false);
  assert.equal(preflight.buildingSkinPreflightReady, true);
  assert.equal(preflight.playerHouseBindingPreflightReady, true);
  assert.equal(preflight.buildingRestorationPreflightReady, true);
  assert.equal(preflight.destinationPreflightReady, false);
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
  assert.equal(preflight.buildingV110ContractBound, true);
  assert.equal(preflight.buildingV110TypedPreflightReady, false);
  assert.equal(
    preflight.issues.some(
      (issue) =>
        issue.code === 'UNKNOWN_BUILDING_SEMANTICS' ||
        issue.code ===
          'SPECIAL_BUILDING_PLACEMENT_LIFECYCLE_REQUIRED'
    ),
    true
  );
  assert.equal(preflight.ddvWriteAuthorized, false);
  assert.equal(preflight.applyReady, false);
});

test('Building skin and PlayerHouse restoration fail closed when destination validators are not bound', () => {
  const manifest = makeBuildingManifest();
  const sourceValidation =
    validateCurrentV125FullDesignManifest(manifest);
  assert.equal(
    sourceValidation.ok,
    true,
    JSON.stringify(sourceValidation.issues)
  );
  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: makeProfile({
      firstGridId: 99,
      secondGridId: 100,
      islandGridId: 120
    }),
    destinationPlatform: 'switch',
    manifest,
    buildingBinding
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
  assert.equal(preflight.ordinaryBuildingPlacementReady, true);
  assert.equal(preflight.buildingSemanticClosureReady, true);
  assert.equal(preflight.destinationResolved, false);
  assert.equal(preflight.destinationPreflightReady, false);
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


test('v1.9 VALID_CLEAR passes only the native placement gate and never enables Apply', () => {
  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: makeProfile(),
    destinationPlatform: 'switch',
    manifest: makePlacementManifest(),
    placementBinding: placementBinding('NATIVE_VALID_CLEAR')
  });

  assert.equal(preflight.nativePlacementContractBound, true);
  assert.equal(preflight.rootObjectPlacementPreflightReady, true);
  const entry = preflight.destination.rootObjectRouteBindings[0];
  assert.equal(entry.nativePlacementClass, 'NATIVE_VALID_CLEAR');
  assert.equal(entry.placementValidated, true);
  assert.equal(entry.placementPolicyReady, true);
  assert.equal(entry.placementBlocker, null);
  assert.equal(entry.persistentWriteAuthorized, false);
  assert.equal(preflight.applyReady, false);
  assert.equal(preflight.persistentWriteAuthorized, false);
});

test('v1.9 replacement/removal-valid result stays a separate blocked policy gate', () => {
  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: makeProfile(),
    destinationPlatform: 'switch',
    manifest: makePlacementManifest(),
    placementBinding: placementBinding(
      'NATIVE_VALID_REPLACES_OR_REMOVES_EXISTING',
      ['GRID_OBJECT_COLLISION_CLEARABLE']
    )
  });

  const entry = preflight.destination.rootObjectRouteBindings[0];
  assert.equal(
    entry.nativePlacementClass,
    'NATIVE_VALID_REPLACES_OR_REMOVES_EXISTING'
  );
  assert.equal(entry.placementValidated, true);
  assert.equal(entry.placementPolicyReady, false);
  assert.equal(
    entry.placementBlocker,
    'NATIVE_REPLACEMENT_OR_REMOVAL_POLICY_REQUIRED'
  );
  assert.equal(preflight.rootObjectPlacementPreflightReady, false);
  assert.equal(
    preflight.issues.some(
      (issue) =>
        issue.code ===
        'FULL_DESIGN_DESTINATION_NATIVE_REPLACEMENT_POLICY_REQUIRED'
    ),
    true
  );
  assert.equal(preflight.applyReady, false);
});

test('v1.9 INVALID and UNKNOWN_UNVERIFIED remain distinct fail-closed outcomes', () => {
  for (const [nativeClass, expectedIssue] of [
    [
      'NATIVE_INVALID',
      'FULL_DESIGN_DESTINATION_NATIVE_PLACEMENT_INVALID'
    ],
    [
      'NATIVE_UNKNOWN_UNVERIFIED',
      'FULL_DESIGN_DESTINATION_NATIVE_PLACEMENT_UNVERIFIED'
    ]
  ]) {
    const preflight = preflightCurrentV125FullDesignManifest({
      destinationProfile: makeProfile(),
      destinationPlatform: 'switch',
      manifest: makePlacementManifest(),
      placementBinding: placementBinding(nativeClass)
    });

    const entry = preflight.destination.rootObjectRouteBindings[0];
    assert.equal(entry.nativePlacementClass, nativeClass);
    assert.equal(entry.placementValidated, false);
    assert.equal(preflight.rootObjectPlacementPreflightReady, false);
    assert.equal(
      preflight.issues.some((issue) => issue.code === expectedIssue),
      true
    );
    assert.equal(preflight.applyReady, false);
    assert.equal(preflight.persistentWriteAuthorized, false);
  }
});

test('unsupported root-object category fails closed before v1.9 classifier invocation', () => {
  let classifyCalls = 0;
  const binding = {
    contract: 'dreamwish-wand-wep-v125-placement-binding@1',
    persistentWriteAuthorized: false,
    classify() {
      classifyCalls += 1;
      return {
        schema: 'ddv.native-placement-legality@1',
        nativeClass: 'NATIVE_VALID_CLEAR',
        reasonCodes: [],
        nativeConflictFlagsResolved: true,
        clearabilityResolved: true,
        persistentWriteAuthorized: false
      };
    }
  };

  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: makeProfile(),
    destinationPlatform: 'switch',
    manifest: makePlacementManifest('landscaping'),
    placementBinding: binding
  });

  assert.equal(classifyCalls, 0);
  assert.equal(preflight.rootObjectPlacementPreflightReady, false);
  const entry = preflight.destination.rootObjectRouteBindings[0];
  assert.equal(
    entry.placementBlocker,
    'NATIVE_PLACEMENT_CATEGORY_UNSUPPORTED'
  );
  assert.equal(
    preflight.issues.some(
      (issue) =>
        issue.code ===
        'FULL_DESIGN_DESTINATION_NATIVE_PLACEMENT_CATEGORY_UNSUPPORTED'
    ),
    true
  );
  assert.equal(preflight.applyReady, false);
});

test('non-Building full-design can close destination preflight while persistent Apply remains off', () => {
  const source = makeProfile();
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: source,
    rootGridId: 10,
    sourcePlatform: 'switch',
    rootEditorDocuments: [
      v17PlacementDocument(
        'GridData/Test/Biome-A.json',
        10,
        { includeObject: false }
      ),
      v17PlacementDocument(
        'GridData/Test/Biome-B.json',
        11,
        { includeObject: false }
      )
    ]
  });

  assert.equal(plan.sourceCategoryClosureReady, true);
  assert.equal(plan.publicationCandidateReady, true);
  assert.equal(plan.publicationReady, false);
  assert.equal(
    plan.publicationReason,
    'FULL_DESIGN_COMMUNITY_PUBLICATION_ADAPTER_NOT_BOUND'
  );
  assert.equal(
    Object.values(plan.categoryReadinessMatrix).every(
      (entry) => entry.sourceCaptureReady === true
    ),
    true
  );

  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: makeProfile({
      firstGridId: 99,
      secondGridId: 100,
      islandGridId: 120
    }),
    destinationPlatform: 'switch',
    manifest: plan.manifest
  });

  assert.equal(preflight.manifestValid, true);
  assert.equal(preflight.routeResolutionReady, true);
  assert.equal(preflight.rootObjectPlacementPreflightReady, true);
  assert.equal(preflight.roadFenceModelPreflightReady, true);
  assert.equal(preflight.roadPreflightReady, true);
  assert.equal(preflight.fencePreflightReady, true);
  assert.equal(
    preflight.destination.roadFencePreflight.bindings.length,
    4
  );
  assert.equal(
    preflight.destination.roadFencePreflight.bindings.every(
      (entry) =>
        entry.boundsValidated === true &&
        entry.tessellationValidated === true &&
        entry.persistentWriteAuthorized === false
    ),
    true
  );
  assert.equal(
    preflight.destination.roadFencePreflight.writerStatus,
    'NOT_AUTHORIZED'
  );
  assert.equal(preflight.buildingSemanticClosureReady, true);
  assert.equal(preflight.environmentPreflightReady, true);
  assert.equal(preflight.categoryClosureReady, true);
  assert.equal(preflight.destinationPreflightReady, true);
  assert.equal(preflight.ok, true);
  assert.equal(preflight.ddvWriteAuthorized, false);
  assert.equal(preflight.persistentWriteAuthorized, false);
  assert.equal(preflight.applyReady, false);
  assert.equal(
    preflight.applyReason,
    'CORE_ATOMIC_PERSISTENT_COMMIT_NOT_AUTHORIZED'
  );
});


test('destination Road/Fence model preflight fails closed on destination tessellation mismatch', () => {
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: makeProfile(),
    rootGridId: 10,
    sourcePlatform: 'switch',
    rootEditorDocuments: [
      v17PlacementDocument(
        'GridData/Test/Biome-A.json',
        10,
        { includeObject: false }
      ),
      v17PlacementDocument(
        'GridData/Test/Biome-B.json',
        11,
        { includeObject: false }
      )
    ]
  });
  const destination = makeProfile({
    firstGridId: 99,
    secondGridId: 100,
    islandGridId: 120
  });
  destination.World.GridCollection.Grids['99'].TessellationFactor = 2;

  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: destination,
    destinationPlatform: 'switch',
    manifest: plan.manifest
  });

  assert.equal(preflight.routeResolutionReady, true);
  assert.equal(preflight.roadFenceModelPreflightReady, false);
  assert.equal(preflight.roadPreflightReady, false);
  assert.equal(preflight.fencePreflightReady, false);
  assert.equal(preflight.destinationPreflightReady, false);
  assert.equal(
    preflight.issues.some(
      (issue) =>
        issue.code ===
        'FULL_DESIGN_DESTINATION_ROADFENCE_TESSELLATION_MISMATCH'
    ),
    true
  );
  assert.equal(preflight.ddvWriteAuthorized, false);
  assert.equal(preflight.persistentWriteAuthorized, false);
  assert.equal(preflight.applyReady, false);
});


test('ordinary Building source becomes portable only with all five authoritative false signals', () => {
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: makeProfile(),
    rootGridId: 10,
    sourcePlatform: 'switch',
    rootEditorDocuments: v17OrdinaryBuildingDocuments(),
    buildingBinding
  });
  const buildings = plan.categories.buildings;
  assert.deepEqual(
    buildings.classificationSummary,
    { ordinary: 1, special: 0, offGrid: 0, unknown: 0 }
  );
  assert.equal(
    buildings.ordinaryPlacement.destinationPlacementStatus,
    'PREFLIGHT_CONTRACT_AVAILABLE'
  );
  assert.equal(
    buildings.ordinaryPlacement.portableCompositionCount,
    1
  );
  assert.equal(buildings.typedPlacements[0].portablePlacementEligible, true);
  assert.equal(
    buildings.blockers.includes('UNKNOWN_BUILDING_SEMANTICS'),
    false
  );
});

test('ordinary Building destination remains blocked until all v1.10 destination validators are bound', () => {
  const manifest = makeOrdinaryBuildingManifest();
  const sourceValidation =
    validateCurrentV125FullDesignManifest(manifest);
  assert.equal(
    sourceValidation.ok,
    true,
    JSON.stringify(sourceValidation.issues)
  );
  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: makeProfile({
      firstGridId: 99,
      secondGridId: 100,
      islandGridId: 120
    }),
    destinationPlatform: 'switch',
    manifest,
    buildingBinding,
    placementBinding: placementBinding('NATIVE_VALID_CLEAR')
  });

  assert.equal(preflight.buildingV110ContractBound, true);
  assert.equal(preflight.buildingV110TypedPreflightReady, false);
  assert.equal(preflight.ordinaryBuildingPlacementReady, false);
  assert.equal(
    preflight.issues.some(
      (issue) =>
        issue.code ===
        'WEP_BUILDING_STOCK_OWNERSHIP_VALIDATOR_NOT_BOUND'
    ),
    true
  );
  assert.equal(
    preflight.issues.some(
      (issue) =>
        issue.code ===
        'WEP_BUILDING_MULTIPLICITY_VALIDATOR_NOT_BOUND'
    ),
    true
  );
  assert.equal(
    preflight.issues.some(
      (issue) =>
        issue.code ===
        'WEP_BUILDING_TYPED_STATE_VALIDATOR_NOT_BOUND'
    ),
    true
  );
  assert.equal(preflight.persistentWriteAuthorized, false);
  assert.equal(preflight.applyReady, false);
});

test('ordinary Building typed destination preflight can pass without authorizing Apply', () => {
  const manifest = makeOrdinaryBuildingManifest();
  const sourceValidation =
    validateCurrentV125FullDesignManifest(manifest);
  assert.equal(
    sourceValidation.ok,
    true,
    JSON.stringify(sourceValidation.issues)
  );
  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: makeProfile({
      firstGridId: 99,
      secondGridId: 100,
      islandGridId: 120
    }),
    destinationPlatform: 'switch',
    manifest,
    buildingBinding,
    placementBinding: placementBinding('NATIVE_VALID_CLEAR'),
    buildingContext: {
      validateDestinationStockOwnership: () => ({ status: 'VALID' }),
      validateCurrentSceneMultiplicity: () => ({ status: 'VALID' }),
      validateTypedInitialStateCompatibility: () => ({ status: 'VALID' })
    }
  });

  assert.equal(preflight.buildingV110TypedPreflightReady, true);
  assert.equal(preflight.ordinaryBuildingPlacementReady, true);
  assert.equal(preflight.buildingSemanticClosureReady, true);
  assert.equal(preflight.destination.buildingTypedPreflights[0].ready, true);
  assert.equal(preflight.ddvWriteAuthorized, false);
  assert.equal(preflight.persistentWriteAuthorized, false);
  assert.equal(preflight.applyReady, false);
});

test('missing ordinary Building signal stays UNKNOWN and blocks source closure', () => {
  const documents = v17OrdinaryBuildingDocuments();
  delete documents[0].objects[0].metadata.buildingSemantics.signals
    .hasOtherGlobalOrSharedBinding;
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: makeProfile(),
    rootGridId: 10,
    sourcePlatform: 'switch',
    rootEditorDocuments: documents,
    buildingBinding
  });
  assert.equal(
    plan.categories.buildings.classificationSummary.unknown,
    1
  );
  assert.equal(
    plan.categories.buildings.blockers.includes(
      'UNKNOWN_BUILDING_SEMANTICS'
    ),
    true
  );
  assert.equal(plan.publicationCandidateReady, false);
});
