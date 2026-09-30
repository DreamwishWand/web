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
  'playerhouseindex'
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
  directRootCount: number,
  issues: FullDesignManifestIssue[]
) {
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
  validateCategories(input.presetType, input.categories, routes.size, issues);

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
