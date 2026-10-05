import '../ddv/core/world/runtime-v125/adapter-v125.js';
import '../ddv/core/world/runtime-v125/location-v125.js';
import '../ddv/core/world/runtime-v125/direct-root-editor-document-v125.js';

import {
  GRIDDATA_DIMENSIONS_V125_RECORD_COUNT,
  GRIDDATA_DIMENSIONS_V125_SHA256,
  GRIDDATA_DIMENSIONS_V125_STATIC_PATH
} from './griddata-v17-contract.ts';
import type { OpenWorldSaveResult, WorldAreaRoute } from './world-save-source.ts';

export const WORLD_ADAPTER_V16_SOURCE_SHA256 =
  '60b56d95b263d8ad8401bcacee5e990201d2b854af440bbd257af3348c65b85c';
export const WORLD_ROLE_AUTHORITY_V125_SHA256 =
  'f16fe61adb356b1e46c59ca053588cc1ed5f9ad187866db04905ede31c9184cc';
export const WORLD_GRIDDATA_DIMENSIONS_V125_SHA256 =
  GRIDDATA_DIMENSIONS_V125_SHA256;
export const WORLD_READ_SWITCH_V125_SHA256 =
  '53db127eb796c0d4b103695258700d18de69f5403d1067cd956396cd1b03ffa6';
export const WORLD_READ_SWITCH_V125_BUILD_ID = '52BD625D9B4E0053';
export const WORLD_DIRECT_ROOT_EDITOR_DOCUMENT_V116_SHA256 =
  'eba3e2e604b2cf976cd6080b69ba9eaef1fa94b0a3aa20a7e4f175b64e0c3d9a';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type CompactReadData = {
  schema: string;
  version: number;
  platform: string;
  gameVersion: string;
  buildID: string;
  geometry: Record<string, [string, number, number, string | null]>;
  scope: Record<string, [boolean, unknown, string[]]>;
  source?: Record<string, unknown>;
};

type RoleAuthority = {
  schema: string;
  version: number;
  gameVersion: string;
  byGridDataPath: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

type CoreWorldApi = {
  CURRENT_GAME_VERSION: string;
  CURRENT_PROFILE_SCHEMA: number;
  createAdapter(config: Record<string, unknown>): {
    loadAreaGrid(profile: Record<string, any>, locator: Record<string, unknown>): any;
  };
};

function locationApi(): any {
  const api = (globalThis as any).DdvCoreWorldV125Location;
  if (
    !api ||
    api.CURRENT_GAME_VERSION !== '1.25.0' ||
    api.CURRENT_PROFILE_SCHEMA !== 624 ||
    api.LOCATION_CODEC !== 'ddv.outdoor-location-ref@1' ||
    api.DIRECT_GRID_ROUTE_CODEC !== 'ddv.direct-grid-route@1'
  ) {
    throw new Error('WEP_WORLD_LOCATION_CORE_CONTRACT_MISMATCH');
  }
  return api;
}

function directRootApi(): any {
  const api = (globalThis as any).DdvCoreDirectRootEditorDocumentV125;
  if (
    !api ||
    typeof api.createProjector !== 'function' ||
    api.CONTRACT_SCHEMA !== 'ddv.direct-root-editor-document@1' ||
    api.CURRENT_GAME_VERSION !== '1.25.0' ||
    api.CURRENT_PROFILE_SCHEMA !== 624
  ) {
    throw new Error('WEP_WORLD_DIRECT_ROOT_PROJECTOR_NOT_LOADED');
  }
  return api;
}

function coreApi(): CoreWorldApi {
  const api = (globalThis as any).DdvCoreWorldV125 as CoreWorldApi | undefined;
  if (!api || typeof api.createAdapter !== 'function') {
    throw new Error('WEP_WORLD_CORE_ADAPTER_NOT_LOADED');
  }
  if (api.CURRENT_GAME_VERSION !== '1.25.0' || api.CURRENT_PROFILE_SCHEMA !== 624) {
    throw new Error('WEP_WORLD_CORE_ADAPTER_VERSION_MISMATCH');
  }
  return api;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WEP_WORLD_SHA256_UNAVAILABLE');
  }
  const digestInput = Uint8Array.from(bytes).buffer;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', digestInput);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchPinnedJson<T>(
  url: string,
  expectedSha256: string,
  fetchImpl: FetchLike
): Promise<T> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error('WEP_WORLD_STATIC_DATA_FETCH_FAILED');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = await sha256Hex(bytes);
  if (actual !== expectedSha256) {
    throw new Error('WEP_WORLD_STATIC_DATA_HASH_MISMATCH');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('WEP_WORLD_STATIC_DATA_JSON_INVALID');
  }
  return parsed as T;
}

