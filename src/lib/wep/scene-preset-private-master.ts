export const SCENE_PRESET_PRIVATE_MASTER_SCHEMA =
  'dreamwish-wand-scene-preset-private-master@1';
export const SCENE_PRESET_PRIVATE_MASTER_STORAGE_KEY =
  'dreamwishwand:scene-preset:private-masters:v1';

export type ScenePresetPublicationRef = {
  presetArtifactId: string;
  presetRevisionId: string;
  workId: string;
  workRevisionId: string;
  galleryWorkId: string;
  galleryWorkRevisionId: string;
  checksumSha256: string;
  byteSize: number;
  publishedAt: string;
};

export type ScenePresetPrivateMaster = {
  schema: typeof SCENE_PRESET_PRIVATE_MASTER_SCHEMA;
  version: 1;
  masterId: string;
  presetType: 'scene';
  authoredTitle: string | null;
  artifact: any;
  publication: ScenePresetPublicationRef | null;
  changesNotPublished: boolean;
  createdAt: string;
  updatedAt: string;
  persistentWriteAuthorized: false;
  productApplyAuthorized: false;
  directSourceReplacementAuthorized: false;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function timestamp(value = new Date().toISOString()) {
  const parsed = new Date(value);
  assert(!Number.isNaN(parsed.getTime()), 'WEP_SCENE_MASTER_TIMESTAMP_INVALID');
  return parsed.toISOString();
}

function normalizeTitle(value: unknown) {
  const title = String(value ?? '').trim();
  return title ? title : null;
}

function normalizePublication(value: any): ScenePresetPublicationRef | null {
  if (value == null) return null;
  assert(value && typeof value === 'object', 'WEP_SCENE_MASTER_PUBLICATION_INVALID');
  const ids = [
    'presetArtifactId',
    'presetRevisionId',
    'workId',
    'workRevisionId',
    'galleryWorkId',
    'galleryWorkRevisionId'
  ] as const;
  for (const key of ids) {
    assert(String(value[key] ?? ''), 'WEP_SCENE_MASTER_PUBLICATION_ID_REQUIRED');
  }
  const checksumSha256 = String(value.checksumSha256 ?? '').toLowerCase();
  assert(/^[0-9a-f]{64}$/.test(checksumSha256), 'WEP_SCENE_MASTER_CHECKSUM_INVALID');
  const byteSize = Number(value.byteSize);
  assert(Number.isSafeInteger(byteSize) && byteSize > 0, 'WEP_SCENE_MASTER_BYTE_SIZE_INVALID');
  return {
    presetArtifactId: String(value.presetArtifactId),
    presetRevisionId: String(value.presetRevisionId),
    workId: String(value.workId),
    workRevisionId: String(value.workRevisionId),
    galleryWorkId: String(value.galleryWorkId),
    galleryWorkRevisionId: String(value.galleryWorkRevisionId),
    checksumSha256,
    byteSize,
    publishedAt: timestamp(String(value.publishedAt ?? ''))
  };
}

export function normalizeScenePresetPrivateMaster(
  value: unknown
): ScenePresetPrivateMaster {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'WEP_SCENE_MASTER_INVALID');
  const input = value as Record<string, any>;
  assert(input.schema === SCENE_PRESET_PRIVATE_MASTER_SCHEMA, 'WEP_SCENE_MASTER_SCHEMA_MISMATCH');
  assert(Number(input.version) === 1, 'WEP_SCENE_MASTER_VERSION_MISMATCH');
  assert(String(input.masterId ?? ''), 'WEP_SCENE_MASTER_ID_REQUIRED');
  assert(input.presetType === 'scene', 'WEP_SCENE_MASTER_TYPE_UNSUPPORTED');
  assert(input.artifact?.schema === 'dreamwish-wand-preset', 'WEP_SCENE_MASTER_ARTIFACT_INVALID');
  assert(input.artifact?.type === 'scene', 'WEP_SCENE_MASTER_ARTIFACT_TYPE_INVALID');
  assert(input.persistentWriteAuthorized === false, 'WEP_SCENE_MASTER_PERSISTENT_WRITE_FORBIDDEN');
  assert(input.productApplyAuthorized === false, 'WEP_SCENE_MASTER_PRODUCT_APPLY_FORBIDDEN');
  assert(input.directSourceReplacementAuthorized === false, 'WEP_SCENE_MASTER_SOURCE_REPLACEMENT_FORBIDDEN');

  return Object.freeze({
    schema: SCENE_PRESET_PRIVATE_MASTER_SCHEMA,
    version: 1 as const,
    masterId: String(input.masterId),
    presetType: 'scene' as const,
    authoredTitle: normalizeTitle(input.authoredTitle),
    artifact: clone(input.artifact),
    publication: normalizePublication(input.publication),
    changesNotPublished: input.changesNotPublished === true,
    createdAt: timestamp(String(input.createdAt ?? '')),
    updatedAt: timestamp(String(input.updatedAt ?? '')),
    persistentWriteAuthorized: false as const,
    productApplyAuthorized: false as const,
    directSourceReplacementAuthorized: false as const
  });
}

