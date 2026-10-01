import '../ddv/core/world/runtime-v125/placement-v125.js';
import '../ddv/core/world/runtime-v125/griddata-floor-v125.js';
import '../ddv/core/world/runtime-v125/placement-legality-v125.js';

type AnyRecord = Record<string, any>;
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const GRIDDATA_FLOOR_MAP_V125_SHA256 =
  'c282132aa56d4936490d36c5a398ed16436cc1ffd86bd17a49b770f8372d8cb3';
export const GRIDDATA_FLOOR_MAP_V125_STATIC_PATH =
  '/ddv/core/world/v1.25/griddata-floor-maps-v125.json';
export const GRIDDATA_FLOOR_BINDER_V18_SHA256 =
  '0744acc96c8a5ba58d77b9ed970313cb04a0624c8ea200d3c3fd892b4c406bd7';
export const PLACEMENT_LEGALITY_V19_SHA256 =
  '95aa8bbc9056d271bb43fd6907c4185ac7597609d94a9e6d3155de577f5a199d';

export const PLACEMENT_GEOMETRY_V125_STATIC_PATH =
  '/ddv/core/world/v1.25/placement-geometry-switch-v125.json';
export const PLACEMENT_GEOMETRY_V125_SHA256 =
  'b685536c29a78626f3bc6381f977b46e4c98218b4c9f4ac6653d504b8e271750';
export const PLACEMENT_GEOMETRY_V125_RECORD_COUNT = 10438;
export const PLACEMENT_GEOMETRY_BASE_V125_STATIC_PATH =
  '/ddv/v1.25/world-read-switch.json';
export const PLACEMENT_GEOMETRY_BASE_V125_SHA256 =
  '53db127eb796c0d4b103695258700d18de69f5403d1067cd956396cd1b03ffa6';
export const PLACEMENT_GEOMETRY_BASE_V125_RECORD_COUNT = 10440;
export const PLACEMENT_GEOMETRY_V125_KNOWN_UNRESOLVED = Object.freeze([
  20000039,
  40006180
]);

export const NATIVE_PLACEMENT_CLASSES = Object.freeze({
  VALID_CLEAR: 'NATIVE_VALID_CLEAR',
  VALID_REPLACES_OR_REMOVES_EXISTING:
    'NATIVE_VALID_REPLACES_OR_REMOVES_EXISTING',
  INVALID: 'NATIVE_INVALID',
  UNKNOWN: 'NATIVE_UNKNOWN_UNVERIFIED'
});

type FloorCore = {
  revision: string;
  SCHEMA: string;
  getGridData(
    contract: AnyRecord,
    gridDataPath: string,
    expected?: AnyRecord
  ): AnyRecord | null;
};

type LegalityCore = {
  revision: string;
  schema: string;
  NATIVE_CLASS: Record<string, string>;
  classifyOrdinaryCardinalNativePlacement(input: AnyRecord): AnyRecord;
  persistentWriteAuthorized: false;
};

function floorCore(): FloorCore {
  const api = (globalThis as any).DdvCoreWorldV125GridDataFloor as
    | FloorCore
    | undefined;
  if (
    !api ||
    api.revision !== 'V125_SWITCH_FLOOR_MAP_CONTRACT_1' ||
    api.SCHEMA !== 'ddv.griddata-floor-map@1' ||
    typeof api.getGridData !== 'function'
  ) {
    throw new Error('WEP_V125_FLOOR_CORE_CONTRACT_MISMATCH');
  }
  return api;
}

function legalityCore(): LegalityCore {
  const api = (globalThis as any).DdvCoreWorldV125PlacementLegality as
    | LegalityCore
    | undefined;
  if (
    !api ||
    api.revision !== 'V125_NATIVE_PLACEMENT_LEGALITY_STRUCTURED_1' ||
    api.schema !== 'ddv.native-placement-legality@1' ||
    api.persistentWriteAuthorized !== false ||
    typeof api.classifyOrdinaryCardinalNativePlacement !== 'function'
  ) {
    throw new Error('WEP_V125_LEGALITY_CORE_CONTRACT_MISMATCH');
  }
  return api;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WEP_V125_PLACEMENT_SHA256_UNAVAILABLE');
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer
  );
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0')
  ).join('');
}

async function fetchPinnedJson(
  url: string,
  expectedSha256: string,
  fetchImpl: FetchLike
) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error('WEP_V125_PLACEMENT_STATIC_DATA_FETCH_FAILED');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if ((await sha256Hex(bytes)) !== expectedSha256) {
    throw new Error('WEP_V125_PLACEMENT_STATIC_DATA_HASH_MISMATCH');
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('WEP_V125_PLACEMENT_STATIC_DATA_JSON_INVALID');
  }
}

function uint32(value: unknown, code: string) {
  const number = Number(value);
  if (
    !Number.isSafeInteger(number) ||
    number < 0 ||
    number > 0xffffffff
  ) {
    throw new Error(code);
  }
  return number >>> 0;
}

