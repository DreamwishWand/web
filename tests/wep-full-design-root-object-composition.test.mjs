import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureCurrentV125RootObjectComposition
} from '../src/lib/wep/full-design-root-object-composition.ts';
import { buildCurrentV125FullDesignCapturePlan } from '../src/lib/wep/full-design-preset-planning.ts';
import { validateCurrentV125FullDesignManifest } from '../src/lib/wep/full-design-preset-manifest.ts';
import { preflightCurrentV125FullDesignManifest } from '../src/lib/wep/full-design-preset-preflight.ts';

function object({
  editorId,
  itemId,
  layer = 'furniture',
  x = 0,
  y = 0,
  orientation = 0,
  editability = 'editable',
  geometryStatus = 'RESOLVED',
  portableState = null,
  reasons = []
}) {
  return {
    editorId,
    itemId,
    layer,
    x,
    y,
    orientation,
    footprint: [{ x: 0, y: 0 }],
    portableState,
    dependencyIds: [],
    editability,
    source: {
      gridId: 10,
      gridObjectId: 999,
      objectMapKey: '999',
      relation: 'ROOT'
    },
    metadata: {
      geometryStatus,
      reasons,
      rawState: {},
      sourceGridDataPath: 'private-source-path'
    }
  };
}

function document(gridDataPath, objects, {
  rootGridId = gridDataPath.endsWith('/A.json') ? 10 : 11,
  bounds = null
} = {}) {
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
      exactBuildKnown: false,
      persistentWriteAuthorized: false
    },
    objects,
    networks: { roads: null, fences: null },
    capabilities: { worldPersistentWrite: 'unsupported' },
    metadata: bounds
      ? {
          rootGridBounds: {
            ...bounds,
            status: 'AUTHORITATIVE_GRIDDATAPATH'
          },
          browserBinding: {
            gridDataDimensionsBound: true,
            gridDataDimensionsSha256:
              '75f33dc20d521d579070aa7919a96c23ce5dd329dbc6f58392f267c9dd0b1aaa'
          }
        }
      : {}
  };
}

function profile() {
  return {
    GameInfo: { Version: 624 },
    Player: {},
    World: {
      PlayerHouses: [],
      GridCollection: {
        Grids: {
          '10': {
            ID: 10,
            GridDataPath: 'GridData/Test/A.json',
            TessellationFactor: 1,
            Objects: {
              '100': {
                ID: 100,
                ItemID: 40000047,
                X: 2,
                Y: 3,
                Orientation: 'GridOrientation_Up',
                State: {}
              },
              '101': {
                ID: 101,
                ItemID: 40700001,
                X: 4,
                Y: 5,
                Orientation: 'GridOrientation_Up',
                State: {}
              }
            }
          },
          '11': {
            ID: 11,
            GridDataPath: 'GridData/Test/B.json',
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
              GridIDs: [10, 11],
              Unlocked: true,
              EnvironmentEffectItemID: 0,
              EnvironmentEffectOrientation: 'GridOrientation_Up'
            }
          }
        }
      ],
      FloatingIslands: {}
    }
  };
}

test('portable composition strips Editor/save-local identity and keeps approved root placement data', () => {
  const composition = captureCurrentV125RootObjectComposition({
    documents: [
      document('GridData/Test/A.json', [
        object({
          editorId: 'g10:o100',
          itemId: 40000047,
          x: 2,
          y: 3
        })
      ]),
      document('GridData/Test/B.json', [])
    ],
    expectedGridDataPaths: [
      'GridData/Test/A.json',
      'GridData/Test/B.json'
    ]
  });

  assert.equal(composition.status, 'CAPTURED_COMPLETE_FOR_BOUND_DOCUMENTS');
  assert.equal(composition.entries.length, 1);
  assert.deepEqual(composition.entries[0], {
    artifactObjectId: 'o0',
    directRootRoute: {
      codec: 'ddv.direct-grid-route@1',
      gridDataPath: 'GridData/Test/A.json'
    },
    itemId: 40000047,
    layer: 'furniture',
    localX: 2,
    localY: 3,
    orientation: 0,
    footprint: [{ x: 0, y: 0 }],
    portableState: null
  });
  const serialized = JSON.stringify(composition);
  assert.equal(serialized.includes('g10:o100'), false);
  assert.equal(serialized.includes('gridObjectId'), false);
  assert.equal(serialized.includes('"gridId"'), false);
  assert.equal(serialized.includes('rawState'), false);
  assert.equal(composition.persistentWriteAuthorized, false);
});

