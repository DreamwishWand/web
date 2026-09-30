import {
  validateCurrentV125FullDesignManifest,
  type FullDesignCategory,
  type FullDesignManifestIssue
} from './full-design-preset-manifest.ts';
import {
  preflightV125PortableRestoration,
  resolveV125DestinationDirectRoot,
  resolveV125OutdoorLocation
} from './world-portable-contracts.ts';

type AnyRecord = Record<string, any>;

export type FullDesignDestinationIssue = {
  severity: 'BLOCK';
  code: string;
  path: string;
  detail?: Record<string, unknown>;
};

function block(
  code: string,
  path: string,
  detail?: Record<string, unknown>
): FullDesignDestinationIssue {
  return {
    severity: 'BLOCK',
    code,
    path,
    ...(detail ? { detail } : {})
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function manifestIssuesAsDestinationIssues(
  issues: FullDesignManifestIssue[]
): FullDesignDestinationIssue[] {
  return issues.map((issue) => ({
    severity: 'BLOCK',
    code: issue.code,
    path: issue.path,
    ...(issue.detail ? { detail: clone(issue.detail) } : {})
  }));
}

function categoryBlockers(manifest: AnyRecord) {
  const output: Array<{
    category: FullDesignCategory;
    code: string;
  }> = [];

  for (const category of [
    'directGrids',
    'rootObjects',
    'roads',
    'fences',
    'buildings',
    'environment'
  ] as FullDesignCategory[]) {
    const blockers = manifest?.categories?.[category]?.blockers;
    if (!Array.isArray(blockers)) continue;
    for (const code of blockers) {
      output.push({ category, code: String(code) });
    }
  }
  return output;
}

export function preflightCurrentV125FullDesignManifest({
  destinationProfile,
  destinationPlatform,
  manifest,
  restorationContext = {}
}: {
  destinationProfile: AnyRecord;
  destinationPlatform: string;
  manifest: unknown;
  restorationContext?: AnyRecord;
}) {
  const validation = validateCurrentV125FullDesignManifest(manifest);
  if (!validation.ok || !validation.manifest) {
    return {
      ok: false,
      manifestValid: false,
      destinationResolved: false,
      destinationPreflightReady: false,
      categoryClosureReady: false,
      routeResolutionReady: false,
      buildingRestorationPreflightReady: false,
      environmentPreflightReady: false,
      issues: manifestIssuesAsDestinationIssues(validation.issues),
      categoryBlockers: [],
      destination: null,
      persistentWriteAuthorized: false,
      applyReady: false,
      applyReason: 'FULL_DESIGN_MANIFEST_INVALID'
    };
  }

  const normalized = validation.manifest as AnyRecord;
  const issues: FullDesignDestinationIssue[] = [];
  const blockers = categoryBlockers(normalized);

  if (destinationPlatform !== 'switch') {
    issues.push(
      block(
        'FULL_DESIGN_DESTINATION_PLATFORM_CONTRACT_UNAVAILABLE',
        '$.destinationPlatform',
        { destinationPlatform }
      )
    );
  }

  let locationResolution: AnyRecord | null = null;
  try {
    locationResolution = resolveV125OutdoorLocation(
      destinationProfile,
      normalized.semanticIdentity
    );
  } catch (error) {
    issues.push(
      block(
        'FULL_DESIGN_DESTINATION_PROFILE_CONTRACT_UNAVAILABLE',
        '$.destinationProfile',
        {
          message: error instanceof Error ? error.message : String(error)
        }
      )
    );
  }

  if (
    locationResolution &&
    locationResolution.status !== 'RESOLVED'
  ) {
    issues.push(
      block(
        'FULL_DESIGN_DESTINATION_LOCATION_UNRESOLVED',
        '$.semanticIdentity',
        {
          status: String(locationResolution.status),
          blockers: clone(locationResolution.blockers ?? [])
        }
      )
    );
  }

  const routeResolutions: AnyRecord[] = [];
  if (destinationPlatform === 'switch' && locationResolution?.status === 'RESOLVED') {
    normalized.directRootRoutes.forEach((route: AnyRecord, index: number) => {
      try {
        const resolved = resolveV125DestinationDirectRoot(
          destinationProfile,
          normalized.semanticIdentity,
          route
        );
        if (resolved.status !== 'RESOLVED') {
          issues.push(
            block(
              'FULL_DESIGN_DESTINATION_DIRECT_ROOT_UNRESOLVED',
              `$.directRootRoutes[${index}]`,
              {
                status: String(resolved.status),
                gridDataPath: route.gridDataPath,
                blockers: clone(resolved.blockers ?? [])
              }
            )
          );
          return;
        }
        routeResolutions.push({
          gridDataPath: route.gridDataPath,
          destinationGridId: Number(resolved.destinationGridId),
          persistentWriteAuthorized: false
        });
      } catch (error) {
        issues.push(
          block(
            'FULL_DESIGN_DESTINATION_DIRECT_ROOT_PREFLIGHT_ERROR',
            `$.directRootRoutes[${index}]`,
            {
              gridDataPath: route.gridDataPath,
              message: error instanceof Error ? error.message : String(error)
            }
          )
        );
      }
    });
  }

  const destinationIds = routeResolutions.map((x) => x.destinationGridId);
  if (new Set(destinationIds).size !== destinationIds.length) {
    issues.push(
      block(
        'FULL_DESIGN_DESTINATION_DIRECT_ROOT_COLLISION',
        '$.directRootRoutes'
      )
    );
  }

  const buildingRestorationPreflights: AnyRecord[] = [];
  const buildingCategory = normalized.categories.buildings;
  const buildingEntries =
    buildingCategory?.requested === true &&
    Array.isArray(buildingCategory?.restorationCapture?.entries)
      ? buildingCategory.restorationCapture.entries
      : [];
  const buildingUnresolved =
    buildingCategory?.requested === true &&
    Array.isArray(buildingCategory?.restorationCapture?.unresolved)
      ? buildingCategory.restorationCapture.unresolved
      : [];

  if (buildingCategory?.requested === true && buildingUnresolved.length > 0) {
    issues.push(
      block(
        'FULL_DESIGN_SOURCE_BUILDING_RESTORATION_UNRESOLVED',
        '$.categories.buildings.restorationCapture.unresolved',
        { count: buildingUnresolved.length }
      )
    );
  }

  for (let index = 0; index < buildingEntries.length; index += 1) {
    const entry = buildingEntries[index];
    try {
      const result = preflightV125PortableRestoration(
        destinationProfile,
        entry.portableState,
        restorationContext
      );
      buildingRestorationPreflights.push({
        artifactRestorationId: entry.artifactRestorationId,
        kind: entry.kind,
        directRootRoute: clone(entry.directRootRoute),
        itemId: entry.itemId,
        status: result.status,
        result: clone(result)
      });
      if (!['VALID', 'VALID_NOOP'].includes(String(result.status))) {
        issues.push(
          block(
            'FULL_DESIGN_DESTINATION_BUILDING_RESTORATION_BLOCKED',
            `$.categories.buildings.restorationCapture.entries[${index}].portableState`,
            {
              artifactRestorationId: entry.artifactRestorationId,
              kind: entry.kind,
              status: String(result.status),
              blockers: clone(result.blockers ?? []),
              issues: clone(result.issues ?? [])
            }
          )
        );
      }
    } catch (error) {
      issues.push(
        block(
          'FULL_DESIGN_DESTINATION_BUILDING_RESTORATION_PREFLIGHT_ERROR',
          `$.categories.buildings.restorationCapture.entries[${index}].portableState`,
          {
            artifactRestorationId: entry.artifactRestorationId,
            kind: entry.kind,
            message: error instanceof Error ? error.message : String(error)
          }
        )
      );
    }
  }

  const buildingRestorationPreflightReady =
    buildingCategory?.requested !== true ||
    (buildingUnresolved.length === 0 &&
      buildingRestorationPreflights.length === buildingEntries.length &&
      buildingRestorationPreflights.every((entry) =>
        ['VALID', 'VALID_NOOP'].includes(String(entry.status))
      ));

  let environmentPreflight: AnyRecord | null = null;
  const environmentCategory = normalized.categories.environment;
  if (environmentCategory?.requested === true) {
    try {
      environmentPreflight = preflightV125PortableRestoration(
        destinationProfile,
        environmentCategory.portableState,
        restorationContext
      );
      if (
        !['VALID', 'VALID_NOOP'].includes(String(environmentPreflight.status))
      ) {
        issues.push(
          block(
            'FULL_DESIGN_DESTINATION_ENVIRONMENT_BLOCKED',
            '$.categories.environment.portableState',
            {
              status: String(environmentPreflight.status),
              blockers: clone(environmentPreflight.blockers ?? []),
              issues: clone(environmentPreflight.issues ?? [])
            }
          )
        );
      }
    } catch (error) {
      issues.push(
        block(
          'FULL_DESIGN_DESTINATION_ENVIRONMENT_PREFLIGHT_ERROR',
          '$.categories.environment.portableState',
          {
            message: error instanceof Error ? error.message : String(error)
          }
        )
      );
    }
  }

  const routeResolutionReady =
    destinationPlatform === 'switch' &&
    locationResolution?.status === 'RESOLVED' &&
    routeResolutions.length === normalized.directRootRoutes.length &&
    new Set(destinationIds).size === destinationIds.length;

  const environmentPreflightReady =
    environmentCategory?.requested !== true ||
    ['VALID', 'VALID_NOOP'].includes(String(environmentPreflight?.status));

  const destinationResolved =
    routeResolutionReady &&
    buildingRestorationPreflightReady &&
    environmentPreflightReady &&
    issues.length === 0;
  const categoryClosureReady = blockers.length === 0;
  const overallOk = destinationResolved && categoryClosureReady;

  return {
    ok: overallOk,
    manifestValid: true,
    destinationResolved,
    destinationPreflightReady: destinationResolved,
    categoryClosureReady,
    routeResolutionReady,
    buildingRestorationPreflightReady,
    environmentPreflightReady,
    issues,
    categoryBlockers: blockers,
    destination: {
      platform: destinationPlatform,
      gameVersion: '1.25.0',
      profileSchemaVersion: 624,
      exactBuildKnown: false,
      semanticIdentity: clone(normalized.semanticIdentity),
      directRootResolutions: routeResolutions,
      buildingRestorationPreflights: clone(buildingRestorationPreflights),
      environmentPreflight: environmentPreflight
        ? clone(environmentPreflight)
        : null
    },
    persistentWriteAuthorized: false,
    applyReady: false,
    applyReason:
      blockers.length > 0
        ? 'FULL_DESIGN_CATEGORY_CLOSURE_INCOMPLETE'
        : 'CORE_ATOMIC_PERSISTENT_COMMIT_NOT_AUTHORIZED'
  };
}
