<script lang="ts">
  import { onMount } from 'svelte';
  import { CommunityLabClient, type CommunitySession } from '$lib/community/staging-http-client';

  const CONFIG_KEY = 'dreamwishwand-community-lab-config-v1';

  let supabaseUrl = 'https://ptpdoxhrqopvczpclcij.supabase.co';
  let publishableKey = '';
  let email = '';
  let password = '';
  let confirmation = '';

  let client: CommunityLabClient | null = null;
  let session: CommunitySession | null = null;
  let result: unknown = null;

  let busy = false;
  let status = 'Ready. Sign in with a disposable staging account.';
  let error = '';

  onMount(() => {
    try {
      const raw = sessionStorage.getItem(CONFIG_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        supabaseUrl = saved.supabaseUrl || supabaseUrl;
        publishableKey = saved.publishableKey || '';
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
      const value = await action();
      result = value;
      status = `${label}: PASS`;
      return value;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      status = `${label}: FAILED`;
      return null;
    } finally {
      busy = false;
    }
  }

  async function signIn() {
    const active = configureClient();
    const signed = await run('Account sign-in', () =>
      active.signInWithPassword(email, password)
    );

    if (signed) {
      session = active.session;
      password = '';
      result = null;
    }
  }

  async function signOut() {
    if (!client) return;
    await run('Account sign-out', () => client!.signOut());
    session = null;
  }

  async function deleteAccount() {
    if (!client) return;

    const deleted = await run('Wand Account tombstone', () =>
      client!.deleteWandAccount(confirmation)
    );

    if (deleted) {
      session = null;
      confirmation = '';
    }
  }
</script>

<svelte:head>
  <title>Account Deletion — Community Lab</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<section class="inside-page">
  <div class="container account-shell">
    <p class="account-kicker">INTERNAL · STAGING ONLY</p>
    <h1>Wand Account Deletion</h1>
    <p class="page-intro">
      Acceptance surface for self-service Community account deletion. This route is intentionally
      absent from public navigation.
    </p>

    <article class="account-card">
      <h2>Disposable staging account</h2>

      <div class="account-two">
        <label>
          Supabase URL
          <input bind:value={supabaseUrl} autocomplete="off" spellcheck="false" />
        </label>
        <label>
          Publishable key
          <input bind:value={publishableKey} type="password" autocomplete="off" />
        </label>
      </div>

      <div class="account-two">
        <label>
          Email
          <input bind:value={email} type="email" autocomplete="username" />
        </label>
        <label>
          Password
          <input bind:value={password} type="password" autocomplete="current-password" />
        </label>
      </div>

      <div class="account-actions">
        <button on:click={signIn} disabled={busy || !email || !password || !publishableKey}>
          Sign in
        </button>
        <button class="secondary" on:click={signOut} disabled={busy || !session}>
          Sign out
        </button>
      </div>

      <p class="account-meta">
        {#if session}
          Authenticated as <strong>{session.email ?? session.userId}</strong>.
        {:else}
          No authenticated staging session.
        {/if}
      </p>
    </article>

    <article class="account-card danger-card">
      <h2>Delete Wand Account</h2>

      <p>
        Deleting this Wand Account is irreversible. Account access, the Creator presence, and owned
        public/private Community works are removed from Community access immediately. Authored
        comments are anonymized, private Saved/Follow/Reaction/notification state and DDV Profile
        Workspaces are removed, Wand sessions are revoked, and provider-account cleanup is queued.
      </p>

      <p>
        User-authored media and Preset payload are physically purged within 7 days unless an
        allowed moderation, security, or legal retention hold applies. Operational detail is
        normally deleted or minimized at 90 days. The 7-day period is not a recovery window.
        Backup/recovery copies and service-provider copies/logs follow separate retention rules.
      </p>

      <p>
        Deletion requires a provider session created within the configured recent-auth window.
        Refreshing an old JWT does not reset that window. If the API returns
        <code>RECENT_AUTH_REQUIRED</code>, sign out and sign in again before retrying.
      </p>

      <label>
        Type <strong>DELETE</strong> to confirm
        <input
          bind:value={confirmation}
          autocomplete="off"
          spellcheck="false"
          placeholder="DELETE"
        />
      </label>

      <button
        class="danger"
        on:click={deleteAccount}
        disabled={busy || !session || confirmation !== 'DELETE'}
      >
        Tombstone Wand Account
      </button>
    </article>

    <article class="account-card">
      <h2>Runtime result</h2>
      <div class:account-pass={!error} class:account-fail={!!error} class="account-status">
        {status}
      </div>

      {#if error}
        <div class="account-error">{error}</div>
      {/if}

      <pre>{result ? JSON.stringify(result, null, 2) : 'No deletion result yet.'}</pre>
    </article>

    <p class="account-footer">
      <a href="../">Back to Community Lab</a>
    </p>
  </div>
</section>

<style>
  .account-shell {
    max-width: 860px;
  }

  .account-kicker {
    color: var(--gold);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .22em;
  }

  .account-card {
    margin-top: 20px;
    padding: 24px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .danger-card {
    border-color: rgba(199, 84, 84, .35);
  }

  .account-two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  label {
    display: block;
    margin: 12px 0;
    color: var(--ink-soft);
    font-size: 12px;
  }

  input {
    box-sizing: border-box;
    display: block;
    width: 100%;
    margin-top: 6px;
    padding: 10px 11px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-raised);
    color: var(--ink);
    font: inherit;
  }

  .account-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin: 12px 0;
  }

  button {
    border: 1px solid var(--gold-strong);
    border-radius: 999px;
    background: var(--gold-strong);
    color: #26304e;
    padding: 9px 14px;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  button.secondary {
    border-color: var(--border);
    background: transparent;
    color: var(--ink);
  }

  button.danger {
    border-color: #bd6262;
    background: #bd6262;
    color: white;
  }

  button:disabled {
    opacity: .42;
    cursor: not-allowed;
  }

  .account-meta,
  .account-footer,
  .account-card p {
    color: var(--ink-muted);
    font-size: 12px;
    line-height: 1.7;
  }

  .account-status {
    margin: 12px 0;
    color: var(--ink-soft);
  }

  .account-pass {
    color: var(--ink);
  }

  .account-fail {
    color: #c66464;
  }

  .account-error {
    margin: 12px 0;
    padding: 12px;
    border: 1px solid rgba(220, 105, 105, .45);
    border-radius: 12px;
    background: rgba(180, 65, 65, .09);
  }

  pre {
    overflow: auto;
    max-height: 320px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface-raised);
    font-size: 10px;
    line-height: 1.55;
  }

  code {
    font-size: .95em;
  }

  @media (max-width: 720px) {
    .account-two {
      grid-template-columns: 1fr;
    }
  }
</style>
