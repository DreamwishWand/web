type AnyRecord = Record<string, any>;

export const FULL_DESIGN_CAPTURE_MANIFEST_SCHEMA =
  'dreamwish-wand-full-design-capture-manifest';
export const FULL_DESIGN_CAPTURE_MANIFEST_VERSION = 1;

export type FullDesignCategory =
  | 'directGrids'
  | 'rootObjects'
  | 'roads'
  | 'fences'
  | 'buildings'
  | 'environment';

export type FullDesignManifestIssue = {
  severity: 'BLOCK';
  code: string;
  path: string;
  detail?: Record<string, unknown>;
};

const CATEGORY_KEYS: FullDesignCategory[] = [
  'directGrids',
  'rootObjects',
  'roads',
  'fences',
  'buildings',
  'environment'
];

const COVERAGE_STATUS = new Set([
  'complete',
  'not_applicable',
  'partial',
  'unknown',
  'blocked'
]);

const DISPOSITIONS = new Set([
  'captured',
  'captured_partial',
  'blocked',
  'excluded'
]);

const FORBIDDEN_SAVE_LOCAL_KEYS = new Set([
  'gridid',
  'rootgridid',
  'sourcegridid',
  'gridobjectid',
  'sourcegridobjectid',
  'playerhouseindex',
  'editorid',
  'objectkey',
  'sourcediagnostics',
  'subgridid',
  'nextgridid',
  'nextgridobjectid'
]);

const REQUIRED_UNRELATED_EXCLUSIONS = [
  'quest',
  'npc',
  'progression',
  'online-entitlement'
];

function plain(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function block(
  code: string,
  path: string,
  detail?: Record<string, unknown>
): FullDesignManifestIssue {
  return {
    severity: 'BLOCK',
    code,
    path,
    ...(detail ? { detail } : {})
  };
}

function safeInteger(value: unknown) {
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

function nonEmptyString(value: unknown) {
  return typeof value === 'string' && value.length > 0;
}

function walkForbiddenKeys(
  value: unknown,
  path: string,
  issues: FullDesignManifestIssue[]
) {
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      walkForbiddenKeys(child, `${path}[${index}]`, issues)
    );
    return;
  }
  if (!plain(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_SAVE_LOCAL_KEYS.has(key.toLowerCase())) {
      issues.push(
        block('FULL_DESIGN_SAVE_LOCAL_IDENTITY_FORBIDDEN', `${path}.${key}`, {
          key
        })
      );
    }
    walkForbiddenKeys(child, `${path}.${key}`, issues);
  }
}

function validateSemanticIdentity(
  presetType: unknown,
  value: unknown,
  issues: FullDesignManifestIssue[]
) {
  const path = '$.semanticIdentity';
  if (!plain(value)) {
    issues.push(block('FULL_DESIGN_SEMANTIC_IDENTITY_INVALID', path));
    return;
  }
  if (value.codec !== 'ddv.outdoor-location-ref@1') {
    issues.push(block('FULL_DESIGN_LOCATION_CODEC_UNSUPPORTED', `${path}.codec`));
  }

  if (presetType === 'biome') {
    if (value.kind !== 'BIOME') {
      issues.push(block('FULL_DESIGN_BIOME_LOCATION_KIND_INVALID', `${path}.kind`));
    }
    const sceneItemId = safeInteger(value.villageSceneItemId);
    const areaType = safeInteger(value.villageAreaType);
    if (sceneItemId === null || sceneItemId <= 0) {
      issues.push(
        block(
          'FULL_DESIGN_BIOME_SCENE_ITEM_ID_INVALID',
          `${path}.villageSceneItemId`
        )
      );
    }
    if (areaType === null) {
      issues.push(
        block('FULL_DESIGN_BIOME_AREA_TYPE_INVALID', `${path}.villageAreaType`)
      );
    }
    if ('sceneItemId' in value) {
      issues.push(
        block('FULL_DESIGN_BIOME_IDENTITY_SHAPE_INVALID', `${path}.sceneItemId`)
      );
    }
    return;
  }

  if (presetType === 'floating_island') {
    if (value.kind !== 'FLOATING_ISLAND') {
      issues.push(
        block('FULL_DESIGN_FLOATING_LOCATION_KIND_INVALID', `${path}.kind`)
      );
    }
    const sceneItemId = safeInteger(value.sceneItemId);
    if (sceneItemId === null || sceneItemId <= 0) {
      issues.push(
        block(
          'FULL_DESIGN_FLOATING_SCENE_ITEM_ID_INVALID',
          `${path}.sceneItemId`
        )
      );
    }
    if ('villageSceneItemId' in value || 'villageAreaType' in value) {
      issues.push(
        block('FULL_DESIGN_FLOATING_IDENTITY_SHAPE_INVALID', path)
      );
    }
  }
}