function normalizeReadData(raw: CompactReadData) {
  if (
    !raw ||
    raw.schema !== 'dreamwish-wand-v125-world-read-data' ||
    raw.version !== 1 ||
    raw.platform !== 'Nintendo Switch' ||
    raw.gameVersion !== '1.25.0' ||
    raw.buildID !== WORLD_READ_SWITCH_V125_BUILD_ID ||
    !raw.geometry ||
    !raw.scope
  ) {
    throw new Error('WEP_WORLD_READ_DATA_CONTRACT_MISMATCH');
  }

  const geometryIndex: Record<string, Record<string, unknown>> = {};
  for (const [itemId, record] of Object.entries(raw.geometry)) {
    if (
      !Array.isArray(record) ||
      record.length !== 4 ||
      typeof record[0] !== 'string' ||
      !Number.isSafeInteger(Number(record[1])) ||
      !Number.isSafeInteger(Number(record[2])) ||
      Number(record[1]) <= 0 ||
      Number(record[2]) <= 0 ||
      !(record[3] === null || typeof record[3] === 'string')
    ) {
      throw new Error('WEP_WORLD_GEOMETRY_RECORD_INVALID');
    }

    geometryIndex[itemId] = {
      concreteType: record[0],
      sizeX: Number(record[1]),
      sizeY: Number(record[2]),
      areaTessellationFactor: 1,
      subGridDataPath: record[3]
    };
  }

  const scopeIndex: Record<string, Record<string, unknown>> = {};
  for (const [itemId, record] of Object.entries(raw.scope)) {
    if (
      !Array.isArray(record) ||
      record.length !== 3 ||
      typeof record[0] !== 'boolean' ||
      !Array.isArray(record[2])
    ) {
      throw new Error('WEP_WORLD_SCOPE_RECORD_INVALID');
    }

    scopeIndex[itemId] = {
      isMissionItem: record[0],
      explicitGridEditRestriction: record[1],
      nativePresetKnownRejectReasons: [...record[2]]
    };
  }

  return {
    geometryIndex,
    scopeIndex,
    provenance: structuredClone(raw.source ?? {})
  };
}

function validateRoleAuthority(raw: RoleAuthority): RoleAuthority {
  if (
    !raw ||
    raw.schema !== 'dreamwish-wand-ddv-grid-role-authority' ||
    raw.version !== 2 ||
    raw.gameVersion !== '1.25.0' ||
    !raw.byGridDataPath ||
    typeof raw.byGridDataPath !== 'object'
  ) {
    throw new Error('WEP_WORLD_ROLE_AUTHORITY_CONTRACT_MISMATCH');
  }
  return raw;
}

