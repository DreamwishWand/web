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
  visibility?: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
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
    visibility = 'unlisted',
    title,
    description = null,
    metadata = {},
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
    assert(String(creatorProfileId), 'WEP_PRESET_CREATOR_REQUIRED');
    assert(String(title).trim(), 'WEP_PRESET_TITLE_REQUIRED');
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
        visibility: String(visibility || 'unlisted'),
        title: String(title).trim(),
        description: description == null ? null : String(description),
        metadata: isObject(metadata) ? metadata : {},
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
    return {
      presetArtifactId: requireId(
        data,
        'presetArtifactId',
        'WEP_PRESET_PUBLISH_ARTIFACT_ID_MISSING'
      ),
      presetRevisionId: requireId(
        data,
        'presetRevisionId',
        'WEP_PRESET_PUBLISH_REVISION_ID_MISSING'
      ),
      workId: requireId(
        data,
        'workId',
        'WEP_PRESET_PUBLISH_WORK_ID_MISSING'
      ),
      workRevisionId: requireId(
        data,
        'workRevisionId',
        'WEP_PRESET_PUBLISH_WORK_REVISION_ID_MISSING'
      ),
      storageKey: String(data.storageKey ?? ''),
      checksumSha256: String(data.checksumSha256 ?? ''),
      byteSize: Number(data.byteSize ?? preparedEnvelope.envelope.byteSize)
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

  async function loadPreset(presetArtifactId: string) {
    assert(String(presetArtifactId), 'WEP_PRESET_ARTIFACT_ID_REQUIRED');

    const [detailResult, readResult] = await Promise.all([
      community.query('preset', {
        presetArtifactId: String(presetArtifactId)
      }),
      community.preset('read', {
        presetArtifactId: String(presetArtifactId)
      })
    ]);

    const detail = dataOf(detailResult) ?? {};
    const read = presetOf(readResult) ?? {};
    const signedUrl = String(read.signedUrl ?? '');
    assert(signedUrl, 'WEP_PRESET_READ_SIGNED_URL_MISSING');

    const response = await requireOk(
      await fetchImpl(signedUrl, { method: 'GET' })
    );
    const bytes = await response.arrayBuffer();
    const byteSize = Number(read.byteSize ?? detail.byteSize ?? 0);

    assert(
      Number.isSafeInteger(byteSize) && byteSize > 0,
      'WEP_PRESET_READ_BYTE_SIZE_INVALID'
    );
    assert(
      bytes.byteLength === byteSize,
      'WEP_PRESET_READ_BYTE_SIZE_MISMATCH'
    );

    const checksum = await sha256Hex(bytes);
    const expected = String(
      read.checksumSha256 ?? detail.checksumSha256 ?? ''
    ).toLowerCase();

    assert(
      /^[0-9a-f]{64}$/.test(expected),
      'WEP_PRESET_READ_CHECKSUM_INVALID'
    );
    assert(
      checksum === expected,
      'WEP_PRESET_READ_CHECKSUM_MISMATCH'
    );

    let artifact: unknown;
    try {
      artifact = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      );
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

    assert(
      String(detail.presetArtifactId ?? presetArtifactId) ===
        String(presetArtifactId),
      'WEP_PRESET_DETAIL_ID_MISMATCH'
    );
    assert(
      String(detail.presetType ?? validation.presetType) ===
        validation.presetType,
      'WEP_PRESET_DETAIL_TYPE_MISMATCH'
    );
    assert(
      Number(detail.schemaVersion ?? validation.schemaVersion) ===
        validation.schemaVersion,
      'WEP_PRESET_DETAIL_SCHEMA_MISMATCH'
    );

    return {
      artifact,
      validation,
      detail,
      read,
      checksumSha256: checksum,
      byteSize
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
    const loaded = await loadPreset(presetArtifactId);

    assert(
      loaded.validation.presetType === 'scene',
      'WEP_PRESET_PREFLIGHT_TYPE_UNSUPPORTED'
    );

    return {
      ...loaded,
      preflight: hooks.preflightScene(loaded.artifact, options)
    };
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
    preflightPreset
  });
}

export { sha256Hex };
