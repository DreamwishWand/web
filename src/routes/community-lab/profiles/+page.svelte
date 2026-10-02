<script lang="ts">
  import { onMount } from 'svelte';
  import {
    CommunityHttpError,
    CommunityLabClient,
    type CommunitySession
  } from '$lib/community/staging-http-client';

  const CONFIG_KEY = 'dreamwishwand-community-lab-config-v1';

  type Workspace = {
    workspaceId: string;
    slotIndex: number;
    displayName: string | null;
    lifecycleState: 'active' | 'archived';
    relationshipKind: 'self' | 'parent_guardian_managed';
    identityAssociated: boolean;
    identityAssociatedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };

  let supabaseUrl = 'https://ptpdoxhrqopvczpclcij.supabase.co';
  let publishableKey = '';
  let email = '';
  let password = '';

  let client: CommunityLabClient | null = null;
  let session: CommunitySession | null = null;
  let workspaces: Workspace[] = [];
  let selectedWorkspaceId = '';

  let relationshipKind: Workspace['relationshipKind'] = 'self';
  let displayName = '';
  let lifecycleState: Workspace['lifecycleState'] = 'active';
  let playerId = '';
  let deleteConfirmation = '';

  let busy = false;
  let status = 'Ready. Sign in with a disposable staging account.';
  let error = '';
  let result: unknown = null;

  $: selectedWorkspace =
    workspaces.find((workspace) => workspace.workspaceId === selectedWorkspaceId) ?? null;
  $: retainedCount = workspaces.length;
  $: capacityRemaining = Math.max(0, 5 - retainedCount);

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
        if (session) {
          status = `Restored session for ${session.email ?? session.userId}.`;
          void refreshWorkspaces();
        }
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

  function workspaceLabel(workspace: Workspace): string {
    return workspace.displayName?.trim() || `Profile ${workspace.slotIndex}`;
  }

  function applySelection(workspace: Workspace | null) {
    if (!workspace) {
      selectedWorkspaceId = '';
      displayName = '';
      lifecycleState = 'active';
      deleteConfirmation = '';
      playerId = '';
      return;
    }

    selectedWorkspaceId = workspace.workspaceId;
    displayName = workspace.displayName ?? '';
    lifecycleState = workspace.lifecycleState;
    deleteConfirmation = '';
    playerId = '';
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
      if (cause instanceof CommunityHttpError && cause.code === 'RECENT_AUTH_REQUIRED') {
        error =
          'Recent authentication is required for this destructive action. Sign out, sign in again, then retry within 15 minutes.';
      } else {
        error = cause instanceof Error ? cause.message : String(cause);
      }
      status = `${label}: FAILED`;
      return null;
    } finally {
      busy = false;
    }
  }

  async function signIn() {
    const active = configureClient();
    const signed = await run('Profile Workspace sign-in', () =>
      active.signInWithPassword(email, password)
    );

    if (signed) {
      session = active.session;
      password = '';
      await refreshWorkspaces();
    }
  }

  async function signOut() {
    if (!client) return;
    await run('Profile Workspace sign-out', () => client!.signOut());
    session = null;
    workspaces = [];
    applySelection(null);
  }

  async function refreshWorkspaces() {
    if (!client || !client.session) return;

    const response = await run('Load Profile Workspaces', () =>
      client!.query<Workspace[]>('ddvProfileWorkspaces')
    );

    if (!response) return;

    const data = Array.isArray(response.data) ? response.data : [];
    workspaces = data
      .map((item) => item as Workspace)
      .sort((a, b) => a.slotIndex - b.slotIndex);

    if (selectedWorkspaceId) {
      applySelection(
        workspaces.find((workspace) => workspace.workspaceId === selectedWorkspaceId) ?? null
      );
    }
  }

  async function createWorkspace() {
    if (!client) return;

    const response = await run('Create Profile Workspace', () =>
      client!.command<Workspace>('createDdvProfileWorkspace', { relationshipKind })
    );

    if (response) {
      await refreshWorkspaces();
      const createdId = String(response.data?.workspaceId ?? '');
      if (createdId) {
        applySelection(workspaces.find((workspace) => workspace.workspaceId === createdId) ?? null);
      }
    }
  }

  async function updateWorkspace() {
    if (!client || !selectedWorkspaceId) return;

    const response = await run('Update Profile Workspace', () =>
      client!.command<Workspace>('updateDdvProfileWorkspace', {
        workspaceId: selectedWorkspaceId,
        displayName: displayName.trim() || null,
        lifecycleState
      })
    );

    if (response) await refreshWorkspaces();
  }

  async function associateIdentity() {
    if (!client || !selectedWorkspaceId || !playerId) return;

    const submittedPlayerId = playerId;
    playerId = '';

    const response = await run('Associate optional DDV Player ID', () =>
      client!.command<Workspace>('associateDdvIdentity', {
        workspaceId: selectedWorkspaceId,
        playerId: submittedPlayerId
      })
    );

    if (response) await refreshWorkspaces();
  }

  async function unlinkIdentity() {
    if (!client || !selectedWorkspaceId) return;

    const response = await run('Unlink optional DDV Player ID', () =>
      client!.command<Workspace>('unlinkDdvIdentity', {
        workspaceId: selectedWorkspaceId
      })
    );

    if (response) await refreshWorkspaces();
  }

  async function deleteWorkspace() {
    if (!client || !selectedWorkspaceId || deleteConfirmation !== 'DELETE') return;

    const deletingId = selectedWorkspaceId;
    const response = await run('Delete Profile Workspace', () =>
      client!.command('deleteDdvProfileWorkspace', {
        workspaceId: deletingId,
        confirmation: 'DELETE'
      })
    );

    deleteConfirmation = '';

    if (response) {
      applySelection(null);
      await refreshWorkspaces();
    }
  }
