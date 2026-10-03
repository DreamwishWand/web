import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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

  let body: { action?: string; confirmation?: string };
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  if (body.action !== 'deleteAccount') {
    return reply({ ok: false, error: 'Unsupported account action' }, 400);
  }

  if (body.confirmation !== 'DELETE') {
    return reply(
      { ok: false, error: 'EXPLICIT_CONFIRMATION_REQUIRED' },
      400
    );
  }

  const { data, error } = await ctx.supabaseAdmin.rpc(
    'community_tombstone_account',
    {
      p_auth_subject: subject,
      p_session_id: sessionId,
      p_issued_at_epoch: issuedAt,
      p_confirmation: body.confirmation
    }
  );

  if (error) {
    const recentAuth = error.message.includes('Recent authentication required');
    const conflict = error.message.includes('already deleted');
    const forbidden =
      recentAuth ||
      error.message.includes('Authenticated session not found') ||
      error.message.includes('not active') ||
      error.message.includes('Wand session has been revoked');

    return reply(
      {
        ok: false,
        error: recentAuth
          ? 'RECENT_AUTH_REQUIRED'
          : conflict
            ? 'ALREADY_DELETED'
            : forbidden
              ? 'FORBIDDEN'
              : 'ACCOUNT_DELETE_FAILED',
        message: error.message
      },
      recentAuth || forbidden ? 403 : conflict ? 409 : 400
    );
  }

  return reply({
    ok: true,
    action: 'deleteAccount',
    data
  });
});

export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    return authenticatedFetch(req);
  }
};
