import {
  captureV125AreaEnvironment,
  captureV125FloatingIslandEnvironment,
  captureV125ObjectRestoration,
  captureV125OutdoorLocation,
  resolveV125OutdoorLocation,
  V125_PORTABLE_CONTRACTS
} from './world-portable-contracts.ts';
import {
  currentV125FullDesignBaseline,
  type FullDesignPresetType
} from './full-design-preset-readiness.ts';
import {
  captureCurrentV125RootObjectComposition
} from './full-design-root-object-composition.ts';
import {
  createSwitchV125RoadFenceReaderBinding
} from './roadfence-reader-adapter.ts';
import {
  captureAuthoritativeDirectRootBounds
} from './griddata-v17-contract.ts';
import type { EditorDocument } from './scene-capture-runtime.ts';
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
  rootEditorDocuments?: AnyRecord[] | null;
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

function sourceGrid(profile: AnyRecord, gridId: unknown) {
  const gid = Number(gridId);
  if (!Number.isSafeInteger(gid)) {
    throw new Error('WEP_FULL_DESIGN_SOURCE_GRID_ID_INVALID');
  }
  const grids = profile?.World?.GridCollection?.Grids;
  const grid = grids?.[String(gid)] ?? grids?.[gid];
  if (!grid || Number(grid.ID) !== gid) {
    throw new Error('WEP_FULL_DESIGN_SOURCE_GRID_UNRESOLVED');
  }
  return grid;
}

function portableObjectAnchor(
  gridDataPath: string,
  object: AnyRecord
) {
  const itemId = Number(object?.ItemID);
  const x = Number(object?.X);
  const y = Number(object?.Y);
  if (
    !Number.isSafeInteger(itemId) ||
    itemId <= 0 ||
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y)
  ) {
    throw new Error('WEP_FULL_DESIGN_ROOT_OBJECT_ANCHOR_INVALID');
  }
  return {
    directRootRoute: {
      codec: V125_PORTABLE_CONTRACTS.location.directGridRouteCodec,
      gridDataPath
    },
    itemId,
    localX: x,
    localY: y
  };
}

function captureDirectRootObjectPlanning(
  profile: AnyRecord,
  resolved: AnyRecord
) {
  if (resolved?.status !== 'RESOLVED' || !Array.isArray(resolved.directRoots)) {
    throw new Error('WEP_FULL_DESIGN_DIRECT_ROOTS_UNRESOLVED');
  }

  const routeObjectCounts: Array<{
    directRootRoute: AnyRecord;
    objectCount: number;
  }> = [];
  const restorationEntries: AnyRecord[] = [];
  const restorationBlockers: AnyRecord[] = [];
  const noExtraStateEntries: AnyRecord[] = [];
  let noExtraStateCount = 0;
  let notApplicableCount = 0;

  for (const root of resolved.directRoots) {
    const gridDataPath = String(root?.gridDataPath ?? '');
    if (!gridDataPath) {
      throw new Error('WEP_FULL_DESIGN_DIRECT_ROOT_PATH_INVALID');
    }
    const grid = sourceGrid(profile, root.sourceGridId);
    const objects = Object.values(grid.Objects ?? {}).filter(
      (value): value is AnyRecord =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
    );
    routeObjectCounts.push({
      directRootRoute: {
        codec: V125_PORTABLE_CONTRACTS.location.directGridRouteCodec,
        gridDataPath
      },
      objectCount: objects.length
    });

    for (const object of objects) {
      const anchor = portableObjectAnchor(gridDataPath, object);
      const capture = captureV125ObjectRestoration(
        profile,
        root.sourceGridId,
        object.ID
      );

      if (capture.status === 'CAPTURED') {
        restorationEntries.push({
          ...anchor,
          kind: String(capture.kind),
          portableState: clone(capture.portableState)
        });
        continue;
      }
      if (capture.status === 'SUPPORTED_NO_EXTRA_STATE') {
        noExtraStateCount += 1;
        noExtraStateEntries.push({
          ...anchor,
          kind: String(capture.kind ?? 'SUPPORTED_NO_EXTRA_STATE')
        });
        continue;
      }
      if (capture.status === 'NOT_APPLICABLE') {
        notApplicableCount += 1;
        continue;
      }
      restorationBlockers.push({
        ...anchor,
        kind: String(capture.kind ?? 'UNKNOWN'),
        status: String(capture.status ?? 'UNKNOWN'),
        blockers: clone(capture.blockers ?? [])
      });
    }
  }

  const sortKey = (entry: AnyRecord) =>
    [
      entry.directRootRoute.gridDataPath,
      String(entry.localY).padStart(10, '0'),
      String(entry.localX).padStart(10, '0'),
      String(entry.itemId).padStart(12, '0'),
      entry.kind,
      JSON.stringify(entry.portableState ?? null)
    ].join('|');

  restorationEntries.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  restorationBlockers.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  return {
    routeObjectCounts,
    directRootObjectCount: routeObjectCounts.reduce(
      (sum, entry) => sum + entry.objectCount,
      0
    ),
    restorationEntries: restorationEntries.map((entry, index) => ({
      artifactRestorationId: `r${index}`,
      ...entry
    })),
    restorationBlockers,
    noExtraStateEntries,
    noExtraStateCount,
    notApplicableCount
  };
}

