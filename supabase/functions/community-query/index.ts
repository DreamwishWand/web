import { withSupabase } from 'npm:@supabase/server';

type JsonObject = Record<string, unknown>;

const queryToRpc = {
  me: 'community_get_me',
  work: 'community_get_work',
  saved: 'community_get_saved',
  notifications: 'community_get_notifications'
} as const;

type QueryName = keyof typeof queryToRpc;

function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
  });
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return response({ ok: false, error: 'POST required' }, 405);

    const subject = ctx.userClaims?.sub;
    if (!subject) return response({ ok: false, error: 'Authenticated subject missing' }, 401);

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
        break;
      case 'work':
        params.p_work_id = payload.workId;
        break;
      case 'saved':
      case 'notifications':
        params.p_limit = payload.limit ?? 50;
        break;
    }

    const { data, error } = await ctx.supabaseAdmin.rpc(rpc, params);
    if (error) {
      const forbidden = error.message.includes('not accessible') || error.message.includes('not active');
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
  })
};
