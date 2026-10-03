import '../ddv/core/world/runtime-v125/location-v125.js';
import '../ddv/core/world/runtime-v125/restoration-v125.js';

export const WORLD_LOCATION_V16_SOURCE_SHA256 =
  '26e31812f735d76aa4c77cd7fb20992ccee12773402f47db490f2826b8b13901';
export const WORLD_RESTORATION_V15_SOURCE_SHA256 =
  'cdb22ee13f22ea78e5def2306a8bce1e073ce572e8f387f2ca8b3eacd0101015';

type AnyRecord = Record<string, any>;

type LocationApi = {
  CURRENT_GAME_VERSION: string;
  CURRENT_PROFILE_SCHEMA: number;
  LOCATION_CODEC: string;
  DIRECT_GRID_ROUTE_CODEC: string;
  KINDS: { BIOME: string; FLOATING_ISLAND: string };
  locationRefFloatingIsland(sceneItemId: unknown): AnyRecord | null;
  locationRefBiome(villageSceneItemId: unknown, villageAreaType: unknown): AnyRecord | null;
  resolveFloatingIsland(profile: AnyRecord, sceneItemId: unknown): AnyRecord;
  resolveBiome(profile: AnyRecord, identity: AnyRecord): AnyRecord;
  resolveLocationRef(profile: AnyRecord, ref: AnyRecord): AnyRecord;
  resolveLocationFromGrid(profile: AnyRecord, gridId: unknown): AnyRecord;
  resolveDestinationDirectRoot(
    profile: AnyRecord,
    locationRef: AnyRecord,
    directRootRoute: AnyRecord
  ): AnyRecord;
};

type RestorationApi = {
  CURRENT_GAME_VERSION: string;
  CURRENT_PROFILE_SCHEMA: number;
  CODECS: {
    environment: string;
    buildingSkin: string;
    playerHouseBinding: string;
  };
  captureEnvironmentState(target: AnyRecord, options?: AnyRecord): AnyRecord;
  captureObjectRestorationState(gridObject: AnyRecord, world: AnyRecord): AnyRecord;
  resolvePlayerHouseBinding(gridObject: AnyRecord, world: AnyRecord): AnyRecord;
  preflightPortableState(portableState: AnyRecord, context?: AnyRecord): AnyRecord;
};

function requireCurrentProfile(profile: AnyRecord) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('WEP_WORLD_PORTABLE_PROFILE_REQUIRED');
  }
  if (Number(profile?.GameInfo?.Version) !== 624) {
    throw new Error('WEP_WORLD_PORTABLE_PROFILE_SCHEMA_UNSUPPORTED');
  }
  if (!profile.World || typeof profile.World !== 'object') {
    throw new Error('WEP_WORLD_PORTABLE_WORLD_MISSING');
  }
}

function locationApi(): LocationApi {
  const api = (globalThis as any).DdvCoreWorldV125Location as LocationApi | undefined;
  if (!api || typeof api.resolveLocationFromGrid !== 'function') {
    throw new Error('WEP_WORLD_LOCATION_CORE_NOT_LOADED');
  }
  if (api.CURRENT_GAME_VERSION !== '1.25.0' || api.CURRENT_PROFILE_SCHEMA !== 624) {
    throw new Error('WEP_WORLD_LOCATION_CORE_VERSION_MISMATCH');
  }
  return api;
}

function restorationApi(): RestorationApi {
  const api = (globalThis as any).DdvCoreWorldV125Restoration as RestorationApi | undefined;
  if (!api || typeof api.captureObjectRestorationState !== 'function') {
    throw new Error('WEP_WORLD_RESTORATION_CORE_NOT_LOADED');
  }
  if (api.CURRENT_GAME_VERSION !== '1.25.0' || api.CURRENT_PROFILE_SCHEMA !== 624) {
    throw new Error('WEP_WORLD_RESTORATION_CORE_VERSION_MISMATCH');
  }
  return api;
}

function cloneResult(result: AnyRecord) {
  const cloned = structuredClone(result);
  if (cloned?.persistentWriteAuthorized !== false) {
    throw new Error('WEP_WORLD_PORTABLE_WRITE_BOUNDARY_VIOLATION');
  }
  return cloned;
}

function resolveGridObject(profile: AnyRecord, gridId: unknown, objectId: unknown) {
  const gid = Number(gridId);
  const oid = Number(objectId);
  if (!Number.isSafeInteger(gid) || !Number.isSafeInteger(oid)) {
    throw new Error('WEP_WORLD_PORTABLE_OBJECT_ID_INVALID');
  }

  const grids = profile?.World?.GridCollection?.Grids;
  const grid = grids?.[String(gid)] ?? grids?.[gid];
  if (!grid || Number(grid.ID) !== gid) {
    throw new Error('WEP_WORLD_PORTABLE_GRID_NOT_FOUND');
  }

  const object = grid.Objects?.[String(oid)] ?? grid.Objects?.[oid];
  if (!object || Number(object.ID) !== oid) {
    throw new Error('WEP_WORLD_PORTABLE_OBJECT_NOT_FOUND');
  }
  return object;
}

