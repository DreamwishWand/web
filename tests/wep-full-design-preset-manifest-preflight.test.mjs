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
  assert.equal(preflight.environmentPreflightReady, true);
  assert.equal(preflight.destinationResolved, true);
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
      (x) => x.code === 'COMPREHENSIVE_GRIDDATA_DIMENSIONS_NOT_BOUND'
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
