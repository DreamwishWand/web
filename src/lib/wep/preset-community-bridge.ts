type JsonObject = Record<string, any>;

export interface PresetCommunityEdgeResult<T = unknown> {
  ok: boolean;
  data?: T;
  [key: string]: unknown;
}

export interface PresetCommunityTransport {
  preset<T = unknown>(
    action: string,
    payload?: Record<string, unknown>
  ): Promise<PresetCommunityEdgeResult<T>>;
  command<T = unknown>(
    command: string,
    payload: Record<string, unknown>
  ): Promise<PresetCommunityEdgeResult<T>>;
  query<T = unknown>(
    query: string,
    payload?: Record<string, unknown>
  ): Promise<PresetCommunityEdgeResult<T>>;
  searchPublicWorks(options?: Record<string, unknown>): Promise<JsonObject[]>;
}

export interface WepPresetHooks {
  buildPublishEnvelope(artifact: unknown): any;
  validatePublishablePreset(artifact: unknown): any;
  preflightScene(artifact: unknown, options?: Record<string, unknown>): any;
}

export interface PresetCommunityBridgeOptions {
  community: PresetCommunityTransport;
  hooks: WepPresetHooks;
  fetchImpl?: typeof fetch;
}

export interface PublishSceneOptions {
  artifact: unknown;
  creatorProfileId: string;
  title: string;
  description?: string | null;
  mediaIds: string[];
  metadata?: Record<string, unknown>;
  presetArtifactId?: string | null;
  expectedPresetRevisionId?: string | null;
  idempotencyKey: string;
}

export interface DiscoveryOptions {
  query?: string | null;
  creatorProfileId?: string | null;
  tags?: string[] | null;
  limit?: number;
  beforePublishedAt?: string | null;
  beforeWorkId?: string | null;
}

export class WepPresetBridgeError extends Error {
  readonly issues: unknown[];

  constructor(code: string, issues: unknown[] = []) {
    super(code);
    this.name = 'WepPresetBridgeError';
    this.issues = issues;
  }
}

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new WepPresetBridgeError(code);
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function dataOf(value: any): any {
  return isObject(value) && 'data' in value ? value.data : value;
}

function presetOf(value: any): any {
  return isObject(value) && isObject(value.preset) ? value.preset : value;
}

