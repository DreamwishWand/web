import '../ddv/core/world/runtime-v125/progression-destination-veto-v125.js';

type AnyRecord = Record<string, any>;
type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export const PROGRESSION_REFERENCE_INDEX_V10_SOURCE_SHA256 =
  '7a7d9fb0e83d0b6607fe2015d14ba288c9408411fa839031fbeffbc4a9fff152';
export const PROGRESSION_DESTINATION_V115_RUNTIME_SHA256 =
  '41bb86f2489079ab3b953a90124fc9898b1ceab40ca5c4553d7c8877538e2206';

const SOURCE_PARTS = Object.freeze([
  '/ddv/core/save/v1.25/progression-reference-index-v125.part01.jsfrag',
  '/ddv/core/save/v1.25/progression-reference-index-v125.part02.jsfrag',
  '/ddv/core/save/v1.25/progression-reference-index-v125.part03.jsfrag',
  '/ddv/core/save/v1.25/progression-reference-index-v125.part04.jsfrag',
  '/ddv/core/save/v1.25/progression-reference-index-v125.part05.jsfrag',
  '/ddv/core/save/v1.25/progression-reference-index-v125.part06.jsfrag'
]);

type ReferenceIndexModule = {
  PROGRESSION_REFERENCE_INDEX_CONTRACT: string;
  PROGRESSION_REFERENCE_INDEX_ARTIFACT: string;
  SUPPORTED_PROFILE_SCHEMA: number;
  buildProgressionReferenceIndex(
    profile: AnyRecord,
    options?: AnyRecord
  ): AnyRecord;
};

type DestinationVetoCore = {
  CURRENT_GAME_VERSION: string;
  CURRENT_PROFILE_SCHEMA: number;
  projectDestinationProgressionVeto(input: {
    objects: AnyRecord[];
    progressionReferenceIndex: AnyRecord;
    scopeIndex: AnyRecord;
    source: AnyRecord;
  }): AnyRecord;
};

let referenceIndexModulePromise:
  | Promise<ReferenceIndexModule>
  | null = null;

async function sha256Hex(bytes: Uint8Array) {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'WEP_PROGRESSION_DESTINATION_V115_SHA256_UNAVAILABLE'
    );
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer
  );
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0')
  ).join('');
}

async function fetchText(url: string, fetchImpl: FetchLike) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(
      'WEP_PROGRESSION_REFERENCE_INDEX_SOURCE_FETCH_FAILED'
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function loadReferenceIndexModule({
  basePath,
  fetchImpl
}: {
  basePath: string;
  fetchImpl: FetchLike;
}) {
  if (referenceIndexModulePromise) {
    return referenceIndexModulePromise;
  }

  referenceIndexModulePromise = (async () => {
    const prefix = String(basePath ?? '').replace(/\/$/, '');
    const parts = await Promise.all(
      SOURCE_PARTS.map((path) =>
        fetchText(`${prefix}${path}`, fetchImpl)
      )
    );
    const totalLength = parts.reduce(
      (sum, part) => sum + part.byteLength,
      0
    );
    const bytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }

    const actual = await sha256Hex(bytes);
    if (actual !== PROGRESSION_REFERENCE_INDEX_V10_SOURCE_SHA256) {
      throw new Error(
        'WEP_PROGRESSION_REFERENCE_INDEX_SOURCE_HASH_MISMATCH'
      );
    }

    const source = new TextDecoder('utf-8', { fatal: true })
      .decode(bytes);
    const moduleUrl =
      'data:text/javascript;charset=utf-8,' +
      encodeURIComponent(source);
    const loaded = (await import(
      /* @vite-ignore */ moduleUrl
    )) as ReferenceIndexModule;

    if (
      loaded.PROGRESSION_REFERENCE_INDEX_CONTRACT !==
        'ddv.progression-reference-index@1' ||
      loaded.PROGRESSION_REFERENCE_INDEX_ARTIFACT !==
        'DDV-PROGRESSION-REFERENCE-INDEX-V125-V1_0' ||
      Number(loaded.SUPPORTED_PROFILE_SCHEMA) !== 624 ||
      typeof loaded.buildProgressionReferenceIndex !== 'function'
    ) {
      throw new Error(
        'WEP_PROGRESSION_REFERENCE_INDEX_SOURCE_CONTRACT_MISMATCH'
      );
    }
    return loaded;
  })();

  try {
    return await referenceIndexModulePromise;
  } catch (error) {
    referenceIndexModulePromise = null;
    throw error;
  }
}

