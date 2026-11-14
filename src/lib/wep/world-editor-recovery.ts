import type { EditorDocument } from './editor-runtime';

export const WORLD_EDITOR_RECOVERY_SCHEMA = 'dreamwish-wand-world-editor-recovery@1';
export const WORLD_EDITOR_RECOVERY_INDEX_KEY = 'dreamwishwand:world-editor:recovery:index:v1';
const PREFIX = 'dreamwishwand:world-editor:recovery:v1:';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type RecoveryTarget = {
  platform: string;
  gameVersion: string;
  profileSchemaVersion: number;
};

export type RecoveryRouteSnapshot = {
  routeKey: string;
  session: Record<string, unknown>;
  savedAt: string;
};

export type WorldEditorRecoveryRecord = {
  schema: typeof WORLD_EDITOR_RECOVERY_SCHEMA;
  version: 1;
  sourceFingerprint: string;
  sourceName: string | null;
  target: RecoveryTarget;
  activeRouteKey: string;
  routes: Record<string, RecoveryRouteSnapshot>;
  savedAt: string;
  persistentWriteAuthorized: false;
  WORLD_PERSISTENT_WRITE_V125: false;
  PERSISTENT_WRITE: false;
  productApplyAuthorized: false;
  directSourceReplacementAuthorized: false;
};

let activeMemory: null | {
  sourceFingerprint: string;
  sourceBytes: Uint8Array;
  worldSource: unknown;
  originalSaveBackup: unknown;
  activeDraftRecord: WorldEditorRecoveryRecord | null;
} = null;

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function normalizeFingerprint(value: unknown) {
  const text = String(value ?? '').toLowerCase();
  assert(/^[0-9a-f]{64}$/.test(text), 'WEP_RECOVERY_FINGERPRINT_INVALID');
  return text;
}

function normalizeTarget(value: any): RecoveryTarget {
  assert(value && typeof value === 'object', 'WEP_RECOVERY_TARGET_INVALID');
  const target = {
    platform: String(value.platform ?? ''),
    gameVersion: String(value.gameVersion ?? ''),
    profileSchemaVersion: Number(value.profileSchemaVersion)
  };
  assert(target.platform, 'WEP_RECOVERY_PLATFORM_REQUIRED');
  assert(target.gameVersion, 'WEP_RECOVERY_VERSION_REQUIRED');
  assert(Number.isSafeInteger(target.profileSchemaVersion), 'WEP_RECOVERY_SCHEMA_VERSION_INVALID');
  return target;
}

export async function sha256Fingerprint(bytes: Uint8Array) {
  assert(globalThis.crypto?.subtle, 'WEP_RECOVERY_SHA256_UNAVAILABLE');
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer
  );
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0')
  ).join('');
}

function keyFor(fingerprint: string) {
  return PREFIX + normalizeFingerprint(fingerprint);
}

function validRouteKey(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 &&
    !Object.hasOwn(Object.prototype, value) &&
    value !== '__proto__' && value !== 'prototype' && value !== 'constructor';
}

function normalizeSnapshot(value: any): RecoveryRouteSnapshot {
  assert(value && typeof value === 'object', 'WEP_RECOVERY_ROUTE_INVALID');
  const routeKey = value.routeKey;
  assert(validRouteKey(routeKey), 'WEP_RECOVERY_ROUTE_KEY_REQUIRED');
  assert(value.session && typeof value.session === 'object', 'WEP_RECOVERY_SESSION_REQUIRED');
  const savedAt = new Date(value.savedAt ?? '').toISOString();
  return {
    routeKey,
    session: structuredClone(value.session),
    savedAt
  };
}