function normalizeGeometryInput(
  raw: AnyRecord,
  baseRaw: AnyRecord
) {
  if (
    !raw ||
    raw.schema !== 'dreamwish-wand-v125-placement-geometry-input' ||
    Number(raw.version) !== 1 ||
    raw.platform !== 'Nintendo Switch' ||
    raw.gameVersion !== '1.25.0' ||
    raw.buildID !== '52BD625D9B4E0053' ||
    Number(raw.profileSchemaVersion) !== 624 ||
    raw.source?.authority !==
      '01D_INTEGRATOR_APPROVED_CURRENT_V125_GAMEDB' ||
    !raw.geometry ||
    typeof raw.geometry !== 'object'
  ) {
    throw new Error('WEP_V125_PLACEMENT_GEOMETRY_CONTRACT_MISMATCH');
  }
  if (
    !baseRaw ||
    baseRaw.schema !== 'dreamwish-wand-v125-world-read-data' ||
    Number(baseRaw.version) !== 1 ||
    baseRaw.platform !== 'Nintendo Switch' ||
    baseRaw.gameVersion !== '1.25.0' ||
    baseRaw.buildID !== '52BD625D9B4E0053' ||
    !baseRaw.geometry ||
    typeof baseRaw.geometry !== 'object'
  ) {
    throw new Error('WEP_V125_PLACEMENT_GEOMETRY_BASE_CONTRACT_MISMATCH');
  }

  const entries = Object.entries(raw.geometry);
  if (entries.length !== PLACEMENT_GEOMETRY_V125_RECORD_COUNT) {
    throw new Error('WEP_V125_PLACEMENT_GEOMETRY_COUNT_MISMATCH');
  }
  if (
    Object.keys(baseRaw.geometry).length !==
    PLACEMENT_GEOMETRY_BASE_V125_RECORD_COUNT
  ) {
    throw new Error('WEP_V125_PLACEMENT_GEOMETRY_BASE_COUNT_MISMATCH');
  }

  const geometryIndex: Record<string, AnyRecord> = {};
  for (const [itemId, record] of entries) {
    const baseRecord = baseRaw.geometry[itemId];
    if (
      !Array.isArray(record) ||
      record.length !== 3 ||
      !Array.isArray(record[2]) ||
      record[2].length === 0 ||
      !Array.isArray(baseRecord) ||
      baseRecord.length !== 4 ||
      typeof baseRecord[0] !== 'string'
    ) {
      throw new Error('WEP_V125_PLACEMENT_GEOMETRY_RECORD_INVALID');
    }

    const sizeX = Number(baseRecord[1]);
    const sizeY = Number(baseRecord[2]);
    if (
      !Number.isSafeInteger(sizeX) ||
      sizeX <= 0 ||
      !Number.isSafeInteger(sizeY) ||
      sizeY <= 0 ||
      record[2].length !== sizeX * sizeY
    ) {
      throw new Error('WEP_V125_PLACEMENT_GEOMETRY_DIMENSIONS_INVALID');
    }

    const stride =
      record[1] === null || record[1] === undefined
        ? null
        : uint32(
            record[1],
            'WEP_V125_PLACEMENT_GEOMETRY_STRIDE_INVALID'
          );

    geometryIndex[itemId] = Object.freeze({
      concreteType: baseRecord[0],
      sizeX,
      sizeY,
      subGridDataPath:
        baseRecord[3] === null || typeof baseRecord[3] === 'string'
          ? baseRecord[3]
          : null,
      areaTessellationFactor: 1,
      acceptedFloorTypesFlag: uint32(
        record[0],
        'WEP_V125_PLACEMENT_GEOMETRY_FLOOR_FLAG_INVALID'
      ),
      strideOverride: stride,
      layers: Object.freeze(
        record[2].map((value: unknown) =>
          uint32(
            value,
            'WEP_V125_PLACEMENT_GEOMETRY_LAYER_INVALID'
          )
        )
      )
    });
  }

  for (const itemId of PLACEMENT_GEOMETRY_V125_KNOWN_UNRESOLVED) {
    if (Object.hasOwn(geometryIndex, String(itemId))) {
      throw new Error('WEP_V125_PLACEMENT_GEOMETRY_UNRESOLVED_PROMOTED');
    }
    if (!Object.hasOwn(baseRaw.geometry, String(itemId))) {
      throw new Error('WEP_V125_PLACEMENT_GEOMETRY_BASE_UNRESOLVED_MISSING');
    }
  }

  return Object.freeze(geometryIndex);
}

function destinationGrid(
  profile: AnyRecord,
  destinationGridId: number,
  gridDataPath: string
) {
  const grid =
    profile?.World?.GridCollection?.Grids?.[String(destinationGridId)] ??
    profile?.World?.GridCollection?.Grids?.[destinationGridId];
  if (
    !grid ||
    Number(grid.ID) !== Number(destinationGridId) ||
    String(grid.GridDataPath ?? '') !== gridDataPath
  ) {
    throw new Error('WEP_V125_PLACEMENT_DESTINATION_GRID_MISMATCH');
  }
  return grid;
}

