import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const BUCKET = 'wand-preset-artifacts-staging';
const MAX_BYTES = 25 * 1024 * 1024;
const CONTENT_TYPE = 'application/json';
const ALLOWED_TYPES = new Set(['scene','biome','floating_island','tom_furniture','tom_clothing']);

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'private, no-store' }
  });
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

const FORBIDDEN_ARTIFACT_KEYS = new Set([
  'editorid','gridid','gridobjectid','sourcegridid','sourcegridobjectid',
  'subgridid','nextgridid','nextgridobjectid','objectkey','sourcediagnostics'
]);

function rejectSaveLocalIdentity(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) rejectSaveLocalIdentity(item);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_ARTIFACT_KEYS.has(key.toLowerCase())) {
      throw new Error('Scene artifact contains save-local identity');
    }
    rejectSaveLocalIdentity(child);
  }
}

function validateFootprint(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Scene footprint is invalid');
  for (const cell of value) {
    if (!cell || typeof cell !== 'object' || Array.isArray(cell)) throw new Error('Scene footprint cell is invalid');
    const c = cell as Record<string, unknown>;
    if (!Number.isInteger(Number(c.x)) || !Number.isInteger(Number(c.y))) throw new Error('Scene footprint cell is invalid');
  }
}

function validatePortableState(value: unknown) {
  if (value == null) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Scene portable state is invalid');
  const state = value as Record<string, unknown>;
  const codec = String(state.codec ?? '');
  if (codec === 'subgrid.itemdata-default-empty-child@1') return;
  if (codec !== 'subgrid.serialized-local-child@1') throw new Error('Scene portable state codec is unsupported');
  const child = state.child as Record<string, unknown> | undefined;
  if (!child || !Number.isInteger(Number(child.width)) || Number(child.width) <= 0 ||
      !Number.isInteger(Number(child.height)) || Number(child.height) <= 0 ||
      !Number.isInteger(Number(child.tessellationFactor)) || Number(child.tessellationFactor) <= 0 ||
      !Array.isArray(child.objects)) {
    throw new Error('Scene SubGrid child is invalid');
  }
  const ids = new Set<string>();
  for (const raw of child.objects as unknown[]) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Scene SubGrid object is invalid');
    const object = raw as Record<string, unknown>;
    const id = String(object.artifactObjectId ?? '');
    if (!/^c\\d+$/.test(id) || ids.has(id)) throw new Error('Scene SubGrid artifact identity is invalid');
    ids.add(id);
    if (!Number.isInteger(Number(object.itemId)) || Number(object.itemId) <= 0 ||
        !Number.isInteger(Number(object.localX)) || !Number.isInteger(Number(object.localY)) ||
        !Number.isInteger(Number(object.orientation)) || Number(object.orientation) < 0 || Number(object.orientation) > 15) {
      throw new Error('Scene SubGrid object is invalid');
    }
    validateFootprint(object.footprint);
    validatePortableState(object.portableState);
  }
}

