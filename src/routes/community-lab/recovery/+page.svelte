<script lang="ts">
  import { onMount } from 'svelte';
  import { CommunityLabClient } from '$lib/community/staging-http-client';

  let client: CommunityLabClient | null = null;
  let status = 'Waiting for recovery code…';
  let error = '';
  let recoveryReady = false;
  let completed = false;
  let newPassword = '';

  onMount(async () => {
    try {
      const url = new URL(window.location.href);
      const providerError = url.searchParams.get('error_description') ?? url.searchParams.get('error');
      if (providerError) throw new Error(providerError);

      const code = url.searchParams.get('code');
      if (!code) throw new Error('Password-recovery callback code is missing.');

      const config = CommunityLabClient.pendingRecoveryConfig();
      if (!config) {
        throw new Error(
          'No valid PKCE recovery flow is stored in this browser. Start recovery from Community Lab.'
        );
      }

      client = new CommunityLabClient(config);
      status = 'Exchanging PKCE recovery code…';
      await client.exchangePasswordRecoveryCode(code);
      recoveryReady = true;
      status = 'Recovery session established. Set a new password.';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      status = 'Recovery failed.';
    }
  });

  async function completeRecovery() {
    if (!client || !recoveryReady) return;

    error = '';
    status = 'Updating password and revoking all sessions…';

    try {
      await client.completePasswordRecovery(newPassword);
      newPassword = '';
      recoveryReady = false;
      completed = true;
      status = 'Password updated. All provider sessions and prior Wand access JWTs are invalidated.';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      status = 'Password update failed.';
    }
  }
</script>

<svelte:head>
  <title>Password Recovery — Community Lab</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<section class="inside-page">
  <div class="container recovery-shell">
    <p class="recovery-kicker">INTERNAL · STAGING ONLY</p>
    <h1>Password Recovery</h1>
    <p class="page-intro">
      PKCE callback for the Community staging Auth path. This route is intentionally absent from
      public navigation.
    </p>

    <div class="recovery-card">
      <p class:ok={!error} class:failed={!!error} class="recovery-status">{status}</p>

      {#if error}
        <div class="recovery-error">{error}</div>
      {/if}

      {#if recoveryReady}
        <label>
          New password
          <input bind:value={newPassword} type="password" autocomplete="new-password" />
        </label>
        <button on:click={completeRecovery} disabled={newPassword.length < 8}>
          Set password + revoke all sessions
        </button>
        <p class="recovery-note">
          Completion performs the provider password update, global provider sign-out, and the Wand
          session cutoff. Sign in again afterward with the new password.
        </p>
      {/if}

      {#if completed}
        <a class="recovery-link" href="../">Return to Community Lab</a>
      {:else}
        <a class="recovery-link" href="../">Back to Community Lab</a>
      {/if}
    </div>
  </div>
</section>

<style>
  .recovery-shell { max-width: 720px; }
  .recovery-kicker {
    color: var(--gold);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .22em;
  }
  .recovery-card {
    margin-top: 28px;
    padding: 26px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow);
  }
  .recovery-status { color: var(--ink-soft); }
  .recovery-status.ok { color: var(--ink); }
  .recovery-status.failed { color: #c66464; }
  .recovery-error {
    margin: 14px 0;
    padding: 12px;
    border: 1px solid rgba(220,105,105,.45);
    border-radius: 12px;
    background: rgba(180,65,65,.09);
  }
  label {
    display: block;
    margin: 18px 0 12px;
    color: var(--ink-soft);
    font-size: 12px;
  }
  input {
    box-sizing: border-box;
    display: block;
    width: 100%;
    margin-top: 7px;
    padding: 11px 12px;
    border: 1px solid var(--border);
    border-radius: 11px;
    background: var(--surface-raised);
    color: var(--ink);
    font: inherit;
  }
  button {
    border: 1px solid var(--gold-strong);
    border-radius: 999px;
    background: var(--gold-strong);
    color: #26304e;
    padding: 10px 15px;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }
  button:disabled { opacity: .42; cursor: not-allowed; }
  .recovery-note {
    margin: 16px 0;
    color: var(--ink-muted);
    font-size: 11px;
    line-height: 1.7;
  }
  .recovery-link {
    display: inline-block;
    margin-top: 10px;
    color: var(--ink-soft);
  }
</style>
