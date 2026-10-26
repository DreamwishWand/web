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

    try {
      const { data: claimed, error: claimError } = await ctx.supabaseAdmin.rpc(
        'wep_get_claimed_retention_artifact_blobs',
        {
          p_retention_job_id: retentionJobId,
          p_lock_token: lockToken
        }
      );
      if (claimError || !claimed) throw claimError ?? new Error('Claimed retention payload missing');

      const accountId = String(claimed.accountId ?? '');
      const blobs = Array.isArray(claimed.blobs) ? claimed.blobs : [];
      let purged = 0;

      for (const item of blobs) {
        const blobId = String(item.blobId ?? '');
        const storageKey = String(item.storageKey ?? '');
        const expectedPrefix = `published/${accountId}/`;
        if (!blobId || !storageKey.startsWith(expectedPrefix) || storageKey.includes('..') || !storageKey.endsWith('.json')) {
          throw new Error('ARTIFACT_STORAGE_KEY_OUTSIDE_WEP_NAMESPACE');
        }

        const { error: removeError } = await ctx.supabaseAdmin.storage.from(BUCKET).remove([storageKey]);
        if (removeError) throw removeError;

        const { error: finalizeError } = await ctx.supabaseAdmin.rpc('community_finalize_artifact_blob_purge', {
          p_blob_id: blobId,
          p_expected_storage_key: storageKey
        });
        if (finalizeError) throw finalizeError;
        purged += 1;
      }

      return reply({
        ok: true,
        retentionJobId,
        accountId,
        purged,
        remaining: 0
      });
    } catch (error) {
      return reply({ ok: false, error: 'PRESET_ARTIFACT_PURGE_FAILED', message: messageOf(error) }, 400);
    }
  })
};