function validateDirectRootRoutes(
  routes: unknown,
  issues: FullDesignManifestIssue[]
) {
  const path = '$.directRootRoutes';
  if (!Array.isArray(routes) || routes.length === 0) {
    issues.push(block('FULL_DESIGN_DIRECT_ROOT_ROUTES_REQUIRED', path));
    return new Set<string>();
  }

  const seen = new Set<string>();
  routes.forEach((route, index) => {
    const routePath = `${path}[${index}]`;
    if (!plain(route)) {
      issues.push(block('FULL_DESIGN_DIRECT_ROOT_ROUTE_INVALID', routePath));
      return;
    }
    if (route.codec !== 'ddv.direct-grid-route@1') {
      issues.push(
        block('FULL_DESIGN_DIRECT_ROOT_ROUTE_CODEC_UNSUPPORTED', `${routePath}.codec`)
      );
    }
    if (!nonEmptyString(route.gridDataPath)) {
      issues.push(
        block('FULL_DESIGN_DIRECT_ROOT_PATH_INVALID', `${routePath}.gridDataPath`)
      );
      return;
    }
    if (seen.has(route.gridDataPath)) {
      issues.push(
        block('FULL_DESIGN_DIRECT_ROOT_PATH_DUPLICATE', `${routePath}.gridDataPath`, {
          gridDataPath: route.gridDataPath
        })
      );
    }
    seen.add(route.gridDataPath);
  });
  return seen;
}

function validateStringArray(
  value: unknown,
  path: string,
  code: string,
  issues: FullDesignManifestIssue[]
) {
  if (!Array.isArray(value) || value.some((x) => !nonEmptyString(x))) {
    issues.push(block(code, path));
    return [] as string[];
  }
  return [...value] as string[];
}

function validateDirectRootRouteObject(
  value: unknown,
  path: string,
  issues: FullDesignManifestIssue[]
) {
  if (!plain(value)) {
    issues.push(block('FULL_DESIGN_DIRECT_ROOT_ROUTE_INVALID', path));
    return null;
  }
  if (value.codec !== 'ddv.direct-grid-route@1') {
    issues.push(
      block('FULL_DESIGN_DIRECT_ROOT_ROUTE_CODEC_UNSUPPORTED', `${path}.codec`)
    );
  }
  if (!nonEmptyString(value.gridDataPath)) {
    issues.push(
      block('FULL_DESIGN_DIRECT_ROOT_PATH_INVALID', `${path}.gridDataPath`)
    );
    return null;
  }
  return String(value.gridDataPath);
}

function validateRootObjectInventory(
  category: AnyRecord,
  directRootPaths: Set<string>,
  issues: FullDesignManifestIssue[]
) {
  if (category.requested !== true) return;
  const count = safeInteger(category.directRootObjectCount);
  if (count === null || count < 0) {
    issues.push(
      block(
        'FULL_DESIGN_ROOT_OBJECT_COUNT_INVALID',
        '$.categories.rootObjects.directRootObjectCount'
      )
    );
  }

  const routeCounts = category.routeObjectCounts;
  if (!Array.isArray(routeCounts)) {
    issues.push(
      block(
        'FULL_DESIGN_ROOT_OBJECT_ROUTE_COUNTS_INVALID',
        '$.categories.rootObjects.routeObjectCounts'
      )
    );
    return;
  }

  const seen = new Set<string>();
  let sum = 0;
  routeCounts.forEach((entry, index) => {
    const path = `$.categories.rootObjects.routeObjectCounts[${index}]`;
    if (!plain(entry)) {
      issues.push(block('FULL_DESIGN_ROOT_OBJECT_ROUTE_COUNT_INVALID', path));
      return;
    }
    const gridDataPath = validateDirectRootRouteObject(
      entry.directRootRoute,
      `${path}.directRootRoute`,
      issues
    );
    const objectCount = safeInteger(entry.objectCount);
    if (objectCount === null || objectCount < 0) {
      issues.push(
        block(
          'FULL_DESIGN_ROOT_OBJECT_ROUTE_COUNT_INVALID',
          `${path}.objectCount`
        )
      );
      return;
    }
    sum += objectCount;
    if (gridDataPath) {
      if (!directRootPaths.has(gridDataPath)) {
        issues.push(
          block(
            'FULL_DESIGN_ROOT_OBJECT_ROUTE_OUTSIDE_LOCATION',
            `${path}.directRootRoute.gridDataPath`,
            { gridDataPath }
          )
        );
      }
      if (seen.has(gridDataPath)) {
        issues.push(
          block(
            'FULL_DESIGN_ROOT_OBJECT_ROUTE_DUPLICATE',
            `${path}.directRootRoute.gridDataPath`,
            { gridDataPath }
          )
        );
      }
      seen.add(gridDataPath);
    }
  });

  if (seen.size !== directRootPaths.size) {
    issues.push(
      block(
        'FULL_DESIGN_ROOT_OBJECT_ROUTE_COVERAGE_MISMATCH',
        '$.categories.rootObjects.routeObjectCounts',
        { expected: directRootPaths.size, actual: seen.size }
      )
    );
  }
  if (count !== null && count !== sum) {
    issues.push(
      block(
        'FULL_DESIGN_ROOT_OBJECT_COUNT_MISMATCH',
        '$.categories.rootObjects.directRootObjectCount',
        { expected: sum, actual: count }
      )
    );
  }
}

