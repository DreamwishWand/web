<script lang="ts">
  import { onMount } from 'svelte';
  import { CommunityLabClient, type CommunitySession } from '$lib/community/staging-http-client';

  const CONFIG_KEY = 'dreamwishwand-community-lab-config-v1';

  let supabaseUrl = 'https://ptpdoxhrqopvczpclcij.supabase.co';
  let publishableKey = '';
  let email = '';
  let password = '';

  let client: CommunityLabClient | null = null;
  let session: CommunitySession | null = null;
  let identity: any = null;
  let selectedFile: File | null = null;
  let media: any = null;
  let draft: any = null;
  let published: any = null;
  let queriedWork: any = null;

  let handle = '';
  let displayName = 'Community Lab Creator';
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

  async function signIn() {
    const active = configureClient();
    const result = await run('Auth sign-in', () => active.signInWithPassword(email, password));
    if (result) {
      session = active.session;
      password = '';
    }
  }

  async function signOut() {
    if (!client) return;
    await run('Auth sign-out', () => client!.signOut());
    session = null;
    identity = null;
    media = null;
    draft = null;
    published = null;
    queriedWork = null;
  }

  async function ensureIdentity() {
    if (!client) return;

    const result = await run('Stable identity', async () => {
      const created = await client!.command('ensureAccountCreator', {
        handle,
        displayName
      });
      const me = await client!.query('me');
      return { created, me };
    });

    if (result) {
      identity = result;
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
      client!.command('publishGallery', {
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
      await queryPublishedWork();
    }
  }

  async function queryPublishedWork() {
    if (!client) return;
    const workId = published?.data?.workId ?? draft?.data?.workId;
    if (!workId) return;

    const result = await run('Authorized work query', () => client!.query('work', { workId }));
    if (result) queriedWork = result;
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
          <button on:click={signIn} disabled={busy || !email || !password || !publishableKey}>
            Sign in
          </button>
          <button class="secondary" on:click={signOut} disabled={busy || !session}>Sign out</button>
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
        <button on:click={ensureIdentity} disabled={busy || !session || !handle || !displayName}>
          Ensure WandAccount + Creator
        </button>
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
        </div>
        <div class="lab-result-grid">
          <pre>{published ? JSON.stringify(published, null, 2) : 'Not published.'}</pre>
          <pre>{queriedWork ? JSON.stringify(queriedWork, null, 2) : 'No work readback.'}</pre>
        </div>
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