export async function createSwitchWorldReadAdapter({
  basePath = '',
  fetchImpl = globalThis.fetch.bind(globalThis)
}: {
  basePath?: string;
  fetchImpl?: FetchLike;
} = {}) {
  const prefix = String(basePath || '').replace(/\/$/, '');
  const [readRaw, roleRaw, gridDataDimensions] = await Promise.all([
    fetchPinnedJson<CompactReadData>(
      `${prefix}/ddv/v1.25/world-read-switch.json`,
      WORLD_READ_SWITCH_V125_SHA256,
      fetchImpl
    ),
    fetchPinnedJson<RoleAuthority>(
      `${prefix}/ddv/core/world/v1.25/grid-role-authority-v125.json`,
      WORLD_ROLE_AUTHORITY_V125_SHA256,
      fetchImpl
    ),
    fetchPinnedJson<Record<string, {
      sizeX: number;
      sizeY: number;
      sourceSha256: string;
    }>>(
      `${prefix}${GRIDDATA_DIMENSIONS_V125_STATIC_PATH}`,
      WORLD_GRIDDATA_DIMENSIONS_V125_SHA256,
      fetchImpl
    )
  ]);

  const data = normalizeReadData(readRaw);
  const roleAuthority = validateRoleAuthority(roleRaw);
  if (
    Object.keys(gridDataDimensions).length !==
    GRIDDATA_DIMENSIONS_V125_RECORD_COUNT
  ) {
    throw new Error('WEP_WORLD_GRIDDATA_DIMENSIONS_CONTRACT_MISMATCH');
  }
  const api = coreApi();
  const adapter = api.createAdapter({
    geometryIndex: data.geometryIndex,
    scopeIndex: data.scopeIndex,
    gridDataDimensions,
    gridRoleIndex: roleAuthority
  });
  const directRootProjector = directRootApi().createProjector({
    locationApi: locationApi(),
    worldApi: api,
    gridDataDimensions,
    gridDataDimensionsSha256:
      WORLD_GRIDDATA_DIMENSIONS_V125_SHA256,
    geometryIndex: data.geometryIndex,
    scopeIndex: data.scopeIndex
  });

  function resolveDraftPlacementSource(
    itemIdInput: number,
    gridTessellationFactor = 1
  ) {
    const itemId = Number(itemIdInput);
    if (!Number.isSafeInteger(itemId) || itemId <= 0) {
      throw new Error('WEP_WORLD_PLACEMENT_SOURCE_ITEM_ID_INVALID');
    }
    const geometry = data.geometryIndex[String(itemId)] ?? null;
    const scope = data.scopeIndex[String(itemId)] ?? null;
    const reasons: string[] = [];
    if (!geometry) reasons.push('GEOMETRY_UNRESOLVED');
    const concreteType = String(geometry?.concreteType ?? '');
    if (concreteType === 'FenceAndRoadItemData') {
      reasons.push('ROAD_FENCE_DELEGATED_01C');
    } else if (concreteType === 'BuildingItemData') {
      reasons.push('BUILDING_READ_ONLY');
    } else if (concreteType !== 'FurnitureItemData') {
      reasons.push('NON_FURNITURE_WORLD_CLASS');
    } else if (!scope) {
      reasons.push('FURNITURE_POLICY_MISSING');
    } else {
      if (scope.isMissionItem) reasons.push('MISSION_ITEM_READ_ONLY');
      if (scope.explicitGridEditRestriction) {
        reasons.push('GRID_EDIT_RESTRICTION_PRESENT');
      }
      for (const reason of scope.nativePresetKnownRejectReasons ?? []) {
        reasons.push(`NATIVE_REJECT_${String(reason)}`);
      }
      if (geometry?.subGridDataPath) {
        reasons.push('SUBGRID_CREATION_CONTRACT_UNBOUND');
      }
    }

    let footprint: Array<{ x: number; y: number }> = [];
    let footprintSize: { w: number; h: number } | null = null;
    if (!reasons.length) {
      footprintSize = adapter.geometryService.orientedFootprintSize(
        itemId,
        0,
        Number(gridTessellationFactor || 1)
      );
      for (let y = 0; y < footprintSize.h; y += 1) {
        for (let x = 0; x < footprintSize.w; x += 1) {
          footprint.push({ x, y });
        }
      }
    }

    return Object.freeze({
      contract: 'dreamwish-wand-wep-draft-placement-source@1',
      status: reasons.length ? 'BLOCKED' : 'SUPPORTED',
      itemId,
      canonicalIdentity: Object.freeze({ kind: 'DDV_ITEM_ID', itemId }),
      layer: concreteType === 'FurnitureItemData' ? 'furniture' : 'static',
      orientation: 0,
      footprint: Object.freeze(footprint.map((cell) => Object.freeze(cell))),
      footprintSize: footprintSize ? Object.freeze({ ...footprintSize }) : null,
      reasons: Object.freeze([...new Set(reasons)]),
      draftPlacementSupported: reasons.length === 0,
      verifiedReplacementExportSupported: false,
      persistentWriteAuthorized: false,
      productApplyAuthorized: false,
      directSourceReplacementAuthorized: false
    });
  }

  return Object.freeze({
    adapter,
    directRootProjector,
    resolveDraftPlacementSource,
    progressionScopeIndex: Object.freeze(
      structuredClone(data.scopeIndex)
    ),
    source: Object.freeze({
      gameVersion: '1.25.0',
      platform: 'Nintendo Switch',
      buildIdentity: null,
      profileSchemaVersion: 624
    }),
    provenance: Object.freeze({
      adapterSourceSha256: WORLD_ADAPTER_V16_SOURCE_SHA256,
      adapterContractVersion: '01B-v1.7',
      gridDataDimensionsSha256: WORLD_GRIDDATA_DIMENSIONS_V125_SHA256,
      gridDataDimensionRecordCount: Object.keys(gridDataDimensions).length,
      roleAuthoritySha256: WORLD_ROLE_AUTHORITY_V125_SHA256,
      readDataSha256: WORLD_READ_SWITCH_V125_SHA256,
      readDataBuildID: WORLD_READ_SWITCH_V125_BUILD_ID,
      readDataSource: data.provenance,
      directRootEditorDocumentContract:
        'DDV-DIRECT-ROOT-EDITOR-DOCUMENT-V125-V1_16',
      directRootEditorDocumentSha256:
        WORLD_DIRECT_ROOT_EDITOR_DOCUMENT_V116_SHA256
    })
  });
}

