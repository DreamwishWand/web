import { p1gPackagedProfileCodec } from '../ddv/core/save/p1g-packaged-profile-codec.js';
import { parseSafeJson } from '../ddv/core/save/safe-edit-session.js';
import {
  PlatformFamily,
  detectSaveIdentity
} from '../ddv/core/save/versioning.js';

export const WEP_WORLD_READ_GAME_VERSION = '1.25.0';
export const WEP_WORLD_READ_PROFILE_SCHEMA = 624;
export const WEP_WORLD_READ_DATA_SWITCH_DRIVE_ID =
  '1gkaPeA3uWcOtdQMK0jVcwVffN6W89Hui';
export const WEP_WORLD_READ_DATA_SWITCH_SHA256 =
  '53db127eb796c0d4b103695258700d18de69f5403d1067cd956396cd1b03ffa6';

export type WorldSaveInputFormat = 'plain-json' | 'packaged';

export interface WorldGridRoute {
  gridId: number;
  gridDataPath: string | null;
  gridDefaultLayoutPath: string | null;
  tessellationFactor: number;
  objectCount: number;
}

export interface WorldAreaRoute {
  villageIndex: number;
  areaId: number;
  unlocked: boolean | null;
  gridIds: number[];
  roots: WorldGridRoute[];
}

export interface OpenWorldSaveResult {
  inputFormat: WorldSaveInputFormat;
  profile: Record<string, any>;
  profileSchemaVersion: number;
  saveIdentity: ReturnType<typeof detectSaveIdentity>;
  areas: WorldAreaRoute[];
  compatibility: {
    readContract: 'current-v125-schema624';
    gameVersion: '1.25.0';
    schemaMatched: true;
    exactBuildKnown: false;
    persistentWriteAuthorized: false;
  };
}

function decodePlainJson(bytes: Uint8Array): string | null {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }

  const normalized = text.replace(/^\uFEFF/, '').trimStart();
  return normalized.startsWith('{') ? text.replace(/^\uFEFF/, '') : null;
}

function safeInteger(value: unknown, code: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(code);
  return number;
}

function asRecord(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

function requireCurrentProfile(profile: Record<string, any>): number {
  const gameInfo = asRecord(profile.GameInfo);
  const player = asRecord(profile.Player);
  const world = asRecord(profile.World);
  if (!gameInfo || !player || !world) {
    throw new Error('WEP_WORLD_PROFILE_REQUIRED_SECTIONS_MISSING');
  }

  const version = safeInteger(
    gameInfo.Version,
    'WEP_WORLD_PROFILE_SCHEMA_INVALID'
  );
  if (version !== WEP_WORLD_READ_PROFILE_SCHEMA) {
    throw new Error('WEP_WORLD_PROFILE_SCHEMA_UNSUPPORTED');
  }
  return version;
}

export function listWorldAreaRoutes(
  profile: Record<string, any>
): WorldAreaRoute[] {
  const world = asRecord(profile.World);
  const villages = world?.Villages;
  const grids = asRecord(asRecord(world?.GridCollection)?.Grids);

  if (!Array.isArray(villages)) {
    throw new Error('WEP_WORLD_VILLAGES_MISSING');
  }
  if (!grids) {
    throw new Error('WEP_WORLD_GRID_COLLECTION_MISSING');
  }

  const routes: WorldAreaRoute[] = [];

  villages.forEach((rawVillage, villageIndex) => {
    const village = asRecord(rawVillage);
    const areas = asRecord(village?.Areas);
    if (!areas) return;

    for (const [areaKey, rawArea] of Object.entries(areas)) {
      const area = asRecord(rawArea);
      if (!area) continue;

      const areaId = safeInteger(areaKey, 'WEP_WORLD_AREA_ID_INVALID');
      const gridIds = Array.isArray(area.GridIDs)
        ? area.GridIDs.map((value: unknown) =>
            safeInteger(value, 'WEP_WORLD_GRID_ID_INVALID')
          )
        : [];

      const roots = gridIds.map((gridId) => {
        const grid = asRecord(grids[String(gridId)] ?? grids[gridId]);
        if (!grid) {
          throw new Error('WEP_WORLD_ROOT_GRID_MISSING');
        }
        if (
          safeInteger(grid.ID, 'WEP_WORLD_GRID_ID_INVALID') !== gridId
        ) {
          throw new Error('WEP_WORLD_GRID_KEY_ID_MISMATCH');
        }

        const objects = asRecord(grid.Objects) ?? {};
        return {
          gridId,
          gridDataPath:
            typeof grid.GridDataPath === 'string'
              ? grid.GridDataPath
              : null,
          gridDefaultLayoutPath:
            typeof grid.GridDefaultLayoutPath === 'string'
              ? grid.GridDefaultLayoutPath
              : null,
          tessellationFactor: safeInteger(
            grid.TessellationFactor ?? 1,
            'WEP_WORLD_GRID_TESSELLATION_INVALID'
          ),
          objectCount: Object.keys(objects).length
        };
      });

      routes.push({
        villageIndex,
        areaId,
        unlocked:
          typeof area.Unlocked === 'boolean' ? area.Unlocked : null,
        gridIds,
        roots
      });
    }
  });

  return routes.sort(
    (left, right) =>
      left.villageIndex - right.villageIndex ||
      left.areaId - right.areaId
  );
}

export async function openWorldSaveBytes(
  sourceBytes: Uint8Array,
  {
    sourcePlatform = PlatformFamily.Unknown
  }: {
    sourcePlatform?: string;
  } = {}
): Promise<OpenWorldSaveResult> {
  if (!(sourceBytes instanceof Uint8Array) || sourceBytes.length === 0) {
    throw new Error('WEP_WORLD_SAVE_INPUT_EMPTY');
  }

  const plain = decodePlainJson(sourceBytes);
  let inputFormat: WorldSaveInputFormat;
  let profile: Record<string, any>;

  if (plain !== null) {
    inputFormat = 'plain-json';
    profile = parseSafeJson(plain);
  } else {
    inputFormat = 'packaged';
    const decoded = await p1gPackagedProfileCodec.loadProfile(
      sourceBytes.slice()
    );
    profile = parseSafeJson(decoded.jsonText);
  }

  const profileSchemaVersion = requireCurrentProfile(profile);
  const saveIdentity = detectSaveIdentity(profile, {
    sourcePlatform:
      sourcePlatform === PlatformFamily.Switch ||
      sourcePlatform === PlatformFamily.SteamWindows
        ? sourcePlatform
        : PlatformFamily.Unknown
  });

  return {
    inputFormat,
    profile,
    profileSchemaVersion,
    saveIdentity,
    areas: listWorldAreaRoutes(profile),
    compatibility: {
      readContract: 'current-v125-schema624',
      gameVersion: WEP_WORLD_READ_GAME_VERSION,
      schemaMatched: true,
      exactBuildKnown: false,
      persistentWriteAuthorized: false
    }
  };
}