function validateRootObjectPortableComposition(
  category: AnyRecord,
  directRootPaths: Set<string>,
  issues: FullDesignManifestIssue[]
) {
  if (category.requested !== true || category.portableComposition == null) return;

  const composition = category.portableComposition;
  const path = '$.categories.rootObjects.portableComposition';
  if (
    !plain(composition) ||
    composition.schema !== 'dreamwish-wand-full-design-root-object-composition' ||
    composition.version !== 1 ||
    !Array.isArray(composition.routeSummaries) ||
    !Array.isArray(composition.entries) ||
    !Array.isArray(composition.unresolved) ||
    !Array.isArray(composition.missingRoutes)
  ) {
    issues.push(block('FULL_DESIGN_ROOT_COMPOSITION_INVALID', path));
    return;
  }

  if (
    !['CAPTURED_PARTIAL', 'CAPTURED_COMPLETE_FOR_BOUND_DOCUMENTS'].includes(
      String(composition.status)
    )
  ) {
    issues.push(
      block(
        'FULL_DESIGN_ROOT_COMPOSITION_STATUS_INVALID',
        `${path}.status`
      )
    );
  }
  if (
    composition.evidenceStatus !==
    'CONFIRMED_01B_V1_6_EDITOR_DOCUMENT'
  ) {
    issues.push(
      block(
        'FULL_DESIGN_ROOT_COMPOSITION_EVIDENCE_INVALID',
        `${path}.evidenceStatus`
      )
    );
  }
  if (composition.persistentWriteAuthorized !== false) {
    issues.push(
      block(
        'FULL_DESIGN_ROOT_COMPOSITION_WRITE_AUTHORIZATION_FORBIDDEN',
        `${path}.persistentWriteAuthorized`
      )
    );
  }
  if (
    !plain(composition.normalization) ||
    composition.normalization.sourceGridIdsRemoved !== true ||
    composition.normalization.sourceGridObjectIdsRemoved !== true ||
    composition.normalization.artifactLocalObjectIds !== true
  ) {
    issues.push(
      block(
        'FULL_DESIGN_ROOT_COMPOSITION_NORMALIZATION_INVALID',
        `${path}.normalization`
      )
    );
  }

  const summaryPaths = new Set<string>();
  composition.routeSummaries.forEach((summary: unknown, index: number) => {
    const current = `${path}.routeSummaries[${index}]`;
    if (!plain(summary)) {
      issues.push(block('FULL_DESIGN_ROOT_COMPOSITION_ROUTE_SUMMARY_INVALID', current));
      return;
    }
    const gridDataPath = validateDirectRootRouteObject(
      summary.directRootRoute,
      `${current}.directRootRoute`,
      issues
    );
    if (gridDataPath) {
      if (!directRootPaths.has(gridDataPath)) {
        issues.push(
          block(
            'FULL_DESIGN_ROOT_COMPOSITION_ROUTE_OUTSIDE_LOCATION',
            `${current}.directRootRoute.gridDataPath`
          )
        );
      }
      if (summaryPaths.has(gridDataPath)) {
        issues.push(
          block(
            'FULL_DESIGN_ROOT_COMPOSITION_ROUTE_DUPLICATE',
            `${current}.directRootRoute.gridDataPath`
          )
        );
      }
      summaryPaths.add(gridDataPath);
    }
    if (typeof summary.documentBound !== 'boolean') {
      issues.push(
        block(
          'FULL_DESIGN_ROOT_COMPOSITION_ROUTE_SUMMARY_INVALID',
          `${current}.documentBound`
        )
      );
    }
    for (const field of ['portableCount', 'unresolvedCount']) {
      const value = safeInteger(summary[field]);
      if (value === null || value < 0) {
        issues.push(
          block(
            'FULL_DESIGN_ROOT_COMPOSITION_ROUTE_SUMMARY_INVALID',
            `${current}.${field}`
          )
        );
      }
    }
    if (summary.objectCount !== null) {
      const objectCount = safeInteger(summary.objectCount);
      if (objectCount === null || objectCount < 0) {
        issues.push(
          block(
            'FULL_DESIGN_ROOT_COMPOSITION_ROUTE_SUMMARY_INVALID',
            `${current}.objectCount`
          )
        );
      }
    }
  });
  if (summaryPaths.size !== directRootPaths.size) {
    issues.push(
      block(
        'FULL_DESIGN_ROOT_COMPOSITION_ROUTE_COVERAGE_MISMATCH',
        `${path}.routeSummaries`,
        { expected: directRootPaths.size, actual: summaryPaths.size }
      )
    );
  }

  const objectIds = new Set<string>();
  composition.entries.forEach((entry: unknown, index: number) => {
    const current = `${path}.entries[${index}]`;
    if (!plain(entry)) {
      issues.push(block('FULL_DESIGN_ROOT_COMPOSITION_ENTRY_INVALID', current));
      return;
    }
    const id = String(entry.artifactObjectId ?? '');
    if (!/^o\d+$/.test(id) || objectIds.has(id)) {
      issues.push(
        block(
          'FULL_DESIGN_ROOT_COMPOSITION_OBJECT_ID_INVALID',
          `${current}.artifactObjectId`
        )
      );
    } else {
      objectIds.add(id);
    }

    const gridDataPath = validateDirectRootRouteObject(
      entry.directRootRoute,
      `${current}.directRootRoute`,
      issues
    );
    if (gridDataPath && !directRootPaths.has(gridDataPath)) {
      issues.push(
        block(
          'FULL_DESIGN_ROOT_COMPOSITION_ROUTE_OUTSIDE_LOCATION',
          `${current}.directRootRoute.gridDataPath`
        )
      );
    }

    const itemId = safeInteger(entry.itemId);
    const localX = safeInteger(entry.localX);
    const localY = safeInteger(entry.localY);
    const orientation = safeInteger(entry.orientation);
    if (
      itemId === null ||
      itemId <= 0 ||
      localX === null ||
      localY === null ||
      orientation === null ||
      orientation < 0 ||
      orientation > 15 ||
      !['furniture', 'landscaping'].includes(String(entry.layer))
    ) {
      issues.push(block('FULL_DESIGN_ROOT_COMPOSITION_ENTRY_INVALID', current));
    }

    if (!Array.isArray(entry.footprint) || entry.footprint.length === 0) {
      issues.push(
        block(
          'FULL_DESIGN_ROOT_COMPOSITION_FOOTPRINT_INVALID',
          `${current}.footprint`
        )
      );
    } else {
      entry.footprint.forEach((cell: unknown, cellIndex: number) => {
        if (
          !plain(cell) ||
          safeInteger(cell.x) === null ||
          safeInteger(cell.y) === null
        ) {
          issues.push(
            block(
              'FULL_DESIGN_ROOT_COMPOSITION_FOOTPRINT_INVALID',
              `${current}.footprint[${cellIndex}]`
            )
          );
        }
      });
    }

    if (entry.portableState != null) {
      if (!plain(entry.portableState)) {
        issues.push(
          block(
            'FULL_DESIGN_ROOT_COMPOSITION_PORTABLE_STATE_INVALID',
            `${current}.portableState`
          )
        );
      } else if (
        ![
          'subgrid.itemdata-default-empty-child@1',
          'subgrid.serialized-local-child@1'
        ].includes(String(entry.portableState.codec))
      ) {
        issues.push(
          block(
            'FULL_DESIGN_ROOT_COMPOSITION_PORTABLE_STATE_CODEC_UNSUPPORTED',
            `${current}.portableState.codec`
          )
        );
      }
    }
  });

  composition.unresolved.forEach((entry: unknown, index: number) => {
    const current = `${path}.unresolved[${index}]`;
    if (!plain(entry)) {
      issues.push(
        block('FULL_DESIGN_ROOT_COMPOSITION_UNRESOLVED_INVALID', current)
      );
      return;
    }
    const gridDataPath = validateDirectRootRouteObject(
      entry.directRootRoute,
      `${current}.directRootRoute`,
      issues
    );
    if (gridDataPath && !directRootPaths.has(gridDataPath)) {
      issues.push(
        block(
          'FULL_DESIGN_ROOT_COMPOSITION_ROUTE_OUTSIDE_LOCATION',
          `${current}.directRootRoute.gridDataPath`
        )
      );
    }
    const itemId = safeInteger(entry.itemId);
    if (
      itemId === null ||
      itemId <= 0 ||
      safeInteger(entry.localX) === null ||
      safeInteger(entry.localY) === null ||
      !nonEmptyString(entry.layer) ||
      !Array.isArray(entry.reasons) ||
      entry.reasons.length === 0 ||
      entry.reasons.some((reason: unknown) => !nonEmptyString(reason))
    ) {
      issues.push(
        block('FULL_DESIGN_ROOT_COMPOSITION_UNRESOLVED_INVALID', current)
      );
    }
  });

  const missing = new Set<string>();
  composition.missingRoutes.forEach((value: unknown, index: number) => {
    if (!nonEmptyString(value)) {
      issues.push(
        block(
          'FULL_DESIGN_ROOT_COMPOSITION_MISSING_ROUTE_INVALID',
          `${path}.missingRoutes[${index}]`
        )
      );
      return;
    }
    const route = String(value);
    if (!directRootPaths.has(route)) {
      issues.push(
        block(
          'FULL_DESIGN_ROOT_COMPOSITION_MISSING_ROUTE_INVALID',
          `${path}.missingRoutes[${index}]`
        )
      );
      return;
    }
    missing.add(route);
  });

  if (
    composition.status === 'CAPTURED_COMPLETE_FOR_BOUND_DOCUMENTS' &&
    (composition.unresolved.length > 0 || missing.size > 0)
  ) {
    issues.push(
      block(
        'FULL_DESIGN_ROOT_COMPOSITION_COMPLETE_STATUS_INCONSISTENT',
        `${path}.status`
      )
    );
  }
}

