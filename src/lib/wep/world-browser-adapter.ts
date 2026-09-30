import '../ddv/core/world/core-world-v125-adapter-v1_3.js';

import type { OpenWorldSaveResult, WorldAreaRoute } from './world-save-source';

export const WORLD_ADAPTER_V13_SOURCE_SHA256 =
  '2ee1f8695d2f1c5e5e5820c33ce0ba56393120768652c1b5ab36feb840126d12';
export const WORLD_ROLE_AUTHORITY_V125_SHA256 =
  '94c958c5a689504c008a53f1f9e8466d4d51697eb4f4adf521a1599472c363f6';
export const WORLD_READ_SWITCH_V125_SHA256 =
  '53db127eb796c0d4b103695258700d18de69f5403d1067cd956396cd1b03ffa6';
export const WORLD_READ_SWITCH_V125_BUILD_ID = '52BD625D9B4E0053';

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
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
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
    raw.schema !== 'dreamwish-wand-world-read-data-v125' ||
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
    raw.schema !== 'dreamwish-wand-grid-role-authority-v125' ||
    raw.version !== 1 ||
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
  const [readRaw, roleRaw] = await Promise.all([
    fetchPinnedJson<CompactReadData>(
      `${prefix}/ddv/v1.25/world-read-switch.json`,
      WORLD_READ_SWITCH_V125_SHA256,
      fetchImpl
    ),
    fetchPinnedJson<RoleAuthority>(
      `${prefix}/ddv/v1.25/grid-role-authority-v125.json`,
      WORLD_ROLE_AUTHORITY_V125_SHA256,
      fetchImpl
    )
  ]);

  const data = normalizeReadData(readRaw);
  const roleAuthority = validateRoleAuthority(roleRaw);
  const api = coreApi();
  const adapter = api.createAdapter({
    geometryIndex: data.geometryIndex,
    scopeIndex: data.scopeIndex,
    gridDataDimensions: {},
    gridRoleIndex: roleAuthority
  });

  return Object.freeze({
    adapter,
    source: Object.freeze({
      gameVersion: '1.25.0',
      platform: 'Nintendo Switch',
      buildIdentity: null,
      profileSchemaVersion: 624
    }),
    provenance: Object.freeze({
      adapterSourceSha256: WORLD_ADAPTER_V13_SOURCE_SHA256,
      roleAuthoritySha256: WORLD_ROLE_AUTHORITY_V125_SHA256,
      readDataSha256: WORLD_READ_SWITCH_V125_SHA256,
      readDataBuildID: WORLD_READ_SWITCH_V125_BUILD_ID,
      readDataSource: data.provenance
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
        adapter: '01B-v1.3-integrator-approved',
        sourcePlatform: 'switch',
        exactBuildKnown: false,
        persistentWriteAuthorized: false,
        gridDataDimensionsBound: false,
        roadFenceLogicalBinding: false
      }
    }
  };
}