</script>

<svelte:head>
  <title>Profile Workspaces — Community Lab</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<section class="inside-page">
  <div class="container profile-shell">
    <p class="profile-kicker">INTERNAL · STAGING ONLY</p>
    <h1>DDV Profile Workspaces</h1>
    <p class="page-intro">
      Acceptance surface for the five-Workspace account boundary and optional DDV Player ID
      association. Player ID is not required to create or use a Workspace.
    </p>

    {#if error}
      <div class="profile-error"><strong>Failure</strong><span>{error}</span></div>
    {/if}

    <article class="profile-card">
      <h2>Staging session</h2>
      <div class="profile-two">
        <label>
          Supabase URL
          <input bind:value={supabaseUrl} autocomplete="off" spellcheck="false" />
        </label>
        <label>
          Publishable key
          <input bind:value={publishableKey} type="password" autocomplete="off" />
        </label>
      </div>
      <div class="profile-two">
        <label>
          Email
          <input bind:value={email} type="email" autocomplete="username" />
        </label>
        <label>
          Password
          <input bind:value={password} type="password" autocomplete="current-password" />
        </label>
      </div>
      <div class="profile-actions">
        <button on:click={signIn} disabled={busy || !email || !password || !publishableKey}>
          Sign in
        </button>
        <button class="secondary" on:click={signOut} disabled={busy || !session}>
          Sign out
        </button>
        <button class="secondary" on:click={refreshWorkspaces} disabled={busy || !session}>
          Refresh
        </button>
      </div>
      <p class="profile-meta">
        {#if session}
          Authenticated as <strong>{session.email ?? session.userId}</strong>.
        {:else}
          No authenticated staging session.
        {/if}
      </p>
    </article>

    <article class="profile-card">
      <div class="profile-heading-row">
        <div>
          <h2>Profile capacity</h2>
          <p class="profile-meta">
            Active + Archived count together. Archiving never frees a slot; deletion does.
          </p>
        </div>
        <strong class="capacity">{retainedCount} / 5 · {capacityRemaining} free</strong>
      </div>

      <div class="profile-two">
        <label>
          New Workspace relationship
          <select bind:value={relationshipKind}>
            <option value="self">self</option>
            <option value="parent_guardian_managed">parent_guardian_managed</option>
          </select>
        </label>
        <div class="profile-create">
          <button on:click={createWorkspace} disabled={busy || !session || retainedCount >= 5}>
            Create next Profile
          </button>
        </div>
      </div>

      {#if workspaces.length === 0}
        <p class="profile-empty">No Profile Workspaces yet. The first Workspace will display as Profile 1.</p>
      {:else}
        <div class="workspace-grid">
          {#each workspaces as workspace}
            <button
              class:selected={workspace.workspaceId === selectedWorkspaceId}
              class="workspace-card"
              on:click={() => applySelection(workspace)}
            >
              <span class="slot">Profile {workspace.slotIndex}</span>
              <strong>{workspaceLabel(workspace)}</strong>
              <span>{workspace.lifecycleState} · {workspace.relationshipKind}</span>
              <span>{workspace.identityAssociated ? 'Player ID associated' : 'No Player ID'}</span>
            </button>
          {/each}
        </div>
      {/if}
    </article>

    {#if selectedWorkspace}
      <article class="profile-card">
        <h2>{workspaceLabel(selectedWorkspace)}</h2>
        <p class="profile-meta">
          Slot {selectedWorkspace.slotIndex}. The slot stays occupied while Active or Archived.
        </p>

        <div class="profile-two">
          <label>
            Private label
            <input
              bind:value={displayName}
              maxlength="80"
              autocomplete="off"
              placeholder={`Profile ${selectedWorkspace.slotIndex}`}
            />
          </label>
          <label>
            Lifecycle
            <select bind:value={lifecycleState}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>

        <div class="profile-actions">
          <button on:click={updateWorkspace} disabled={busy || !session}>
            Save Workspace
          </button>
        </div>
      </article>

      <article class="profile-card">
        <h2>Optional DDV Player ID</h2>
        <p class="profile-meta">
          This is only a continuity/routing association. It is not authentication, ownership proof,
          entitlement proof, or a requirement for using this Workspace. Raw Player ID is not saved
          by this page and the input is cleared after an association attempt.
        </p>

        {#if selectedWorkspace.identityAssociated}
          <p class="identity-state">An optional Player ID is associated with this Workspace.</p>
          <button class="secondary" on:click={unlinkIdentity} disabled={busy || !session}>
            Unlink Player ID
          </button>
        {:else}
          <label>
            DDV Player ID / User ID
            <input
              bind:value={playerId}
              autocomplete="off"
              spellcheck="false"
              placeholder="Enter Player ID"
            />
          </label>
          <button
            on:click={associateIdentity}
            disabled={busy || !session || !playerId}
          >
            Associate Player ID
          </button>
          <p class="profile-meta">
            Staging association requires COMMUNITY_DDV_PROFILE_BINDING_KEY_V1. If that secret is not
            configured, this probe must fail without storing the raw ID.
          </p>
        {/if}
      </article>

      <article class="profile-card danger-card">
        <h2>Delete this Profile Workspace</h2>
        <p class="profile-meta">
          Deletion is irreversible. Workspace-scoped private data is deleted with the Workspace.
          Account/Creator-scoped Gallery posts, Wand Presets, and Q&amp;A/Tips remain independent.
          Deleting the Workspace frees its slot. For safety, deletion also requires a sign-in session
          created within the last 15 minutes; if the server requests recent authentication, sign out
          and sign in again before retrying.
        </p>
        <label>
          Type <strong>DELETE</strong> to confirm
          <input
            bind:value={deleteConfirmation}
            autocomplete="off"
            spellcheck="false"
            placeholder="DELETE"
          />
        </label>
        <button
          class="danger"
          on:click={deleteWorkspace}
          disabled={busy || !session || deleteConfirmation !== 'DELETE'}
        >
          Delete Profile Workspace
        </button>
      </article>
    {/if}

    <article class="profile-card">
      <h2>Runtime result</h2>
      <div class:profile-pass={!error} class:profile-fail={!!error} class="profile-status">{status}</div>
      <pre>{result ? JSON.stringify(result, null, 2) : 'No operation result yet.'}</pre>
    </article>

    <p class="profile-footer"><a href="../">Back to Community Lab</a></p>
  </div>
</section>

<style>
  .profile-shell { max-width: 960px; }
  .profile-kicker { color:var(--gold); font-size:10px; font-weight:900; letter-spacing:.22em; }
  .profile-card { margin-top:20px; padding:24px; border:1px solid var(--border); border-radius:20px; background:var(--surface); box-shadow:var(--shadow); }
  .profile-card h2 { margin:0 0 14px; font-family:Georgia,serif; font-size:24px; font-weight:500; }
  .profile-heading-row { display:flex; align-items:start; justify-content:space-between; gap:18px; }
  .capacity { white-space:nowrap; color:var(--gold-strong); }
  .profile-two { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
  .profile-create { display:flex; align-items:end; padding-bottom:12px; }
  label { display:block; margin:12px 0; color:var(--ink-soft); font-size:12px; }
  input, select { box-sizing:border-box; display:block; width:100%; margin-top:6px; padding:10px 11px; border:1px solid var(--border); border-radius:10px; background:var(--surface-raised); color:var(--ink); font:inherit; }
  .profile-actions { display:flex; flex-wrap:wrap; gap:9px; margin:12px 0; }
  button { border:1px solid var(--gold-strong); border-radius:999px; background:var(--gold-strong); color:#26304e; padding:9px 14px; font:inherit; font-size:12px; font-weight:800; cursor:pointer; }
  button.secondary { border-color:var(--border); background:transparent; color:var(--ink); }
  button.danger { border-color:#bd6262; background:#bd6262; color:white; }
  button:disabled { opacity:.42; cursor:not-allowed; }
  .workspace-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin-top:15px; }
  .workspace-card { display:flex; flex-direction:column; gap:6px; align-items:flex-start; text-align:left; border-color:var(--border); border-radius:14px; background:var(--surface-raised); color:var(--ink-soft); }
  .workspace-card.selected { border-color:var(--gold-strong); box-shadow:0 0 0 1px var(--gold-strong); }
  .workspace-card strong { color:var(--ink); }
  .workspace-card .slot { color:var(--gold); font-size:10px; letter-spacing:.12em; text-transform:uppercase; }
  .profile-meta, .profile-footer, .profile-empty { color:var(--ink-muted); font-size:12px; line-height:1.7; }
  .identity-state { color:var(--ink-soft); }
  .danger-card { border-color:rgba(199,84,84,.35); }
  .profile-error { display:flex; gap:15px; margin:16px 0; padding:13px; border:1px solid rgba(220,105,105,.45); border-radius:12px; background:rgba(180,65,65,.09); }
  .profile-status { margin:12px 0; color:var(--ink-soft); }
  .profile-fail { color:#c66464; }
  pre { overflow:auto; max-height:320px; padding:12px; border:1px solid var(--border); border-radius:12px; background:var(--surface-raised); font-size:10px; line-height:1.55; }
  @media (max-width:720px) {
    .profile-two { grid-template-columns:1fr; }
    .profile-heading-row { flex-direction:column; }
    .profile-create { padding-bottom:0; }
  }
</style>
