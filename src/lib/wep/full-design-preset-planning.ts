import {
  captureV125AreaEnvironment,
  captureV125FloatingIslandEnvironment,
  captureV125OutdoorLocation,
  resolveV125OutdoorLocation,
  V125_PORTABLE_CONTRACTS
} from './world-portable-contracts.ts';
import {
  currentV125FullDesignBaseline,
  type FullDesignPresetType
} from './full-design-preset-readiness.ts';
import {
  FULL_DESIGN_CAPTURE_MANIFEST_SCHEMA,
  FULL_DESIGN_CAPTURE_MANIFEST_VERSION,
  validateCurrentV125FullDesignManifest,
  type FullDesignCategory
} from './full-design-preset-manifest.ts';

export {
  FULL_DESIGN_CAPTURE_MANIFEST_SCHEMA,
  FULL_DESIGN_CAPTURE_MANIFEST_VERSION
} from './full-design-preset-manifest.ts';
export type { FullDesignCategory } from './full-design-preset-manifest.ts';

type AnyRecord = Record<string, any>;

export interface FullDesignCapturePlanInput {
  profile: AnyRecord;
  rootGridId: number;
  sourcePlatform?: string | null;
  requestedCategories?: Partial<Record<FullDesignCategory, boolean>>;
}

export interface FullDesignPlanningIssue {
  severity: 'BLOCK';
  code: string;
  category?: FullDesignCategory;
  detail?: Record<string, unknown>;
}