function occupancyObjects(grid: AnyRecord) {
  return Object.values(grid?.Objects ?? {}).map((object: any) => ({
    editorId: String(object.ID),
    itemId: Number(object.ItemID),
    x: Number(object.X),
    y: Number(object.Y),
    orientation: object.Orientation
  }));
}

export type CurrentV125PlacementBinding = Awaited<
  ReturnType<typeof createSwitchV125PlacementLegalityBinding>
>;

export async function createSwitchV125PlacementLegalityBinding({
  basePath = '',
  fetchImpl = globalThis.fetch.bind(globalThis)
}: {
  basePath?: string;
  fetchImpl?: FetchLike;
} = {}) {
  const prefix = String(basePath || '').replace(/\/$/, '');
  const [floorContract, geometryRaw, geometryBaseRaw] = await Promise.all([
    fetchPinnedJson(
      `${prefix}${GRIDDATA_FLOOR_MAP_V125_STATIC_PATH}`,
      GRIDDATA_FLOOR_MAP_V125_SHA256,
      fetchImpl
    ),
    fetchPinnedJson(
      `${prefix}${PLACEMENT_GEOMETRY_V125_STATIC_PATH}`,
      PLACEMENT_GEOMETRY_V125_SHA256,
      fetchImpl
    ),
    fetchPinnedJson(
      `${prefix}${PLACEMENT_GEOMETRY_BASE_V125_STATIC_PATH}`,
      PLACEMENT_GEOMETRY_BASE_V125_SHA256,
      fetchImpl
    )
  ]);
  const floor = floorCore();
  const legality = legalityCore();
  const geometryIndex = normalizeGeometryInput(
    geometryRaw,
    geometryBaseRaw
  );

  // Core owns floor decoding/interpretation. WEP only asks the promoted v1.8
  // binder for a GridData view by exact GridDataPath.
  function classify({
    profile,
    destinationGridId,
    gridDataPath,
    candidate,
    clearabilityResolver = null
  }: {
    profile: AnyRecord;
    destinationGridId: number;
    gridDataPath: string;
    candidate: AnyRecord;
    clearabilityResolver?: ((input: AnyRecord) => unknown) | null;
  }) {
    const grid = destinationGrid(
      profile,
      Number(destinationGridId),
      String(gridDataPath)
    );
    const gridData = floor.getGridData(
      floorContract,
      String(gridDataPath),
      {
        gameVersion: '1.25.0',
        platform: 'Nintendo Switch',
        buildIdentity: '52BD625D9B4E0053',
        profileSchemaVersion: 624
      }
    );
    if (!gridData) {
      throw new Error('WEP_V125_PLACEMENT_FLOOR_MAP_UNRESOLVED');
    }

    const result = legality.classifyOrdinaryCardinalNativePlacement({
      gridData,
      geometryIndex,
      objects: occupancyObjects(grid),
      candidate: {
        editorId: String(candidate.artifactObjectId ?? ''),
        itemId: Number(candidate.itemId),
        x: Number(candidate.localX),
        y: Number(candidate.localY),
        orientation: Number(candidate.orientation)
      },
      gridTessellationFactor: Number(
        grid.TessellationFactor ?? 1
      ),
      excludeEditorId: null,
      clearArea: false,
      automaticSpawning: false,
      clearabilityResolver
    });

    if (
      result?.schema !== 'ddv.native-placement-legality@1' ||
      !new Set<string>(
        Object.values(NATIVE_PLACEMENT_CLASSES)
      ).has(String(result.nativeClass)) ||
      result.persistentWriteAuthorized !== false
    ) {
      throw new Error('WEP_V125_PLACEMENT_CLASSIFIER_RESULT_INVALID');
    }
    return result;
  }

  return Object.freeze({
    contract: 'dreamwish-wand-wep-v125-placement-binding@1',
    platform: 'switch',
    gameVersion: '1.25.0',
    buildID: '52BD625D9B4E0053',
    profileSchemaVersion: 624,
    classify,
    provenance: Object.freeze({
      floorMapSha256: GRIDDATA_FLOOR_MAP_V125_SHA256,
      floorBinderSha256: GRIDDATA_FLOOR_BINDER_V18_SHA256,
      legalityClassifierSha256: PLACEMENT_LEGALITY_V19_SHA256,
      geometryInputSha256: PLACEMENT_GEOMETRY_V125_SHA256,
      geometryRecordCount: PLACEMENT_GEOMETRY_V125_RECORD_COUNT,
      geometryBaseSha256: PLACEMENT_GEOMETRY_BASE_V125_SHA256,
      geometryBaseRecordCount:
        PLACEMENT_GEOMETRY_BASE_V125_RECORD_COUNT,
      geometryKnownUnresolvedItemIds:
        PLACEMENT_GEOMETRY_V125_KNOWN_UNRESOLVED
    }),
    persistentWriteAuthorized: false
  });
}
