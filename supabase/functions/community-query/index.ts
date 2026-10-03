import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type JsonObject = Record<string, unknown>;

const queryToRpc = {
  me: 'community_get_me',
  work: 'community_get_work',
  saved: 'community_get_saved',
  notifications: 'community_get_notifications',
  preset: 'community_get_preset',
  deadLetters: 'community_get_dead_letter_outbox',
  ddvProfileWorkspaces: 'community_get_ddv_profile_workspaces_v1'
} as const;

type QueryName = keyof typeof queryToRpc;

function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'private, no-store' }
  });
}

const authenticatedFetch = withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return response({ ok: false, error: 'POST required' }, 405);

    const subject = ctx.userClaims?.id;
    if (!subject) return response({ ok: false, error: 'Authenticated subject missing' }, 401);

    const issuedAt = Number(ctx.jwtClaims?.iat ?? 0);
    if (!Number.isInteger(issuedAt) || issuedAt <= 0) {
      return response({ ok: false, error: 'JWT issued-at claim missing' }, 401);
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
      return response(
        {
          ok: false,
          error: 'SESSION_REVOKED_OR_INVALID',
          message: sessionError.message
        },
        401
      );
    }

    let body: { query?: string; payload?: JsonObject };
    try {
      body = await req.json();
    } catch {
      return response({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    if (!body.query || !(body.query in queryToRpc)) {
      return response({ ok: false, error: 'Unsupported query' }, 400);
    }

    const query = body.query as QueryName;
    const payload = body.payload ?? {};
    const rpc = queryToRpc[query];
    const params: JsonObject = { p_auth_subject: subject };

    switch (query) {
      case 'me':
      case 'ddvProfileWorkspaces':
        break;
      case 'work':
        params.p_work_id = payload.workId;
        break;
      case 'saved':
      case 'notifications':
      case 'deadLetters':
        params.p_limit = payload.limit ?? 50;
        break;
      case 'preset':
        params.p_preset_artifact_id = payload.presetArtifactId;
        break;
    }

    const { data, error } = await ctx.supabaseAdmin.rpc(rpc, params);
    if (error) {
      const forbidden =
        error.message.includes('not accessible') ||
        error.message.includes('not active') ||
        error.message.includes('role required');
      return response(
        {
          ok: false,
          error: forbidden ? 'FORBIDDEN' : 'QUERY_FAILED',
          message: error.message
        },
        forbidden ? 403 : 400
      );
    }

    return response({ ok: true, query, data });
});

export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    return authenticatedFetch(req);
  }
};