export function normalizeRecoveryRecord(value: unknown): WorldEditorRecoveryRecord {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'WEP_RECOVERY_INVALID');
  const input = value as any;
  assert(input.schema === WORLD_EDITOR_RECOVERY_SCHEMA, 'WEP_RECOVERY_SCHEMA_MISMATCH');
  assert(Number(input.version) === 1, 'WEP_RECOVERY_VERSION_MISMATCH');
  for (const key of [
    'persistentWriteAuthorized',
    'WORLD_PERSISTENT_WRITE_V125',
    'PERSISTENT_WRITE',
    'productApplyAuthorized',
    'directSourceReplacementAuthorized'
  ]) {
    assert(input[key] === false, 'WEP_RECOVERY_SAFETY_FLAG_INVALID');
  }
  assert(
    input.routes !== null && typeof input.routes === 'object' &&
      !Array.isArray(input.routes) &&
      (Object.getPrototypeOf(input.routes) === Object.prototype ||
        Object.getPrototypeOf(input.routes) === null),
    'WEP_RECOVERY_ROUTES_INVALID'
  );
  const routes: Record<string, RecoveryRouteSnapshot> = {};
  for (const [key, route] of Object.entries(input.routes)) {
    assert(validRouteKey(key), 'WEP_RECOVERY_ROUTE_KEY_REQUIRED');
    const normalized = normalizeSnapshot(route);
    assert(normalized.routeKey === key, 'WEP_RECOVERY_ROUTE_INDEX_MISMATCH');
    routes[key] = normalized;
  }
  const activeRouteKey = input.activeRouteKey;
  assert(
    validRouteKey(activeRouteKey) && Object.hasOwn(routes, activeRouteKey),
    'WEP_RECOVERY_ACTIVE_ROUTE_INVALID'
  );
  return {
    schema: WORLD_EDITOR_RECOVERY_SCHEMA,
    version: 1,
    sourceFingerprint: normalizeFingerprint(input.sourceFingerprint),
    sourceName: input.sourceName == null ? null : String(input.sourceName),
    target: normalizeTarget(input.target),
    activeRouteKey,
    routes,
    savedAt: new Date(input.savedAt ?? '').toISOString(),
    persistentWriteAuthorized: false,
    WORLD_PERSISTENT_WRITE_V125: false,
    PERSISTENT_WRITE: false,
    productApplyAuthorized: false,
    directSourceReplacementAuthorized: false
  };
}

function readIndex(storage: StorageLike) {
  try {
    const parsed = JSON.parse(storage.getItem(WORLD_EDITOR_RECOVERY_INDEX_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value))
      : [];
  } catch {
    return [];
  }
}

// Checkpoint must never replace an unreadable index with a fresh empty index.
function readCheckpointIndex(storage: StorageLike) {
  const raw = storage.getItem(WORLD_EDITOR_RECOVERY_INDEX_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('WEP_RECOVERY_INDEX_INVALID');
  }
  assert(
    Array.isArray(parsed) &&
      parsed.length <= 20 &&
      parsed.every((value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)) &&
      new Set(parsed).size === parsed.length,
    'WEP_RECOVERY_INDEX_INVALID'
  );
  return parsed as string[];
}

function writeIndex(storage: StorageLike, fingerprints: string[]) {
  storage.setItem(
    WORLD_EDITOR_RECOVERY_INDEX_KEY,
    JSON.stringify(Array.from(new Set(fingerprints)).slice(-20))
  );
}

export function createRecoveryRecord(
  {
    sourceFingerprint,
    sourceName = null,
    target,
    routeKey,
    sessionSnapshot,
    existing = null,
    now = new Date().toISOString()
  }: {
    sourceFingerprint: string;
    sourceName?: string | null;
    target: RecoveryTarget;
    routeKey: string;
    sessionSnapshot: Record<string, unknown>;
    existing?: WorldEditorRecoveryRecord | null;
    now?: string;
  }
) {
  const fingerprint = normalizeFingerprint(sourceFingerprint);
  const route = normalizeSnapshot({
    routeKey,
    session: sessionSnapshot,
    savedAt: now
  });
  return normalizeRecoveryRecord({
    schema: WORLD_EDITOR_RECOVERY_SCHEMA,
    version: 1,
    sourceFingerprint: fingerprint,
    sourceName,
    target: normalizeTarget(target),
    activeRouteKey: route.routeKey,
    routes: {
      ...(existing?.routes ?? {}),
      [route.routeKey]: route
    },
    savedAt: new Date(now).toISOString(),
    persistentWriteAuthorized: false,
    WORLD_PERSISTENT_WRITE_V125: false,
    PERSISTENT_WRITE: false,
    productApplyAuthorized: false,
    directSourceReplacementAuthorized: false
  });
}

