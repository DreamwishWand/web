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

  let busy = false;
  let status = 'Ready. Sign in with a staging moderator/admin account.';
  let error = '';

  let recoveryState = 'open';
  let recoveryCases: unknown = [];
  let accountId = '';
  let newProvider = 'supabase';
  let newProviderSubject = '';
  let recoveryReason = 'Verified support-assisted recovery';
  let verificationMethod = 'provider_recovery';
  let verificationRef = '';

  let recoveryCaseId = '';
  let verificationNote = 'Provider recovery control confirmed';
  let completionReason = 'Verified recovery handoff complete';

  let cleanupState = 'dead_letter';
  let providerCleanupJobs: unknown = [];
  let cleanupJobId = '';
  let cleanupRetryReason = 'Reviewed provider cleanup failure';

  let deadLetters: unknown = [];
  let outboxId = '';
  let outboxRetryReason = 'Reviewed dead-letter event';

  let alertState = 'open';
  let operationsAlerts: unknown = [];
  let operationsAlertId = '';
  let operationsAlertNote = 'Investigating operations alert';

  let retentionState = 'dead_letter';
  let retentionJobs: unknown = [];
  let retentionJobId = '';
  let retentionRetryReason = 'Reviewed retention purge failure';

  let escalationState = 'dead_letter';
  let operationsEscalations: unknown = [];
  let escalationDeliveryId = '';
  let escalationRetryReason = 'Reviewed external alert delivery failure';

  let securityPolicy: unknown = null;

  let moderationState = 'open';
  let moderationCases: unknown = [];
  let moderationCaseId = '';
  let moderationAction = 'restrict';
  let moderationReason = 'Reviewed reported Community content';

  let retentionAccountId = '';
  let retentionHolds: unknown = [];
  let retentionHoldType = 'security';
  let retentionHoldReason = 'Approved temporary retention hold';
  let retentionHoldExpiresAt = '';
  let retentionHoldId = '';
  let retentionHoldReleaseReason = 'Retention hold no longer required';

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
      const result = await action();
      status = `${label}: PASS`;
      return result;
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
    const result = await run('Admin sign-in', () => active.signInWithPassword(email, password));
    if (result) {
      session = active.session;
      password = '';
    }
  }

  async function signOut() {
    if (!client) return;
    await run('Admin sign-out', () => client!.signOut());
    session = null;
    recoveryCases = [];
    providerCleanupJobs = [];
    deadLetters = [];
    operationsAlerts = [];
    retentionJobs = [];
    retentionHolds = [];
    operationsEscalations = [];
    securityPolicy = null;
    moderationCases = [];
  }

  async function refreshSecurityPolicy() {
    if (!client) return;
    const result = await run('Load security policy', () =>
      client!.admin('getSecurityPolicy', {})
    );
    if (result) securityPolicy = result.data ?? null;
  }

  async function refreshModerationCases() {
    if (!client) return;
    const result = await run('Load moderation cases', () =>
      client!.admin('listModerationCases', {
        state: moderationState || null,
        limit: 50
      })
    );
    if (result) moderationCases = result.data ?? [];
  }

  async function moderateCase() {
    if (!client) return;
    const result = await run('Apply moderation action', () =>
      client!.admin('moderateCase', {
        caseId: moderationCaseId,
        action: moderationAction,
        reason: moderationReason
      })
    );
    if (result) await refreshModerationCases();
  }

  async function refreshRecoveryCases() {
    if (!client) return;
    const result = await run('Load recovery cases', () =>
      client!.admin('listRecoveryCases', {
        state: recoveryState || null,
        limit: 50
      })
    );
    if (result) recoveryCases = result.data ?? [];
  }

  async function openRecoveryCase() {
    if (!client) return;
    const result = await run('Open recovery case', () =>
      client!.admin('openRecoveryCase', {
        accountId,
        newProvider,
        newProviderSubject,
        reason: recoveryReason,
        verificationMethod,
        verificationRef
      })
    );
    if (result) {
      const data = result.data as Record<string, unknown> | undefined;
      recoveryCaseId = String(data?.recoveryCaseId ?? recoveryCaseId);
      newProviderSubject = '';
      await refreshRecoveryCases();
    }
  }

  async function verifyRecoveryCase() {
    if (!client) return;
    const result = await run('Verify recovery case', () =>
      client!.admin('verifyRecoveryCase', {
        recoveryCaseId,
        verificationNote
      })
    );
    if (result) await refreshRecoveryCases();
  }

  async function completeRecoveryCase() {
    if (!client) return;
    const result = await run('Complete recovery case', () =>
      client!.admin('completeRecoveryCase', {
        recoveryCaseId,
        completionReason
      })
    );
    if (result) await refreshRecoveryCases();
  }

  async function refreshProviderCleanup() {
    if (!client) return;
    const result = await run('Load provider cleanup jobs', () =>
      client!.admin('listProviderCleanupJobs', {
        state: cleanupState || null,
        limit: 50
      })
    );
    if (result) providerCleanupJobs = result.data ?? [];
  }

  async function retryProviderCleanup() {
    if (!client) return;
    const result = await run('Retry provider cleanup', () =>
      client!.admin('retryProviderCleanup', {
        cleanupJobId,
        reason: cleanupRetryReason
      })
    );
    if (result) await refreshProviderCleanup();
  }

  async function refreshOutboxDeadLetters() {
    if (!client) return;
    const result = await run('Load outbox dead letters', () =>
      client!.query('deadLetters', { limit: 50 })
    );
    if (result) deadLetters = result.data ?? [];
  }

  async function retryOutboxDeadLetter() {
    if (!client) return;
    const result = await run('Retry outbox dead letter', () =>
      client!.command('retryDeadLetter', {
        outboxId,
        reason: outboxRetryReason
      })
    );
    if (result) await refreshOutboxDeadLetters();
  }

  async function refreshOperationsAlerts() {
    if (!client) return;
    const result = await run('Load operations alerts', () =>
      client!.admin('listOperationsAlerts', {
        state: alertState || null,
        limit: 50
      })
    );
    if (result) operationsAlerts = result.data ?? [];
  }

  async function acknowledgeOperationsAlert() {
    if (!client) return;
    const result = await run('Acknowledge operations alert', () =>
      client!.admin('acknowledgeOperationsAlert', {
        alertId: operationsAlertId,
        note: operationsAlertNote
      })
    );
    if (result) await refreshOperationsAlerts();
  }

  async function refreshOperationsEscalations() {
    if (!client) return;
    const result = await run('Load external alert deliveries', () =>
      client!.admin('listOperationsEscalations', {
        state: escalationState || null,
        limit: 50
      })
    );
    if (result) operationsEscalations = result.data ?? [];
  }

  async function retryOperationsEscalation() {
    if (!client) return;
    const result = await run('Retry external alert delivery', () =>
      client!.admin('retryOperationsEscalation', {
        deliveryId: escalationDeliveryId,
        reason: escalationRetryReason
      })
    );
    if (result) {
      await refreshOperationsEscalations();
      await refreshOperationsAlerts();
    }
  }

  async function refreshRetentionJobs() {
    if (!client) return;
    const result = await run('Load retention jobs', () =>
      client!.admin('listRetentionJobs', {
        state: retentionState || null,
        limit: 50
      })
    );
    if (result) retentionJobs = result.data ?? [];
  }

  async function retryRetentionJob() {
    if (!client) return;
    const result = await run('Retry retention job', () =>
      client!.admin('retryRetentionJob', {
        retentionJobId,
        reason: retentionRetryReason
      })
    );
    if (result) {
      await refreshRetentionJobs();
      await refreshOperationsAlerts();
    }
  }

  async function refreshRetentionHolds() {
    if (!client) return;
    const result = await run('Load retention holds', () =>
      client!.admin('listRetentionHolds', {
        accountId: retentionAccountId || null,
        limit: 50
      })
    );
    if (result) retentionHolds = result.data ?? [];
  }

  async function addRetentionHold() {
    if (!client) return;
    const result = await run('Add retention hold', () =>
      client!.admin('addRetentionHold', {
        accountId: retentionAccountId,
        holdType: retentionHoldType,
        reason: retentionHoldReason,
        expiresAt: retentionHoldExpiresAt || null
      })
    );

    if (result) {
      const data = result.data as Record<string, unknown> | undefined;
      retentionHoldId = String(data?.holdId ?? retentionHoldId);
      await refreshRetentionHolds();
    }
  }

  async function releaseRetentionHold() {
    if (!client) return;
    const result = await run('Release retention hold', () =>
      client!.admin('releaseRetentionHold', {
        holdId: retentionHoldId,
        reason: retentionHoldReleaseReason
      })
    );
    if (result) await refreshRetentionHolds();
  }