const CATEGORIES: FullDesignCategory[] = [
  'directGrids',
  'rootObjects',
  'roads',
  'fences',
  'buildings',
  'environment'
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function requested(
  category: FullDesignCategory,
  overrides: FullDesignCapturePlanInput['requestedCategories']
) {
  return overrides?.[category] !== false;
}

function block(
  code: string,
  category?: FullDesignCategory,
  detail?: Record<string, unknown>
): FullDesignPlanningIssue {
  return {
    severity: 'BLOCK',
    code,
    ...(category ? { category } : {}),
    ...(detail ? { detail } : {})
  };
}

function semanticType(locationRef: AnyRecord): FullDesignPresetType {
  if (locationRef?.kind === 'BIOME') return 'biome';
  if (locationRef?.kind === 'FLOATING_ISLAND') return 'floating_island';
  throw new Error('WEP_FULL_DESIGN_LOCATION_KIND_UNSUPPORTED');
}

function currentReadinessIdentity(
  type: FullDesignPresetType,
  locationRef: AnyRecord
) {
  return type === 'biome'
    ? {
        villageSceneItemId: locationRef.villageSceneItemId,
        villageAreaType: locationRef.villageAreaType
      }
    : { sceneItemId: locationRef.sceneItemId };
}

function portableRoutes(resolved: AnyRecord) {
  if (resolved?.status !== 'RESOLVED' || !Array.isArray(resolved.directRoots)) {
    throw new Error('WEP_FULL_DESIGN_DIRECT_ROOTS_UNRESOLVED');
  }

  return resolved.directRoots.map((root: AnyRecord) => {
    if (
      typeof root?.gridDataPath !== 'string' ||
      root.gridDataPath.length === 0
    ) {
      throw new Error('WEP_FULL_DESIGN_DIRECT_ROOT_PATH_INVALID');
    }
    return {
      codec: V125_PORTABLE_CONTRACTS.location.directGridRouteCodec,
      gridDataPath: root.gridDataPath
    };
  });
}

function captureEnvironment(
  profile: AnyRecord,
  type: FullDesignPresetType,
  locationRef: AnyRecord,
  resolved: AnyRecord
) {
  if (type === 'biome') {
    const villageIndex = Number(resolved?.sourceDiagnostics?.villageIndex);
    if (!Number.isSafeInteger(villageIndex)) {
      throw new Error('WEP_FULL_DESIGN_BIOME_VILLAGE_INDEX_UNRESOLVED');
    }
    return captureV125AreaEnvironment(
      profile,
      villageIndex,
      locationRef.villageAreaType
    );
  }

  return captureV125FloatingIslandEnvironment(
    profile,
    locationRef.sceneItemId
  );
}

export function buildCurrentV125FullDesignCapturePlan({
  profile,
  rootGridId,
  sourcePlatform = 'unknown',
  requestedCategories = {}
}: FullDesignCapturePlanInput) {
  const sourceLocation = captureV125OutdoorLocation(profile, rootGridId);
  if (sourceLocation?.status !== 'RESOLVED' || !sourceLocation.locationRef) {
    throw new Error('WEP_FULL_DESIGN_SEMANTIC_LOCATION_UNRESOLVED');
  }

  const locationRef = clone(sourceLocation.locationRef);
  const type = semanticType(locationRef);
  const resolved = resolveV125OutdoorLocation(profile, locationRef);
  if (resolved?.status !== 'RESOLVED') {
    throw new Error('WEP_FULL_DESIGN_LOCATION_RESOLUTION_FAILED');
  }

  const directRootRoutes = portableRoutes(resolved);
  const environment = captureEnvironment(
    profile,
    type,
    locationRef,
    resolved
  );
  if (environment?.status !== 'CAPTURED') {
    throw new Error('WEP_FULL_DESIGN_ENVIRONMENT_CAPTURE_UNAVAILABLE');
  }

  const readiness = currentV125FullDesignBaseline(
    type,
    currentReadinessIdentity(type, locationRef)
  );
  const issues: FullDesignPlanningIssue[] = [];

  for (const category of CATEGORIES) {
    if (!requested(category, requestedCategories)) {
      issues.push(block('FULL_DESIGN_REQUIRED_CATEGORY_EXCLUDED', category));
    }
  }

  if (requested('directGrids', requestedCategories)) {
    issues.push(
      block('COMPREHENSIVE_GRIDDATA_DIMENSIONS_NOT_BOUND', 'directGrids')
    );
  }
  if (requested('rootObjects', requestedCategories)) {
    issues.push(
      block('FULL_DESIGN_ALL_ROOT_OBJECT_COMPOSITION_INCOMPLETE', 'rootObjects')
    );
  }
  if (requested('roads', requestedCategories)) {
    issues.push(
      block('NATIVE_ROADFENCE_LOGICAL_READER_NOT_BOUND', 'roads')
    );
  }
  if (requested('fences', requestedCategories)) {
    issues.push(
      block('NATIVE_ROADFENCE_LOGICAL_READER_NOT_BOUND', 'fences')
    );
  }
  if (requested('buildings', requestedCategories)) {
    issues.push(
      block('FULL_DESIGN_BUILDING_COMPOSITION_INCOMPLETE', 'buildings')
    );
  }
  if (requested('environment', requestedCategories)) {
    issues.push(
      block('FULL_DESIGN_ENVIRONMENT_PREFLIGHT_PARTIAL', 'environment')
    );
  }

  const categories = {
    directGrids: {
      requested: requested('directGrids', requestedCategories),
      disposition: requested('directGrids', requestedCategories)
        ? 'captured_partial'
        : 'excluded',
      coverageStatus: readiness.categories.directGrids.status,
      evidenceStatus: readiness.categories.directGrids.evidenceStatus,
      contract: readiness.categories.directGrids.contract,
      directRootCount: directRootRoutes.length,
      blockers: issues
        .filter((issue) => issue.category === 'directGrids')
        .map((issue) => issue.code)
    },
    rootObjects: {
      requested: requested('rootObjects', requestedCategories),
      disposition: requested('rootObjects', requestedCategories)
        ? 'blocked'
        : 'excluded',
      coverageStatus: readiness.categories.rootObjects.status,
      evidenceStatus: readiness.categories.rootObjects.evidenceStatus,
      contract: readiness.categories.rootObjects.contract,
      blockers: issues
        .filter((issue) => issue.category === 'rootObjects')
        .map((issue) => issue.code)
    },
    roads: {
      requested: requested('roads', requestedCategories),
      disposition: requested('roads', requestedCategories)
        ? 'blocked'
        : 'excluded',
      coverageStatus: readiness.categories.roads.status,
      evidenceStatus: readiness.categories.roads.evidenceStatus,
      contract: readiness.categories.roads.contract,
      blockers: issues
        .filter((issue) => issue.category === 'roads')
        .map((issue) => issue.code)
    },
    fences: {
      requested: requested('fences', requestedCategories),
      disposition: requested('fences', requestedCategories)
        ? 'blocked'
        : 'excluded',
      coverageStatus: readiness.categories.fences.status,
      evidenceStatus: readiness.categories.fences.evidenceStatus,
      contract: readiness.categories.fences.contract,
      blockers: issues
        .filter((issue) => issue.category === 'fences')
        .map((issue) => issue.code)
    },
    buildings: {
      requested: requested('buildings', requestedCategories),
      disposition: requested('buildings', requestedCategories)
        ? 'blocked'
        : 'excluded',
      coverageStatus: readiness.categories.buildings.status,
      evidenceStatus: readiness.categories.buildings.evidenceStatus,
      contract: readiness.categories.buildings.contract,
      portableStateCodecs: [
        V125_PORTABLE_CONTRACTS.restoration.buildingSkinCodec,
        V125_PORTABLE_CONTRACTS.restoration.playerHouseBindingCodec
      ],
      blockers: issues
        .filter((issue) => issue.category === 'buildings')
        .map((issue) => issue.code)
    },
    environment: {
      requested: requested('environment', requestedCategories),
      disposition: requested('environment', requestedCategories)
        ? 'captured_partial'
        : 'excluded',
      coverageStatus: readiness.categories.environment.status,
      evidenceStatus: readiness.categories.environment.evidenceStatus,
      contract: readiness.categories.environment.contract,
      portableState: requested('environment', requestedCategories)
        ? clone(environment.portableState)
        : null,
      blockers: issues
        .filter((issue) => issue.category === 'environment')
        .map((issue) => issue.code)
    }
  };

  const manifest = {
    schema: FULL_DESIGN_CAPTURE_MANIFEST_SCHEMA,
    manifestVersion: FULL_DESIGN_CAPTURE_MANIFEST_VERSION,
    presetType: type,
    source: {
      gameVersion: '1.25.0',
      profileSchemaVersion: 624,
      sourcePlatform: String(sourcePlatform ?? 'unknown'),
      exactBuildKnown: false
    },
    semanticIdentity: locationRef,
    directRootRoutes,
    categories,
    exclusions: {
      sourceSaveLocalIdentity: true,
      unrelatedGameplayState: [
        'quest',
        'npc',
        'progression',
        'online-entitlement'
      ]
    },
    normalization: {
      sourceGridIdsRemoved: true,
      sourceGridObjectIdsRemoved: true,
      destinationLocalRootResolutionRequired: true
    },
    persistentWriteAuthorized: false
  } as const;

  const manifestValidation = validateCurrentV125FullDesignManifest(manifest);

  return {
    manifestReady: manifestValidation.ok,
    manifestValidation,
    publicationReady:
      manifestValidation.ok &&
      readiness.publicationReady === true &&
      issues.length === 0,
    applyReady: false,
    applyReason: 'CORE_ATOMIC_PERSISTENT_COMMIT_NOT_AUTHORIZED',
    presetType: type,
    semanticIdentity: clone(locationRef),
    directRootRoutes: clone(directRootRoutes),
    categories: clone(categories),
    issues: clone(issues),
    readiness: clone(readiness),
    manifest
  };
}