function validateRoadFenceReaderCoverage(
  category: AnyRecord,
  directRootPaths: Set<string>,
  categoryKey: 'roads' | 'fences',
  issues: FullDesignManifestIssue[]
) {
  if (category.requested !== true || category.readerCoverage == null) return;
  const path = `$.categories.${categoryKey}.readerCoverage`;
  if (!Array.isArray(category.readerCoverage)) {
    issues.push(block('FULL_DESIGN_ROADFENCE_READER_COVERAGE_INVALID', path));
    return;
  }

  const seen = new Set<string>();
  category.readerCoverage.forEach((entry: unknown, index: number) => {
    const current = `${path}[${index}]`;
    if (!plain(entry)) {
      issues.push(
        block('FULL_DESIGN_ROADFENCE_READER_COVERAGE_INVALID', current)
      );
      return;
    }
    const gridDataPath = validateDirectRootRouteObject(
      entry.directRootRoute,
      `${current}.directRootRoute`,
      issues
    );
    if (gridDataPath) {
      if (!directRootPaths.has(gridDataPath)) {
        issues.push(
          block(
            'FULL_DESIGN_ROADFENCE_READER_ROUTE_OUTSIDE_LOCATION',
            `${current}.directRootRoute.gridDataPath`
          )
        );
      }
      if (seen.has(gridDataPath)) {
        issues.push(
          block(
            'FULL_DESIGN_ROADFENCE_READER_ROUTE_DUPLICATE',
            `${current}.directRootRoute.gridDataPath`
          )
        );
      }
      seen.add(gridDataPath);
    }

    if (!['supported', 'blocked'].includes(String(entry.status))) {
      issues.push(
        block(
          'FULL_DESIGN_ROADFENCE_READER_STATUS_INVALID',
          `${current}.status`
        )
      );
    }
    for (const field of [
      'roadNetworkCount',
      'fenceNetworkCount',
      'modeBoundaryTouchCount'
    ]) {
      const value = safeInteger(entry[field]);
      if (value === null || value < 0) {
        issues.push(
          block(
            'FULL_DESIGN_ROADFENCE_READER_COUNT_INVALID',
            `${current}.${field}`
          )
        );
      }
    }
    if (
      !Array.isArray(entry.blockCodes) ||
      entry.blockCodes.some((value: unknown) => !nonEmptyString(value))
    ) {
      issues.push(
        block(
          'FULL_DESIGN_ROADFENCE_READER_BLOCK_CODES_INVALID',
          `${current}.blockCodes`
        )
      );
    }
    if (entry.persistentWriteAuthorized !== false) {
      issues.push(
        block(
          'FULL_DESIGN_ROADFENCE_READER_WRITE_AUTHORIZATION_FORBIDDEN',
          `${current}.persistentWriteAuthorized`
        )
      );
    }
  });

  if (seen.size !== directRootPaths.size) {
    issues.push(
      block(
        'FULL_DESIGN_ROADFENCE_READER_ROUTE_COVERAGE_MISMATCH',
        path,
        { expected: directRootPaths.size, actual: seen.size }
      )
    );
  }
}