test('Road/Fence delegates to 01C while Building and unresolved geometry stay fail-closed', () => {
  const composition = captureCurrentV125RootObjectComposition({
    documents: [
      document('GridData/Test/A.json', [
        object({
          editorId: 'building',
          itemId: 20500001,
          layer: 'building',
          editability: 'readonly'
        }),
        object({
          editorId: 'road',
          itemId: 40700001,
          layer: 'road',
          editability: 'readonly'
        }),
        object({
          editorId: 'unknown-geometry',
          itemId: 40000048,
          geometryStatus: 'UNRESOLVED',
          editability: 'readonly'
        })
      ])
    ],
    expectedGridDataPaths: ['GridData/Test/A.json']
  });

  assert.equal(composition.status, 'CAPTURED_PARTIAL');
  assert.equal(composition.entries.length, 0);
  assert.equal(composition.unresolved.length, 2);
  assert.equal(composition.delegatedNetworkObjectCount, 1);
  assert.equal(composition.routeSummaries[0].delegatedNetworkCount, 1);
  assert.equal(
    composition.unresolved[0].reasons.includes(
      'BUILDING_PLACEMENT_PORTABILITY_INCOMPLETE'
    ),
    true
  );
  assert.equal(
    composition.unresolved[1].reasons.includes(
      'ROOT_OBJECT_GEOMETRY_UNRESOLVED'
    ),
    true
  );
});

test('missing direct-root EditorDocument is explicit partial coverage', () => {
  const composition = captureCurrentV125RootObjectComposition({
    documents: [
      document('GridData/Test/A.json', [])
    ],
    expectedGridDataPaths: [
      'GridData/Test/A.json',
      'GridData/Test/B.json'
    ]
  });

  assert.equal(composition.status, 'CAPTURED_PARTIAL');
  assert.deepEqual(composition.missingRoutes, ['GridData/Test/B.json']);
  assert.deepEqual(
    composition.routeSummaries.map((x) => ({
      path: x.directRootRoute.gridDataPath,
      bound: x.documentBound
    })),
    [
      { path: 'GridData/Test/A.json', bound: true },
      { path: 'GridData/Test/B.json', bound: false }
    ]
  );
});

test('full-design manifest accepts validated partial portable composition and remains non-publishable', () => {
  const source = profile();
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: source,
    rootGridId: 10,
    sourcePlatform: 'switch',
    rootEditorDocuments: [
      document('GridData/Test/A.json', [
        object({
          editorId: 'g10:o100',
          itemId: 40000047,
          x: 2,
          y: 3
        }),
        object({
          editorId: 'g10:o101',
          itemId: 40700001,
          layer: 'road',
          x: 4,
          y: 5,
          editability: 'readonly'
        })
      ]),
      document('GridData/Test/B.json', [])
    ]
  });

  assert.equal(plan.manifestValidation.ok, true);
  assert.equal(plan.categories.rootObjects.portableComposition.entries.length, 1);
  assert.equal(plan.categories.rootObjects.portableComposition.unresolved.length, 0);
  assert.equal(
    plan.categories.rootObjects.portableComposition.delegatedNetworkObjectCount,
    1
  );
  assert.equal(
    plan.categories.rootObjects.blockers.includes(
      'FULL_DESIGN_ROOT_OBJECT_COMPOSITION_UNRESOLVED'
    ),
    false
  );
  assert.equal(
    plan.categories.rootObjects.coverageStatus,
    'complete'
  );
  assert.equal(
    plan.categories.rootObjects.disposition,
    'captured'
  );
  assert.equal(
    plan.categories.rootObjects.blockers.length,
    0
  );
  assert.equal(plan.publicationCandidateReady, false);
  assert.equal(
    plan.categoryReadinessMatrix.directGrids.sourceCaptureReady,
    false
  );
  assert.equal(
    plan.categoryReadinessMatrix.rootObjects.sourceCaptureReady,
    true
  );
  assert.equal(plan.publicationReady, false);
  assert.equal(plan.applyReady, false);
});

test('destination preflight binds routes but fails closed when authoritative bounds are absent', () => {
  const source = profile();
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: source,
    rootGridId: 10,
    sourcePlatform: 'switch',
    rootEditorDocuments: [
      document('GridData/Test/A.json', [
        object({
          editorId: 'g10:o100',
          itemId: 40000047,
          x: 2,
          y: 3
        })
      ]),
      document('GridData/Test/B.json', [])
    ]
  });

  const destination = structuredClone(source);
  destination.World.GridCollection.Grids = {
    '90': {
      ...destination.World.GridCollection.Grids['10'],
      ID: 90
    },
    '91': {
      ...destination.World.GridCollection.Grids['11'],
      ID: 91
    }
  };
  destination.World.Villages[0].Areas['7'].GridIDs = [90, 91];

  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: destination,
    destinationPlatform: 'switch',
    manifest: plan.manifest
  });

  assert.equal(preflight.rootObjectRouteBindingReady, true);
  assert.equal(preflight.rootObjectPlacementPreflightReady, false);
  assert.equal(preflight.destination.rootObjectRouteBindings.length, 1);
  assert.deepEqual(preflight.destination.rootObjectRouteBindings[0], {
    artifactObjectId: 'o0',
    gridDataPath: 'GridData/Test/A.json',
    destinationGridId: 90,
    itemId: 40000047,
    localX: 2,
    localY: 3,
    orientation: 0,
    footprint: [{ x: 0, y: 0 }],
    portableState: null,
    routeResolved: true,
    boundsValidated: false,
    floorMapBound: false,
    nativePlacementClass: null,
    nativePlacementReasonCodes: [],
    nativeConflictFlagsResolved: false,
    clearabilityResolved: false,
    placementValidated: false,
    placementPolicyReady: false,
    placementBlocker: 'AUTHORITATIVE_GRIDDATAPATH_BOUNDS_NOT_BOUND',
    ddvWriteAuthorized: false,
    persistentWriteAuthorized: false
  });
  assert.equal(
    preflight.issues.some(
      (issue) =>
        issue.code ===
        'FULL_DESIGN_DESTINATION_ROOT_OBJECT_BOUNDS_UNAVAILABLE'
    ),
    true
  );
  assert.equal(preflight.destinationPreflightReady, false);
  assert.equal(preflight.categoryClosureReady, false);
  assert.equal(preflight.ok, false);
  assert.equal(preflight.applyReady, false);
});