function captureRoadFenceReaderCoverage(
  profile: AnyRecord,
  resolved: AnyRecord,
  sourcePlatform: string | null | undefined
) {
  if (sourcePlatform !== 'switch') return null;
  if (resolved?.status !== 'RESOLVED' || !Array.isArray(resolved.directRoots)) {
    throw new Error('WEP_FULL_DESIGN_DIRECT_ROOTS_UNRESOLVED');
  }

  return resolved.directRoots.map((root: AnyRecord) => {
    const gridDataPath = String(root?.gridDataPath ?? '');
    if (!gridDataPath) {
      throw new Error('WEP_FULL_DESIGN_DIRECT_ROOT_PATH_INVALID');
    }
    try {
      const binding = createSwitchV125RoadFenceReaderBinding({
        profile,
        rootGridId: root.sourceGridId
      });
      const blockCodes = Array.from(
        new Set(
          (binding.summary.issues ?? [])
            .map((entry: AnyRecord) => String(entry?.code ?? ''))
            .filter(Boolean)
        )
      );
      return {
        directRootRoute: {
          codec: V125_PORTABLE_CONTRACTS.location.directGridRouteCodec,
          gridDataPath
        },
        status: binding.summary.status,
        roadNetworkCount: binding.summary.roadNetworkCount,
        fenceNetworkCount: binding.summary.fenceNetworkCount,
        modeBoundaryTouchCount: binding.summary.modeBoundaryTouchCount,
        blockCodes,
        persistentWriteAuthorized: false
      };
    } catch (error) {
      return {
        directRootRoute: {
          codec: V125_PORTABLE_CONTRACTS.location.directGridRouteCodec,
          gridDataPath
        },
        status: 'blocked',
        roadNetworkCount: 0,
        fenceNetworkCount: 0,
        modeBoundaryTouchCount: 0,
        blockCodes: [
          error instanceof Error ? error.message : 'WEP_ROADFENCE_READER_FAILED'
        ],
        persistentWriteAuthorized: false
      };
    }
  });
}