function validateBuildingRestorationCapture(
  category: AnyRecord,
  directRootPaths: Set<string>,
  issues: FullDesignManifestIssue[]
) {
  if (category.requested !== true) return;
  const capture = category.restorationCapture;
  const path = '$.categories.buildings.restorationCapture';
  if (!plain(capture)) {
    issues.push(block('FULL_DESIGN_BUILDING_RESTORATION_CAPTURE_REQUIRED', path));
    return;
  }
  if (!Array.isArray(capture.entries) || !Array.isArray(capture.unresolved)) {
    issues.push(block('FULL_DESIGN_BUILDING_RESTORATION_CAPTURE_INVALID', path));
    return;
  }

  const ids = new Set<string>();
  capture.entries.forEach((entry: unknown, index: number) => {
    const current = `${path}.entries[${index}]`;
    if (!plain(entry)) {
      issues.push(block('FULL_DESIGN_BUILDING_RESTORATION_ENTRY_INVALID', current));
      return;
    }
    const id = String(entry.artifactRestorationId ?? '');
    if (!/^r\d+$/.test(id) || ids.has(id)) {
      issues.push(
        block(
          'FULL_DESIGN_BUILDING_RESTORATION_ID_INVALID',
          `${current}.artifactRestorationId`
        )
      );
    } else {
      ids.add(id);
    }
    const gridDataPath = validateDirectRootRouteObject(
      entry.directRootRoute,
      `${current}.directRootRoute`,
      issues
    );
    if (gridDataPath && !directRootPaths.has(gridDataPath)) {
      issues.push(
        block(
          'FULL_DESIGN_BUILDING_RESTORATION_ROUTE_OUTSIDE_LOCATION',
          `${current}.directRootRoute.gridDataPath`
        )
      );
    }
    const itemId = safeInteger(entry.itemId);
    const localX = safeInteger(entry.localX);
    const localY = safeInteger(entry.localY);
    if (
      itemId === null ||
      itemId <= 0 ||
      localX === null ||
      localY === null ||
      !['BUILDING_SKIN', 'PLAYER_HOUSE'].includes(String(entry.kind))
    ) {
      issues.push(block('FULL_DESIGN_BUILDING_RESTORATION_ENTRY_INVALID', current));
    }

    if (!plain(entry.portableState)) {
      issues.push(
        block(
          'FULL_DESIGN_BUILDING_RESTORATION_STATE_INVALID',
          `${current}.portableState`
        )
      );
      return;
    }
    const codec = String(entry.portableState.codec ?? '');
    const expected =
      entry.kind === 'BUILDING_SKIN'
        ? 'ddv.building-skin@1'
        : entry.kind === 'PLAYER_HOUSE'
          ? 'ddv.player-house-binding@1'
          : null;
    if (expected && codec !== expected) {
      issues.push(
        block(
          'FULL_DESIGN_BUILDING_RESTORATION_CODEC_MISMATCH',
          `${current}.portableState.codec`,
          { expected, actual: codec }
        )
      );
    }
  });

  capture.unresolved.forEach((entry: unknown, index: number) => {
    const current = `${path}.unresolved[${index}]`;
    if (!plain(entry)) {
      issues.push(
        block('FULL_DESIGN_BUILDING_RESTORATION_UNRESOLVED_INVALID', current)
      );
      return;
    }
    const gridDataPath = validateDirectRootRouteObject(
      entry.directRootRoute,
      `${current}.directRootRoute`,
      issues
    );
    if (gridDataPath && !directRootPaths.has(gridDataPath)) {
      issues.push(
        block(
          'FULL_DESIGN_BUILDING_RESTORATION_ROUTE_OUTSIDE_LOCATION',
          `${current}.directRootRoute.gridDataPath`
        )
      );
    }
    const itemId = safeInteger(entry.itemId);
    if (
      itemId === null ||
      itemId <= 0 ||
      safeInteger(entry.localX) === null ||
      safeInteger(entry.localY) === null ||
      !nonEmptyString(entry.status) ||
      !Array.isArray(entry.blockers)
    ) {
      issues.push(
        block('FULL_DESIGN_BUILDING_RESTORATION_UNRESOLVED_INVALID', current)
      );
    }
  });

  for (const field of ['supportedNoExtraStateCount', 'notApplicableCount']) {
    const value = safeInteger(capture[field]);
    if (value === null || value < 0) {
      issues.push(
        block(
          'FULL_DESIGN_BUILDING_RESTORATION_COUNT_INVALID',
          `${path}.${field}`
        )
      );
    }
  }
}