test('v1.7 bounds validate object extent but native terrain legality remains fail-closed', () => {
  const source = profile();
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: source,
    rootGridId: 10,
    sourcePlatform: 'switch',
    rootEditorDocuments: [
      document(
        'GridData/Test/A.json',
        [
          object({
            editorId: 'g10:o100',
            itemId: 40000047,
            x: 2,
            y: 3
          })
        ],
        { rootGridId: 10, bounds: { x: 0, y: 0, w: 20, h: 20 } }
      ),
      document(
        'GridData/Test/B.json',
        [],
        { rootGridId: 11, bounds: { x: 0, y: 0, w: 10, h: 10 } }
      )
    ]
  });

  const destination = structuredClone(source);
  destination.World.GridCollection.Grids = {
    '90': {
      ...destination.World.GridCollection.Grids['10'],
      ID: 90
    },
    '91': {
      ...destination.World.GridCollection.Grids['11'],
      ID: 91
    }
  };
  destination.World.Villages[0].Areas['7'].GridIDs = [90, 91];

  const preflight = preflightCurrentV125FullDesignManifest({
    destinationProfile: destination,
    destinationPlatform: 'switch',
    manifest: plan.manifest
  });

  assert.equal(preflight.rootObjectRouteBindingReady, true);
  assert.equal(preflight.rootObjectPlacementPreflightReady, false);
  assert.equal(
    preflight.destination.rootObjectRouteBindings[0].boundsValidated,
    true
  );
  assert.equal(
    preflight.destination.rootObjectRouteBindings[0].placementBlocker,
    'NATIVE_PLACEMENT_CONTRACT_NOT_BOUND'
  );
  assert.equal(
    preflight.issues.some(
      (issue) =>
        issue.code ===
        'FULL_DESIGN_DESTINATION_NATIVE_PLACEMENT_CONTRACT_NOT_BOUND'
    ),
    true
  );
  assert.equal(preflight.destinationPreflightReady, false);
  assert.equal(preflight.applyReady, false);
});


test('strict manifest validation rejects tampered composition routes and write promotion', () => {
  const source = profile();
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: source,
    rootGridId: 10,
    sourcePlatform: 'switch',
    rootEditorDocuments: [
      document('GridData/Test/A.json', [
        object({
          editorId: 'g10:o100',
          itemId: 40000047
        })
      ]),
      document('GridData/Test/B.json', [])
    ]
  });
  const manifest = structuredClone(plan.manifest);
  manifest.categories.rootObjects.portableComposition.entries[0].directRootRoute.gridDataPath =
    'GridData/Test/Outside.json';
  manifest.categories.rootObjects.portableComposition.persistentWriteAuthorized = true;

  const validation = validateCurrentV125FullDesignManifest(manifest);
  assert.equal(validation.ok, false);
  assert.equal(
    validation.issues.some(
      (issue) =>
        issue.code ===
        'FULL_DESIGN_ROOT_COMPOSITION_ROUTE_OUTSIDE_LOCATION'
    ),
    true
  );
  assert.equal(
    validation.issues.some(
      (issue) =>
        issue.code ===
        'FULL_DESIGN_ROOT_COMPOSITION_WRITE_AUTHORIZATION_FORBIDDEN'
    ),
    true
  );
});


test('explicit Core progression blockers remain visible in non-portable Preset diagnostics', () => {
  const composition = captureCurrentV125RootObjectComposition({
    documents: [
      document('GridData/Test/A.json', [
        object({
          editorId: 'progression-risk',
          itemId: 40000999,
          editability: 'readonly',
          reasons: [
            'PROTECTED_PROGRESSION_OBJECT_CONFLICT',
            'PROGRESSION_STATE_INCONSISTENT'
          ]
        })
      ])
    ],
    expectedGridDataPaths: ['GridData/Test/A.json']
  });

  assert.equal(composition.entries.length, 0);
  assert.equal(composition.unresolved.length, 1);
  assert.equal(
    composition.unresolved[0].reasons.includes(
      'PROTECTED_PROGRESSION_OBJECT_CONFLICT'
    ),
    true
  );
  assert.equal(
    composition.unresolved[0].reasons.includes(
      'PROGRESSION_STATE_INCONSISTENT'
    ),
    true
  );
  assert.equal(composition.persistentWriteAuthorized, false);
});