function requireId(value: any, key: string, code: string): string {
  const id = String(value?.[key] ?? '');
  assert(id, code);
  return id;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  assert(subtle, 'WEP_PRESET_BRIDGE_CRYPTO_UNAVAILABLE');
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

async function requireOk(response: Response): Promise<Response> {
  assert(
    response && typeof response.ok === 'boolean',
    'WEP_PRESET_BRIDGE_HTTP_RESPONSE_INVALID'
  );
  if (response.ok) return response;

  let detail = '';
  try {
    detail = await response.text();
  } catch {
    detail = '';
  }

  throw new WepPresetBridgeError(
    'WEP_PRESET_BRIDGE_HTTP_' +
      String(Number(response.status) || 0) +
      (detail ? ':' + detail : '')
  );
}

function requireCommunityClient(
  community: PresetCommunityTransport
): void {
  for (const method of ['preset', 'command', 'query', 'searchPublicWorks'] as const) {
    assert(
      typeof community?.[method] === 'function',
      'WEP_PRESET_BRIDGE_COMMUNITY_' + method.toUpperCase() + '_REQUIRED'
    );
  }
}

function requireHooks(hooks: WepPresetHooks): void {
  for (const method of [
    'buildPublishEnvelope',
    'validatePublishablePreset',
    'preflightScene'
  ] as const) {
    assert(
      typeof hooks?.[method] === 'function',
      'WEP_PRESET_BRIDGE_HOOK_' + method.toUpperCase() + '_REQUIRED'
    );
  }
}

export function createPresetCommunityBridge({
  community,
  hooks,
  fetchImpl = globalThis.fetch
}: PresetCommunityBridgeOptions) {
  requireCommunityClient(community);
  requireHooks(hooks);
  assert(typeof fetchImpl === 'function', 'WEP_PRESET_BRIDGE_FETCH_REQUIRED');

  async function publishScene({
    artifact,
    creatorProfileId,
    title,
    description = null,
    mediaIds,
    metadata = {},
    presetArtifactId = null,
    expectedPresetRevisionId = null,
    idempotencyKey
  }: PublishSceneOptions) {
    const preparedEnvelope = hooks.buildPublishEnvelope(artifact);
    if (!preparedEnvelope?.ok) {
      throw new WepPresetBridgeError(
        'WEP_PRESET_NOT_PUBLISHABLE',
        preparedEnvelope?.issues ?? []
      );
    }

    assert(preparedEnvelope.presetType === 'scene', 'WEP_PRESET_TYPE_NOT_SCENE');
    assert(Number(preparedEnvelope.schemaVersion) === 1, 'WEP_PRESET_SCHEMA_VERSION_UNSUPPORTED');
    assert(String(creatorProfileId), 'WEP_PRESET_CREATOR_REQUIRED');
    assert(String(title).trim(), 'WEP_PRESET_TITLE_REQUIRED');
    assert(Array.isArray(mediaIds) && mediaIds.length > 0, 'WEP_PRESET_PUBLIC_IMAGE_REQUIRED');
    assert(mediaIds.length <= 10, 'WEP_PRESET_PUBLIC_IMAGE_LIMIT');
    const normalizedMediaIds = mediaIds.map(String).filter(Boolean);
    assert(normalizedMediaIds.length === mediaIds.length, 'WEP_PRESET_PUBLIC_IMAGE_ID_INVALID');
    assert(new Set(normalizedMediaIds).size === normalizedMediaIds.length, 'WEP_PRESET_PUBLIC_IMAGE_DUPLICATE');
    assert((presetArtifactId == null) === (expectedPresetRevisionId == null), 'WEP_PRESET_PUBLISH_UPDATE_IDENTITY_INCOMPLETE');
    assert(String(idempotencyKey).trim(), 'WEP_PRESET_IDEMPOTENCY_KEY_REQUIRED');

    const prepare: any = await community.preset('prepare', {
      byteSize: preparedEnvelope.envelope.byteSize
    });
    const storageKey = requireId(
      prepare,
      'storageKey',
      'WEP_PRESET_PREPARE_STORAGE_KEY_MISSING'
    );
    const signedUrl = String(prepare?.signedUpload?.signedUrl ?? '');
    assert(signedUrl, 'WEP_PRESET_PREPARE_SIGNED_URL_MISSING');

    const form = new FormData();
    form.append('cacheControl', '3600');
    form.append(
      '',
      new Blob([preparedEnvelope.envelope.json], {
        type: 'application/json'
      }),
      'preset.json'
    );

    await requireOk(
      await fetchImpl(signedUrl, {
        method: 'PUT',
        headers: { 'x-upsert': 'false' },
        body: form
      })
    );

    let published: any;
    try {
      published = await community.preset('publish', {
        storageKey,
        creatorProfileId: String(creatorProfileId),
        title: String(title).trim(),
        description: description == null ? null : String(description),
        mediaIds: normalizedMediaIds,
        metadata: isObject(metadata) ? metadata : {},
        presetArtifactId: presetArtifactId ? String(presetArtifactId) : null,
        expectedPresetRevisionId: expectedPresetRevisionId ? String(expectedPresetRevisionId) : null,
        idempotencyKey: String(idempotencyKey).trim()
      });
    } catch (error) {
      try {
        await community.preset('discard', { storageKey });
      } catch {
        // Best effort only. Registered artifacts cannot be discarded.
      }
      throw error;
    }

    const data = dataOf(published) ?? {};
    const nextPresetArtifactId = requireId(
      data,
      'presetArtifactId',
      'WEP_PRESET_PUBLISH_ARTIFACT_ID_MISSING'
    );
    const nextPresetRevisionId = requireId(
      data,
      'presetRevisionId',
      'WEP_PRESET_PUBLISH_REVISION_ID_MISSING'
    );
    const presetWorkId = requireId(
      data,
      'presetWorkId',
      'WEP_PRESET_PUBLISH_WORK_ID_MISSING'
    );
    const presetWorkRevisionId = requireId(
      data,
      'presetWorkRevisionId',
      'WEP_PRESET_PUBLISH_WORK_REVISION_ID_MISSING'
    );
    const galleryWorkId = requireId(
      data,
      'galleryWorkId',
      'WEP_PRESET_PUBLISH_GALLERY_WORK_ID_MISSING'
    );
    const galleryRevisionId = requireId(
      data,
      'galleryRevisionId',
      'WEP_PRESET_PUBLISH_GALLERY_REVISION_ID_MISSING'
    );

    if (presetArtifactId) {
      assert(nextPresetArtifactId === String(presetArtifactId), 'WEP_PRESET_PUBLISH_UPDATE_ARTIFACT_CHANGED');
      assert(nextPresetRevisionId !== String(expectedPresetRevisionId), 'WEP_PRESET_PUBLISH_UPDATE_REVISION_NOT_ADVANCED');
    }

    return {
      presetArtifactId: nextPresetArtifactId,
      presetRevisionId: nextPresetRevisionId,
      presetWorkId,
      presetWorkRevisionId,
      galleryWorkId,
      galleryRevisionId,
      workId: presetWorkId,
      workRevisionId: presetWorkRevisionId,
      revisionNumber: Number(data.revisionNumber ?? 0),
      storageKey: String(data.storageKey ?? ''),
      checksumSha256: String(data.checksumSha256 ?? ''),
      byteSize: Number(data.byteSize ?? preparedEnvelope.envelope.byteSize),
      schemaVersion: Number(data.schemaVersion ?? preparedEnvelope.schemaVersion)
    };
  }

  async function discover({
    query = null,
    creatorProfileId = null,
    tags = null,
    limit = 20,
    beforePublishedAt = null,
    beforeWorkId = null
  }: DiscoveryOptions = {}) {
    const rows = await community.searchPublicWorks({
      query,
      workType: 'preset',
      creatorProfileId,
      tags,
      limit,
      beforePublishedAt,
      beforeWorkId
    });

    assert(Array.isArray(rows), 'WEP_PRESET_DISCOVERY_RESULT_INVALID');

    return rows
      .map((row: JsonObject) => ({
        workId: String(row.work_id ?? row.workId ?? ''),
        creatorProfileId: String(
          row.creator_profile_id ?? row.creatorProfileId ?? ''
        ),
        title: String(row.title ?? ''),
        description: String(row.text_content ?? row.description ?? ''),
        tags: Array.isArray(row.tags) ? row.tags : [],
        facets: isObject(row.facets) ? row.facets : {},
        publishedAt: row.published_at ?? row.publishedAt ?? null
      }))
      .filter((row) => row.workId);
  }

  async function resolveDiscoveredWork(workId: string) {
    assert(String(workId), 'WEP_PRESET_WORK_ID_REQUIRED');

    const resolved: any = await community.preset('resolveWork', {
      workId: String(workId)
    });
    const preset = presetOf(resolved) ?? {};

    return {
      workId: String(workId),
      presetArtifactId: requireId(
        preset,
        'presetArtifactId',
        'WEP_PRESET_RESOLVE_ARTIFACT_ID_MISSING'
      ),
      presetRevisionId: requireId(
        preset,
        'presetRevisionId',
        'WEP_PRESET_RESOLVE_REVISION_ID_MISSING'
      ),
      presetType: String(preset.presetType ?? ''),
      schemaVersion: Number(preset.schemaVersion ?? 0),
      byteSize: Number(preset.byteSize ?? 0),
      checksumSha256: String(preset.checksumSha256 ?? '')
    };
  }

  async function saveToLibrary(presetArtifactId: string) {
    assert(String(presetArtifactId), 'WEP_PRESET_ARTIFACT_ID_REQUIRED');
    return community.command('saveEntity', {
      targetEntityId: String(presetArtifactId)
    });
  }

  async function removeFromLibrary(presetArtifactId: string) {
    assert(String(presetArtifactId), 'WEP_PRESET_ARTIFACT_ID_REQUIRED');
    return community.command('unsaveEntity', {
      targetEntityId: String(presetArtifactId)
    });
  }

  async function listLibrary(limit = 50) {
    const result = await community.query('saved', { limit });
    const data = dataOf(result);
    assert(Array.isArray(data), 'WEP_PRESET_LIBRARY_RESULT_INVALID');

    return data
      .map((entry: JsonObject) => ({
        targetEntityId: String(entry.targetEntityId ?? ''),
        savedAt: entry.savedAt ?? null,
        accessible: entry.accessible === true
      }))
      .filter((entry) => entry.targetEntityId);
  }

  async function loadPreset(
    presetArtifactId: string,
    { expectedPresetRevisionId = null }: { expectedPresetRevisionId?: string | null } = {}
  ) {
    assert(String(presetArtifactId), 'WEP_PRESET_ARTIFACT_ID_REQUIRED');

    const [detailResult, readResult] = await Promise.all([
      community.query('preset', {
        presetArtifactId: String(presetArtifactId)
      }),
      community.preset(
        'read',
        expectedPresetRevisionId
          ? { presetRevisionId: String(expectedPresetRevisionId) }
          : { presetArtifactId: String(presetArtifactId) }
      )
    ]);

    const detail = dataOf(detailResult) ?? {};
    const read = presetOf(readResult) ?? {};

    const detailArtifactId = String(detail.presetArtifactId ?? '');
    const detailRevisionId = String(detail.presetRevisionId ?? '');
    const readArtifactId = String(read.presetArtifactId ?? '');
    const readRevisionId = String(read.presetRevisionId ?? '');
    assert(detailArtifactId === String(presetArtifactId), 'WEP_PRESET_DETAIL_ID_MISMATCH');
    assert(readArtifactId === String(presetArtifactId), 'WEP_PRESET_READ_ID_MISMATCH');
    assert(detailRevisionId && readRevisionId, 'WEP_PRESET_REVISION_ID_MISSING');
    if (expectedPresetRevisionId) {
      assert(detailRevisionId === String(expectedPresetRevisionId), 'WEP_PRESET_REVISION_CHANGED');
      assert(readRevisionId === String(expectedPresetRevisionId), 'WEP_PRESET_READ_REVISION_MISMATCH');
    } else {
      assert(readRevisionId === detailRevisionId, 'WEP_PRESET_READ_REVISION_MISMATCH');
    }

    const readBlobId = String(read.blobId ?? '');
    const readStorageKey = String(read.storageKey ?? '');
    assert(readBlobId, 'WEP_PRESET_READ_BLOB_ID_MISSING');
    assert(/^published\/[^/]+\/[0-9a-f]{64}\.json$/i.test(readStorageKey), 'WEP_PRESET_READ_STORAGE_KEY_INVALID');

    const detailSchemaVersion = Number(detail.schemaVersion ?? 0);
    const readSchemaVersion = Number(read.schemaVersion ?? 0);
    assert(detailSchemaVersion === 1 && readSchemaVersion === 1, 'WEP_PRESET_SCHEMA_VERSION_UNSUPPORTED');
    assert(readSchemaVersion === detailSchemaVersion, 'WEP_PRESET_METADATA_SCHEMA_MISMATCH');

    const detailContentType = String(detail.contentType ?? '');
    const readContentType = String(read.contentType ?? '');
    assert(detailContentType === 'application/json' && readContentType === 'application/json', 'WEP_PRESET_CONTENT_TYPE_UNSUPPORTED');
    assert(readContentType === detailContentType, 'WEP_PRESET_METADATA_CONTENT_TYPE_MISMATCH');

    const detailByteSize = Number(detail.byteSize ?? 0);
    const readByteSize = Number(read.byteSize ?? 0);
    assert(Number.isSafeInteger(detailByteSize) && detailByteSize > 0, 'WEP_PRESET_DETAIL_BYTE_SIZE_INVALID');
    assert(readByteSize === detailByteSize, 'WEP_PRESET_METADATA_BYTE_SIZE_MISMATCH');

    const detailChecksum = String(detail.checksumSha256 ?? '').toLowerCase();
    const readChecksum = String(read.checksumSha256 ?? '').toLowerCase();
    assert(/^[0-9a-f]{64}$/.test(detailChecksum), 'WEP_PRESET_DETAIL_CHECKSUM_INVALID');
    assert(readChecksum === detailChecksum, 'WEP_PRESET_METADATA_CHECKSUM_MISMATCH');

    assert(String(detail.presetType ?? '') === 'scene', 'WEP_PRESET_DETAIL_TYPE_MISMATCH');
    assert(String(read.presetType ?? '') === 'scene', 'WEP_PRESET_READ_TYPE_MISMATCH');

    const signedUrl = String(read.signedUrl ?? '');
    assert(signedUrl, 'WEP_PRESET_READ_SIGNED_URL_MISSING');
    const response = await requireOk(await fetchImpl(signedUrl, { method: 'GET' }));
    const bytes = await response.arrayBuffer();
    assert(bytes.byteLength === readByteSize, 'WEP_PRESET_READ_BYTE_SIZE_MISMATCH');

    const checksum = await sha256Hex(bytes);
    assert(checksum === readChecksum, 'WEP_PRESET_READ_CHECKSUM_MISMATCH');

    let artifact: unknown;
    try {
      artifact = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      throw new WepPresetBridgeError('WEP_PRESET_READ_JSON_INVALID');
    }

    const validation = hooks.validatePublishablePreset(artifact);
    if (!validation?.ok) {
      throw new WepPresetBridgeError(
        'WEP_PRESET_READ_ARTIFACT_INVALID',
        validation?.issues ?? []
      );
    }
    assert(validation.presetType === 'scene', 'WEP_PRESET_READ_TYPE_MISMATCH');
    assert(Number(validation.schemaVersion) === readSchemaVersion, 'WEP_PRESET_READ_SCHEMA_MISMATCH');

    return {
      artifact,
      validation,
      detail,
      read,
      authoritative: {
        presetArtifactId: readArtifactId,
        presetRevisionId: readRevisionId,
        blobId: readBlobId,
        storageKey: readStorageKey,
        schemaVersion: readSchemaVersion,
        contentType: readContentType,
        byteSize: readByteSize,
        checksumSha256: readChecksum
      },
      checksumSha256: checksum,
      byteSize: readByteSize
    };
  }

  async function loadDiscoveredWork(workId: string) {
    const resolved = await resolveDiscoveredWork(workId);
    return {
      ...resolved,
      loaded: await loadPreset(resolved.presetArtifactId)
    };
  }

  async function saveDiscoveredWork(workId: string) {
    const resolved = await resolveDiscoveredWork(workId);
    return {
      ...resolved,
      saved: await saveToLibrary(resolved.presetArtifactId)
    };
  }

  async function preflightPreset(
    presetArtifactId: string,
    options: Record<string, unknown> = {}
  ) {
    const expectedPresetRevisionId =
      options.expectedPresetRevisionId == null ? null : String(options.expectedPresetRevisionId);
    const preflightOptions = { ...options };
    delete preflightOptions.expectedPresetRevisionId;
    const loaded = await loadPreset(presetArtifactId, { expectedPresetRevisionId });

    assert(
      loaded.validation.presetType === 'scene',
      'WEP_PRESET_PREFLIGHT_TYPE_UNSUPPORTED'
    );

    return {
      ...loaded,
      preflight: hooks.preflightScene(loaded.artifact, preflightOptions)
    };
  }

  async function changeLifecycle(
    presetArtifactId: string,
    expectedPresetRevisionId: string,
    lifecycleAction: 'unpublish' | 'delete',
    idempotencyKey: string
  ) {
    assert(String(presetArtifactId), 'WEP_PRESET_ARTIFACT_ID_REQUIRED');
    assert(String(expectedPresetRevisionId), 'WEP_PRESET_REVISION_ID_REQUIRED');
    assert(['unpublish','delete'].includes(lifecycleAction), 'WEP_PRESET_LIFECYCLE_ACTION_UNSUPPORTED');
    assert(String(idempotencyKey).trim(), 'WEP_PRESET_IDEMPOTENCY_KEY_REQUIRED');
    return community.preset('lifecycle', {
      presetArtifactId: String(presetArtifactId),
      expectedPresetRevisionId: String(expectedPresetRevisionId),
      lifecycleAction,
      idempotencyKey: String(idempotencyKey).trim()
    });
  }

  return Object.freeze({
    publishScene,
    discover,
    resolveDiscoveredWork,
    saveToLibrary,
    removeFromLibrary,
    listLibrary,
    loadPreset,
    loadDiscoveredWork,
    saveDiscoveredWork,
    preflightPreset,
    changeLifecycle
  });
}

export { sha256Hex };