function captureFullRootRoadFenceNetworks(
  profile: AnyRecord,
  resolved: AnyRecord,
  rootEditorDocuments: AnyRecord[] | null,
  directRootBounds: AnyRecord | null
) {
  if (
    !Array.isArray(rootEditorDocuments) ||
    !rootEditorDocuments.length ||
    directRootBounds?.status !== 'AUTHORITATIVE_COMPLETE'
  ) {
    return null;
  }

  const documents = new Map<string, EditorDocument>(
    rootEditorDocuments.map((document: AnyRecord) => [
      String(document?.target?.gridDataPath ?? ''),
      document as EditorDocument
    ])
  );
  const bounds = new Map<string, AnyRecord>(
    (directRootBounds.entries ?? []).map((entry: AnyRecord) => [
      String(entry?.directRootRoute?.gridDataPath ?? ''),
      entry
    ])
  );
  const entries: AnyRecord[] = [];

  for (const root of resolved.directRoots ?? []) {
    const gridDataPath = String(root?.gridDataPath ?? '');
    const document = documents.get(gridDataPath);
    const bound = bounds.get(gridDataPath);
    if (!document || !bound) {
      return null;
    }

    const binding = createSwitchV125RoadFenceReaderBinding({
      profile,
      rootGridId: root.sourceGridId
    });
    if (binding.summary.status !== 'supported') {
      return {
        status: 'blocked',
        entries,
        blockCodes: (binding.summary.issues ?? [])
          .map((issue: AnyRecord) => String(issue?.code ?? ''))
          .filter(Boolean),
        persistentWriteAuthorized: false
      };
    }

    const region = {
      x: bound.bounds.x,
      y: bound.bounds.y,
      w: bound.bounds.w,
      h: bound.bounds.h
    };
    const roads = binding.networkAdapter.capture(
      'roads',
      document,
      region
    );
    const fences = binding.networkAdapter.capture(
      'fences',
      document,
      region
    );
    if (roads.status !== 'supported' || fences.status !== 'supported') {
      return {
        status: 'blocked',
        entries,
        blockCodes: [
          ...(roads.issues ?? []),
          ...(fences.issues ?? [])
        ]
          .map((issue: AnyRecord) => String(issue?.code ?? ''))
          .filter(Boolean),
        persistentWriteAuthorized: false
      };
    }

    entries.push({
      directRootRoute: {
        codec: V125_PORTABLE_CONTRACTS.location.directGridRouteCodec,
        gridDataPath
      },
      captureRegion: region,
      roads: clone(roads.data),
      fences: clone(fences.data),
      persistentWriteAuthorized: false
    });
  }

  return {
    status: 'captured',
    entries,
    blockCodes: [],
    persistentWriteAuthorized: false
  };
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
  requestedCategories = {},
  rootEditorDocuments = null
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
  const rootObjectPlanning = captureDirectRootObjectPlanning(profile, resolved);
  const roadFenceReaderCoverage = captureRoadFenceReaderCoverage(
    profile,
    resolved,
    sourcePlatform
  );
  const roadFenceReaderBound =
    Array.isArray(roadFenceReaderCoverage) &&
    roadFenceReaderCoverage.length === directRootRoutes.length &&
    roadFenceReaderCoverage.every(
      (entry: AnyRecord) => entry.status === 'supported'
    );
  const roadFenceBlockCodes = Array.from(
    new Set(
      (roadFenceReaderCoverage ?? []).flatMap(
        (entry: AnyRecord) => entry.blockCodes ?? []
      )
    )
  );
  const rootObjectComposition =
    Array.isArray(rootEditorDocuments) && rootEditorDocuments.length
      ? captureCurrentV125RootObjectComposition({
          documents: rootEditorDocuments as any,
          expectedGridDataPaths: directRootRoutes.map(
            (route: AnyRecord) => route.gridDataPath
          )
        })
      : null;
  const rootObjectCompositionReady =
    rootObjectComposition?.status ===
      'CAPTURED_COMPLETE_FOR_BOUND_DOCUMENTS' &&
    Array.isArray(rootObjectComposition?.unresolved) &&
    rootObjectComposition.unresolved.length === 0 &&
    Array.isArray(rootObjectComposition?.missingRoutes) &&
    rootObjectComposition.missingRoutes.length === 0;

  const buildingPlacementEntries =
    rootObjectComposition?.unresolved?.filter(
      (entry: AnyRecord) => String(entry?.layer ?? '') === 'building'
    ) ?? [];
  const buildingRecognitionComplete =
    Boolean(rootObjectComposition) &&
    Array.isArray(rootObjectComposition?.missingRoutes) &&
    rootObjectComposition.missingRoutes.length === 0;
  const buildingSkinEntries = rootObjectPlanning.restorationEntries.filter(
    (entry: AnyRecord) => entry.kind === 'BUILDING_SKIN'
  );
  const playerHouseEntries = rootObjectPlanning.restorationEntries.filter(
    (entry: AnyRecord) => entry.kind === 'PLAYER_HOUSE'
  );
  const ordinaryHouseStateEntries =
    rootObjectPlanning.noExtraStateEntries.filter(
      (entry: AnyRecord) => entry.kind === 'BUILDING_HOUSE_DATA'
    );
  const recognizedBuildingCount = new Set(
    [
      ...buildingPlacementEntries,
      ...buildingSkinEntries,
      ...playerHouseEntries,
      ...ordinaryHouseStateEntries
    ].map((entry: AnyRecord) =>
      [
        entry?.directRootRoute?.gridDataPath,
        entry?.itemId,
        entry?.localX,
        entry?.localY
      ].join('|')
    )
  ).size;
  const noBuildingsPresent =
    buildingRecognitionComplete &&
    recognizedBuildingCount === 0 &&
    rootObjectPlanning.restorationBlockers.length === 0;

  const directRootBounds =
    Array.isArray(rootEditorDocuments) && rootEditorDocuments.length
      ? captureAuthoritativeDirectRootBounds({
          documents: rootEditorDocuments,
          expectedGridDataPaths: directRootRoutes.map(
            (route: AnyRecord) => route.gridDataPath
          )
        })
      : null;
  const directRootBoundsReady =
    directRootBounds?.status === 'AUTHORITATIVE_COMPLETE';
  const fullRootNetworks = captureFullRootRoadFenceNetworks(
    profile,
    resolved,
    rootEditorDocuments,
    directRootBounds
  );
  const fullRootNetworkCaptureReady =
    fullRootNetworks?.status === 'captured';
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

  if (
    requested('directGrids', requestedCategories) &&
    !directRootBoundsReady
  ) {
    issues.push(
      block(
        'AUTHORITATIVE_GRIDDATAPATH_BOUNDS_NOT_BOUND',
        'directGrids'
      )
    );
  }
  if (requested('rootObjects', requestedCategories)) {
    if (!rootObjectComposition) {
      issues.push(
        block(
          'FULL_DESIGN_ROOT_OBJECT_COMPOSITION_UNAVAILABLE',
          'rootObjects'
        )
      );
    } else {
      if (rootObjectComposition.unresolved?.length) {
        issues.push(
          block(
            'FULL_DESIGN_ROOT_OBJECT_COMPOSITION_UNRESOLVED',
            'rootObjects'
          )
        );
      }
      if (rootObjectComposition.missingRoutes?.length) {
        issues.push(
          block(
            'FULL_DESIGN_ROOT_OBJECT_ROUTE_DOCUMENTS_MISSING',
            'rootObjects'
          )
        );
      }
    }
  }
  if (requested('roads', requestedCategories)) {
    if (!roadFenceReaderCoverage) {
      issues.push(
        block('NATIVE_ROADFENCE_LOGICAL_READER_NOT_BOUND', 'roads')
      );
    } else if (!roadFenceReaderBound) {
      for (const code of roadFenceBlockCodes.length
        ? roadFenceBlockCodes
        : ['ROADFENCE_NATIVE_READER_NOT_SUPPORTED']) {
        issues.push(block(String(code), 'roads'));
      }
    } else if (!fullRootNetworkCaptureReady) {
      issues.push(
        block(
          fullRootNetworks?.blockCodes?.[0] ??
            'FULL_DESIGN_ROADFENCE_FULL_ROOT_CAPTURE_UNAVAILABLE',
          'roads'
        )
      );
    }
  }
  if (requested('fences', requestedCategories)) {
    if (!roadFenceReaderCoverage) {
      issues.push(
        block('NATIVE_ROADFENCE_LOGICAL_READER_NOT_BOUND', 'fences')
      );
    } else if (!roadFenceReaderBound) {
      for (const code of roadFenceBlockCodes.length
        ? roadFenceBlockCodes
        : ['ROADFENCE_NATIVE_READER_NOT_SUPPORTED']) {
        issues.push(block(String(code), 'fences'));
      }
    } else if (!fullRootNetworkCaptureReady) {
      issues.push(
        block(
          fullRootNetworks?.blockCodes?.[0] ??
            'FULL_DESIGN_ROADFENCE_FULL_ROOT_CAPTURE_UNAVAILABLE',
          'fences'
        )
      );
    }
  }
  if (requested('buildings', requestedCategories)) {
    if (!buildingRecognitionComplete) {
      issues.push(
        block(
          'FULL_DESIGN_BUILDING_SOURCE_RECOGNITION_INCOMPLETE',
          'buildings'
        )
      );
    } else if (!noBuildingsPresent) {
      if (buildingPlacementEntries.length > 0) {
        issues.push(
          block(
            'BUILDING_DESTINATION_SEMANTICS_UNRESOLVED',
            'buildings'
          )
        );
      }
      if (rootObjectPlanning.restorationBlockers.length > 0) {
        issues.push(
          block(
            'FULL_DESIGN_BUILDING_RESTORATION_CAPTURE_UNRESOLVED',
            'buildings'
          )
        );
      }
    }
  }

  const categories = {
    directGrids: {
      requested: requested('directGrids', requestedCategories),
      disposition: requested('directGrids', requestedCategories)
        ? directRootBoundsReady
          ? 'captured'
          : 'captured_partial'
        : 'excluded',
      coverageStatus: directRootBoundsReady
        ? 'complete'
        : readiness.categories.directGrids.status,
      evidenceStatus: directRootBoundsReady
        ? 'CONFIRMED_01B_V1_7_GRIDDATAPATH_DIMENSIONS'
        : readiness.categories.directGrids.evidenceStatus,
      contract: directRootBoundsReady
        ? '01B-v1.7-griddata-dimensions'
        : readiness.categories.directGrids.contract,
      directRootCount: directRootRoutes.length,
      boundsCapture:
        requested('directGrids', requestedCategories) && directRootBounds
          ? clone(directRootBounds)
          : null,
      blockers: issues
        .filter((issue) => issue.category === 'directGrids')
        .map((issue) => issue.code)
    },
    rootObjects: {
      requested: requested('rootObjects', requestedCategories),
      disposition: requested('rootObjects', requestedCategories)
        ? rootObjectCompositionReady
          ? 'captured'
          : 'captured_partial'
        : 'excluded',
      coverageStatus: rootObjectCompositionReady
        ? 'complete'
        : readiness.categories.rootObjects.status,
      evidenceStatus: rootObjectCompositionReady
        ? 'CONFIRMED_WEP_ALL_DIRECT_ROOT_COMPOSITION'
        : readiness.categories.rootObjects.evidenceStatus,
      contract: rootObjectCompositionReady
        ? 'dreamwish-wand-full-design-root-object-composition@1'
        : readiness.categories.rootObjects.contract,
      directRootObjectCount: rootObjectPlanning.directRootObjectCount,
      routeObjectCounts: requested('rootObjects', requestedCategories)
        ? clone(rootObjectPlanning.routeObjectCounts)
        : [],
      portableComposition:
        requested('rootObjects', requestedCategories) && rootObjectComposition
          ? clone(rootObjectComposition)
          : null,
      blockers: [
        ...issues
          .filter((issue) => issue.category === 'rootObjects')
          .map((issue) => issue.code),
        ...(requested('rootObjects', requestedCategories) &&
        rootObjectComposition?.unresolved?.length
          ? ['FULL_DESIGN_ROOT_OBJECT_COMPOSITION_UNRESOLVED']
          : []),
        ...(requested('rootObjects', requestedCategories) &&
        rootObjectComposition?.missingRoutes?.length
          ? ['FULL_DESIGN_ROOT_OBJECT_ROUTE_DOCUMENTS_MISSING']
          : [])
      ]
    },
    roads: {
      requested: requested('roads', requestedCategories),
      disposition: requested('roads', requestedCategories)
        ? fullRootNetworkCaptureReady
          ? 'captured'
          : roadFenceReaderBound
            ? 'captured_partial'
            : 'blocked'
        : 'excluded',
      coverageStatus: fullRootNetworkCaptureReady
        ? 'complete'
        : readiness.categories.roads.status,
      evidenceStatus: fullRootNetworkCaptureReady
        ? 'CONFIRMED_01C_FULL_ROOT_LOGICAL_CAPTURE'
        : roadFenceReaderBound
          ? 'CONFIRMED_01C_NATIVE_LOGICAL_READER_BOUND'
          : readiness.categories.roads.evidenceStatus,
      contract: roadFenceReaderBound
        ? '01C-v1.25-native-reader-capture-region'
        : readiness.categories.roads.contract,
      readerCoverage:
        requested('roads', requestedCategories) && roadFenceReaderCoverage
          ? clone(roadFenceReaderCoverage)
          : null,
      networkCaptures:
        requested('roads', requestedCategories) &&
        fullRootNetworkCaptureReady
          ? fullRootNetworks.entries.map((entry: AnyRecord) => ({
              directRootRoute: clone(entry.directRootRoute),
              captureRegion: clone(entry.captureRegion),
              network: clone(entry.roads),
              persistentWriteAuthorized: false
            }))
          : null,
      blockers: issues
        .filter((issue) => issue.category === 'roads')
        .map((issue) => issue.code)
    },
    fences: {
      requested: requested('fences', requestedCategories),
      disposition: requested('fences', requestedCategories)
        ? fullRootNetworkCaptureReady
          ? 'captured'
          : roadFenceReaderBound
            ? 'captured_partial'
            : 'blocked'
        : 'excluded',
      coverageStatus: fullRootNetworkCaptureReady
        ? 'complete'
        : readiness.categories.fences.status,
      evidenceStatus: fullRootNetworkCaptureReady
        ? 'CONFIRMED_01C_FULL_ROOT_LOGICAL_CAPTURE'
        : roadFenceReaderBound
          ? 'CONFIRMED_01C_NATIVE_LOGICAL_READER_BOUND'
          : readiness.categories.fences.evidenceStatus,
      contract: roadFenceReaderBound
        ? '01C-v1.25-native-reader-capture-region'
        : readiness.categories.fences.contract,
      readerCoverage:
        requested('fences', requestedCategories) && roadFenceReaderCoverage
          ? clone(roadFenceReaderCoverage)
          : null,
      networkCaptures:
        requested('fences', requestedCategories) &&
        fullRootNetworkCaptureReady
          ? fullRootNetworks.entries.map((entry: AnyRecord) => ({
              directRootRoute: clone(entry.directRootRoute),
              captureRegion: clone(entry.captureRegion),
              network: clone(entry.fences),
              persistentWriteAuthorized: false
            }))
          : null,
      blockers: issues
        .filter((issue) => issue.category === 'fences')
        .map((issue) => issue.code)
    },
    buildings: {
      requested: requested('buildings', requestedCategories),
      disposition: requested('buildings', requestedCategories)
        ? noBuildingsPresent
          ? 'captured'
          : 'captured_partial'
        : 'excluded',
      coverageStatus: noBuildingsPresent
        ? 'not_applicable'
        : readiness.categories.buildings.status,
      evidenceStatus: noBuildingsPresent
        ? 'CONFIRMED_01B_EDITOR_DOCUMENT_NO_BUILDING'
        : readiness.categories.buildings.evidenceStatus,
      contract: readiness.categories.buildings.contract,
      portableStateCodecs: [
        V125_PORTABLE_CONTRACTS.restoration.buildingSkinCodec,
        V125_PORTABLE_CONTRACTS.restoration.playerHouseBindingCodec
      ],
      ordinaryPlacement: requested('buildings', requestedCategories)
        ? {
            sourceRecognition:
              buildingRecognitionComplete
                ? 'COMPLETE'
                : 'INCOMPLETE',
            recognizedCount: recognizedBuildingCount,
            entries: clone(buildingPlacementEntries),
            ordinaryHouseStateEntries: clone(
              ordinaryHouseStateEntries
            ),
            portableCompositionCount: 0,
            destinationPlacementStatus:
              noBuildingsPresent
                ? 'NOT_APPLICABLE'
                : recognizedBuildingCount > 0
                  ? 'UNRESOLVED'
                  : 'UNKNOWN',
            destinationPlacementReady: noBuildingsPresent,
            blockers:
              noBuildingsPresent
                ? []
                : buildingRecognitionComplete
                  ? [
                      'BUILDING_DESTINATION_SEMANTICS_UNRESOLVED'
                    ]
                  : [
                      'ORDINARY_BUILDING_SOURCE_RECOGNITION_INCOMPLETE'
                    ],
            persistentWriteAuthorized: false
          }
        : null,
      buildingSkins: requested('buildings', requestedCategories)
        ? {
            provisionalCodec:
              V125_PORTABLE_CONTRACTS.restoration.buildingSkinCodec,
            semanticStatus: noBuildingsPresent
              ? 'NOT_APPLICABLE'
              : 'PROVISIONAL_PENDING_01B',
            entries: clone(buildingSkinEntries),
            nonzeroValidatorRequired:
              buildingSkinEntries.some(
                (entry: AnyRecord) =>
                  Number(entry?.portableState?.skinItemId ?? 0) !== 0
              ),
            destinationSemanticsReady: noBuildingsPresent,
            persistentWriteAuthorized: false
          }
        : null,
      playerHouses: requested('buildings', requestedCategories)
        ? {
            provisionalCodec:
              V125_PORTABLE_CONTRACTS.restoration.playerHouseBindingCodec,
            semanticStatus: noBuildingsPresent
              ? 'NOT_APPLICABLE'
              : 'PROVISIONAL_PENDING_01B',
            entries: clone(playerHouseEntries),
            destinationBinderCurrentlyRequired:
              playerHouseEntries.length > 0,
            destinationSemanticsReady: noBuildingsPresent,
            persistentWriteAuthorized: false
          }
        : null,
      restorationCapture: requested('buildings', requestedCategories)
        ? {
            entries: clone(rootObjectPlanning.restorationEntries),
            unresolved: clone(rootObjectPlanning.restorationBlockers),
            supportedNoExtraStateCount:
              rootObjectPlanning.noExtraStateCount,
            notApplicableCount:
              rootObjectPlanning.notApplicableCount
          }
        : null,
      blockers: issues
        .filter((issue) => issue.category === 'buildings')
        .map((issue) => issue.code)
    },
    environment: {
      requested: requested('environment', requestedCategories),
      disposition: requested('environment', requestedCategories)
        ? 'captured'
        : 'excluded',
      coverageStatus: 'complete',
      evidenceStatus: 'CONFIRMED_PORTABLE_CAPTURE_PREFLIGHT',
      contract: V125_PORTABLE_CONTRACTS.restoration.environmentCodec,
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
  const categoryReadinessMatrix = Object.fromEntries(
    CATEGORIES.map((category) => {
      const state = (categories as AnyRecord)[category];
      const blockers = Array.isArray(state?.blockers)
        ? state.blockers.map(String)
        : [];
      const sourceCaptureReady =
        state?.requested === true &&
        ['complete', 'not_applicable'].includes(
          String(state?.coverageStatus ?? '')
        ) &&
        blockers.length === 0;
      return [
        category,
        {
          requested: state?.requested === true,
          sourceStatus: String(state?.coverageStatus ?? 'unknown'),
          sourceCaptureReady,
          publicationCandidateReady: sourceCaptureReady,
          blockers,
          persistentWriteAuthorized: false
        }
      ];
    })
  );
  const sourceCategoryClosureReady =
    CATEGORIES.every(
      (category) =>
        categoryReadinessMatrix[category].sourceCaptureReady
    );
  const publicationCandidateReady =
    manifestValidation.ok &&
    sourceCategoryClosureReady &&
    issues.length === 0;

  return {
    manifestReady: manifestValidation.ok,
    manifestValidation,
    publicationCandidateReady,
    publicationReady: false,
    publicationReason: publicationCandidateReady
      ? 'FULL_DESIGN_COMMUNITY_PUBLICATION_ADAPTER_NOT_BOUND'
      : 'FULL_DESIGN_SOURCE_CATEGORY_CLOSURE_INCOMPLETE',
    sourceCategoryClosureReady,
    categoryReadinessMatrix: clone(categoryReadinessMatrix),
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