function validateEnvironmentPortableState(
  presetType: unknown,
  category: AnyRecord,
  issues: FullDesignManifestIssue[]
) {
  if (category.requested !== true) return;
  const path = '$.categories.environment.portableState';
  const state = category.portableState;
  if (!plain(state)) {
    issues.push(block('FULL_DESIGN_ENVIRONMENT_STATE_REQUIRED', path));
    return;
  }
  if (state.codec !== 'ddv.environment-effect@1') {
    issues.push(block('FULL_DESIGN_ENVIRONMENT_CODEC_UNSUPPORTED', `${path}.codec`));
  }
  const expectedKind = presetType === 'biome' ? 'AREA' : 'FLOATING_ISLAND';
  if (state.targetKind !== expectedKind) {
    issues.push(
      block('FULL_DESIGN_ENVIRONMENT_TARGET_KIND_MISMATCH', `${path}.targetKind`, {
        expected: expectedKind,
        actual: state.targetKind
      })
    );
  }
  const itemId = safeInteger(state.effectItemId);
  const orientation = safeInteger(state.orientation);
  if (itemId === null || itemId < 0) {
    issues.push(
      block('FULL_DESIGN_ENVIRONMENT_EFFECT_ITEM_INVALID', `${path}.effectItemId`)
    );
  }
  if (orientation === null || orientation < 0 || orientation > 15) {
    issues.push(
      block('FULL_DESIGN_ENVIRONMENT_ORIENTATION_INVALID', `${path}.orientation`)
    );
  }
}