export function saveRecoveryRoute(
  storage: StorageLike,
  {
    sourceFingerprint,
    sourceName = null,
    target,
    routeKey,
    sessionSnapshot,
    now = new Date().toISOString()
  }: {
    sourceFingerprint: string;
    sourceName?: string | null;
    target: RecoveryTarget;
    routeKey: string;
    sessionSnapshot: Record<string, unknown>;
    now?: string;
  }
) {
  const fingerprint = normalizeFingerprint(sourceFingerprint);
  let existing: WorldEditorRecoveryRecord | null = null;
  const raw = storage.getItem(keyFor(fingerprint));
  const index = readCheckpointIndex(storage);
  if (raw !== null) {
    try {
      existing = normalizeRecoveryRecord(JSON.parse(raw));
    } catch {
      // A broken recovery is evidence and may be recoverable offline.
      // Never replace it merely because a new checkpoint was attempted.
      throw new Error('WEP_RECOVERY_EXISTING_RECORD_INVALID');
    }
    assert(
      recoveryCompatible(existing, fingerprint, target),
      'WEP_RECOVERY_EXISTING_TARGET_MISMATCH'
    );
  } else {
    assert(!index.includes(fingerprint), 'WEP_RECOVERY_INDEX_RECORD_MISSING');
  }
  const record = createRecoveryRecord({
    sourceFingerprint: fingerprint,
    sourceName,
    target,
    routeKey,
    sessionSnapshot,
    existing,
    now
  });
  storage.setItem(keyFor(fingerprint), JSON.stringify(record));
  writeIndex(storage, [...index, fingerprint]);
  return record;
}

export function listRecoveryRecords(storage: StorageLike) {
  const records: WorldEditorRecoveryRecord[] = [];
  for (const fingerprint of readIndex(storage)) {
    const raw = storage.getItem(keyFor(fingerprint));
    if (!raw) continue;
    try {
      records.push(normalizeRecoveryRecord(JSON.parse(raw)));
    } catch {
      // Corrupt local recovery is never silently resumed.
    }
  }
  return records.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function getRecoveryRecord(storage: StorageLike, fingerprint: string) {
  const raw = storage.getItem(keyFor(fingerprint));
  if (!raw) return null;
  try {
    return normalizeRecoveryRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function recoveryCompatible(
  record: WorldEditorRecoveryRecord,
  fingerprint: string,
  target: RecoveryTarget
) {
  const normalizedTarget = normalizeTarget(target);
  return (
    record.sourceFingerprint === normalizeFingerprint(fingerprint) &&
    record.target.platform === normalizedTarget.platform &&
    record.target.gameVersion === normalizedTarget.gameVersion &&
    record.target.profileSchemaVersion === normalizedTarget.profileSchemaVersion
  );
}

export function discardRecovery(storage: StorageLike, fingerprint: string) {
  const normalized = normalizeFingerprint(fingerprint);
  storage.removeItem(keyFor(normalized));
  writeIndex(storage, readIndex(storage).filter((value) => value !== normalized));
}

export function setActiveWorldEditorMemory(input: {
  sourceFingerprint: string;
  sourceBytes: Uint8Array;
  worldSource: unknown;
  originalSaveBackup: unknown;
  activeDraftRecord?: WorldEditorRecoveryRecord | null;
}) {
  activeMemory = {
    sourceFingerprint: normalizeFingerprint(input.sourceFingerprint),
    sourceBytes: input.sourceBytes.slice(),
    worldSource: input.worldSource,
    originalSaveBackup: input.originalSaveBackup,
    activeDraftRecord:
      input.activeDraftRecord === undefined
        ? null
        : input.activeDraftRecord
          ? normalizeRecoveryRecord(input.activeDraftRecord)
          : null
  };
}

export function setActiveWorldEditorDraftRecord(
  record: WorldEditorRecoveryRecord | null
) {
  if (!activeMemory) {
    throw new Error('WEP_RECOVERY_ACTIVE_SOURCE_MEMORY_REQUIRED');
  }
  activeMemory.activeDraftRecord = record
    ? normalizeRecoveryRecord(record)
    : null;
}

export function getActiveWorldEditorMemory() {
  if (!activeMemory) return null;
  return {
    ...activeMemory,
    sourceBytes: activeMemory.sourceBytes.slice()
  };
}

export function clearActiveWorldEditorMemory() {
  activeMemory = null;
}

export function routeKeyForDocument(document: EditorDocument) {
  const target = document?.target ?? {};
  if (target.kind === 'PLAYER_HOUSE_ROOM') {
    return [
      String(target.platform ?? ''),
      String(target.gameVersion ?? ''),
      'PLAYER_HOUSE_ROOM',
      String(target.houseItemId ?? ''),
      String(target.floorIndex ?? ''),
      String(target.roomSlot ?? '')
    ].join('|');
  }
  return [
    String(target.platform ?? ''),
    String(target.gameVersion ?? ''),
    String(target.rootGridId ?? ''),
    String(target.gridDataPath ?? '')
  ].join('|');
}