export function captureV125OutdoorLocation(profile: AnyRecord, gridId: unknown) {
  requireCurrentProfile(profile);
  return cloneResult(locationApi().resolveLocationFromGrid(profile, gridId));
}

export function resolveV125OutdoorLocation(
  profile: AnyRecord,
  locationRef: AnyRecord
) {
  requireCurrentProfile(profile);
  return cloneResult(
    locationApi().resolveLocationRef(
      profile,
      structuredClone(locationRef)
    )
  );
}

export function resolveV125DestinationDirectRoot(
  profile: AnyRecord,
  locationRef: AnyRecord,
  directRootRoute: AnyRecord
) {
  requireCurrentProfile(profile);
  return cloneResult(
    locationApi().resolveDestinationDirectRoot(
      profile,
      structuredClone(locationRef),
      structuredClone(directRootRoute)
    )
  );
}

export function captureV125AreaEnvironment(
  profile: AnyRecord,
  villageIndex: unknown,
  areaId: unknown
) {
  requireCurrentProfile(profile);
  const vi = Number(villageIndex);
  const aid = Number(areaId);
  if (!Number.isSafeInteger(vi) || !Number.isSafeInteger(aid)) {
    throw new Error('WEP_WORLD_PORTABLE_AREA_ID_INVALID');
  }
  const village = profile.World.Villages?.[vi];
  const area = village?.Areas?.[String(aid)] ?? village?.Areas?.[aid];
  if (!area) throw new Error('WEP_WORLD_PORTABLE_AREA_NOT_FOUND');
  return cloneResult(
    restorationApi().captureEnvironmentState(area, { targetKind: 'AREA' })
  );
}

export function captureV125FloatingIslandEnvironment(
  profile: AnyRecord,
  sceneItemId: unknown
) {
  requireCurrentProfile(profile);
  const sid = Number(sceneItemId);
  if (!Number.isSafeInteger(sid)) {
    throw new Error('WEP_WORLD_PORTABLE_FLOATING_ISLAND_ID_INVALID');
  }
  const island =
    profile.World.FloatingIslands?.[String(sid)] ??
    profile.World.FloatingIslands?.[sid];
  if (!island || Number(island.SceneItemId) !== sid) {
    throw new Error('WEP_WORLD_PORTABLE_FLOATING_ISLAND_NOT_FOUND');
  }
  return cloneResult(
    restorationApi().captureEnvironmentState(island, {
      targetKind: 'FLOATING_ISLAND'
    })
  );
}

export function captureV125ObjectRestoration(
  profile: AnyRecord,
  gridId: unknown,
  objectId: unknown
) {
  requireCurrentProfile(profile);
  const object = resolveGridObject(profile, gridId, objectId);
  return cloneResult(
    restorationApi().captureObjectRestorationState(object, profile.World)
  );
}

export function preflightV125PortableRestoration(
  profile: AnyRecord,
  portableState: AnyRecord,
  context: AnyRecord = {}
) {
  requireCurrentProfile(profile);
  return cloneResult(
    restorationApi().preflightPortableState(
      structuredClone(portableState),
      context
    )
  );
}

export function currentV125FloatingIslandIdentityAdapter(
  type: 'floating_island',
  value: unknown
) {
  if (type !== 'floating_island') return { status: 'unsupported' as const };
  const raw =
    value && typeof value === 'object'
      ? Number((value as AnyRecord).sceneItemId)
      : Number(value);
  if (!Number.isSafeInteger(raw) || raw <= 0) {
    return { status: 'invalid' as const };
  }
  const ref = locationApi().locationRefFloatingIsland(raw);
  if (!ref) return { status: 'invalid' as const };
  return {
    status: 'supported' as const,
    identity: structuredClone(ref)
  };
}

export const V125_PORTABLE_CONTRACTS = Object.freeze({
  location: Object.freeze({
    codec: 'ddv.outdoor-location-ref@1',
    directGridRouteCodec: 'ddv.direct-grid-route@1',
    persistentWriteAuthorized: false
  }),
  restoration: Object.freeze({
    environmentCodec: 'ddv.environment-effect@1',
    buildingSkinCodec: 'ddv.building-skin@1',
    playerHouseBindingCodec: 'ddv.player-house-binding@1',
    persistentWriteAuthorized: false
  })
});