function validateCategories(
  presetType: unknown,
  categories: unknown,
  directRootPaths: Set<string>,
  issues: FullDesignManifestIssue[]
) {
  const directRootCount = directRootPaths.size;
  const path = '$.categories';
  if (!plain(categories)) {
    issues.push(block('FULL_DESIGN_CATEGORIES_REQUIRED', path));
    return;
  }

  const actualKeys = Object.keys(categories);
  for (const key of actualKeys) {
    if (!CATEGORY_KEYS.includes(key as FullDesignCategory)) {
      issues.push(
        block('FULL_DESIGN_CATEGORY_UNKNOWN', `${path}.${key}`, { category: key })
      );
    }
  }

  for (const key of CATEGORY_KEYS) {
    const categoryPath = `${path}.${key}`;
    const category = categories[key];
    if (!plain(category)) {
      issues.push(
        block('FULL_DESIGN_CATEGORY_REQUIRED', categoryPath, { category: key })
      );
      continue;
    }

    if (typeof category.requested !== 'boolean') {
      issues.push(
        block('FULL_DESIGN_CATEGORY_REQUESTED_INVALID', `${categoryPath}.requested`)
      );
    }
    if (!DISPOSITIONS.has(String(category.disposition))) {
      issues.push(
        block(
          'FULL_DESIGN_CATEGORY_DISPOSITION_INVALID',
          `${categoryPath}.disposition`
        )
      );
    }
    if (!COVERAGE_STATUS.has(String(category.coverageStatus))) {
      issues.push(
        block(
          'FULL_DESIGN_CATEGORY_COVERAGE_STATUS_INVALID',
          `${categoryPath}.coverageStatus`
        )
      );
    }
    if (!nonEmptyString(category.evidenceStatus)) {
      issues.push(
        block(
          'FULL_DESIGN_CATEGORY_EVIDENCE_STATUS_REQUIRED',
          `${categoryPath}.evidenceStatus`
        )
      );
    }
    if (!nonEmptyString(category.contract)) {
      issues.push(
        block(
          'FULL_DESIGN_CATEGORY_CONTRACT_REQUIRED',
          `${categoryPath}.contract`
        )
      );
    }

    const blockers = validateStringArray(
      category.blockers,
      `${categoryPath}.blockers`,
      'FULL_DESIGN_CATEGORY_BLOCKERS_INVALID',
      issues
    );

    if (category.requested === false) {
      if (category.disposition !== 'excluded') {
        issues.push(
          block(
            'FULL_DESIGN_EXCLUDED_CATEGORY_DISPOSITION_MISMATCH',
            `${categoryPath}.disposition`
          )
        );
      }
      if (!blockers.includes('FULL_DESIGN_REQUIRED_CATEGORY_EXCLUDED')) {
        issues.push(
          block(
            'FULL_DESIGN_EXCLUDED_CATEGORY_BLOCKER_REQUIRED',
            `${categoryPath}.blockers`
          )
        );
      }
    } else if (category.disposition === 'excluded') {
      issues.push(
        block(
          'FULL_DESIGN_REQUESTED_CATEGORY_CANNOT_BE_EXCLUDED',
          `${categoryPath}.disposition`
        )
      );
    }

    if (key === 'directGrids') {
      const count = safeInteger(category.directRootCount);
      if (count === null || count !== directRootCount) {
        issues.push(
          block(
            'FULL_DESIGN_DIRECT_ROOT_COUNT_MISMATCH',
            `${categoryPath}.directRootCount`,
            { expected: directRootCount, actual: category.directRootCount }
          )
        );
      }
    }

    if (key === 'rootObjects') {
      validateRootObjectInventory(category, directRootPaths, issues);
      validateRootObjectPortableComposition(
        category,
        directRootPaths,
        issues
      );
    }

    if (key === 'roads' || key === 'fences') {
      validateRoadFenceReaderCoverage(
        category,
        directRootPaths,
        key,
        issues
      );
    }

    if (key === 'buildings' && category.requested === true) {
      const codecs = validateStringArray(
        category.portableStateCodecs,
        `${categoryPath}.portableStateCodecs`,
        'FULL_DESIGN_BUILDING_CODECS_INVALID',
        issues
      );
      for (const required of [
        'ddv.building-skin@1',
        'ddv.player-house-binding@1'
      ]) {
        if (!codecs.includes(required)) {
          issues.push(
            block(
              'FULL_DESIGN_BUILDING_CODEC_REQUIRED',
              `${categoryPath}.portableStateCodecs`,
              { codec: required }
            )
          );
        }
      }
      validateBuildingRestorationCapture(category, directRootPaths, issues);
    }

    if (key === 'environment') {
      validateEnvironmentPortableState(presetType, category, issues);
    }
  }
}