function destinationCore() {
  const api = (globalThis as any)
    .DdvCoreProgressionDestinationVetoV125 as
      | DestinationVetoCore
      | undefined;
  if (
    !api ||
    api.CURRENT_GAME_VERSION !== '1.25.0' ||
    Number(api.CURRENT_PROFILE_SCHEMA) !== 624 ||
    typeof api.projectDestinationProgressionVeto !== 'function'
  ) {
    throw new Error(
      'WEP_PROGRESSION_DESTINATION_V115_CORE_NOT_LOADED'
    );
  }
  return api;
}

function materializedGridObjects(profile: AnyRecord) {
  const grids =
    profile?.World?.GridCollection?.Grids ?? {};
  const objects: AnyRecord[] = [];

  for (const grid of Object.values(grids) as AnyRecord[]) {
    const gridId = Number(grid?.ID);
    if (!Number.isSafeInteger(gridId)) continue;
    for (const object of Object.values(
      grid?.Objects ?? {}
    ) as AnyRecord[]) {
      const gridObjectId = Number(object?.ID);
      const itemId = Number(object?.ItemID);
      if (!Number.isSafeInteger(gridObjectId)) continue;
      objects.push({
        source: {
          gridId,
          gridObjectId
        },
        itemId: Number.isSafeInteger(itemId)
          ? itemId
          : null,
        editorId: String(gridObjectId)
      });
    }
  }

  return objects;
}

export async function buildSwitchV125DestinationProgressionProjection({
  profile,
  progressionScopeIndex,
  basePath = '',
  fetchImpl = globalThis.fetch.bind(globalThis)
}: {
  profile: AnyRecord;
  progressionScopeIndex: AnyRecord;
  basePath?: string;
  fetchImpl?: FetchLike;
}) {
  if (
    Number(profile?.GameInfo?.Version) !== 624 ||
    !progressionScopeIndex ||
    typeof progressionScopeIndex !== 'object'
  ) {
    throw new Error(
      'WEP_PROGRESSION_DESTINATION_V115_INPUT_MISMATCH'
    );
  }

  const referenceModule = await loadReferenceIndexModule({
    basePath,
    fetchImpl
  });
  const progressionReferenceIndex =
    referenceModule.buildProgressionReferenceIndex(profile, {
      sourceLabel:
        'WEP_DESTINATION_PREFLIGHT_SCHEMA624_LOCAL',
      packagedSourceSha256:
        PROGRESSION_REFERENCE_INDEX_V10_SOURCE_SHA256
    });

  const projection =
    destinationCore().projectDestinationProgressionVeto({
      objects: materializedGridObjects(profile),
      progressionReferenceIndex,
      scopeIndex: progressionScopeIndex,
      source: {
        gameVersion: '1.25.0',
        profileSchemaVersion: 624
      }
    });

  if (
    projection?.schema !==
      'ddv.progression-destination-veto-projection@1' ||
    projection?.version !== 'v1.15' ||
    projection?.semantics?.absenceOfVetoIsPermission !==
      false ||
    projection?.semantics?.positivePermission !== false ||
    projection?.writerBoundary
      ?.persistentWriteAuthorized !== false ||
    projection?.writerBoundary
      ?.WORLD_PERSISTENT_WRITE_V125 !== false ||
    projection?.writerBoundary?.applyAuthorized !== false
  ) {
    throw new Error(
      'WEP_PROGRESSION_DESTINATION_V115_RESULT_MISMATCH'
    );
  }

  return Object.freeze({
    projection,
    referenceIndexSummary:
      structuredClone(
        progressionReferenceIndex?.coverage?.summary ?? {}
      ),
    positivePermissionGranted: false,
    persistentWriteAuthorized: false
  });
}
