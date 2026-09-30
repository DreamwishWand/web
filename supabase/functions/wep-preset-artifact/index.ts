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

function validateArtifact(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Preset artifact must be a JSON object');
  }
  const artifact = value as Record<string, unknown>;
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
    if (!Array.isArray(object.footprint) || object.footprint.length === 0) throw new Error('Scene footprint is invalid');
    for (const cell of object.footprint as unknown[]) {
      if (!cell || typeof cell !== 'object' || Array.isArray(cell)) throw new Error('Scene footprint cell is invalid');
      const c = cell as Record<string, unknown>;
      if (!Number.isInteger(Number(c.x)) || !Number.isInteger(Number(c.y))) throw new Error('Scene footprint cell is invalid');
    }
    if (!Array.isArray(object.dependencyIds)) throw new Error('Scene dependency list is invalid');
    for (const dependencyId of object.dependencyIds as unknown[]) {
      if (typeof dependencyId !== 'string' || !dependencyId) throw new Error('Scene dependency identity is invalid');
    }
    for (const forbidden of ['gridId','gridObjectId','sourceGridId','sourceGridObjectId','subGridId','nextGridId','nextGridObjectId']) {
      if (forbidden in object) throw new Error('Scene artifact contains save-local identity');
    }
  }
  for (const raw of artifact.objects as Array<Record<string, unknown>>) {
    for (const dependencyId of raw.dependencyIds as string[]) {
      if (!ids.has(dependencyId)) throw new Error('Scene dependency points outside artifact');
    }
  }

  const networks = artifact.networks;
  if (networks != null && (typeof networks !== 'object' || Array.isArray(networks))) {
    throw new Error('Scene network envelope is invalid');
  }
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
    if (error) return reply({ ok: false, error: 'PRESET_PUBLISH_FAILED', message: error.message }, 400);

    if (source === 'staging') {
      await ctx.supabaseAdmin.storage.from(BUCKET).remove([storageKey]);
    }
    return reply({ ok: true, action, data: { ...data, storageKey: publishedStorageKey, schemaVersion: validated.schemaVersion, presetType: validated.presetType, contentType: CONTENT_TYPE, byteSize: validated.blob.size, checksumSha256: validated.checksumSha256 } });
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
    return reply({ ok: true, action, preset: { ...meta, signedUrl: signed.signedUrl, expiresIn: 300 } });
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