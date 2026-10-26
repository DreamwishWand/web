import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES = 25 * 1024 * 1024;
function reply(body: unknown, status = 409) {
  return Response.json(body, { status, headers: { ...corsHeaders, 'Cache-Control': 'private, no-store' } });
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
function validKey(value: unknown, accountId: string, scope: 'staging' | 'published' | 'either' = 'either') {
  if (typeof value !== 'string' || !validId(accountId) || value.includes('..') ||
      value.includes('%') || value.includes('\\') || value.includes('//')) return false;
  const parts = value.split('/');
  if (parts.length !== 3 || parts[1] !== accountId) return false;
  const stagingName = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i;
  const publishedName = /^[0-9a-f]{64}\.json$/i;
  return (scope !== 'published' && parts[0] === 'staging' && stagingName.test(parts[2])) ||
         (scope !== 'staging' && parts[0] === 'published' && publishedName.test(parts[2]));
}
function validKeyToken(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 160;
}
async function creatorOwned(ctx: any, owner: string, creator: string) {
  if (!validId(creator)) return false;
  try {
    const { data, error } = await ctx.supabaseAdmin.from('creator_profiles')
      .select('owner_account_id').eq('creator_profile_id', creator).maybeSingle();
    return !error && data?.owner_account_id === owner;
  } catch {
    return false;
  }
}
function stopped(action: string, alias = false) {
  return reply({
    ok: false, action,
    error: alias ? 'OPERATOR_GATE_A_LEGACY_ALIAS_DISABLED' : 'OPERATOR_GATE_A_WEP_STOP',
    operatorGate: 'A',
    retryable: false,
    userMessageKey: 'preset-temporarily-unavailable',
    publicationAuthorized: false,
    readAuthorized: false,
    signedUrlAuthorized: false,
    storageMutationAuthorized: false,
    physicalDeleteAuthorized: false,
    cleanupAuthorized: false,
    nextAction: 'WAIT_FOR_OPERATOR_REOPENING'
  });
}
async function actorAccount(ctx: any) {
  const subject = ctx.userClaims?.id;
  const issuedAt = Number(ctx.jwtClaims?.iat ?? 0);
  if (!validId(subject) || !Number.isSafeInteger(issuedAt) || issuedAt <= 0) return null;
  try {
    const { data, error } = await ctx.supabaseAdmin.rpc('community_authorize_session', {
      p_auth_subject: subject, p_issued_at_epoch: issuedAt, p_max_age_seconds: null
    });
    if (error || !validId(data?.accountId)) return null;
    return data.accountId as string;
  } catch {
    return null;
  }
}

const authenticatedFetch = withSupabase({ auth: 'user' }, async (req, ctx) => {
  if (req.method !== 'POST') return reply({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  const accountId = await actorAccount(ctx);
  if (!accountId) return reply({ ok: false, error: 'SESSION_REVOKED_OR_INVALID' }, 401);
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('invalid');
    body = parsed as Record<string, unknown>;
  } catch {
    return reply({ ok: false, error: 'INVALID_JSON_BODY' }, 400);
  }
  const action = body.action;
  if (typeof action !== 'string' || !action) return reply({ ok: false, error: 'UNSUPPORTED_ACTION' }, 400);

  if (action === 'prepare') {
    if (!Number.isSafeInteger(body.byteSize) || (body.byteSize as number) <= 0 ||
        (body.byteSize as number) > MAX_BYTES) return reply({ ok: false, error: 'INVALID_PRESET_SIZE' }, 400);
    return stopped(action);
  }
  if (action === 'reservePublication' || action === 'publish') {
    if (!validKey(body.storageKey, accountId, 'staging')) return reply({ ok: false, error: 'INVALID_STORAGE_KEY' }, 403);
    if (!validId(body.creatorProfileId) || !validKeyToken(body.idempotencyKey)) {
      return reply({ ok: false, error: 'PUBLISH_METADATA_REQUIRED' }, 400);
    }
    if (!(await creatorOwned(ctx, accountId, body.creatorProfileId))) {
      return reply({ ok: false, error: 'CREATOR_FORBIDDEN_OR_UNAVAILABLE' }, 403);
    }
    return stopped(action);
  }
  if (action === 'recoverPublication' || action === 'inspectPublishedObject') {
    if (!validId(body.reservationId) || !Number.isSafeInteger(body.expectedVersion) ||
        (body.expectedVersion as number) <= 0) {
      return reply({ ok: false, error: 'PRESET_RESERVATION_INPUT_INVALID' }, 400);
    }
    return stopped(action);
  }
  if (action === 'revisionReadiness') {
    if (!validId(body.presetArtifactId)) return reply({ ok: false, error: 'INVALID_PRESET_ARTIFACT_ID' }, 400);
    return stopped(action);
  }
  if (action === 'resolveWork') {
    if (!validId(body.workId)) return reply({ ok: false, error: 'WORK_ID_REQUIRED' }, 400);
    return stopped(action);
  }
  if (action === 'read') {
    if (!validId(body.presetArtifactId) && !validId(body.presetRevisionId)) {
      return reply({ ok: false, error: 'PRESET_READ_ID_REQUIRED' }, 400);
    }
    return stopped(action);
  }
  if (action === 'discard') {
    if (!validKey(body.storageKey, accountId)) return reply({ ok: false, error: 'INVALID_STORAGE_KEY' }, 403);
    return stopped(action);
  }
  const legacy = new Set([
    'unpublish', 'delete', 'cleanup', 'compensate', 'failedSqlPublishCompensation',
    'retry', 'retryPublish', 'prepareUpload', 'ownerRead', 'readPreset', 'publishScene'
  ]);
  if (legacy.has(action)) {
    if (body.storageKey != null && !validKey(body.storageKey, accountId)) {
      return reply({ ok: false, error: 'INVALID_STORAGE_KEY' }, 403);
    }
    return stopped(action, true);
  }
  return reply({ ok: false, error: 'UNSUPPORTED_ACTION' }, 400);

});
export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
    return authenticatedFetch(req);
  }
};