export function projectSwitchAreaGrid(
  opened: OpenWorldSaveResult,
  area: WorldAreaRoute,
  rootGridId: number,
  binding: Awaited<ReturnType<typeof createSwitchWorldReadAdapter>>
) {
  if (
    opened.profileSchemaVersion !== 624 ||
    opened.compatibility.gameVersion !== '1.25.0'
  ) {
    throw new Error('WEP_WORLD_SAVE_CONTRACT_MISMATCH');
  }
  if (opened.saveIdentity.sourcePlatform !== 'switch') {
    throw new Error('WEP_WORLD_SWITCH_SOURCE_PLATFORM_REQUIRED');
  }
  if (!area.gridIds.includes(Number(rootGridId))) {
    throw new Error('WEP_WORLD_ROOT_GRID_NOT_IN_AREA');
  }

  const document = binding.adapter.loadAreaGrid(opened.profile, {
    villageIndex: area.villageIndex,
    areaId: area.areaId,
    rootGridId: Number(rootGridId),
    source: binding.source
  });

  return {
    ...document,
    target: {
      ...document.target,
      exactBuildKnown: false,
      persistentWriteAuthorized: false
    },
    capabilities: {
      ...document.capabilities,
      worldPlacementValidate: 'browser-disabled-exact-build-unproven',
      worldDryRunMutation: 'browser-disabled-exact-build-unproven',
      worldPersistentWrite: 'unsupported'
    },
    metadata: {
      ...document.metadata,
      browserBinding: {
        adapter: '01B-v1.7-integrator-approved',
        sourcePlatform: 'switch',
        exactBuildKnown: false,
        persistentWriteAuthorized: false,
        gridDataDimensionsBound: true,
        gridDataDimensionsSha256:
          binding.provenance.gridDataDimensionsSha256,
        roadFenceLogicalBinding: true
      }
    }
  };
}


export function projectSwitchFloatingIslandGrid(
  opened: OpenWorldSaveResult,
  island: { sceneItemId: number; roots: Array<{ gridId: number; gridDataPath: string | null }> },
  root: { gridId: number; gridDataPath: string | null },
  binding: Awaited<ReturnType<typeof createSwitchWorldReadAdapter>>
) {
  if (
    opened.profileSchemaVersion !== 624 ||
    opened.compatibility.gameVersion !== '1.25.0'
  ) {
    throw new Error('WEP_WORLD_SAVE_CONTRACT_MISMATCH');
  }
  if (opened.saveIdentity.sourcePlatform !== 'switch') {
    throw new Error('WEP_WORLD_SWITCH_SOURCE_PLATFORM_REQUIRED');
  }

  const gridDataPath = String(root?.gridDataPath ?? '');
  const rootGridId = Number(root?.gridId);
  const listed = (island?.roots ?? []).some(
    (entry) =>
      Number(entry?.gridId) === rootGridId &&
      String(entry?.gridDataPath ?? '') === gridDataPath
  );
  if (
    !Number.isSafeInteger(rootGridId) ||
    !gridDataPath ||
    !listed
  ) {
    throw new Error('WEP_WORLD_FLOATING_DIRECT_ROOT_ROUTE_INVALID');
  }

  const locations = locationApi();
  const locationRef = locations.locationRefFloatingIsland(
    island.sceneItemId
  );
  if (!locationRef) {
    throw new Error('WEP_WORLD_FLOATING_LOCATION_IDENTITY_INVALID');
  }

  const directRootRoute = {
    codec: locations.DIRECT_GRID_ROUTE_CODEC,
    gridDataPath
  };
  const result = binding.directRootProjector.project(
    opened.profile,
    {
      locationRef,
      directRootRoute,
      source: binding.source
    }
  );
  if (result?.status !== 'RESOLVED' || !result?.document) {
    throw new Error(
      String(
        result?.blockers?.[0]?.code ??
          'WEP_WORLD_DIRECT_ROOT_PROJECTION_BLOCKED'
      )
    );
  }

  const document = result.document;
  return {
    ...document,
    target: {
      ...document.target,
      exactBuildKnown: false,
      persistentWriteAuthorized: false
    },
    capabilities: {
      ...document.capabilities,
      worldPlacementValidate:
        'browser-disabled-direct-root-read-model',
      worldDryRunMutation: 'not-authorized-by-projector',
      worldPersistentWrite: 'unsupported'
    },
    metadata: {
      ...document.metadata,
      browserBinding: {
        adapter:
          '01B-v1.16-direct-root-integrator-promoted',
        sourcePlatform: 'switch',
        exactBuildKnown: false,
        persistentWriteAuthorized: false,
        gridDataDimensionsBound: true,
        gridDataDimensionsSha256:
          binding.provenance.gridDataDimensionsSha256,
        directRootEditorDocumentContract:
          'DDV-DIRECT-ROOT-EDITOR-DOCUMENT-V125-V1_16',
        directRootEditorDocumentSha256:
          WORLD_DIRECT_ROOT_EDITOR_DOCUMENT_V116_SHA256,
        roadFenceLogicalBinding: true
      }
    }
  };
}
