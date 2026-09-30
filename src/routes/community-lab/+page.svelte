<script lang="ts">
  import { onMount } from 'svelte';
  import { CommunityLabClient, type CommunitySession } from '$lib/community/staging-http-client';

  const CONFIG_KEY = 'dreamwishwand-community-lab-config-v1';
  const TARGET_KEY = 'dreamwishwand-community-lab-target-v1';

  type WorkResultData = {
    workId?: string;
    creatorProfileId?: string;
    rowVersion?: number;
    caseId?: string;
    commentId?: string;
  };

  type CreatorResultData = {
    accountId?: string;
    creatorProfileId?: string;
    handle?: string;
    displayName?: string;
    bio?: string | null;
    profileVisibility?: string;
    rowVersion?: number;
  };

  let supabaseUrl = 'https://ptpdoxhrqopvczpclcij.supabase.co';
  let publishableKey = '';
  let email = '';
  let password = '';
  let newPassword = '';
  let reauthNonce = '';

  let client: CommunityLabClient | null = null;
  let session: CommunitySession | null = null;
  let identity: any = null;
  let selectedFile: File | null = null;
  let media: any = null;
  let draft: any = null;
  let published: any = null;
  let queriedWork: any = null;
  let targetQuery: any = null;
  let savedQuery: any = null;
  let notificationsQuery: any = null;
  let discoveryQuery: any = null;
  let deadLetterQuery: any = null;
  let interactions: Record<string, unknown> = {};

  let targetWorkId = '';
  let targetCreatorProfileId = '';
  let targetRowVersion = 0;
  let commentBody = 'Community Lab comment';
  let parentCommentId = '';
  let replyBody = 'Community Lab reply from current actor';
  let reportCaseId = '';
  let moderationAction = 'restrict';
  let moderationReason = 'Community Lab moderator runtime probe';
  let ownerVisibility = 'private';
  let deadLetterOutboxId = '';
  let deadLetterReason = 'Reviewed in Community Lab and safe to retry';

  let handle = '';
  let displayName = 'Community Lab Creator';
  let creatorBio = '';
  let creatorProfileVisibility = 'public';
  let visibility = 'unlisted';
  let galleryKind = 'outdoor';
  let title = 'Community Lab Gallery';
  let description = 'Internal staging vertical-slice publication.';
  let busy = false;
  let status = 'Ready. Configure staging and sign in.';
  let error = '';
  let log: Array<{ step: string; detail: unknown }> = [];

  onMount(() => {
    try {
      const raw = sessionStorage.getItem(CONFIG_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        supabaseUrl = saved.supabaseUrl || supabaseUrl;
        publishableKey = saved.publishableKey || '';
      }

      const rawTarget = sessionStorage.getItem(TARGET_KEY);
      if (rawTarget) {
        const savedTarget = JSON.parse(rawTarget);
        targetWorkId = savedTarget.targetWorkId || '';
        targetCreatorProfileId = savedTarget.targetCreatorProfileId || '';
        targetRowVersion = Number(savedTarget.targetRowVersion || 0);
        reportCaseId = savedTarget.reportCaseId || '';
        parentCommentId = savedTarget.parentCommentId || '';
      }

      if (!handle) {
        handle = `lab-${crypto.randomUUID().slice(0, 10)}`;
      }

      if (publishableKey) {
        client = new CommunityLabClient({ supabaseUrl, publishableKey });
        session = client.session;
        if (session) status = `Restored session for ${session.email ?? session.userId}.`;
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  });

  function record(step: string, detail: unknown) {
    log = [{ step, detail }, ...log].slice(0, 20);
  }

  function configureClient() {
    sessionStorage.setItem(CONFIG_KEY, JSON.stringify({ supabaseUrl, publishableKey }));
    client = new CommunityLabClient({ supabaseUrl, publishableKey });
    session = client.session;
    return client;
  }

  function persistTargetContext() {
    sessionStorage.setItem(
      TARGET_KEY,
      JSON.stringify({
        targetWorkId,
        targetCreatorProfileId,
        targetRowVersion,
        reportCaseId,
        parentCommentId
      })
    );
  }

  function currentCreatorProfileId(): string {
    return String(
      identity?.me?.data?.creatorProfileId ?? identity?.created?.data?.creatorProfileId ?? ''
    );
  }

  async function run<T>(label: string, action: () => Promise<T>): Promise<T | null> {
    busy = true;
    error = '';
    status = `${label}…`;

    try {
      const result = await action();
      record(label, result);
      status = `${label}: PASS`;
      return result;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      status = `${label}: FAILED`;
      record(label, { error });
      return null;
    } finally {
      busy = false;
    }
  }

  async function signUp() {
    const active = configureClient();
    const result = await run('Auth sign-up', () => active.signUpWithPassword(email, password));

    if (result && result.requiresEmailConfirmation !== true) {
      error = 'Signup returned an immediate session path; email confirmation must remain required.';
      status = 'Auth sign-up: CONFIGURATION FAILED';
    }
  }

  async function signIn() {
    const active = configureClient();
    const result = await run('Auth sign-in', () => active.signInWithPassword(email, password));
    if (result) {
      session = active.session;
      password = '';
    }
  }

  function clearActorState() {
    session = null;
    identity = null;
    media = null;
    draft = null;
    published = null;
    queriedWork = null;
  }

  async function signOut() {
    if (!client) return;
    const result = await run('Auth local sign-out', () => client!.signOut());
    if (result !== null) clearActorState();
  }

  async function revokeAllSessions() {
    if (!client) return;
    const result = await run('Auth global revoke + Wand cutoff', () =>
      client!.revokeAllSessions()
    );
    if (result) clearActorState();
  }

  async function requestPasswordRecovery() {
    const active = client ?? configureClient();
    if (!email) {
      error = 'Email is required for password recovery.';
      return;
    }

    const redirectTo =
      typeof window === 'undefined'
        ? ''
        : new URL('recovery/', window.location.href).toString();

    await run('Password recovery email', () =>
      active.requestPasswordRecovery(email, redirectTo)
    );
  }

  async function requestReauthentication() {
    if (!client) return;
    await run('Request reauthentication nonce', () => client!.requestReauthentication());
  }

  async function changePasswordAfterReauth() {
    if (!client) return;
    const result = await run('Password change + revoke all sessions', () =>
      client!.changePasswordAfterReauthentication(newPassword, reauthNonce)
    );

    if (result) {
      newPassword = '';
      reauthNonce = '';
      clearActorState();
    }
  }

  async function ensureIdentity() {
    if (!client) return;

    const result = await run('Stable identity', async () => {
      const created = await client!.command<CreatorResultData>('ensureAccountCreator', {
        handle,
        displayName
      });
      const me = await client!.query<CreatorResultData>('me');
      return { created, me };
    });

    if (result) {
      identity = result;
      creatorBio = String(result.me?.data?.bio ?? '');
      creatorProfileVisibility = String(result.me?.data?.profileVisibility ?? 'public');
    }
  }

  async function updateCreatorProfile() {
    if (!client) return;

    const before = identity?.me?.data as CreatorResultData | undefined;
    const expectedVersion = Number(before?.rowVersion ?? 0);
    const beforeCreatorProfileId = String(before?.creatorProfileId ?? '');

    if (!expectedVersion || !beforeCreatorProfileId) {
      error = 'Run Stable identity before editing the CreatorProfile.';
      return;
    }

    const result = await run('CreatorProfile stable-ID edit', async () => {
      const updated = await client!.command<CreatorResultData>('updateCreatorProfile', {
        expectedVersion,
        handle,
        displayName,
        bio: creatorBio,
        profileVisibility: creatorProfileVisibility,
        idempotencyKey: crypto.randomUUID()
      });
      const me = await client!.query<CreatorResultData>('me');
      const afterCreatorProfileId = String(me?.data?.creatorProfileId ?? '');

      if (!afterCreatorProfileId || afterCreatorProfileId !== beforeCreatorProfileId) {
        throw new Error('CreatorProfile stable ID changed across edit.');
      }

      return {
        beforeCreatorProfileId,
        updated,
        me,
        stableId: true
      };
    });

    if (result) {
      identity = { ...identity, profileEdit: result, me: result.me };
    }
  }

  async function uploadMedia() {
    if (!client || !selectedFile) return;

    const result = await run('Signed media upload/finalize/read', () =>
      client!.uploadAndFinalizeImage(selectedFile!)
    );

    if (result) {
      media = result;
    }
  }

  async function createDraft() {
    if (!client) return;
    const creatorProfileId =
      identity?.me?.data?.creatorProfileId ?? identity?.created?.data?.creatorProfileId;

    if (!creatorProfileId) {
      error = 'Run Stable identity first.';
      return;
    }

    const result = await run('Gallery draft', () =>
      client!.command('createGalleryDraft', {
        creatorProfileId,
        visibility,
        galleryKind,
        idempotencyKey: crypto.randomUUID()
      })
    );

    if (result) draft = result;
  }

  async function publishGallery() {
    if (!client) return;

    const workId = draft?.data?.workId;
    const expectedVersion = draft?.data?.rowVersion;
    const mediaId = media?.mediaId;

    if (!workId || !expectedVersion || !mediaId) {
      error = 'Draft and finalized media are required before publish.';
      return;
    }

    const result = await run('Media-backed Gallery publish', () =>
      client!.command<WorkResultData>('publishGallery', {
        workId,
        expectedVersion,
        title,
        description,
        mediaIds: [mediaId],
        presetRevisionIds: [],
        idempotencyKey: crypto.randomUUID()
      })
    );

    if (result) {
      published = result;
      targetWorkId = String(result?.data?.workId ?? workId);
      targetCreatorProfileId = currentCreatorProfileId();
      targetRowVersion = Number(result?.data?.rowVersion ?? expectedVersion);
      persistTargetContext();
      await queryPublishedWork();
    }
  }

  async function discoverPublic() {
    const active = client ?? configureClient();
    const result = await run('Public SearchDocument discovery', () =>
      active.discoverPublicWorks(20)
    );

    if (result) {
      const targetFound = targetWorkId
        ? result.some((row) => String(row.work_id ?? '') === targetWorkId)
        : null;
      discoveryQuery = { rows: result, targetWorkId: targetWorkId || null, targetFound };
    }
  }

  async function queryPublishedWork() {
    if (!client) return;
    const workId = published?.data?.workId ?? draft?.data?.workId;
    if (!workId) return;

    const result = await run('Authorized work query', () => client!.query<WorkResultData>('work', { workId }));
    if (result) {
      queriedWork = result;
      targetWorkId = String(result?.data?.workId ?? workId);
      targetCreatorProfileId = String(result?.data?.creatorProfileId ?? targetCreatorProfileId);
      targetRowVersion = Number(result?.data?.rowVersion ?? targetRowVersion);
      persistTargetContext();
    }
  }

  async function queryTargetWork() {
    if (!client || !targetWorkId) return;
    const result = await run('Target work query', () =>
      client!.query<WorkResultData>('work', { workId: targetWorkId })
    );
    if (result) {
      targetQuery = result;
      targetCreatorProfileId = String(result?.data?.creatorProfileId ?? targetCreatorProfileId);
      targetRowVersion = Number(result?.data?.rowVersion ?? targetRowVersion);
      persistTargetContext();
    }
  }

  async function saveTarget() {
    if (!client || !targetWorkId) return;
    const result = await run('B save work', () =>
      client!.command('saveEntity', { targetEntityId: targetWorkId })
    );
    if (result) interactions = { ...interactions, save: result };
  }

  async function unsaveTarget() {
    if (!client || !targetWorkId) return;
    const result = await run('B unsave work', () =>
      client!.command('unsaveEntity', { targetEntityId: targetWorkId })
    );
    if (result) interactions = { ...interactions, unsave: result };
  }

  async function followTargetCreator() {
    if (!client || !targetCreatorProfileId) return;
    const result = await run('B follow creator', () =>
      client!.command('followCreator', { creatorProfileId: targetCreatorProfileId })
    );
    if (result) interactions = { ...interactions, follow: result };
  }

  async function unfollowTargetCreator() {
    if (!client || !targetCreatorProfileId) return;
    const result = await run('B unfollow creator', () =>
      client!.command('unfollowCreator', { creatorProfileId: targetCreatorProfileId })
    );
    if (result) interactions = { ...interactions, unfollow: result };
  }

  async function reactTarget() {
    if (!client || !targetWorkId) return;
    const result = await run('B react', () =>
      client!.command('addReaction', {
        targetEntityId: targetWorkId,
        reactionKind: 'like'
      })
    );
    if (result) interactions = { ...interactions, reaction: result };
  }

  async function removeReactionTarget() {
    if (!client || !targetWorkId) return;
    const result = await run('B remove reaction', () =>
      client!.command('removeReaction', {
        targetEntityId: targetWorkId,
        reactionKind: 'like'
      })
    );
    if (result) interactions = { ...interactions, removeReaction: result };
  }

  async function commentTarget() {
    if (!client || !targetWorkId) return;
    const creatorProfileId = currentCreatorProfileId();
    if (!creatorProfileId) {
      error = 'Run Stable identity for the currently signed-in B account first.';
      return;
    }

    const result = await run('B comment', () =>
      client!.command<WorkResultData>('addComment', {
        creatorProfileId,
        targetEntityId: targetWorkId,
        parentCommentId: null,
        body: commentBody,
        idempotencyKey: crypto.randomUUID()
      })
    );
    if (result) {
      interactions = { ...interactions, comment: result };
      parentCommentId = String(result?.data?.commentId ?? parentCommentId);
      persistTargetContext();
    }
  }

  async function replyToStoredComment() {
    if (!client || !targetWorkId || !parentCommentId) return;
    const creatorProfileId = currentCreatorProfileId();
    if (!creatorProfileId) {
      error = 'Run Stable identity for the currently signed-in replying account first.';
      return;
    }

    const result = await run('Reply to stored comment', () =>
      client!.command<WorkResultData>('addComment', {
        creatorProfileId,
        targetEntityId: targetWorkId,
        parentCommentId,
        body: replyBody,
        idempotencyKey: crypto.randomUUID()
      })
    );
    if (result) interactions = { ...interactions, reply: result };
  }

  async function reportTarget() {
    if (!client || !targetWorkId) return;
    const result = await run('B report', () =>
      client!.command<WorkResultData>('reportEntity', {
        targetEntityId: targetWorkId,
        reasonCode: 'community_lab',
        detail: 'Internal staging acceptance report',
        idempotencyKey: crypto.randomUUID()
      })
    );
    if (result) {
      interactions = { ...interactions, report: result };
      reportCaseId = String(result?.data?.caseId ?? reportCaseId);
      persistTargetContext();
    }
  }

  async function querySaved() {
    if (!client) return;
    const result = await run('SavedItem query', () => client!.query('saved', { limit: 50 }));
    if (result) savedQuery = result;
  }

  async function queryNotifications() {
    if (!client) return;
    const result = await run('Notification query', () =>
      client!.query('notifications', { limit: 50 })
    );
    if (result) notificationsQuery = result;
  }

  async function negativeAuthorizationProbe() {
    if (!client || !targetWorkId || !targetRowVersion) return;
    busy = true;
    error = '';
    status = 'Negative authorization probe…';

    const probes = [
      {
        name: 'changeVisibility',
        payload: {
          workId: targetWorkId,
          expectedVersion: targetRowVersion,
          visibility: 'private',
          idempotencyKey: crypto.randomUUID()
        }
      },
      {
        name: 'unpublishWork',
        payload: {
          workId: targetWorkId,
          expectedVersion: targetRowVersion,
          idempotencyKey: crypto.randomUUID()
        }
      },
      {
        name: 'deleteWork',
        payload: {
          workId: targetWorkId,
          expectedVersion: targetRowVersion,
          idempotencyKey: crypto.randomUUID()
        }
      }
    ];

    try {
      const results: Record<string, string> = {};
      for (const probe of probes) {
        try {
          await client.command(probe.name, probe.payload);
          throw new Error(`${probe.name} unexpectedly succeeded`);
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          if (message.includes('unexpectedly succeeded')) throw cause;
          results[probe.name] = message;
        }
      }
      interactions = { ...interactions, negativeAuthorization: results };
      record('B negative authorization', results);
      status = 'B negative authorization: PASS (all rejected)';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      status = 'B negative authorization: FAILED';
      record('B negative authorization', { error });
    } finally {
      busy = false;
    }
  }

  async function moderateTarget() {
    if (!client || !reportCaseId) return;
    const result = await run(`Moderator ${moderationAction}`, () =>
      client!.command('moderateWork', {
        caseId: reportCaseId,
        action: moderationAction,
        reason: moderationReason
      })
    );
    if (result) interactions = { ...interactions, moderation: result };
  }

  async function ownerChangeVisibility() {
    if (!client || !targetWorkId || !targetRowVersion) return;
    const result = await run(`Owner visibility -> ${ownerVisibility}`, () =>
      client!.command<WorkResultData>('changeVisibility', {
        workId: targetWorkId,
        expectedVersion: targetRowVersion,
        visibility: ownerVisibility,
        idempotencyKey: crypto.randomUUID()
      })
    );

    if (result) {
      interactions = { ...interactions, ownerVisibility: result };
      targetRowVersion = Number(result?.data?.rowVersion ?? targetRowVersion);
      persistTargetContext();
    }
  }

  async function ownerUnpublish() {
    if (!client || !targetWorkId || !targetRowVersion) return;
    const result = await run('Owner unpublish', () =>
      client!.command<WorkResultData>('unpublishWork', {
        workId: targetWorkId,
        expectedVersion: targetRowVersion,
        idempotencyKey: crypto.randomUUID()
      })
    );

    if (result) {
      interactions = { ...interactions, ownerUnpublish: result };
      targetRowVersion = Number(result?.data?.rowVersion ?? targetRowVersion);
      persistTargetContext();
    }
  }

  async function ownerDelete() {
    if (!client || !targetWorkId || !targetRowVersion) return;
    const result = await run('Owner soft delete', () =>
      client!.command<WorkResultData>('deleteWork', {
        workId: targetWorkId,
        expectedVersion: targetRowVersion,
        idempotencyKey: crypto.randomUUID()
      })
    );

    if (result) {
      interactions = { ...interactions, ownerDelete: result };
      targetRowVersion = Number(result?.data?.rowVersion ?? targetRowVersion);
      persistTargetContext();
    }
  }

  async function queryDeadLetters() {
    if (!client) return;
    const result = await run('Dead-letter queue query', () =>
      client!.query('deadLetters', { limit: 50 })
    );
    if (result) deadLetterQuery = result;
  }

  async function retryDeadLetter() {
    if (!client || !deadLetterOutboxId || !deadLetterReason.trim()) return;
    const result = await run('Dead-letter audited retry', () =>
      client!.command('retryDeadLetter', {
        outboxId: deadLetterOutboxId,
        reason: deadLetterReason
      })
    );
    if (result) {
      interactions = { ...interactions, deadLetterRetry: result };
      await queryDeadLetters();
    }
  }

  function fileChanged(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    selectedFile = input.files?.[0] ?? null;
  }
</script>

<svelte:head>
  <title>Community Lab — Dreamwish Wand</title>
  <meta
    name="description"
    content="Internal staging path for Dreamwish Wand Community Core acceptance."
  />
</svelte:head>

<section class="inside-page">
  <div class="container lab-shell">
    <div class="lab-heading">
      <div>
        <p class="lab-kicker">INTERNAL · STAGING ONLY</p>
        <h1>Community Lab</h1>
        <p class="page-intro">
          Product-shaped acceptance path for Supabase Auth → Community Edge APIs → validated media →
          immutable Gallery publication. This route is intentionally absent from public navigation.
        </p>
      </div>
      <div class:lab-pass={!error} class:lab-fail={!!error} class="lab-status">{status}</div>
    </div>

    {#if error}
      <div class="lab-error"><strong>Failure</strong><span>{error}</span></div>
    {/if}

    <div class="lab-grid">
      <article class="lab-card">
        <span class="lab-step">01</span>
        <h2>Staging + Auth</h2>
        <label>
          Supabase URL
          <input bind:value={supabaseUrl} autocomplete="off" spellcheck="false" />
        </label>
        <label>
          Publishable key
          <input
            bind:value={publishableKey}
            type="password"
            autocomplete="off"
            placeholder="sb_publishable_…"
          />
        </label>
        <div class="lab-two">
          <label>
            Email
            <input bind:value={email} type="email" autocomplete="username" />
          </label>
          <label>
            Password
            <input bind:value={password} type="password" autocomplete="current-password" />
          </label>
        </div>
        <div class="lab-actions">
          <button on:click={signUp} disabled={busy || !email || !password || !publishableKey}>
            Sign up + send confirmation
          </button>
          <button on:click={signIn} disabled={busy || !email || !password || !publishableKey}>
            Sign in
          </button>
          <button class="secondary" on:click={signOut} disabled={busy || !session}>
            Sign out this session
          </button>
          <button class="secondary" on:click={revokeAllSessions} disabled={busy || !session}>
            Revoke all sessions
          </button>
          <button
            class="secondary"
            on:click={requestPasswordRecovery}
            disabled={busy || !email || !publishableKey}
          >
            Send recovery email
          </button>
        </div>
        <p class="lab-meta">
          Signup uses the normal Supabase email/password path and requires email confirmation.
          "Revoke all sessions" first invalidates provider refresh sessions, then advances the Wand
          session cutoff so already-issued access JWTs are rejected immediately by Community APIs.
          Recovery uses PKCE and returns to the internal recovery route.
        </p>
        <div class="lab-two">
          <label>
            New password
            <input bind:value={newPassword} type="password" autocomplete="new-password" />
          </label>
          <label>
            Reauthentication nonce
            <input bind:value={reauthNonce} autocomplete="one-time-code" />
          </label>
        </div>
        <div class="lab-actions">
          <button
            class="secondary"
            on:click={requestReauthentication}
            disabled={busy || !session}
          >
            Send reauthentication nonce
          </button>
          <button
            class="secondary"
            on:click={changePasswordAfterReauth}
            disabled={busy || !session || !newPassword || !reauthNonce}
          >
            Change password + revoke all
          </button>
        </div>
        <p class="lab-meta">
          {#if session}
            JWT session: <strong>{session.email ?? session.userId}</strong>
          {:else}
            No authenticated session.
          {/if}
        </p>
      </article>

      <article class="lab-card">
        <span class="lab-step">02</span>
        <h2>Stable identity</h2>
        <div class="lab-two">
          <label>
            Handle
            <input bind:value={handle} autocomplete="off" />
          </label>
          <label>
            Display name
            <input bind:value={displayName} autocomplete="off" />
          </label>
        </div>
        <div class="lab-two">
          <label>
            Bio
            <input bind:value={creatorBio} autocomplete="off" />
          </label>
          <label>
            Profile visibility
            <select bind:value={creatorProfileVisibility}>
              <option value="public">public</option>
              <option value="unlisted">unlisted</option>
              <option value="private">private</option>
            </select>
          </label>
        </div>
        <div class="lab-actions">
          <button on:click={ensureIdentity} disabled={busy || !session || !handle || !displayName}>
            Ensure WandAccount + Creator
          </button>
          <button
            class="secondary"
            on:click={updateCreatorProfile}
            disabled={busy || !session || !identity || !handle || !displayName}
          >
            Edit profile + prove stable ID
          </button>
        </div>
        <pre>{identity ? JSON.stringify(identity, null, 2) : 'Awaiting identity round-trip.'}</pre>
      </article>

      <article class="lab-card">
        <span class="lab-step">03</span>
        <h2>Validated media</h2>
        <label>
          JPEG / PNG / WebP
          <input type="file" accept="image/jpeg,image/png,image/webp" on:change={fileChanged} />
        </label>
        <button on:click={uploadMedia} disabled={busy || !session || !selectedFile}>
          Signed upload → finalize → read
        </button>
        {#if selectedFile}
          <p class="lab-meta">{selectedFile.name} · {selectedFile.type} · {selectedFile.size} bytes</p>
        {/if}
        {#if media?.read?.media?.signedUrl}
          <img class="lab-preview" src={media.read.media.signedUrl} alt="Validated staging upload" />
        {/if}
        <pre>{media ? JSON.stringify(media, null, 2) : 'No finalized MediaAsset yet.'}</pre>
      </article>

      <article class="lab-card">
        <span class="lab-step">04</span>
        <h2>Gallery draft</h2>
        <div class="lab-two">
          <label>
            Visibility
            <select bind:value={visibility}>
              <option value="unlisted">unlisted</option>
              <option value="private">private</option>
              <option value="public">public</option>
            </select>
          </label>
          <label>
            Gallery kind
            <select bind:value={galleryKind}>
              <option value="outdoor">outdoor</option>
              <option value="indoor">indoor</option>
            </select>
          </label>
        </div>
        <button on:click={createDraft} disabled={busy || !session || !identity}>Create draft</button>
        <pre>{draft ? JSON.stringify(draft, null, 2) : 'No draft yet.'}</pre>
      </article>

      <article class="lab-card lab-wide">
        <span class="lab-step">05</span>
        <h2>Immutable publish + readback</h2>
        <label>
          Title
          <input bind:value={title} />
        </label>
        <label>
          Description
          <textarea bind:value={description} rows="3"></textarea>
        </label>
        <div class="lab-actions">
          <button on:click={publishGallery} disabled={busy || !draft || !media}>
            Publish with validated media
          </button>
          <button class="secondary" on:click={queryPublishedWork} disabled={busy || !draft}>
            Query work
          </button>
          <button class="secondary" on:click={discoverPublic} disabled={busy || !publishableKey}>
            Public discovery (no user JWT)
          </button>
        </div>
        <div class="lab-result-grid">
          <pre>{published ? JSON.stringify(published, null, 2) : 'Not published.'}</pre>
          <pre>{queriedWork ? JSON.stringify(queriedWork, null, 2) : 'No work readback.'}</pre>
          <pre>{discoveryQuery
              ? JSON.stringify(discoveryQuery, null, 2)
              : 'No public discovery query.'}</pre>
        </div>
      </article>


      <article class="lab-card lab-wide">
        <span class="lab-step">06</span>
        <h2>User B interactions + authorization</h2>
        <p class="lab-meta">
          Keep these target IDs from User A, sign out A, sign in as B, then run Stable identity again
          for B before commenting. Target context is stored only in this tab's sessionStorage.
        </p>
        <div class="lab-two">
          <label>
            Target work ID
            <input bind:value={targetWorkId} on:change={persistTargetContext} />
          </label>
          <label>
            A CreatorProfile ID
            <input bind:value={targetCreatorProfileId} on:change={persistTargetContext} />
          </label>
        </div>
        <label>
          Target rowVersion
          <input
            type="number"
            min="0"
            bind:value={targetRowVersion}
            on:change={persistTargetContext}
          />
        </label>
        <div class="lab-two">
          <label>
            Comment
            <input bind:value={commentBody} />
          </label>
          <label>
            Stored parent comment ID
            <input bind:value={parentCommentId} on:change={persistTargetContext} />
          </label>
        </div>
        <label>
          Reply body
          <input bind:value={replyBody} />
        </label>
        <div class="lab-actions lab-wrap">
          <button on:click={queryTargetWork} disabled={busy || !session || !targetWorkId}>
            Query target
          </button>
          <button on:click={saveTarget} disabled={busy || !session || !targetWorkId}>Save</button>
          <button class="secondary" on:click={unsaveTarget} disabled={busy || !session || !targetWorkId}>
            Unsave
          </button>
          <button
            on:click={followTargetCreator}
            disabled={busy || !session || !targetCreatorProfileId}>Follow A</button
          >
          <button
            class="secondary"
            on:click={unfollowTargetCreator}
            disabled={busy || !session || !targetCreatorProfileId}>Unfollow A</button
          >
          <button on:click={reactTarget} disabled={busy || !session || !targetWorkId}>Like</button>
          <button class="secondary" on:click={removeReactionTarget} disabled={busy || !session || !targetWorkId}>
            Remove Like
          </button>
          <button
            on:click={commentTarget}
            disabled={busy || !session || !targetWorkId || !identity}>Comment</button
          >
          <button
            class="secondary"
            on:click={replyToStoredComment}
            disabled={busy || !session || !targetWorkId || !parentCommentId || !identity}
          >
            Reply as current actor
          </button>
          <button on:click={reportTarget} disabled={busy || !session || !targetWorkId}>Report</button>
          <button
            class="secondary"
            on:click={negativeAuthorizationProbe}
            disabled={busy || !session || !targetWorkId || !targetRowVersion}
          >
            Expect owner mutations to fail
          </button>
          <button class="secondary" on:click={querySaved} disabled={busy || !session}>
            Query Saved
          </button>
          <button class="secondary" on:click={queryNotifications} disabled={busy || !session}>
            Query Notifications
          </button>
        </div>
        <div class="lab-result-grid">
          <pre>{targetQuery ? JSON.stringify(targetQuery, null, 2) : 'No target readback.'}</pre>
          <pre>{interactions ? JSON.stringify(interactions, null, 2) : 'No interactions.'}</pre>
          <pre>{savedQuery ? JSON.stringify(savedQuery, null, 2) : 'No SavedItem query.'}</pre>
          <pre>{notificationsQuery
              ? JSON.stringify(notificationsQuery, null, 2)
              : 'No notification query.'}</pre>
        </div>
      </article>

      <article class="lab-card lab-wide">
        <span class="lab-step">07</span>
        <h2>Moderator restrict / restore</h2>
        <p class="lab-meta">
          After B reports the target, sign in as a staging moderator. The RPC performs the role check;
          a normal user must be rejected.
        </p>
        <div class="lab-two">
          <label>
            Moderation case ID
            <input bind:value={reportCaseId} on:change={persistTargetContext} />
          </label>
          <label>
            Action
            <select bind:value={moderationAction}>
              <option value="restrict">restrict</option>
              <option value="restore">restore</option>
            </select>
          </label>
        </div>
        <label>
          Required reason
          <input bind:value={moderationReason} />
        </label>
        <div class="lab-actions">
          <button
            on:click={moderateTarget}
            disabled={busy || !session || !reportCaseId || !moderationReason}
          >
            Apply moderation
          </button>
          <button class="secondary" on:click={queryTargetWork} disabled={busy || !session || !targetWorkId}>
            Query target after action
          </button>
          <button class="secondary" on:click={queryNotifications} disabled={busy || !session}>
            Query moderator notifications
          </button>
        </div>
      </article>



      <article class="lab-card lab-wide">
        <span class="lab-step">08</span>
        <h2>Owner privacy / unpublish / tombstone</h2>
        <p class="lab-meta">
          Sign back in as A and query the target first to refresh rowVersion. These controls drive the
          product-shaped VS-10/11/15 path. After privacy/unpublish/delete, switch to B and query Saved
          again: the SavedItem may remain, but access must not be granted by that reference.
        </p>
        <div class="lab-two">
          <label>
            Owner visibility target
            <select bind:value={ownerVisibility}>
              <option value="public">public</option>
              <option value="unlisted">unlisted</option>
              <option value="private">private</option>
            </select>
          </label>
          <label>
            Current expected rowVersion
            <input
              type="number"
              min="0"
              bind:value={targetRowVersion}
              on:change={persistTargetContext}
            />
          </label>
        </div>
        <div class="lab-actions">
          <button
            on:click={ownerChangeVisibility}
            disabled={busy || !session || !targetWorkId || !targetRowVersion}
          >
            Change visibility
          </button>
          <button
            class="secondary"
            on:click={ownerUnpublish}
            disabled={busy || !session || !targetWorkId || !targetRowVersion}
          >
            Unpublish
          </button>
          <button
            class="secondary"
            on:click={ownerDelete}
            disabled={busy || !session || !targetWorkId || !targetRowVersion}
          >
            Soft delete
          </button>
          <button class="secondary" on:click={queryTargetWork} disabled={busy || !session || !targetWorkId}>
            Refresh target
          </button>
        </div>
      </article>



      <article class="lab-card lab-wide">
        <span class="lab-step">09</span>
        <h2>Operator dead-letter Outbox</h2>
        <p class="lab-meta">
          Staff-only operational path. Sign in as a staging moderator/admin. Listing and retry are
          server-authorized; retry requires a reason, resets the retry budget and writes an immutable
          AuditEvent. This UI never offers destructive discard.
        </p>
        <div class="lab-two">
          <label>
            Dead-letter outbox ID
            <input bind:value={deadLetterOutboxId} autocomplete="off" />
          </label>
          <label>
            Retry reason
            <input bind:value={deadLetterReason} autocomplete="off" />
          </label>
        </div>
        <div class="lab-actions">
          <button on:click={queryDeadLetters} disabled={busy || !session}>
            Query dead letters
          </button>
          <button
            class="secondary"
            on:click={retryDeadLetter}
            disabled={busy || !session || !deadLetterOutboxId || !deadLetterReason.trim()}
          >
            Audited retry
          </button>
        </div>
        <pre>{deadLetterQuery
            ? JSON.stringify(deadLetterQuery, null, 2)
            : 'No dead-letter queue query yet.'}</pre>
      </article>

      <article class="lab-card lab-wide">
        <span class="lab-step">LOG</span>
        <h2>Latest calls</h2>
        {#if log.length === 0}
          <p class="lab-meta">No calls yet.</p>
        {:else}
          <div class="lab-log">
            {#each log as entry}
              <details>
                <summary>{entry.step}</summary>
                <pre>{JSON.stringify(entry.detail, null, 2)}</pre>
              </details>
            {/each}
          </div>
        {/if}
      </article>
    </div>
  </div>
</section>

<style>
  .lab-shell { max-width: 1100px; }
  .lab-heading { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:28px; align-items:start; margin-bottom:30px; }
  .lab-kicker { color:var(--gold); font-size:10px; font-weight:900; letter-spacing:.22em; margin:0; }
  .lab-status { border:1px solid var(--border); border-radius:999px; padding:9px 13px; font-size:11px; max-width:310px; background:var(--surface); color:var(--ink-soft); }
  .lab-pass { border-color:rgba(95,184,143,.45); }
  .lab-fail { border-color:rgba(220,105,105,.55); }
  .lab-error { display:flex; gap:15px; align-items:flex-start; margin:0 0 20px; padding:15px 18px; border:1px solid rgba(220,105,105,.45); border-radius:14px; background:rgba(180,65,65,.09); color:var(--ink-soft); }
  .lab-error strong { color:var(--ink); }
  .lab-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
  .lab-card { position:relative; border:1px solid var(--border); border-radius:20px; padding:24px; background:var(--surface); box-shadow:var(--shadow); min-width:0; }
  .lab-wide { grid-column:1/-1; }
  .lab-step { display:inline-block; color:var(--gold); font-size:10px; font-weight:900; letter-spacing:.16em; margin-bottom:7px; }
  .lab-card h2 { margin:0 0 18px; font-family:Georgia,serif; font-size:24px; font-weight:500; }
  .lab-card label { display:block; color:var(--ink-soft); font-size:11px; margin:0 0 13px; }
  .lab-card input, .lab-card select, .lab-card textarea { box-sizing:border-box; display:block; width:100%; margin-top:7px; border:1px solid var(--border); border-radius:11px; padding:10px 12px; background:var(--surface-raised); color:var(--ink); font:inherit; }
  .lab-card button { border:1px solid var(--gold-strong); border-radius:999px; background:var(--gold-strong); color:#26304e; padding:10px 15px; font:inherit; font-size:12px; font-weight:800; cursor:pointer; }
  .lab-card button.secondary { background:transparent; color:var(--ink-soft); border-color:var(--border); }
  .lab-card button:disabled { opacity:.42; cursor:not-allowed; }
  .lab-two { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
  .lab-actions { display:flex; flex-wrap:wrap; gap:9px; margin-top:4px; }
  .lab-wrap button { flex:0 0 auto; }
  .lab-meta { color:var(--ink-muted); font-size:11px; line-height:1.7; }
  .lab-card pre { max-height:260px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; border:1px solid var(--border); border-radius:12px; background:var(--surface-raised); color:var(--ink-soft); padding:12px; font-size:10px; line-height:1.6; }
  .lab-preview { display:block; max-width:100%; max-height:250px; margin:13px 0; border-radius:12px; border:1px solid var(--border); }
  .lab-result-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
  .lab-log details { border-top:1px solid var(--border); padding:9px 0; }
  .lab-log summary { cursor:pointer; color:var(--ink-soft); font-size:12px; }
  @media (max-width: 760px) {
    .lab-heading, .lab-grid, .lab-two, .lab-result-grid { grid-template-columns:1fr; }
    .lab-wide { grid-column:auto; }
  }
</style>
