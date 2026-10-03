<script lang="ts">
  import { onMount } from 'svelte';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient, callPublicCommunityRpc } from '$lib/community/browser-client';
  import DreamsnapsTabs from '$lib/community/DreamsnapsTabs.svelte';

  const client = createCommunityBrowserClient();
  let challenge: any = null;
  let creatorProfileId = '';
  let workspaces: any[] = [];
  let selectedWorkspaceId = '';
  let email = '', password = '', handle = '', displayName = '', caption = '';
  let file: File | null = null;
  let gameScreenshotAttested = false;
  let noExternalEditsAttested = false;
  let workId = '', revisionId = '', entryId = '';
  let busy = false, error = '', status = '';

  onMount(() => { void loadChallenge(); if (client?.session) void loadIdentity(); });

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    busy = true; error = ''; status = '';
    try { return await fn(); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); return null; }
    finally { busy = false; }
  }

  async function loadChallenge() {
    challenge = await run(() => callPublicCommunityRpc('community_get_current_dreamsnap_challenge_public_v1')) ?? null;
  }

  async function signIn() {
    if (!client) return;
    const session = await run(() => client.signInWithPassword(email.trim(), password));
    if (!session) return;
    password = '';
    await loadIdentity();
  }

  async function loadIdentity() {
    if (!client?.session) return;
    const me: any = await run(() => client.query('me'));
    creatorProfileId = String(me?.data?.creatorProfileId ?? '');
    const ws: any = await run(() => client.query('ddvProfileWorkspaces'));
    workspaces = (ws?.data ?? []).filter((item: any) => item.lifecycleState === 'active');
  }

  async function ensureCreator() {
    if (!client?.session || !handle.trim() || !displayName.trim()) return;
    const result: any = await run(() => client.command('ensureAccountCreator', {
      handle: handle.trim(), displayName: displayName.trim()
    }));
    creatorProfileId = String(result?.data?.creatorProfileId ?? '');
    if (!creatorProfileId) await loadIdentity();
  }

  async function registerWork() {
    if (!client?.session || !creatorProfileId || !challenge?.challengeId || !file) return;
    const result: any = await run(async () => {
      const uploaded = await client.uploadAndFinalizeImage(file!);
      return client.command('registerDreamsnapWork', {
        creatorProfileId,
        challengeId: challenge.challengeId,
        workspaceId: selectedWorkspaceId || null,
        mediaId: uploaded.mediaId,
        caption: caption.trim() || null,
        gameScreenshotAttested,
        noExternalEditsAttested,
        idempotencyKey: crypto.randomUUID()
      });
    });
    if (!result?.data) return;
    workId = String(result.data.workId ?? '');
    revisionId = String(result.data.revisionId ?? '');
    entryId = '';
    status = t('dreamsnaps.submit.registered', {}, $locale);
  }

  async function joinEvent() {
    if (!client?.session || !workId) return;
    const result: any = await run(() => client.command('joinDreamsnapEvent', {
      workId, idempotencyKey: crypto.randomUUID()
    }));
    if (!result?.data) return;
    entryId = String(result.data.entryId ?? '');
    status = t('dreamsnaps.submit.joined', {}, $locale);
  }

  function chooseFile(event: Event) {
    file = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
  }
</script>

<svelte:head><title>{t('dreamsnaps.tab.submit', {}, $locale)} | Dreamwish Wand</title></svelte:head>

