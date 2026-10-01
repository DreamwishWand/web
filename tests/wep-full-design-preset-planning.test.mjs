import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FULL_DESIGN_CAPTURE_MANIFEST_SCHEMA,
  buildCurrentV125FullDesignCapturePlan
} from '../src/lib/wep/full-design-preset-planning.ts';
import {
  validateCurrentV125FullDesignManifest
} from '../src/lib/wep/full-design-preset-manifest.ts';

function makeProfile() {
  return {
    GameInfo: { Version: 624 },
    Player: {},
    World: {
      PlayerHouses: [],
      GridCollection: {
        Grids: {
          '10': {
            ID: 10,
            GridDataPath: 'GridData/Test/Biome-A.json',
            TessellationFactor: 1,
            Objects: {}
          },
          '11': {
            ID: 11,
            GridDataPath: 'GridData/Test/Biome-B.json',
            TessellationFactor: 1,
            Objects: {}
          },
          '20': {
            ID: 20,
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
              GridIDs: [10, 11],
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

test('Biome planning captures portable multi-root routes and strips save-local identity', () => {
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: makeProfile(),
    rootGridId: 10,
    sourcePlatform: 'switch'
  });

  assert.equal(plan.manifestReady, true);
  assert.equal(plan.publicationReady, false);
  assert.equal(plan.applyReady, false);
  assert.equal(plan.manifest.schema, FULL_DESIGN_CAPTURE_MANIFEST_SCHEMA);
  assert.equal(plan.manifest.presetType, 'biome');
  assert.deepEqual(plan.manifest.semanticIdentity, {
    codec: 'ddv.outdoor-location-ref@1',
    kind: 'BIOME',
    villageSceneItemId: 1540000000,
    villageAreaType: 7
  });
  assert.deepEqual(plan.manifest.directRootRoutes, [
    {
      codec: 'ddv.direct-grid-route@1',
      gridDataPath: 'GridData/Test/Biome-A.json'
    },
    {
      codec: 'ddv.direct-grid-route@1',
      gridDataPath: 'GridData/Test/Biome-B.json'
    }
  ]);

  const collectKeys = (value) => {
    if (Array.isArray(value)) return value.flatMap(collectKeys);
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, child]) => [
      key,
      ...collectKeys(child)
    ]);
  };
  const manifestKeys = collectKeys(plan.manifest);
  assert.equal(manifestKeys.includes('sourceGridId'), false);
  assert.equal(manifestKeys.includes('rootGridId'), false);
  assert.equal(manifestKeys.includes('GridObjectID'), false);
  assert.equal(manifestKeys.includes('PlayerHouseIndex'), false);
  assert.equal(plan.manifest.normalization.sourceGridIdsRemoved, true);
  assert.equal(plan.manifest.normalization.sourceGridObjectIdsRemoved, true);
});

test('Environment is captured with the approved portable codec but remains partial', () => {
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: makeProfile(),
    rootGridId: 10,
    sourcePlatform: 'switch'
  });

  assert.equal(plan.categories.environment.disposition, 'captured_partial');
  assert.equal(
    plan.categories.environment.evidenceStatus,
    'CONFIRMED_PORTABLE_CAPTURE_PREFLIGHT'
  );
  assert.deepEqual(plan.categories.environment.portableState, {
    codec: 'ddv.environment-effect@1',
    targetKind: 'AREA',
    effectItemId: 0,
    orientation: 0
  });
  assert.equal(
    plan.categories.environment.blockers.includes(
      'FULL_DESIGN_ENVIRONMENT_PREFLIGHT_PARTIAL'
    ),
    true
  );
});

test('Core-owned dimension and native Road/Fence reader gaps are explicit blockers', () => {
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: makeProfile(),
    rootGridId: 10
  });

  assert.equal(
    plan.categories.directGrids.blockers.includes(
      'COMPREHENSIVE_GRIDDATA_DIMENSIONS_NOT_BOUND'
    ),
    true
  );
  assert.equal(
    plan.categories.roads.blockers.includes(
      'NATIVE_ROADFENCE_LOGICAL_READER_NOT_BOUND'
    ),
    true
  );
  assert.equal(
    plan.categories.fences.blockers.includes(
      'NATIVE_ROADFENCE_LOGICAL_READER_NOT_BOUND'
    ),
    true
  );
  assert.equal(plan.manifest.persistentWriteAuthorized, false);
  assert.equal(
    plan.applyReason,
    'CORE_ATOMIC_PERSISTENT_COMMIT_NOT_AUTHORIZED'
  );
});

