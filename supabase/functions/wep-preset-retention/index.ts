import { withSupabase } from 'npm:@supabase/server';
import { resolveRuntimeWepPresetArtifactBucket } from '../_shared/wep-preset-artifact-bucket.ts';

const BUCKET = resolveRuntimeWepPresetArtifactBucket();

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? 'purge failed');
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'POST') return reply({ ok: false, error: 'POST required' }, 405);
    const token = req.headers.get('x-community-worker-token') ?? '';
    if (!token) return reply({ ok: false, error: 'WORKER_AUTH_REQUIRED' }, 401);
    const { data: authorized, error: authError } = await ctx.supabaseAdmin.rpc('community_verify_worker_token', {
      p_worker_name: 'retention_cleanup',
      p_token: token
    });
    if (authError || authorized !== true) return reply({ ok: false, error: 'WORKER_AUTH_INVALID' }, 401);

    const body = await req.json().catch(() => ({}));
    const retentionJobId = String((body as any).retentionJobId ?? '');
    const lockToken = String((body as any).lockToken ?? '');
    if (!retentionJobId || !lockToken) {
      return reply({ ok: false, error: 'INVALID_PURGE_REQUEST' }, 400);
    }

    return reply({
      ok:false,
      error:'R18_PRESET_PHYSICAL_RETENTION_CLEANUP_NOT_ENROLLED',
      retentionJobId,
      physicalDeleteAuthorized:false,
      privacySuppressionIndependent:true,
      recovery:'DEFERRED_OPERATOR_RECONCILIATION_REQUIRED'
    },409);
  })
};