import { withSupabase } from 'npm:@supabase/server';

function reply(body: unknown, status = 409) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: { 'Cache-Control': 'private, no-store' } });
    if (req.method !== 'POST') return reply({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
    const token = req.headers.get('x-community-worker-token');
    if (!token) return reply({ ok: false, error: 'WORKER_AUTH_REQUIRED' }, 401);
    let authorized = false;
    try {
      const { data, error } = await ctx.supabaseAdmin.rpc('community_verify_worker_token', {
        p_worker_name: 'retention_cleanup', p_token: token
      });
      authorized = !error && data === true;
    } catch {
      authorized = false;
    }
    if (!authorized) return reply({ ok: false, error: 'WORKER_AUTH_INVALID' }, 401);
    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('invalid');
      body = parsed as Record<string, unknown>;
    } catch {
      return reply({ ok: false, error: 'INVALID_JSON_BODY' }, 400);
    }
    if (typeof body.retentionJobId !== 'string' || !body.retentionJobId ||
        typeof body.lockToken !== 'string' || !body.lockToken) {
      return reply({ ok: false, error: 'INVALID_PURGE_REQUEST' }, 400);
    }
    return reply({
      ok: false, error: 'OPERATOR_GATE_A_RETENTION_STOP',
      operatorGate: 'A', retryable: false,
      userMessageKey: 'preset-temporarily-unavailable',
      nextAction: 'WAIT_FOR_OPERATOR_REOPENING',
      physicalDeleteAuthorized: false, cleanupAuthorized: false,
      claimAuthorized: false, retryAuthorized: false
    });
  })
};
