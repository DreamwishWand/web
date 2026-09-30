import { withSupabase } from 'npm:@supabase/server';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { preflightScene, validatePublishablePreset } from './scene-preset-runtime.ts';

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
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message?: unknown }).message ?? '')
        : '';
    throw new Error(
      `${label}: ${detail}${message ? ` / ${message}` : ''} (HTTP ${response.status})`
    );
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

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return reply({ ok: false, error: 'POST_REQUIRED' }, 405);
    }

    const workerToken = req.headers.get('x-wep-e2e-token') ?? '';
    const { data: workerAuthorized, error: workerAuthError } =
      await ctx.supabaseAdmin.rpc('community_verify_worker_token', {
        p_worker_name: 'wep_preset_flow_e2e',
        p_token: workerToken
      });

    if (workerAuthError || workerAuthorized !== true) {
      return reply({ ok: false, error: 'WORKER_AUTH_INVALID' }, 401);
    }

    const runId = crypto.randomUUID();
    const suffix = runId.replaceAll('-', '').slice(0, 12);
    const email = `wep-flow-e2e-${suffix}@example.invalid`;
    const password = `WepFlow-${crypto.randomUUID()}-Aa9!`;
    const handle = `wepflow${suffix.slice(0, 8)}`;
    const title = `WEP Flow E2E ${suffix}`;
    const projectUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const publishableKey = defaultPublishableKey();

    let providerUserId: string | null = null;
    let accessToken: string | null = null;
    let accountId: string | null = null;
    let creatorProfileId: string | null = null;
    let presetArtifactId: string | null = null;
    let presetRevisionId: string | null = null;
    let workId: string | null = null;
    let workRevisionId: string | null = null;
    let storageKey: string | null = null;
    let publishedStorageKey: string | null = null;
    let deletionEventId: string | null = null;

    try {
      const { data: created, error: createError } =
        await ctx.supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });
      if (createError || !created.user) {
        throw createError ?? new Error('Auth fixture creation failed');
      }
      providerUserId = created.user.id;

      const authClient = createClient(projectUrl, publishableKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
      const { data: signedIn, error: signInError } =
        await authClient.auth.signInWithPassword({ email, password });
      if (signInError || !signedIn.session) {
        throw signInError ?? new Error('Synthetic sign-in failed');
      }
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
              displayName: 'WEP Preset Flow E2E'
            }
          })
        }),
        'Community bootstrap failed'
      );

      accountId = String(bootstrap.data?.accountId ?? '');
      creatorProfileId = String(bootstrap.data?.creatorProfileId ?? '');
      if (!accountId || !creatorProfileId) {
        throw new Error('Bootstrap IDs missing');
      }

      const artifact = {
        schema: 'dreamwish-wand-preset',
        artifactVersion: 1,
        type: 'scene',
        title,
        source: {
          gameVersion: '1.25.0',
          platform: 'synthetic',
          areaKey: 'wep-flow-e2e'
        },
        bounds: { w: 2, h: 2 },
        originPolicy: 'capture-region-top-left',
        objects: [
          {
            artifactObjectId: 'o0',
            itemId: 10,
            layer: 'furniture',
            localX: 0,
            localY: 0,
            orientation: 0,
            footprint: [{ x: 0, y: 0 }],
            portableState: null,
            dependencyIds: []
          }
        ],
        networks: { roads: null, fences: null },
        requirements: {
          itemQuantities: { '10': 1 },
          roadTopology: false,
          fenceTopology: false
        },
        normalization: {
          sourceGridIdsRemoved: true,
          sourceGridObjectIdsRemoved: true,
          dependencyClosureIncluded: true
        }
      };

      const localValidation = validatePublishablePreset(artifact);
      if (!localValidation.ok) {
        throw new Error('Local WEP validation rejected fixture');
      }

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
      const uploadUrl = String(prepared.signedUpload?.signedUrl ?? '');
      if (!storageKey || !uploadUrl) {
        throw new Error('Preset signed upload data missing');
      }

      const form = new FormData();
      form.append('cacheControl', '3600');
      form.append(
        '',
        new Blob([artifactBytes], { type: 'application/json' }),
        'wep-flow-e2e.json'
      );

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'x-upsert': 'false' },
        body: form
      });
      if (!uploadResponse.ok) {
        throw new Error(`Preset upload failed (HTTP ${uploadResponse.status})`);
      }

      const published = await jsonOrThrow(
        await fetch(`${projectUrl}/functions/v1/wep-preset-artifact`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({
            action: 'publish',
            storageKey,
            creatorProfileId,
            visibility: 'public',
            title,
            description: 'Disposable product-shaped WEP Preset flow fixture',
            metadata: { testFixture: 'wep-preset-flow-e2e', runId },
            idempotencyKey: `wep-flow-publish-${runId}`
          })
        }),
        'Preset publish failed'
      );

      presetArtifactId = String(published.data?.presetArtifactId ?? '');
      presetRevisionId = String(published.data?.presetRevisionId ?? '');
      workId = String(published.data?.workId ?? '');
      workRevisionId = String(published.data?.workRevisionId ?? '');
      publishedStorageKey = String(published.data?.storageKey ?? '');

      if (
        !presetArtifactId ||
        !presetRevisionId ||
        !workId ||
        !workRevisionId ||
        !publishedStorageKey
      ) {
        throw new Error('Published Preset IDs missing');
      }

      const search = await jsonOrThrow(
        await fetch(`${projectUrl}/rest/v1/rpc/community_search_public`, {
          method: 'POST',
          headers: {
            apikey: publishableKey,
            accept: 'application/json',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            p_query: title,
            p_work_type: 'preset',
            p_creator_profile_id: creatorProfileId,
            p_tags: null,
            p_limit: 20,
            p_before_published_at: null,
            p_before_work_id: null
          })
        }),
        'Preset public discovery failed'
      );

      if (
        !Array.isArray(search) ||
        !search.some((row: Record<string, unknown>) => String(row.work_id ?? '') === workId)
      ) {
        throw new Error('Published Preset missing from public discovery');
      }

      const resolved = await jsonOrThrow(
        await fetch(`${projectUrl}/functions/v1/wep-preset-artifact`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({
            action: 'resolveWork',
            workId
          })
        }),
        'Preset work resolver failed'
      );

      if (String(resolved.preset?.presetArtifactId ?? '') !== presetArtifactId) {
        throw new Error('Work resolver returned a different PresetArtifact');
      }

      await jsonOrThrow(
        await fetch(`${projectUrl}/functions/v1/community-command`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({
            command: 'saveEntity',
            payload: { targetEntityId: presetArtifactId }
          })
        }),
        'Preset Library save failed'
      );

      const saved = await jsonOrThrow(
        await fetch(`${projectUrl}/functions/v1/community-query`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({
            query: 'saved',
            payload: { limit: 50 }
          })
        }),
        'Preset Library query failed'
      );

      const savedRows = Array.isArray(saved.data) ? saved.data : [];
      const savedRow = savedRows.find(
        (row: Record<string, unknown>) =>
          String(row.targetEntityId ?? '') === presetArtifactId
      );
      if (!savedRow || savedRow.accessible !== true) {
        throw new Error('SavedItem missing or inaccessible');
      }

      const detail = await jsonOrThrow(
        await fetch(`${projectUrl}/functions/v1/community-query`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({
            query: 'preset',
            payload: { presetArtifactId }
          })
        }),
        'Preset detail query failed'
      );

      if (String(detail.data?.presetArtifactId ?? '') !== presetArtifactId) {
        throw new Error('Preset detail identity mismatch');
      }

      const read = await jsonOrThrow(
        await fetch(`${projectUrl}/functions/v1/wep-preset-artifact`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({
            action: 'read',
            presetArtifactId
          })
        }),
        'Preset signed read failed'
      );

      const signedUrl = String(read.preset?.signedUrl ?? '');
      if (!signedUrl) throw new Error('Preset signed URL missing');

      const readResponse = await fetch(signedUrl, { method: 'GET' });
      if (!readResponse.ok) {
        throw new Error(`Preset signed fetch failed (HTTP ${readResponse.status})`);
      }

      const readBuffer = await readResponse.arrayBuffer();
      const expectedBytes = Number(read.preset?.byteSize ?? 0);
      if (readBuffer.byteLength !== expectedBytes) {
        throw new Error('Preset signed read byte-size mismatch');
      }

      const actualChecksum = hex(await crypto.subtle.digest('SHA-256', readBuffer));
      const expectedChecksum = String(read.preset?.checksumSha256 ?? '').toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(expectedChecksum) || actualChecksum !== expectedChecksum) {
        throw new Error('Preset signed read checksum mismatch');
      }

      const downloadedArtifact = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(readBuffer)
      );
      const downloadedValidation = validatePublishablePreset(downloadedArtifact);
      if (!downloadedValidation.ok) {
        throw new Error('Downloaded Preset failed WEP validation');
      }

      const preflight = preflightScene(downloadedArtifact);
      if (!preflight.ok) throw new Error('Downloaded Preset preflight failed');
      if (preflight.writeReady !== false) {
        throw new Error('Preflight unexpectedly authorized persistent write');
      }
      if (preflight.reason !== 'CORE_COMMIT_ADAPTER_NOT_BOUND') {
        throw new Error('Preflight writer-lock reason mismatch');
      }

      await jsonOrThrow(
        await fetch(`${projectUrl}/functions/v1/community-command`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({
            command: 'unsaveEntity',
            payload: { targetEntityId: presetArtifactId }
          })
        }),
        'Preset Library unsave failed'
      );

      const deleted = await jsonOrThrow(
        await fetch(`${projectUrl}/functions/v1/community-account`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({
            action: 'deleteAccount',
            confirmation: 'DELETE'
          })
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
        presetArtifactId,
        presetRevisionId,
        workId,
        workRevisionId,
        storageKey: publishedStorageKey,
        deletionEventId,
        checks: {
          localValidation: true,
          signedUpload: true,
          publish: true,
          publicDiscovery: true,
          workResolve: true,
          librarySaveAndQuery: true,
          presetDetail: true,
          signedRead: true,
          byteSize: true,
          checksumSha256: true,
          downloadedValidation: true,
          destinationPreflight: true,
          persistentWriteLocked: true,
          accountTombstone: true,
          providerUserDeleted: true
        }
      });
    } catch (error) {
      if (accessToken && !deletionEventId) {
        try {
          const deleted = await fetch(
            `${projectUrl}/functions/v1/community-account`,
            {
              method: 'POST',
              headers: {
                apikey: publishableKey,
                authorization: `Bearer ${accessToken}`,
                'content-type': 'application/json'
              },
              body: JSON.stringify({
                action: 'deleteAccount',
                confirmation: 'DELETE'
              })
            }
          );
          if (deleted.ok) {
            const body = await deleted.json().catch(() => ({}));
            deletionEventId = String(body?.data?.deletionEventId ?? '') || null;
          }
        } catch {
          // Cleanup attempt only.
        }
      }

      if (providerUserId) {
        await ctx.supabaseAdmin.auth.admin
          .deleteUser(providerUserId)
          .catch(() => undefined);
      }

      if (storageKey && !publishedStorageKey) {
        await ctx.supabaseAdmin.storage
          .from('wand-preset-artifacts-staging')
          .remove([storageKey])
          .catch(() => undefined);
      }

      return reply(
        {
          ok: false,
          error: 'WEP_PRESET_FLOW_E2E_FAILED',
          message: error instanceof Error ? error.message : String(error),
          runId,
          accountId,
          creatorProfileId,
          presetArtifactId,
          presetRevisionId,
          workId,
          workRevisionId,
          storageKey: publishedStorageKey ?? storageKey,
          deletionEventId
        },
        500
      );
    }
  })
};
