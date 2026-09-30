import { withSupabase } from 'npm:@supabase/server';
import { createClient } from 'npm:@supabase/supabase-js@2';

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
  });
}

async function jsonOrThrow(response: Response, label: string) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error?: unknown }).error ?? label)
        : label;
    throw new Error(`${label}: ${detail} (HTTP ${response.status})`);
  }
  return body as Record<string, any>;
}

function defaultPublishableKey(): string {
  const raw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '';
  if (!raw) throw new Error('SUPABASE_PUBLISHABLE_KEYS missing');
  const parsed = JSON.parse(raw) as Record<string, string>;
  const key = parsed.default;
  if (!key) throw new Error('Default publishable key missing');
  return key;
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'POST') return reply({ ok: false, error: 'POST required' }, 405);

    const workerToken = req.headers.get('x-community-worker-token') ?? '';
    if (!workerToken) return reply({ ok: false, error: 'WORKER_AUTH_REQUIRED' }, 401);

    const { data: workerAuthorized, error: workerAuthError } =
      await ctx.supabaseAdmin.rpc('community_verify_worker_token', {
        p_worker_name: 'retention_cleanup',
        p_token: workerToken
      });

    if (workerAuthError || workerAuthorized !== true) {
      return reply({ ok: false, error: 'WORKER_AUTH_INVALID' }, 401);
    }

    const runId = crypto.randomUUID();
    const suffix = runId.replaceAll('-', '').slice(0, 12);
    const email = `retention-e2e-${suffix}@example.invalid`;
    const password = `E2e-${crypto.randomUUID()}-Aa9!`;
    const handle = `rete2e${suffix.slice(0, 8)}`;
    const projectUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const publishableKey = defaultPublishableKey();

    let providerUserId: string | null = null;
    let accessToken: string | null = null;
    let accountId: string | null = null;
    let creatorProfileId: string | null = null;
    let storageKey: string | null = null;
    let publishedStorageKey: string | null = null;
    let presetArtifactId: string | null = null;
    let presetRevisionId: string | null = null;
    let workId: string | null = null;
    let workRevisionId: string | null = null;
    let blobId: string | null = null;
    let deletionEventId: string | null = null;

    try {
      const { data: created, error: createError } = await ctx.supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (createError || !created.user) throw createError ?? new Error('Auth fixture creation failed');
      providerUserId = created.user.id;

      const authClient = createClient(projectUrl, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      const { data: signedIn, error: signInError } = await authClient.auth.signInWithPassword({
        email,
        password
      });
      if (signInError || !signedIn.session) throw signInError ?? new Error('Synthetic sign-in failed');
      accessToken = signedIn.session.access_token;

      const userHeaders = {
        apikey: publishableKey,
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json'
      };

      const bootstrap = await jsonOrThrow(
        await fetch(`${projectUrl}/functions/v1/community-command`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({
            command: 'ensureAccountCreator',
            payload: {
              handle,
              displayName: 'Retention E2E'
            }
          })
        }),
        'Community bootstrap failed'
      );

      accountId = String(bootstrap.data?.accountId ?? '');
      creatorProfileId = String(bootstrap.data?.creatorProfileId ?? '');
      if (!accountId || !creatorProfileId) throw new Error('Bootstrap IDs missing');

      const artifact = {
        schema: 'dreamwish-wand-preset',
        artifactVersion: 1,
        type: 'scene',
        originPolicy: 'capture-region-top-left',
        bounds: { w: 1, h: 1 },
        objects: [
          {
            artifactObjectId: 'retention-fixture-object',
            itemId: 1,
            localX: 0,
            localY: 0,
            orientation: 0,
            footprint: [{ x: 0, y: 0 }],
            dependencyIds: []
          }
        ]
      };
      const artifactText = JSON.stringify(artifact);
      const artifactBytes = new TextEncoder().encode(artifactText);

      const prepared = await jsonOrThrow(
        await fetch(`${projectUrl}/functions/v1/wep-preset-artifact`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({
            action: 'prepare',
            byteSize: artifactBytes.byteLength
          })
        }),
        'Preset prepare failed'
      );

      storageKey = String(prepared.storageKey ?? '');
      const signedUrl = String(prepared.signedUpload?.signedUrl ?? '');
      if (!storageKey || !signedUrl) throw new Error('Preset signed upload data missing');

      const form = new FormData();
      form.append('cacheControl', '3600');
      form.append(
        '',
        new Blob([artifactBytes], { type: 'application/json' }),
        'retention-e2e.json'
      );

      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'x-upsert': 'false' },
        body: form
      });
      if (!uploadResponse.ok) {
        throw new Error(`Preset signed upload failed (HTTP ${uploadResponse.status})`);
      }

      const published = await jsonOrThrow(
        await fetch(`${projectUrl}/functions/v1/wep-preset-artifact`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({
            action: 'publish',
            storageKey,
            creatorProfileId,
            visibility: 'private',
            title: 'Retention E2E',
            description: 'Disposable staging retention fixture',
            metadata: { testFixture: 'preset-retention-e2e', runId },
            idempotencyKey: `retention-e2e-${runId}`
          })
        }),
        'Preset publish failed'
      );

      publishedStorageKey = String(published.data?.storageKey ?? '');
      presetArtifactId = String(published.data?.presetArtifactId ?? '');
      presetRevisionId = String(published.data?.presetRevisionId ?? '');
      workId = String(published.data?.workId ?? '');
      workRevisionId = String(published.data?.workRevisionId ?? '');

      if (!publishedStorageKey || !presetArtifactId || !presetRevisionId || !workId || !workRevisionId) {
        throw new Error('Preset publication IDs missing');
      }

      const { data: blob, error: blobError } = await ctx.supabaseAdmin
        .from('artifact_blobs')
        .select('blob_id,storage_key,purged_at')
        .eq('storage_key', publishedStorageKey)
        .single();
      if (blobError || !blob) throw blobError ?? new Error('ArtifactBlob lookup failed');
      blobId = String(blob.blob_id);

      const deleted = await jsonOrThrow(
        await fetch(`${projectUrl}/functions/v1/community-account`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({ action: 'deleteAccount', confirmation: 'DELETE' })
        }),
        'Wand account tombstone failed'
      );

      deletionEventId = String(deleted.data?.deletionEventId ?? '');
      if (!deletionEventId) throw new Error('DeletionEvent ID missing');

      const { error: providerDeleteError } =
        await ctx.supabaseAdmin.auth.admin.deleteUser(providerUserId);
      if (providerDeleteError) throw providerDeleteError;

      return reply({
        ok: true,
        runId,
        accountId,
        creatorProfileId,
        deletionEventId,
        presetArtifactId,
        presetRevisionId,
        workId,
        workRevisionId,
        blobId,
        storageKey: publishedStorageKey,
        providerUserDeleted: true
      });
    } catch (error) {
      if (providerUserId) {
        await ctx.supabaseAdmin.auth.admin.deleteUser(providerUserId).catch(() => undefined);
      }
      if (storageKey) {
        await ctx.supabaseAdmin.storage
          .from('wand-preset-artifacts-staging')
          .remove([storageKey])
          .catch(() => undefined);
      }
      if (publishedStorageKey && publishedStorageKey !== storageKey) {
        await ctx.supabaseAdmin.storage
          .from('wand-preset-artifacts-staging')
          .remove([publishedStorageKey])
          .catch(() => undefined);
      }

      return reply(
        {
          ok: false,
          error: 'RETENTION_E2E_SETUP_FAILED',
          message: error instanceof Error ? error.message : String(error)
        },
        500
      );
    }
  })
};