function validateNetworkCapture(value: unknown, kind: 'roads' | 'fences', width: number, height: number) {
  if (value == null) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Scene network capture is invalid');
  const capture = value as Record<string, unknown>;
  if (capture.schema !== 'dreamwish-wand-wep-network-capture' || Number(capture.version) !== 1 ||
      capture.kind !== kind || capture.originPolicy !== 'capture-region-top-left' || !Array.isArray(capture.networks)) {
    throw new Error('Scene network capture is invalid');
  }
  for (const raw of capture.networks as unknown[]) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Scene network is invalid');
    const network = raw as Record<string, unknown>;
    if (!String(network.networkId ?? '') || !Number.isInteger(Number(network.familyBaseItemID)) || Number(network.familyBaseItemID) <= 0) {
      throw new Error('Scene network identity is invalid');
    }
    if (kind === 'roads') {
      if (!Array.isArray(network.cells)) throw new Error('Scene Road cells are invalid');
      for (const rawCell of network.cells as unknown[]) {
        if (!rawCell || typeof rawCell !== 'object' || Array.isArray(rawCell)) throw new Error('Scene Road cell is invalid');
        const cell = rawCell as Record<string, unknown>;
        const x = Number(cell.x), y = Number(cell.y);
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height || !String(cell.mode ?? '')) {
          throw new Error('Scene Road cell is invalid');
        }
      }
    } else {
      const graph = network.graph as Record<string, unknown> | undefined;
      if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error('Scene Fence graph is invalid');
      const nodeIds = new Set<string>();
      for (const rawNode of graph.nodes as unknown[]) {
        if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) throw new Error('Scene Fence node is invalid');
        const node = rawNode as Record<string, unknown>;
        const id = String(node.id ?? ''), x = Number(node.x), y = Number(node.y);
        if (!/^n\\d+$/.test(id) || nodeIds.has(id) || !Number.isInteger(x) || !Number.isInteger(y) ||
            x < 0 || y < 0 || x >= width || y >= height || !String(node.mode ?? '')) {
          throw new Error('Scene Fence node is invalid');
        }
        nodeIds.add(id);
      }
      for (const rawEdge of graph.edges as unknown[]) {
        if (!rawEdge || typeof rawEdge !== 'object' || Array.isArray(rawEdge)) throw new Error('Scene Fence edge is invalid');
        const edge = rawEdge as Record<string, unknown>;
        if (!nodeIds.has(String(edge.a ?? '')) || !nodeIds.has(String(edge.b ?? ''))) throw new Error('Scene Fence edge is invalid');
      }
    }
  }
}

function validateArtifact(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Preset artifact must be a JSON object');
  }
  const artifact = value as Record<string, unknown>;
  rejectSaveLocalIdentity(artifact);
  if (artifact.schema !== 'dreamwish-wand-preset') throw new Error('Unsupported Preset schema');
  const schemaVersion = Number(artifact.artifactVersion ?? artifact.schemaVersion ?? 0);
  if (!Number.isInteger(schemaVersion) || schemaVersion <= 0) throw new Error('Invalid Preset schema version');
  const presetType = String(artifact.type ?? artifact.artifactType ?? '').toLowerCase();
  if (!ALLOWED_TYPES.has(presetType)) throw new Error('Unsupported Preset type');

  if (presetType !== 'scene') throw new Error('PRESET_TYPE_VALIDATOR_NOT_AVAILABLE');
  if (!Array.isArray(artifact.objects) || artifact.objects.length === 0) {
    throw new Error('Scene Preset objects must be a non-empty array');
  }
  const bounds = artifact.bounds as Record<string, unknown> | undefined;
  if (!bounds || !Number.isInteger(Number(bounds.w)) || !Number.isInteger(Number(bounds.h)) ||
      Number(bounds.w) <= 0 || Number(bounds.h) <= 0) {
    throw new Error('Scene Preset bounds are invalid');
  }
  if (artifact.originPolicy !== 'capture-region-top-left') {
    throw new Error('Scene Preset origin policy is unsupported');
  }

  const ids = new Set<string>();
  for (const raw of artifact.objects as unknown[]) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid Scene object');
    const object = raw as Record<string, unknown>;
    const id = String(object.artifactObjectId ?? '');
    if (!id || ids.has(id)) throw new Error('Scene artifact object identity is invalid');
    ids.add(id);
    if (!Number.isInteger(Number(object.itemId)) || Number(object.itemId) <= 0) throw new Error('Scene itemId is invalid');
    if (!Number.isInteger(Number(object.localX)) || !Number.isInteger(Number(object.localY))) throw new Error('Scene local position is invalid');
    if (!Number.isInteger(Number(object.orientation)) || Number(object.orientation) < 0 || Number(object.orientation) > 15) throw new Error('Scene orientation is invalid');
    validateFootprint(object.footprint);
    validatePortableState(object.portableState);
    if (!Array.isArray(object.dependencyIds)) throw new Error('Scene dependency list is invalid');
    for (const dependencyId of object.dependencyIds as unknown[]) {
      if (typeof dependencyId !== 'string' || !dependencyId) throw new Error('Scene dependency identity is invalid');
    }
  }
  for (const raw of artifact.objects as Array<Record<string, unknown>>) {
    for (const dependencyId of raw.dependencyIds as string[]) {
      if (!ids.has(dependencyId)) throw new Error('Scene dependency points outside artifact');
    }
  }

  const networks = artifact.networks;
  if (networks != null && (typeof networks !== 'object' || Array.isArray(networks))) throw new Error('Scene network envelope is invalid');
  const networkEnvelope = (networks ?? {}) as Record<string, unknown>;
  validateNetworkCapture(networkEnvelope.roads, 'roads', Number(bounds.w), Number(bounds.h));
  validateNetworkCapture(networkEnvelope.fences, 'fences', Number(bounds.w), Number(bounds.h));
  return { schemaVersion, presetType };
}