<section class="inside-page container">
  <p class="eyebrow">{t('dreamsnaps.eyebrow', {}, $locale)}</p>
  <h1>{t('dreamsnaps.title', {}, $locale)}</h1>
  <DreamsnapsTabs />

  {#if challenge}
    <article class="challenge" aria-labelledby="current-theme">
      <p class="state">{challenge.state}</p>
      <h2 id="current-theme">{challenge.title}</h2>
      {#if challenge.description}<p>{challenge.description}</p>{/if}
      <p>{t('dreamsnaps.submit.window', {}, $locale)}: <time>{challenge.submissionOpensAt}</time> – <time>{challenge.submissionClosesAt}</time></p>
    </article>
  {:else}
    <div class="notice">{t('dreamsnaps.noCurrentRound', {}, $locale)}</div>
  {/if}

  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else if !client.session}
    <div class="panel auth">
      <label>{t('community.auth.email', {}, $locale)}<input type="email" bind:value={email} autocomplete="email" /></label>
      <label>{t('community.auth.password', {}, $locale)}<input type="password" bind:value={password} autocomplete="current-password" /></label>
      <button type="button" disabled={busy || !email || !password} on:click={signIn}>{t('community.auth.signIn', {}, $locale)}</button>
    </div>
  {:else if !creatorProfileId}
    <div class="panel">
      <p>{t('community.auth.creatorRequired', {}, $locale)}</p>
      <label>{t('community.creator.handle', {}, $locale)}<input bind:value={handle} /></label>
      <label>{t('community.creator.displayName', {}, $locale)}<input bind:value={displayName} /></label>
      <button type="button" disabled={busy || !handle.trim() || !displayName.trim()} on:click={ensureCreator}>{t('community.creator.create', {}, $locale)}</button>
    </div>
  {:else if challenge?.state === 'submission_open'}
    <div class="panel">
      <label>{t('dreamsnaps.submit.workspace', {}, $locale)}
        <select bind:value={selectedWorkspaceId}>
          <option value="">{t('dreamsnaps.submit.workspaceNone', {}, $locale)}</option>
          {#each workspaces as workspace}
            <option value={workspace.workspaceId}>{workspace.displayName ?? `#${workspace.slotIndex}`}</option>
          {/each}
        </select>
      </label>
      <label>{t('dreamsnaps.submit.screenshot', {}, $locale)}
        <input type="file" accept="image/jpeg,image/png,image/webp" on:change={chooseFile} />
      </label>
      <label>{t('dreamsnaps.submit.caption', {}, $locale)}<textarea maxlength="2000" bind:value={caption}></textarea></label>
      <label class="check"><input type="checkbox" bind:checked={gameScreenshotAttested} /> <span>{t('dreamsnaps.submit.attestGame', {}, $locale)}</span></label>
      <label class="check"><input type="checkbox" bind:checked={noExternalEditsAttested} /> <span>{t('dreamsnaps.submit.attestNoEdits', {}, $locale)}</span></label>
      <p class="rule">{t('dreamsnaps.submit.integrityNote', {}, $locale)}</p>
      <button type="button"
        disabled={busy || !file || !gameScreenshotAttested || !noExternalEditsAttested || Boolean(workId)}
        on:click={registerWork}>{t('dreamsnaps.submit.register', {}, $locale)}</button>
    </div>

    {#if workId}
      <section class="panel join">
        <h2>{t('dreamsnaps.submit.registeredHeading', {}, $locale)}</h2>
        <p>{t('dreamsnaps.submit.registeredOnly', {}, $locale)}</p>
        <code>{workId}</code>
        <button type="button" disabled={busy || Boolean(entryId)} on:click={joinEvent}>{t('dreamsnaps.submit.join', {}, $locale)}</button>
        {#if entryId}<p>{t('dreamsnaps.submit.entryId', {}, $locale)} <code>{entryId}</code></p>{/if}
      </section>
    {/if}
  {/if}

  {#if status}<p class="notice" role="status">{status}</p>{/if}
  {#if error}<p class="error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
</section>

<style>
  .challenge,.panel{display:grid;gap:12px;margin-top:20px;padding:20px;border:1px solid var(--border);border-radius:20px;background:var(--surface)}
  .state{margin:0;color:var(--ink-muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}.auth{grid-template-columns:1fr 1fr auto;align-items:end}
  label{display:grid;gap:6px;color:var(--ink-soft)}input,select,textarea{min-height:42px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised);color:var(--ink);padding:9px 11px;font:inherit}textarea{min-height:96px;resize:vertical}
  .check{grid-template-columns:auto 1fr;align-items:start}.check input{min-height:auto;margin-top:3px}.rule{font-size:13px;color:var(--ink-muted)}
  button{min-height:42px;border:1px solid var(--gold);border-radius:999px;background:var(--gold-strong);color:#27324f;padding:8px 14px;font-weight:800}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--gold);outline-offset:3px}.error{color:#ffb6b6}.join code{overflow-wrap:anywhere}
  @media(max-width:680px){.auth{grid-template-columns:1fr}}
</style>
