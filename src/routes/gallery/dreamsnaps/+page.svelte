<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient, callPublicCommunityRpc, getPublicCommunityMedia } from '$lib/community/browser-client';

  const client = createCommunityBrowserClient();
  let query = '';
  let works: any[] = [];
  let selected: any = null;
  let mediaUrl = '';
  let email = '', password = '', creatorProfileId = '', commentBody = '';
  let busy = false, error = '', status = '';

  onMount(() => { void browse(); if (client?.session) void loadMe(); });

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    busy = true; error = ''; status = '';
    try { return await fn(); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); return null; }
    finally { busy = false; }
  }

  async function browse() {
    works = await run(() => callPublicCommunityRpc<any[]>('community_search_gallery_dreamsnaps_public_v1', {
      p_query: query.trim() || null, p_limit: 30
    })) ?? [];
  }

  async function openWork(workId: string) {
    selected = await run(() => callPublicCommunityRpc('community_get_gallery_dreamsnap_public_v1', {
      p_work_id: workId
    }));
    mediaUrl = '';
    if (selected?.mediaId) {
      const media = await run(() => getPublicCommunityMedia(String(selected.mediaId)));
      mediaUrl = media?.signedUrl ?? '';
    }
  }

  async function signIn() {
    if (!client) return;
    const session = await run(() => client.signInWithPassword(email.trim(), password));
    if (!session) return;
    password = ''; await loadMe();
  }

  async function loadMe() {
    if (!client?.session) return;
    const me: any = await run(() => client.query('me'));
    creatorProfileId = String(me?.data?.creatorProfileId ?? '');
  }

  async function command(name: string, payload: Record<string,unknown>) {
    if (!client?.session) return null;
    return run(() => client.command(name, payload));
  }

  async function addComment() {
    if (!selected?.workId || !creatorProfileId || !commentBody.trim()) return;
    const ok = await command('addComment', {
      creatorProfileId,
      targetEntityId: selected.workId,
      parentCommentId: null,
      body: commentBody.trim(),
      idempotencyKey: crypto.randomUUID()
    });
    if (ok) { commentBody=''; await openWork(String(selected.workId)); }
  }

  async function report() {
    if (!selected?.workId) return;
    const ok = await command('reportEntity', {
      targetEntityId: selected.workId,
      reasonCode: 'dreamsnap_content',
      detail: null,
      idempotencyKey: crypto.randomUUID()
    });
    if (ok) status = t('dreamsnaps.gallery.reported', {}, $locale);
  }
</script>

<svelte:head><title>{t('dreamsnaps.gallery.title', {}, $locale)} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <a class="inline-link" href={`${base}/gallery/`}>← {t('gallery.title', {}, $locale)}</a>
  <h1>{t('dreamsnaps.gallery.title', {}, $locale)}</h1>
  <p class="page-intro">{t('dreamsnaps.gallery.intro', {}, $locale)}</p>

  <form class="search" on:submit|preventDefault={browse}>
    <label>{t('dreamsnaps.gallery.search', {}, $locale)}<input bind:value={query} /></label>
    <button type="submit">{t('community.action.search', {}, $locale)}</button>
  </form>

  <div class="grid">
    {#each works as work}
      <button class="card" type="button" on:click={() => openWork(String(work.workId))}>
        <strong>{work.challengeTitle}</strong>
        <span>{work.creatorDisplayName}</span>
      </button>
    {:else}<p>{t('dreamsnaps.gallery.empty', {}, $locale)}</p>{/each}
  </div>

  {#if selected}
    <article class="detail">
      <button class="close" type="button" on:click={() => (selected=null)} aria-label={t('community.action.close', {}, $locale)}>×</button>
      {#if mediaUrl}<img src={mediaUrl} alt={t('dreamsnaps.gallery.entryAlt', {}, $locale)} />{/if}
      <div class="body">
        <h2>{selected.challengeTitle}</h2>
        <p>{selected.creator?.displayName ?? ''}</p>
        {#if selected.caption}<p>{selected.caption}</p>{/if}
        {#if selected.officialResult}
          <section>
            <h3>{t('dreamsnaps.results.ingame', {}, $locale)}</h3>
            <pre>{JSON.stringify(selected.officialResult, null, 2)}</pre>
          </section>
        {/if}

        {#if client?.session}
          <div class="actions">
            <button type="button" on:click={() => command('saveEntity', { targetEntityId: selected.workId })}>{t('community.action.save', {}, $locale)}</button>
            <button type="button" on:click={() => command('addReaction', { targetEntityId: selected.workId, reactionKind: 'like' })}>{t('community.action.react', {}, $locale)}</button>
            <button type="button" on:click={report}>{t('community.action.report', {}, $locale)}</button>
          </div>
          {#if selected.commentsEnabled && creatorProfileId}
            <form class="comment" on:submit|preventDefault={addComment}>
              <label>{t('gallery.detail.comments', {}, $locale)}<textarea bind:value={commentBody} maxlength="10000"></textarea></label>
              <button type="submit" disabled={!commentBody.trim()}>{t('community.action.comment', {}, $locale)}</button>
            </form>
          {:else if !selected.commentsEnabled}
            <p>{t('dreamsnaps.gallery.commentsUnavailable', {}, $locale)}</p>
          {/if}
        {:else if client}
          <div class="auth">
            <label>{t('community.auth.email', {}, $locale)}<input type="email" bind:value={email} autocomplete="email" /></label>
            <label>{t('community.auth.password', {}, $locale)}<input type="password" bind:value={password} autocomplete="current-password" /></label>
            <button type="button" on:click={signIn}>{t('community.auth.signIn', {}, $locale)}</button>
          </div>
        {/if}
      </div>
    </article>
  {/if}

  {#if status}<p class="notice" role="status">{status}</p>{/if}
  {#if error}<p class="error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
</section>

<style>
  .search{display:flex;gap:10px;align-items:end;margin:20px 0}.search label,.auth label,.comment label{display:grid;gap:6px;flex:1}input,textarea{min-height:42px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised);color:var(--ink);padding:9px 11px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.card{display:grid;gap:6px;text-align:left}.card,.search button,.actions button,.auth button,.comment button,.close{border:1px solid var(--border);border-radius:14px;background:var(--surface);color:var(--ink);padding:12px}.detail{position:relative;margin-top:24px;border:1px solid var(--border);border-radius:20px;overflow:hidden;background:var(--surface)}.detail>img{display:block;width:100%;max-height:70vh;object-fit:contain;background:var(--surface-raised)}.body{display:grid;gap:12px;padding:18px}.close{position:absolute;right:10px;top:10px;border-radius:999px}.actions,.auth{display:flex;gap:8px;flex-wrap:wrap}.comment{display:grid;gap:8px}textarea{min-height:100px;resize:vertical}pre{white-space:pre-wrap}.error{color:#ffb6b6}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
  @media(max-width:680px){.search,.auth{display:grid}}
</style>