export function validateCurrentV125FullDesignManifest(input: unknown) {
  const issues: FullDesignManifestIssue[] = [];
  if (!plain(input)) {
    return {
      ok: false,
      issues: [block('FULL_DESIGN_MANIFEST_OBJECT_REQUIRED', '$')],
      manifest: null,
      persistentWriteAuthorized: false
    };
  }

  walkForbiddenKeys(input, '$', issues);

  if (input.schema !== FULL_DESIGN_CAPTURE_MANIFEST_SCHEMA) {
    issues.push(block('FULL_DESIGN_MANIFEST_SCHEMA_UNSUPPORTED', '$.schema'));
  }
  if (input.manifestVersion !== FULL_DESIGN_CAPTURE_MANIFEST_VERSION) {
    issues.push(
      block('FULL_DESIGN_MANIFEST_VERSION_UNSUPPORTED', '$.manifestVersion')
    );
  }
  if (!['biome', 'floating_island'].includes(String(input.presetType))) {
    issues.push(block('FULL_DESIGN_PRESET_TYPE_UNSUPPORTED', '$.presetType'));
  }

  if (!plain(input.source)) {
    issues.push(block('FULL_DESIGN_SOURCE_REQUIRED', '$.source'));
  } else {
    if (input.source.gameVersion !== '1.25.0') {
      issues.push(block('FULL_DESIGN_SOURCE_GAME_VERSION_UNSUPPORTED', '$.source.gameVersion'));
    }
    if (input.source.profileSchemaVersion !== 624) {
      issues.push(
        block(
          'FULL_DESIGN_SOURCE_PROFILE_SCHEMA_UNSUPPORTED',
          '$.source.profileSchemaVersion'
        )
      );
    }
    if (input.source.sourcePlatform !== 'switch') {
      issues.push(
        block('FULL_DESIGN_SOURCE_PLATFORM_CONTRACT_UNAVAILABLE', '$.source.sourcePlatform')
      );
    }
    if (input.source.exactBuildKnown !== false) {
      issues.push(
        block('FULL_DESIGN_SOURCE_EXACT_BUILD_MUST_REMAIN_UNPROVEN', '$.source.exactBuildKnown')
      );
    }
  }

  validateSemanticIdentity(input.presetType, input.semanticIdentity, issues);
  const routes = validateDirectRootRoutes(input.directRootRoutes, issues);
  validateCategories(input.presetType, input.categories, routes, issues);

  if (!plain(input.exclusions) || input.exclusions.sourceSaveLocalIdentity !== true) {
    issues.push(
      block(
        'FULL_DESIGN_SAVE_LOCAL_IDENTITY_EXCLUSION_REQUIRED',
        '$.exclusions.sourceSaveLocalIdentity'
      )
    );
  } else {
    const exclusions = validateStringArray(
      input.exclusions.unrelatedGameplayState,
      '$.exclusions.unrelatedGameplayState',
      'FULL_DESIGN_UNRELATED_EXCLUSIONS_INVALID',
      issues
    );
    for (const required of REQUIRED_UNRELATED_EXCLUSIONS) {
      if (!exclusions.includes(required)) {
        issues.push(
          block(
            'FULL_DESIGN_UNRELATED_EXCLUSION_REQUIRED',
            '$.exclusions.unrelatedGameplayState',
            { exclusion: required }
          )
        );
      }
    }
  }

  if (!plain(input.normalization)) {
    issues.push(block('FULL_DESIGN_NORMALIZATION_REQUIRED', '$.normalization'));
  } else {
    for (const key of [
      'sourceGridIdsRemoved',
      'sourceGridObjectIdsRemoved',
      'destinationLocalRootResolutionRequired'
    ]) {
      if (input.normalization[key] !== true) {
        issues.push(
          block('FULL_DESIGN_NORMALIZATION_FLAG_REQUIRED', `$.normalization.${key}`, {
            key
          })
        );
      }
    }
  }

  if (input.persistentWriteAuthorized !== false) {
    issues.push(
      block(
        'FULL_DESIGN_PERSISTENT_WRITE_AUTHORIZATION_FORBIDDEN',
        '$.persistentWriteAuthorized'
      )
    );
  }

  return {
    ok: issues.length === 0,
    issues,
    manifest: issues.length === 0 ? structuredClone(input) : null,
    persistentWriteAuthorized: false
  };
}

export const FULL_DESIGN_CATEGORY_KEYS = Object.freeze([...CATEGORY_KEYS]);