function readAll(storage: StorageLike): ScenePresetPrivateMaster[] {
  const raw = storage.getItem(SCENE_PRESET_PRIVATE_MASTER_STORAGE_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('WEP_SCENE_MASTER_STORE_JSON_INVALID');
  }
  assert(Array.isArray(parsed), 'WEP_SCENE_MASTER_STORE_INVALID');
  return parsed.map(normalizeScenePresetPrivateMaster);
}

function writeAll(storage: StorageLike, masters: ScenePresetPrivateMaster[]) {
  storage.setItem(
    SCENE_PRESET_PRIVATE_MASTER_STORAGE_KEY,
    JSON.stringify(masters.map((entry) => normalizeScenePresetPrivateMaster(entry)))
  );
}

export function listScenePresetPrivateMasters(storage: StorageLike) {
  return readAll(storage).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getScenePresetPrivateMaster(
  storage: StorageLike,
  masterId: string
) {
  return readAll(storage).find((entry) => entry.masterId === String(masterId)) ?? null;
}

export function saveScenePresetPrivateMaster(
  storage: StorageLike,
  {
    artifact,
    masterId = null,
    authoredTitle = null,
    now = new Date().toISOString()
  }: {
    artifact: any;
    masterId?: string | null;
    authoredTitle?: string | null;
    now?: string;
  }
) {
  assert(artifact?.schema === 'dreamwish-wand-preset', 'WEP_SCENE_MASTER_ARTIFACT_INVALID');
  assert(artifact?.type === 'scene', 'WEP_SCENE_MASTER_ARTIFACT_TYPE_INVALID');

  const all = readAll(storage);
  const existing = masterId
    ? all.find((entry) => entry.masterId === String(masterId)) ?? null
    : null;
  const id = existing?.masterId ?? String(masterId || crypto.randomUUID());
  const stamp = timestamp(now);

  const next = normalizeScenePresetPrivateMaster({
    schema: SCENE_PRESET_PRIVATE_MASTER_SCHEMA,
    version: 1,
    masterId: id,
    presetType: 'scene',
    authoredTitle: normalizeTitle(authoredTitle),
    artifact: clone(artifact),
    publication: existing?.publication ?? null,
    changesNotPublished: Boolean(existing?.publication),
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
    persistentWriteAuthorized: false,
    productApplyAuthorized: false,
    directSourceReplacementAuthorized: false
  });

  writeAll(storage, [...all.filter((entry) => entry.masterId !== id), next]);
  return next;
}

export function recordScenePresetPublication(
  storage: StorageLike,
  masterId: string,
  publication: ScenePresetPublicationRef,
  now = new Date().toISOString()
) {
  const all = readAll(storage);
  const existing = all.find((entry) => entry.masterId === String(masterId));
  assert(existing, 'WEP_SCENE_MASTER_NOT_FOUND');

  const next = normalizeScenePresetPrivateMaster({
    ...existing,
    publication: normalizePublication(publication),
    changesNotPublished: false,
    updatedAt: timestamp(now)
  });
  writeAll(storage, [...all.filter((entry) => entry.masterId !== existing.masterId), next]);
  return next;
}

export function removeScenePresetPrivateMaster(
  storage: StorageLike,
  masterId: string
) {
  const all = readAll(storage);
  const next = all.filter((entry) => entry.masterId !== String(masterId));
  writeAll(storage, next);
  return next.length !== all.length;
}
