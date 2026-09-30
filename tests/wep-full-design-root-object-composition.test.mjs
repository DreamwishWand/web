import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureCurrentV125RootObjectComposition
} from '../src/lib/wep/full-design-root-object-composition.ts';
import { buildCurrentV125FullDesignCapturePlan } from '../src/lib/wep/full-design-preset-planning.ts';
import { validateCurrentV125FullDesignManifest } from '../src/lib/wep/full-design-preset-manifest.ts';

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

function document(gridDataPath, objects) {
  return {
    schema: 'dreamwish-wand-wep-editor-document',
    version: 1,
    target: {
      gameVersion: '1.25.0',
      platform: 'Nintendo Switch',
      profileSchemaVersion: 624,
      gridDataPath,
      exactBuildKnown: false,
      persistentWriteAuthorized: false
    },
    objects,
    networks: { roads: null, fences: null },
    capabilities: { worldPersistentWrite: 'unsupported' },
    metadata: {}
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

test('Building, Road/Fence, readonly and unresolved geometry stay unresolved rather than being invented', () => {
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
  assert.equal(composition.unresolved.length, 3);
  assert.equal(
    composition.unresolved[0].reasons.includes(
      'BUILDING_PLACEMENT_PORTABILITY_INCOMPLETE'
    ),
    true
  );
  assert.equal(
    composition.unresolved[1].reasons.includes(
      'NETWORK_LAYER_DELEGATED_01C'
    ),
    true
  );
  assert.equal(
    composition.unresolved[2].reasons.includes(
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
  assert.equal(plan.categories.rootObjects.portableComposition.unresolved.length, 1);
  assert.equal(
    plan.categories.rootObjects.blockers.includes(
      'FULL_DESIGN_ROOT_OBJECT_COMPOSITION_UNRESOLVED'
    ),
    true
  );
  assert.equal(plan.publicationReady, false);
  assert.equal(plan.applyReady, false);
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
