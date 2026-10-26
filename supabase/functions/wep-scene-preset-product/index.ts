import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const MAX_BYTES = 25 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAGING_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i;
const PUBLISHED_NAME = /^[0-9a-f]{64}\.json$/i;

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'private, no-store' }
  });
}

function pathScope(value: unknown, accountId: string): 'staging' | 'published' | null {
  if (typeof value !== 'string' || !UUID.test(accountId) || value.includes('..') ||
      value.includes('\\') || value.includes('%') || value.includes('//')) return null;
  const parts = value.split('/');
  if (parts.length !== 3 || parts[1] !== accountId) return null;
  if (parts[0] === 'staging' && STAGING_NAME.test(parts[2])) return 'staging';
  if (parts[0] === 'published' && PUBLISHED_NAME.test(parts[2])) return 'published';
  return null;
}

function idempotency(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 160;
}

async function creatorIsOwned(ctx: any, accountId: string, creatorProfileId: string) {
  try {
    const { data, error } = await ctx.supabaseAdmin.from('creator_profiles')
      .select('owner_account_id')
      .eq('creator_profile_id', creatorProfileId)
      .maybeSingle();
    return !error && data?.owner_account_id === accountId;
  } catch {
    return false;
  }
}

const authenticatedFetch = withSupabase({ auth: 'user' }, async (req, ctx) => {
  if (req.method !== 'POST') return reply({ ok: false, error: 'POST_REQUIRED' }, 405);
  const subject = ctx.userClaims?.id;
  if (typeof subject !== 'string' || !UUID.test(subject)) {
    return reply({ ok: false, error: 'AUTHENTICATED_SUBJECT_REQUIRED' }, 401);
  }
  const iat = Number(ctx.jwtClaims?.iat ?? 0);
  if (!Number.isSafeInteger(iat) || iat <= 0) {
    return reply({ ok: false, error: 'JWT_ISSUED_AT_REQUIRED' }, 401);
  }
  let authorization;
  try {
    const { data, error } = await ctx.supabaseAdmin.rpc('community_authorize_session', {
      p_auth_subject: subject,
      p_issued_at_epoch: iat,
      p_max_age_seconds: null
    });
    if (error || !data) return reply({ ok: false, error: 'SESSION_REVOKED_OR_INVALID' }, 401);
    authorization = data;
  } catch {
    return reply({ ok: false, error: 'SESSION_REVOKED_OR_INVALID' }, 401);
  }
  const accountId = authorization?.accountId;
  if (typeof accountId !== 'string' || !UUID.test(accountId)) {
    return reply({ ok: false, error: 'WAND_ACCOUNT_ID_MISSING' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return reply({ ok: false, error: 'INVALID_JSON_BODY' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return reply({ ok: false, error: 'INVALID_JSON_BODY' }, 400);
  }

  const action = body.action;
  if (typeof action !== 'string') return reply({ ok: false, error: 'UNSUPPORTED_ACTION' }, 400);

  if (action === 'prepare') {
    if (!Number.isSafeInteger(body.byteSize) || (body.byteSize as number) <= 0 ||
        (body.byteSize as number) > MAX_BYTES) {
      return reply({ ok: false, error: 'INVALID_PRESET_SIZE' }, 400);
    }
    return reply({ ok: false, action, error: 'SCENE_PRESET_PRODUCT_UPLOAD_NOT_AUTHORIZED',
      uploadAuthorized: false, publicationAuthorized: false }, 409);
  }

  if (action === 'publish') {
    if (pathScope(body.storageKey, accountId) !== 'staging') {
      return reply({ ok: false, error: 'INVALID_STORAGE_KEY' }, 403);
    }
    const creatorProfileId = body.creatorProfileId;
    if (typeof creatorProfileId !== 'string' || !UUID.test(creatorProfileId) ||
        typeof body.title !== 'string' || !body.title.trim() || !idempotency(body.idempotencyKey)) {
      return reply({ ok: false, error: 'PUBLISH_METADATA_REQUIRED' }, 400);
    }
    if (body.presetArtifactId != null &&
        (typeof body.presetArtifactId !== 'string' || !UUID.test(body.presetArtifactId))) {
      return reply({ ok: false, error: 'PRESET_ARTIFACT_ID_INVALID' }, 400);
    }
    if (!(await creatorIsOwned(ctx, accountId, creatorProfileId))) {
      return reply({ ok: false, error: 'CREATOR_FORBIDDEN_OR_UNAVAILABLE' }, 403);
    }
    return reply({ ok: false, action,
      error: 'R18_SCENE_PRODUCT_PUBLICATION_ISSUER_NOT_ENROLLED',
      publicationAuthorized: false, physicalDeleteAuthorized: false }, 409);
  }

  if (action === 'unpublish' || action === 'delete') {
    if (typeof body.presetArtifactId !== 'string' || !UUID.test(body.presetArtifactId) ||
        !idempotency(body.idempotencyKey)) {
      return reply({ ok: false, error: 'LIFECYCLE_METADATA_REQUIRED' }, 400);
    }
    if (body.creatorProfileId != null) {
      if (typeof body.creatorProfileId !== 'string' || !UUID.test(body.creatorProfileId) ||
          !(await creatorIsOwned(ctx, accountId, body.creatorProfileId))) {
        return reply({ ok: false, error: 'CREATOR_FORBIDDEN_OR_UNAVAILABLE' }, 403);
      }
    }
    return reply({ ok: false, action,
      error: 'R18_SCENE_PRODUCT_LIFECYCLE_ISSUER_NOT_ENROLLED',
      lifecycleAuthorized: false, physicalDeleteAuthorized: false }, 409);
  }

  if (action === 'discard') {
    if (pathScope(body.storageKey, accountId) !== 'staging') {
      return reply({ ok: false, error: 'INVALID_STORAGE_KEY' }, 403);
    }
    return reply({ ok: false, action, error: 'R18_SCENE_PRODUCT_DISCARD_NOT_AUTHORIZED',
      physicalDeleteAuthorized: false }, 409);
  }

  if (action === 'read') {
    if ((typeof body.presetArtifactId !== 'string' || !UUID.test(body.presetArtifactId)) &&
        (typeof body.presetRevisionId !== 'string' || !UUID.test(body.presetRevisionId))) {
      return reply({ ok: false, error: 'PRESET_READ_ID_REQUIRED' }, 400);
    }
    return reply({ ok: false, action, error: 'SCENE_PRODUCT_READ_ALIAS_NOT_ENROLLED',
      readAuthorized: false }, 409);
  }

  if (action === 'failedSqlPublishCompensation' || action === 'compensate') {
    if (body.storageKey != null && pathScope(body.storageKey, accountId) === null) {
      return reply({ ok: false, error: 'INVALID_STORAGE_KEY' }, 403);
    }
    return reply({ ok: false, action, error: 'R18_SCENE_PRODUCT_COMPENSATION_NOT_AUTHORIZED',
      physicalDeleteAuthorized: false }, 409);
  }
  return reply({ ok: false, error: 'UNSUPPORTED_ACTION' }, 400);
});

export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    return authenticatedFetch(req);
  }
};