test('Switch full-design planning consumes the bound 01C reader on every direct root', () => {
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: makeProfile(),
    rootGridId: 10,
    sourcePlatform: 'switch'
  });

  for (const categoryKey of ['roads', 'fences']) {
    const category = plan.categories[categoryKey];
    assert.equal(category.disposition, 'captured_partial');
    assert.equal(
      category.evidenceStatus,
      'CONFIRMED_01C_NATIVE_LOGICAL_READER_BOUND'
    );
    assert.equal(
      category.contract,
      '01C-v1.25-native-reader-capture-region'
    );
    assert.equal(category.readerCoverage.length, 2);
    assert.equal(
      category.readerCoverage.every(
        (entry) =>
          entry.status === 'supported' &&
          entry.persistentWriteAuthorized === false
      ),
      true
    );
    assert.equal(
      category.blockers.includes(
        'NATIVE_ROADFENCE_LOGICAL_READER_NOT_BOUND'
      ),
      false
    );
    assert.equal(
      category.blockers.includes(
        'FULL_DESIGN_ROADFENCE_CAPTURE_REGION_BOUNDS_UNAVAILABLE'
      ),
      true
    );
  }

  const serialized = JSON.stringify(plan.manifest);
  assert.equal(serialized.includes('sourceGridId'), false);
  assert.equal(serialized.includes('gridObjectId'), false);
  assert.equal(plan.manifestValidation.ok, true);
  assert.equal(plan.publicationReady, false);
  assert.equal(plan.applyReady, false);
});

test('strict validation rejects tampered Road/Fence reader coverage without promoting write', () => {
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: makeProfile(),
    rootGridId: 10,
    sourcePlatform: 'switch'
  });
  const manifest = structuredClone(plan.manifest);
  manifest.categories.roads.readerCoverage[0].directRootRoute.gridDataPath =
    'GridData/Test/Outside.json';
  manifest.categories.fences.readerCoverage[0].persistentWriteAuthorized = true;

  const validation = validateCurrentV125FullDesignManifest(manifest);
  assert.equal(validation.ok, false);
  assert.equal(
    validation.issues.some(
      (issue) =>
        issue.code ===
        'FULL_DESIGN_ROADFENCE_READER_ROUTE_OUTSIDE_LOCATION'
    ),
    true
  );
  assert.equal(
    validation.issues.some(
      (issue) =>
        issue.code ===
        'FULL_DESIGN_ROADFENCE_READER_WRITE_AUTHORIZATION_FORBIDDEN'
    ),
    true
  );
});

test('Floating Island planning uses SceneItemId identity and island environment target', () => {
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: makeProfile(),
    rootGridId: 20,
    sourcePlatform: 'switch'
  });

  assert.equal(plan.presetType, 'floating_island');
  assert.deepEqual(plan.semanticIdentity, {
    codec: 'ddv.outdoor-location-ref@1',
    kind: 'FLOATING_ISLAND',
    sceneItemId: 1540000100
  });
  assert.deepEqual(plan.manifest.directRootRoutes, [
    {
      codec: 'ddv.direct-grid-route@1',
      gridDataPath: 'GridData/Test/FloatingIsland.json'
    }
  ]);
  assert.deepEqual(plan.categories.environment.portableState, {
    codec: 'ddv.environment-effect@1',
    targetKind: 'FLOATING_ISLAND',
    effectItemId: 0,
    orientation: 4
  });
});

test('Excluding a required full-design category remains publication-blocking', () => {
  const plan = buildCurrentV125FullDesignCapturePlan({
    profile: makeProfile(),
    rootGridId: 10,
    requestedCategories: { roads: false }
  });

  assert.equal(plan.categories.roads.disposition, 'excluded');
  assert.equal(
    plan.categories.roads.blockers.includes(
      'FULL_DESIGN_REQUIRED_CATEGORY_EXCLUDED'
    ),
    true
  );
  assert.equal(
    plan.issues.some(
      (issue) =>
        issue.category === 'roads' &&
        issue.code === 'FULL_DESIGN_REQUIRED_CATEGORY_EXCLUDED'
    ),
    true
  );
  assert.equal(plan.publicationReady, false);
  assert.equal(plan.applyReady, false);
});
