import { withSupabase } from 'npm:@supabase/server';

const BUCKET = 'wand-preset-artifacts-staging';

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
    const blobId = String((body as any).blobId ?? '');
    const storageKey = String((body as any).storageKey ?? '');
    if (!blobId || !storageKey || !storageKey.startsWith('published/') || storageKey.includes('..') || !storageKey.endsWith('.json')) {
      return reply({ ok: false, error: 'INVALID_PURGE_REQUEST' }, 400);
    }

    try {
      const { data: blob, error: lookupError } = await ctx.supabaseAdmin
        .from('artifact_blobs')
        .select('blob_id,storage_key,purged_at')
        .eq('blob_id', blobId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!blob) return reply({ ok: false, error: 'ARTIFACT_BLOB_NOT_FOUND' }, 404);
      if (blob.purged_at) return reply({ ok: true, data: { blobId, state: 'purged', purgedAt: blob.purged_at, idempotent: true } });
      if (blob.storage_key !== storageKey) return reply({ ok: false, error: 'ARTIFACT_STORAGE_KEY_MISMATCH' }, 409);

      const { error: removeError } = await ctx.supabaseAdmin.storage.from(BUCKET).remove([storageKey]);
      if (removeError) throw removeError;
      const { data, error } = await ctx.supabaseAdmin.rpc('community_finalize_artifact_blob_purge', {
        p_blob_id: blobId,
        p_expected_storage_key: storageKey
      });
      if (error) throw error;
      return reply({ ok: true, data });
    } catch (error) {
      return reply({ ok: false, error: 'PRESET_ARTIFACT_PURGE_FAILED', message: messageOf(error) }, 400);
    }
  })
};