async function validatedStoredArtifact(ctx: any, subject: string, storageKey: string, phase: 'staging' | 'published') {
  const prefix = `${phase}/${subject}/`;
  if (!storageKey.startsWith(prefix) || storageKey.includes('..') || !storageKey.endsWith('.json')) {
    throw new Error('INVALID_STORAGE_KEY');
  }
  const { data: blob, error } = await ctx.supabaseAdmin.storage.from(BUCKET).download(storageKey);
  if (error || !blob) throw new Error('UPLOAD_NOT_FOUND');
  if (blob.size <= 0 || blob.size > MAX_BYTES) throw new Error('INVALID_FILE_SIZE');
  const buffer = await blob.arrayBuffer();
  let parsed: unknown;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    parsed = JSON.parse(text);
  } catch {
    throw new Error('INVALID_JSON_ARTIFACT');
  }
  const envelope = validateArtifact(parsed);
  const checksumSha256 = hex(await crypto.subtle.digest('SHA-256', buffer));
  return { blob, buffer, artifact: parsed, ...envelope, checksumSha256 };
}

const authenticatedFetch = withSupabase({ auth: 'user' }, async (req, ctx) => {
  if (req.method !== 'POST') return reply({ ok: false, error: 'POST required' }, 405);
  const subject = ctx.userClaims?.id;
  if (!subject) return reply({ ok: false, error: 'Authenticated subject missing' }, 401);

  const issuedAt = Number(ctx.jwtClaims?.iat ?? 0);
  if (!Number.isInteger(issuedAt) || issuedAt <= 0) return reply({ ok: false, error: 'JWT issued-at claim missing' }, 401);
  const { error: sessionError } = await ctx.supabaseAdmin.rpc('community_authorize_session', {
    p_auth_subject: subject,
    p_issued_at_epoch: issuedAt,
    p_max_age_seconds: null
  });
  if (sessionError) return reply({ ok: false, error: 'SESSION_REVOKED_OR_INVALID', message: sessionError.message }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ ok: false, error: 'Invalid JSON body' }, 400); }
  const action = String(body.action ?? '');

  if (action === 'prepare') {
    const byteSize = Number(body.byteSize ?? 0);
    if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_BYTES) {
      return reply({ ok: false, error: 'INVALID_PRESET_SIZE' }, 400);
    }
    const { data: rate, error: rateError } = await ctx.supabaseAdmin.rpc('community_consume_action_rate_limit', {
      p_auth_subject: subject,
      p_bucket: 'preset_artifact_prepare'
    });
    if (rateError) return reply({ ok: false, error: 'RATE_LIMIT_CHECK_FAILED', message: rateError.message }, 400);
    if (rate?.allowed === false) {
      return reply({ ok: false, error: 'RATE_LIMITED', retryAfterSeconds: rate.retryAfterSeconds, resetAt: rate.resetAt }, 429);
    }
    const storageKey = `staging/${subject}/${crypto.randomUUID()}.json`;
    const { data, error } = await ctx.supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(storageKey);
    if (error || !data) return reply({ ok: false, error: 'UPLOAD_PREPARE_FAILED', message: error?.message }, 400);
    return reply({ ok: true, action, storageKey, contentType: CONTENT_TYPE, maxBytes: MAX_BYTES, signedUpload: data });
  }

  if (action === 'publish') {
    const storageKey = String(body.storageKey ?? '');
    const creatorProfileId = String(body.creatorProfileId ?? '');
    const visibility = String(body.visibility ?? 'private');
    const title = String(body.title ?? '').trim();
    const description = body.description == null ? null : String(body.description);
    const idempotencyKey = String(body.idempotencyKey ?? '').trim();
    const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {};
    if (!creatorProfileId || !title || !idempotencyKey) {
      return reply({ ok: false, error: 'PUBLISH_METADATA_REQUIRED' }, 400);
    }

    const finalDigest = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${subject}:${idempotencyKey}`)));
    const publishedStorageKey = `published/${subject}/${finalDigest}.json`;

    let validated;
    let source: 'staging' | 'published' = 'staging';
    try {
      validated = await validatedStoredArtifact(ctx, subject, storageKey, 'staging');
    } catch {
      try {
        validated = await validatedStoredArtifact(ctx, subject, publishedStorageKey, 'published');
        source = 'published';
      } catch (error) {
        return reply({ ok: false, error: error instanceof Error ? error.message : 'ARTIFACT_VALIDATE_FAILED' }, 400);
      }
    }

    let promotedNewObject = false;
    if (source === 'staging') {
      const { error: copyError } = await ctx.supabaseAdmin.storage.from(BUCKET).copy(storageKey, publishedStorageKey);
      if (copyError) {
        try {
          const existing = await validatedStoredArtifact(ctx, subject, publishedStorageKey, 'published');
          if (existing.checksumSha256 !== validated.checksumSha256) {
            return reply({ ok: false, error: 'PUBLISHED_KEY_CONFLICT' }, 409);
          }
        } catch {
          return reply({ ok: false, error: 'ARTIFACT_PROMOTE_FAILED', message: copyError.message }, 400);
        }
      } else {
        promotedNewObject = true;
      }
    }

    const { data, error } = await ctx.supabaseAdmin.rpc('community_publish_preset_envelope', {
      p_auth_subject: subject,
      p_creator_profile_id: creatorProfileId,
      p_visibility: visibility,
      p_preset_type: validated.presetType,
      p_title: title,
      p_description: description,
      p_artifact_storage_key: publishedStorageKey,
      p_schema_version: validated.schemaVersion,
      p_content_type: CONTENT_TYPE,
      p_byte_size: validated.blob.size,
      p_checksum_sha256: validated.checksumSha256,
      p_metadata: metadata,
      p_idempotency_key: idempotencyKey
    });
    if (error) {
      if (promotedNewObject) {
        await ctx.supabaseAdmin.storage.from(BUCKET).remove([publishedStorageKey]);
      }
      return reply({ ok: false, error: 'PRESET_PUBLISH_FAILED', message: error.message }, 400);
    }

    if (source === 'staging') {
      await ctx.supabaseAdmin.storage.from(BUCKET).remove([storageKey]);
    }
    return reply({ ok: true, action, data: { ...data, storageKey: publishedStorageKey, schemaVersion: validated.schemaVersion, presetType: validated.presetType, contentType: CONTENT_TYPE, byteSize: validated.blob.size, checksumSha256: validated.checksumSha256 } });
  }

  if (action === 'resolveWork') {
    const workId = String(body.workId ?? '');
    if (!workId) return reply({ ok: false, error: 'WORK_ID_REQUIRED' }, 400);

    const { data: preset, error: presetError } = await ctx.supabaseAdmin
      .from('preset_artifacts')
      .select('preset_artifact_id')
      .eq('community_work_id', workId)
      .maybeSingle();

    if (presetError) {
      return reply({ ok: false, error: 'PRESET_RESOLVE_FAILED', message: presetError.message }, 400);
    }
    if (!preset?.preset_artifact_id) {
      return reply({ ok: false, error: 'PRESET_NOT_FOUND_FOR_WORK' }, 404);
    }

    const { data: meta, error: metaError } = await ctx.supabaseAdmin.rpc(
      'wep_get_accessible_preset_blob',
      {
        p_auth_subject: subject,
        p_preset_artifact_id: preset.preset_artifact_id,
        p_preset_revision_id: null
      }
    );

    if (metaError || !meta) {
      return reply(
        {
          ok: false,
          error: 'PRESET_FORBIDDEN_OR_UNAVAILABLE',
          message: metaError?.message
        },
        403
      );
    }

    return reply({
      ok: true,
      action,
      preset: {
        presetArtifactId: meta.presetArtifactId,
        presetRevisionId: meta.presetRevisionId,
        presetType: meta.presetType,
        schemaVersion: meta.schemaVersion,
        contentType: meta.contentType,
        byteSize: meta.byteSize,
        checksumSha256: meta.checksumSha256
      }
    });
  }

  if (action === 'read') {
    const presetArtifactId = body.presetArtifactId ? String(body.presetArtifactId) : null;
    const presetRevisionId = body.presetRevisionId ? String(body.presetRevisionId) : null;
    const { data: meta, error: metaError } = await ctx.supabaseAdmin.rpc('wep_get_accessible_preset_blob', {
      p_auth_subject: subject,
      p_preset_artifact_id: presetArtifactId,
      p_preset_revision_id: presetRevisionId
    });
    if (metaError || !meta) return reply({ ok: false, error: 'PRESET_FORBIDDEN_OR_UNAVAILABLE', message: metaError?.message }, 403);
    const { data: signed, error: signError } = await ctx.supabaseAdmin.storage.from(BUCKET).createSignedUrl(meta.storageKey, 300);
    if (signError || !signed) return reply({ ok: false, error: 'PRESET_SIGN_FAILED', message: signError?.message }, 400);
    return reply({
      ok: true,
      action,
      preset: {
        presetArtifactId: meta.presetArtifactId,
        presetRevisionId: meta.presetRevisionId,
        presetType: meta.presetType,
        blobId: meta.blobId,
        schemaVersion: meta.schemaVersion,
        contentType: meta.contentType,
        byteSize: meta.byteSize,
        checksumSha256: meta.checksumSha256,
        signedUrl: signed.signedUrl,
        expiresIn: 300
      }
    });
  }

  if (action === 'discard') {
    const storageKey = String(body.storageKey ?? '');
    const ownedPrefix = storageKey.startsWith(`staging/${subject}/`) || storageKey.startsWith(`published/${subject}/`);
    if (!ownedPrefix || storageKey.includes('..') || !storageKey.endsWith('.json')) {
      return reply({ ok: false, error: 'INVALID_STORAGE_KEY' }, 403);
    }
    const { data: registered, error: lookupError } = await ctx.supabaseAdmin
      .from('artifact_blobs').select('blob_id').eq('storage_key', storageKey).maybeSingle();
    if (lookupError) return reply({ ok: false, error: 'DISCARD_LOOKUP_FAILED', message: lookupError.message }, 400);
    if (registered) return reply({ ok: false, error: 'REGISTERED_ARTIFACT_CANNOT_BE_DISCARDED' }, 409);
    const { error } = await ctx.supabaseAdmin.storage.from(BUCKET).remove([storageKey]);
    if (error) return reply({ ok: false, error: 'DISCARD_FAILED', message: error.message }, 400);
    return reply({ ok: true, action, storageKey });
  }

  return reply({ ok: false, error: 'Unsupported action' }, 400);
});

export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    return authenticatedFetch(req);
  }
};