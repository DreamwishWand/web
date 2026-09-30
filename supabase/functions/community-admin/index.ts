import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type JsonObject = Record<string, unknown>;

const operationToRpc = {
  listRecoveryCases: 'community_get_recovery_cases',
  listProviderCleanupJobs: 'community_get_provider_cleanup_jobs',
  openRecoveryCase: 'community_admin_open_recovery_case',
  completeRecoveryCase: 'community_admin_complete_recovery',
  retryProviderCleanup: 'community_admin_retry_provider_cleanup'
} as const;

type OperationName = keyof typeof operationToRpc;

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'private, no-store' }
  });
}

const authenticatedFetch = withSupabase({ auth: 'user' }, async (req, ctx) => {
  if (req.method !== 'POST') return reply({ ok: false, error: 'POST required' }, 405);

  const subject = ctx.userClaims?.id;
  if (!subject) return reply({ ok: false, error: 'Authenticated subject missing' }, 401);

  const issuedAt = Number(ctx.jwtClaims?.iat ?? 0);
  const sessionId = String(ctx.jwtClaims?.session_id ?? '');
  if (!Number.isInteger(issuedAt) || issuedAt <= 0) {
    return reply({ ok: false, error: 'JWT issued-at claim missing' }, 401);
  }
  if (!sessionId) {
    return reply({ ok: false, error: 'JWT session-id claim missing' }, 401);
  }

  const { error: sessionError } = await ctx.supabaseAdmin.rpc(
    'community_authorize_session',
    {
      p_auth_subject: subject,
      p_issued_at_epoch: issuedAt,
      p_max_age_seconds: null
    }
  );

  if (sessionError) {
    return reply(
      {
        ok: false,
        error: 'SESSION_REVOKED_OR_INVALID',
        message: sessionError.message
      },
      401
    );
  }

  let body: { operation?: string; payload?: JsonObject };
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  if (!body.operation || !(body.operation in operationToRpc)) {
    return reply({ ok: false, error: 'Unsupported admin operation' }, 400);
  }

  const operation = body.operation as OperationName;
  const payload = body.payload ?? {};
  const rpc = operationToRpc[operation];
  const params: JsonObject = { p_admin_auth_subject: subject };

  switch (operation) {
    case 'listRecoveryCases':
      params.p_state = payload.state ?? null;
      params.p_limit = payload.limit ?? 50;
      break;
    case 'listProviderCleanupJobs':
      params.p_state = payload.state ?? null;
      params.p_limit = payload.limit ?? 50;
      break;
    case 'openRecoveryCase':
      params.p_session_id = sessionId;
      params.p_issued_at_epoch = issuedAt;
      params.p_account_id = payload.accountId;
      params.p_new_provider = payload.newProvider;
      params.p_new_provider_subject = payload.newProviderSubject;
      params.p_reason = payload.reason;
      params.p_verification_ref = payload.verificationRef ?? null;
      break;
    case 'completeRecoveryCase':
      params.p_session_id = sessionId;
      params.p_issued_at_epoch = issuedAt;
      params.p_recovery_case_id = payload.recoveryCaseId;
      params.p_completion_reason = payload.completionReason;
      break;
    case 'retryProviderCleanup':
      params.p_session_id = sessionId;
      params.p_issued_at_epoch = issuedAt;
      params.p_cleanup_job_id = payload.cleanupJobId;
      params.p_reason = payload.reason;
      break;
  }

  const { data, error } = await ctx.supabaseAdmin.rpc(rpc, params);

  if (error) {
    const recentAuth = error.message.includes('Recent authentication required');
    const forbidden =
      recentAuth ||
      error.message.includes('Admin role required') ||
      error.message.includes('not active') ||
      error.message.includes('Wand session has been revoked');

    return reply(
      {
        ok: false,
        error: recentAuth
          ? 'RECENT_AUTH_REQUIRED'
          : forbidden
            ? 'FORBIDDEN'
            : 'ADMIN_OPERATION_FAILED',
        message: error.message
      },
      forbidden ? 403 : 400
    );
  }

  return reply({ ok: true, operation, data });
});

export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    return authenticatedFetch(req);
  }
};
