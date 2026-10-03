<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient, callPublicCommunityRpc } from '$lib/community/browser-client';
  import QaTagPicker from '$lib/community/QaTagPicker.svelte';

  const client = createCommunityBrowserClient();
  let signedIn = false;
  let creatorProfileId = '';
  let email = '', password = '', handle = '', displayName = '';
  let title = '', body = '', platform = '', gameVersion = '';
  let contextTags: string[] = [];
  let related: any[] = [];
  let busy = false, error = '', publishedQuestionId = '';

  onMount(() => {
    signedIn = Boolean(client?.session);
    if (signedIn) void loadIdentity();
  });

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    busy = true; error = '';
    try { return await fn(); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); return null; }
    finally { busy = false; }
  }

  async function signIn() {
    if (!client) return;
    const session = await run(() => client.signInWithPassword(email.trim(), password));
    if (!session) return;
    password = ''; signedIn = true; await loadIdentity();
  }

  async function loadIdentity() {
    if (!client?.session) return;
    const me: any = await run(() => client.query('me'));
    creatorProfileId = String(me?.data?.creatorProfileId ?? '');
  }

  async function ensureCreator() {
    if (!client?.session || !handle.trim() || !displayName.trim()) return;
    const result: any = await run(() => client.command('ensureAccountCreator', {
      handle: handle.trim(), displayName: displayName.trim()
    }));
    creatorProfileId = String(result?.data?.creatorProfileId ?? '');
    if (!creatorProfileId) await loadIdentity();
  }

  async function findRelated() {
    if (!contextTags.length) { related = []; return; }
    const rows = await run(() => callPublicCommunityRpc<any[]>('community_search_questions_v1', {
      p_query: title.trim() || null,
      p_context_tags: contextTags,
      p_unanswered_only: false,
      p_limit: 10
    }));
    if (rows) related = rows;
  }

  async function publish() {
    if (!client?.session || !creatorProfileId || !title.trim() || !body.trim() || !contextTags.length) return;
    const result: any = await run(() => client.command('askQuestion', {
      creatorProfileId,
      title: title.trim(),
      body: body.trim(),
      contextTags,
      platform: platform.trim() || null,
      gameVersion: gameVersion.trim() || null,
      idempotencyKey: crypto.randomUUID()
    }));
    publishedQuestionId = String(result?.data?.questionId ?? '');
  }

  $: if (contextTags.length) { void findRelated(); }
</script>

<svelte:head><title>{t('community.action.ask', {}, $locale)} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <a class="inline-link" href={`${base}/qa/`}>← {t('qa.title', {}, $locale)}</a>
  <h1>{t('community.action.ask', {}, $locale)}</h1>

  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else if !signedIn}
    <div class="card">
      <label>{t('community.auth.email', {}, $locale)}<input type="email" bind:value={email} autocomplete="email" /></label>
      <label>{t('community.auth.password', {}, $locale)}<input type="password" bind:value={password} autocomplete="current-password" /></label>
      <button type="button" disabled={busy || !email || !password} on:click={signIn}>{t('community.auth.signIn', {}, $locale)}</button>
    </div>
  {:else if !creatorProfileId}
    <div class="card">
      <p>{t('community.auth.creatorRequired', {}, $locale)}</p>
      <label>{t('community.creator.handle', {}, $locale)}<input bind:value={handle} /></label>
      <label>{t('community.creator.displayName', {}, $locale)}<input bind:value={displayName} /></label>
      <button type="button" on:click={ensureCreator} disabled={busy || !handle.trim() || !displayName.trim()}>{t('community.creator.create', {}, $locale)}</button>
    </div>
  {:else}
    <div class="card">
      <QaTagPicker bind:selected={contextTags} />
      <label>{t('qa.ask.title', {}, $locale)}<input maxlength="240" bind:value={title} on:blur={findRelated} /></label>
      <label>{t('qa.ask.body', {}, $locale)}<textarea maxlength="20000" bind:value={body}></textarea></label>
      <div class="two">
        <label>{t('qa.ask.platform', {}, $locale)}<input maxlength="80" bind:value={platform} /></label>
        <label>{t('qa.ask.version', {}, $locale)}<input maxlength="80" bind:value={gameVersion} /></label>
      </div>
      <button type="button" on:click={publish} disabled={busy || !title.trim() || !body.trim() || !contextTags.length}>{t('qa.ask.submit', {}, $locale)}</button>
    </div>

    {#if related.length}
      <section class="related">
        <h2>{t('qa.related', {}, $locale)}</h2>
        {#each related as row}
          <a href={`${base}/qa/?question=${row.question_id}`}><strong>{row.title}</strong><span>{row.text_content}</span></a>
        {/each}
      </section>
    {/if}
  {/if}

  {#if error}<p class="error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
  {#if publishedQuestionId}
    <div class="notice"><a class="inline-link" href={`${base}/qa/?question=${publishedQuestionId}`}>{t('qa.ask.submit', {}, $locale)}</a></div>
  {/if}
</section>

<style>
  .card{display:grid;gap:13px;max-width:760px;margin-top:22px;padding:22px;border:1px solid var(--border);border-radius:20px;background:var(--surface)}label{display:grid;gap:6px;font-size:12px;color:var(--ink-soft)}input,textarea{min-height:43px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised);color:var(--ink);padding:9px 11px;font:inherit}textarea{min-height:120px;resize:vertical}.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}button{min-height:43px;border:1px solid var(--gold);border-radius:999px;background:var(--gold-strong);color:#27324f;padding:8px 14px;font-weight:800}.related{margin-top:24px;display:grid;gap:9px}.related a{display:grid;gap:5px;padding:13px;border:1px solid var(--border);border-radius:13px;color:var(--ink)}.related span{font-size:12px;color:var(--ink-muted)}.error{color:#ffb6b6}@media(max-width:640px){.two{grid-template-columns:1fr}}
</style>