</script>

<svelte:head>
  <title>Community Ops — Dreamwish Wand</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<section class="inside-page">
  <div class="container ops-shell">
    <div class="ops-heading">
      <div>
        <p class="ops-kicker">INTERNAL · STAGING ONLY</p>
        <h1>Community Ops</h1>
        <p class="page-intro">
          Staff-only moderation plus admin recovery and operations controls. This route is intentionally
          absent from public navigation.
        </p>
      </div>
      <div class:ops-pass={!error} class:ops-fail={!!error} class="ops-status">{status}</div>
    </div>

    {#if error}
      <div class="ops-error">
        <strong>Failure</strong>
        <span>{error}</span>
      </div>
    {/if}

    <article class="ops-card">
      <h2>Staff session</h2>
      <div class="ops-two">
        <label>
          Supabase URL
          <input bind:value={supabaseUrl} autocomplete="off" spellcheck="false" />
        </label>
        <label>
          Publishable key
          <input bind:value={publishableKey} type="password" autocomplete="off" />
        </label>
      </div>
      <div class="ops-two">
        <label>
          Email
          <input bind:value={email} type="email" autocomplete="username" />
        </label>
        <label>
          Password
          <input bind:value={password} type="password" autocomplete="current-password" />
        </label>
      </div>
      <div class="ops-actions">
        <button on:click={signIn} disabled={busy || !email || !password || !publishableKey}>
          Sign in
        </button>
        <button class="secondary" on:click={signOut} disabled={busy || !session}>
          Sign out
        </button>
      </div>
      <p class="ops-note">
        High-risk writes require the appropriate staff role and a provider session created within the
        configured recent-auth window. Launch defaults are 15 minutes for account deletion,
        support/admin high-risk writes, and moderation staff actions. Refreshing the JWT does not reset
        that window; sign out and sign in again when step-up is required.
      </p>
      <div class="ops-actions">
        <button class="secondary" on:click={refreshSecurityPolicy} disabled={busy || !session}>
          Load security policy
        </button>
      </div>
      {#if securityPolicy}
        <pre>{JSON.stringify(securityPolicy, null, 2)}</pre>
      {/if}
    </article>

    <div class="ops-grid">
      <article class="ops-card">
        <h2>Operations alerts</h2>
        <div class="ops-actions">
          <select bind:value={alertState}>
            <option value="">all</option>
            <option value="open">open</option>
            <option value="acknowledged">acknowledged</option>
            <option value="resolved">resolved</option>
          </select>
          <button on:click={refreshOperationsAlerts} disabled={busy || !session}>
            Refresh
          </button>
        </div>

        <p class="ops-note">
          Persistent alerts cover provider-cleanup, outbox, retention and external-alert-delivery
          dead letters plus provider-cleanup, retention and external-alert worker heartbeat failures.
          External delivery self-monitor alerts are intentionally not fed back into the same external
          transport. Alerts resolve automatically when the underlying condition clears.
        </p>

        <label>
          Open alert ID
          <input bind:value={operationsAlertId} autocomplete="off" />
        </label>
        <label>
          Acknowledgment note
          <input bind:value={operationsAlertNote} autocomplete="off" />
        </label>
        <button
          on:click={acknowledgeOperationsAlert}
          disabled={busy || !session || !operationsAlertId || operationsAlertNote.length < 3}
        >
          Acknowledge alert
        </button>

        <pre>{JSON.stringify(operationsAlerts, null, 2)}</pre>
      </article>

      <article class="ops-card">
        <h2>Moderation queue</h2>
        <p class="ops-note">
          Moderator/admin-only case review. Reporter account identity is intentionally omitted from
          this queue; staff receive the report reason/detail and target state needed to act. Restrict,
          remove and restore require a session created within the 15-minute moderation recent-auth
          window. Completing an action also closes open/triaged reports attached to that case.
        </p>
        <div class="ops-actions">
          <select bind:value={moderationState}>
            <option value="">all</option>
            <option value="open">open</option>
            <option value="reviewing">reviewing</option>
            <option value="resolved">resolved</option>
            <option value="closed">closed</option>
          </select>
          <button on:click={refreshModerationCases} disabled={busy || !session}>
            Refresh cases
          </button>
        </div>
        <label>
          Moderation case ID
          <input bind:value={moderationCaseId} autocomplete="off" />
        </label>
        <label>
          Action
          <select bind:value={moderationAction}>
            <option value="restrict">restrict</option>
            <option value="remove">remove</option>
            <option value="restore">restore</option>
          </select>
        </label>
        <label>
          Moderation reason
          <input bind:value={moderationReason} autocomplete="off" />
        </label>
        <button
          on:click={moderateCase}
          disabled={busy || !session || !moderationCaseId || moderationReason.length < 8}
        >
          Apply moderation action
        </button>
        <pre>{JSON.stringify(moderationCases, null, 2)}</pre>
      </article>

      <article class="ops-card">
        <h2>External alert deliveries</h2>
        <p class="ops-note">
          Provider-neutral critical-alert delivery queue. Self-monitor alerts for this transport are
          visible in Operations alerts but are never recursively delivered through the same worker.
          Retry is recent-auth protected and only allowed while the underlying critical occurrence is
          still open.
        </p>
        <div class="ops-actions">
          <select bind:value={escalationState}>
            <option value="">all</option>
            <option value="pending">pending</option>
            <option value="processing">processing</option>
            <option value="delivered">delivered</option>
            <option value="cancelled">cancelled</option>
            <option value="dead_letter">dead_letter</option>
          </select>
          <button on:click={refreshOperationsEscalations} disabled={busy || !session}>
            Refresh
          </button>
        </div>

        <label>
          Dead-letter delivery ID
          <input bind:value={escalationDeliveryId} autocomplete="off" />
        </label>
        <label>
          Retry reason
          <input bind:value={escalationRetryReason} autocomplete="off" />
        </label>
        <button
          on:click={retryOperationsEscalation}
          disabled={busy || !session || !escalationDeliveryId || escalationRetryReason.length < 8}
        >
          Requeue external alert delivery
        </button>

        <pre>{JSON.stringify(operationsEscalations, null, 2)}</pre>
      </article>

      <article class="ops-card">
        <h2>Moderation cases</h2>
        <p class="ops-note">
          Moderator/admin review queue for user reports. Listings intentionally omit reporter
          account identity. Restrict/remove/restore require a session created within the configured
          moderation recent-auth window. Resolving a case also closes linked open/triaged reports.
        </p>
        <div class="ops-actions">
          <select bind:value={moderationState}>
            <option value="">all</option>
            <option value="open">open</option>
            <option value="reviewing">reviewing</option>
            <option value="resolved">resolved</option>
            <option value="closed">closed</option>
          </select>
          <button on:click={refreshModerationCases} disabled={busy || !session}>
            Refresh
          </button>
        </div>

        <label>
          Moderation case ID
          <input bind:value={moderationCaseId} autocomplete="off" />
        </label>
        <label>
          Action
          <select bind:value={moderationAction}>
            <option value="restrict">restrict</option>
            <option value="remove">remove</option>
            <option value="restore">restore</option>
          </select>
        </label>
        <label>
          Review reason
          <input bind:value={moderationReason} autocomplete="off" />
        </label>
        <button
          on:click={moderateCase}
          disabled={busy || !session || !moderationCaseId || moderationReason.length < 8}
        >
          Apply moderation action
        </button>

        <pre>{JSON.stringify(moderationCases, null, 2)}</pre>
      </article>

      <article class="ops-card">
        <h2>Recovery cases</h2>
        <div class="ops-actions">
          <select bind:value={recoveryState}>
            <option value="">all</option>
            <option value="open">open</option>
            <option value="completed">completed</option>
            <option value="rejected">rejected</option>
            <option value="cancelled">cancelled</option>
          </select>
          <button on:click={refreshRecoveryCases} disabled={busy || !session}>Refresh</button>
        </div>

        <div class="ops-section">
          <h3>Open case</h3>
          <label>
            Target WandAccount ID
            <input bind:value={accountId} autocomplete="off" />
          </label>
          <div class="ops-two">
            <label>
              New provider
              <input bind:value={newProvider} autocomplete="off" />
            </label>
            <label>
              New provider subject
              <input bind:value={newProviderSubject} autocomplete="off" />
            </label>
          </div>
          <label>
            Verification method
            <select bind:value={verificationMethod}>
              <option value="provider_recovery">provider_recovery</option>
            </select>
          </label>
          <label>
            Opaque verification reference
            <input bind:value={verificationRef} autocomplete="off" />
          </label>
          <label>
            Reason
            <input bind:value={recoveryReason} autocomplete="off" />
          </label>
          <button
            on:click={openRecoveryCase}
            disabled={busy || !session || !accountId || !newProvider || !newProviderSubject || verificationRef.length < 8 || recoveryReason.length < 8}
          >
            Open recovery case
          </button>
        </div>

        <div class="ops-section">
          <h3>Verify case</h3>
          <label>
            Recovery case ID
            <input bind:value={recoveryCaseId} autocomplete="off" />
          </label>
          <label>
            Verification note
            <input bind:value={verificationNote} autocomplete="off" />
          </label>
          <button
            on:click={verifyRecoveryCase}
            disabled={busy || !session || !recoveryCaseId || verificationNote.length < 8}
          >
            Verify recovery evidence
          </button>
        </div>

        <div class="ops-section">
          <h3>Complete verified case</h3>
          <label>
            Completion reason
            <input bind:value={completionReason} autocomplete="off" />
          </label>
          <button
            on:click={completeRecoveryCase}
            disabled={busy || !session || !recoveryCaseId || completionReason.length < 8}
          >
            Complete verified recovery
          </button>
        </div>

        <p class="ops-note">
          Recovery is fail-closed: Open → Verify → Complete. Launch support verification currently
          accepts only provider_recovery with an opaque external evidence reference. Public profile
          details or screenshots are not sufficient proof. Linked DDV Profile recovery remains
          disabled until CORE confirms a stable claim/binding contract. Case lists omit the requested
          provider subject and verification-reference value.
        </p>
        <pre>{JSON.stringify(recoveryCases, null, 2)}</pre>
      </article>

      <article class="ops-card">
        <h2>Account retention</h2>
        <p class="ops-note">
          Current engineering defaults are immediate tombstone, content-payload purge after 30 days
          and restricted operational-detail scrub after 365 days. These durations are
          configuration-driven and remain subject to launch privacy/legal review. Open moderation,
          active reports, unresolved provider cleanup and explicit holds delay purge.
        </p>

        <div class="ops-actions">
          <select bind:value={retentionState}>
            <option value="">all jobs</option>
            <option value="pending">pending</option>
            <option value="processing">processing</option>
            <option value="completed">completed</option>
            <option value="dead_letter">dead_letter</option>
          </select>
          <button on:click={refreshRetentionJobs} disabled={busy || !session}>
            Refresh jobs
          </button>
        </div>

        <label>
          Dead-letter retention job ID
          <input bind:value={retentionJobId} autocomplete="off" />
        </label>
        <label>
          Retry reason
          <input bind:value={retentionRetryReason} autocomplete="off" />
        </label>
        <button
          on:click={retryRetentionJob}
          disabled={busy || !session || !retentionJobId || retentionRetryReason.length < 8}
        >
          Requeue retention job
        </button>

        <pre>{JSON.stringify(retentionJobs, null, 2)}</pre>

        <div class="ops-section">
          <h3>Retention holds</h3>
          <label>
            WandAccount ID
            <input bind:value={retentionAccountId} autocomplete="off" />
          </label>
          <div class="ops-actions">
            <button on:click={refreshRetentionHolds} disabled={busy || !session}>
              Refresh holds
            </button>
          </div>
          <label>
            Hold type
            <select bind:value={retentionHoldType}>
              <option value="moderation">moderation</option>
              <option value="security">security</option>
              <option value="legal">legal</option>
            </select>
          </label>
          <label>
            Hold reason
            <input bind:value={retentionHoldReason} autocomplete="off" />
          </label>
          <label>
            Optional expiry (ISO 8601)
            <input bind:value={retentionHoldExpiresAt} autocomplete="off" />
          </label>
          <button
            on:click={addRetentionHold}
            disabled={busy || !session || !retentionAccountId || retentionHoldReason.length < 8}
          >
            Add retention hold
          </button>
          <label>
            Active hold ID
            <input bind:value={retentionHoldId} autocomplete="off" />
          </label>
          <label>
            Release reason
            <input bind:value={retentionHoldReleaseReason} autocomplete="off" />
          </label>
          <button
            on:click={releaseRetentionHold}
            disabled={busy || !session || !retentionHoldId || retentionHoldReleaseReason.length < 8}
          >
            Release retention hold
          </button>
          <pre>{JSON.stringify(retentionHolds, null, 2)}</pre>
        </div>
      </article>

      <article class="ops-card">
        <h2>Provider cleanup</h2>
        <div class="ops-actions">
          <select bind:value={cleanupState}>
            <option value="">all</option>
            <option value="pending">pending</option>
            <option value="processing">processing</option>
            <option value="completed">completed</option>
            <option value="dead_letter">dead_letter</option>
          </select>
          <button on:click={refreshProviderCleanup} disabled={busy || !session}>Refresh</button>
        </div>

        <label>
          Dead-letter cleanup job ID
          <input bind:value={cleanupJobId} autocomplete="off" />
        </label>
        <label>
          Retry reason
          <input bind:value={cleanupRetryReason} autocomplete="off" />
        </label>
        <button
          on:click={retryProviderCleanup}
          disabled={busy || !session || !cleanupJobId || cleanupRetryReason.length < 8}
        >
          Requeue provider cleanup
        </button>

        <p class="ops-note">
          Provider subjects are stored only in the private worker queue and are never returned by
          this admin listing.
        </p>
        <pre>{JSON.stringify(providerCleanupJobs, null, 2)}</pre>
      </article>

      <article class="ops-card">
        <h2>Outbox dead letters</h2>
        <div class="ops-actions">
          <button on:click={refreshOutboxDeadLetters} disabled={busy || !session}>
            Refresh
          </button>
        </div>
        <label>
          Outbox ID
          <input bind:value={outboxId} autocomplete="off" />
        </label>
        <label>
          Retry reason
          <input bind:value={outboxRetryReason} autocomplete="off" />
        </label>
        <button
          on:click={retryOutboxDeadLetter}
          disabled={busy || !session || !outboxId || outboxRetryReason.length < 3}
        >
          Requeue outbox event
        </button>
        <pre>{JSON.stringify(deadLetters, null, 2)}</pre>
      </article>
    </div>
  </div>
</section>

<style>
  .ops-shell {
    max-width: 1180px;
  }

  .ops-heading {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .ops-kicker {
    color: var(--gold);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .22em;
  }

  .ops-status {
    min-width: 180px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink-soft);
    font-size: 11px;
  }

  .ops-pass {
    color: var(--ink);
  }

  .ops-fail {
    color: #c66464;
  }

  .ops-error {
    display: flex;
    gap: 10px;
    margin: 18px 0;
    padding: 12px 14px;
    border: 1px solid rgba(220, 105, 105, .45);
    border-radius: 12px;
    background: rgba(180, 65, 65, .09);
  }

  .ops-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 18px;
    margin-top: 18px;
  }

  .ops-card {
    margin-top: 18px;
    padding: 22px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .ops-card h2,
  .ops-card h3 {
    margin-top: 0;
  }

  .ops-section {
    margin: 18px 0;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .ops-two {
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

  input,
  select {
    box-sizing: border-box;
    width: 100%;
    margin-top: 6px;
    padding: 10px 11px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-raised);
    color: var(--ink);
    font: inherit;
  }

  .ops-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    align-items: center;
    margin: 12px 0;
  }

  .ops-actions select {
    width: auto;
    min-width: 150px;
    margin-top: 0;
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
    background: transparent;
    color: var(--ink);
    border-color: var(--border);
  }

  button:disabled {
    opacity: .42;
    cursor: not-allowed;
  }

  .ops-note {
    color: var(--ink-muted);
    font-size: 11px;
    line-height: 1.7;
  }

  pre {
    overflow: auto;
    max-height: 360px;
    margin-top: 14px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface-raised);
    font-size: 10px;
    line-height: 1.55;
  }

  @media (max-width: 720px) {
    .ops-heading {
      display: block;
    }

    .ops-status {
      margin-top: 14px;
    }

    .ops-two {
      grid-template-columns: 1fr;
    }
  }
</style>
