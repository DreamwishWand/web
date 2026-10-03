<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import {
    createCommunityBrowserClient,
    callPublicCommunityRpc,
    getPublicCommunityMedia
  } from '$lib/community/browser-client';

  const client = createCommunityBrowserClient();
  let query = '';
  let works: any[] = [];
  let selected: any = null;
  let mediaUrls: Record<string,string> = {};
  let creatorProfileId = '';
  let commentBody = '';
  let busy = false, error = '', status = '';

  onMount(() => {
    if (client?.session) void loadIdentity();
    void browse();
    const workId = new URLSearchParams(window.location.search).get('work');
    if (workId) void openWork(workId);
  });

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    busy = true; error = ''; status = '';
    try { return await fn(); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); return null; }
    finally { busy = false; }
  }

  async function loadIdentity() {
    if (!client?.session) return;
    const me: any = await run(() => client.query('me'));
    creatorProfileId = String(me?.data?.creatorProfileId ?? '');
  }

  async function browse() {
    const result = await run(() => callPublicCommunityRpc<any[]>(
      'community_search_gallery_dreamsnaps_public_v1',
      { p_query: query.trim() || null, p_limit: 30 }
    ));
    works = result ?? [];
    for (const work of works) await loadMedia(String(work.mediaId ?? ''));
  }

  async function loadMedia(mediaId: string) {
    if (!mediaId || mediaUrls[mediaId]) return;
    try {
      const signed = await getPublicCommunityMedia(mediaId);
      mediaUrls = { ...mediaUrls, [mediaId]: signed.signedUrl };
    } catch {}
  }

  async function openWork(workId: string) {
    const detail: any = await run(() => callPublicCommunityRpc(
      'community_get_gallery_dreamsnap_public_v1',
      { p_work_id: workId }
    ));
    selected = detail;
    await loadMedia(String(detail?.mediaId ?? ''));
  }

  async function action(name: string, payload: Record<string,unknown>) {
    if (!client?.session) {
      error = t('dreamsnaps.gallery.signInToInteract', {}, $locale);
      return null;
    }
    const result = await run(() => client.command(name, payload));
    if (selected?.workId) await openWork(String(selected.workId));
    return result;
  }

  async function comment() {
    if (!creatorProfileId || !selected?.workId || !commentBody.trim()) return;
    const ok = await action('addComment', {
      creatorProfileId,
      targetEntityId: selected.workId,
      parentCommentId: null,
      body: commentBody.trim(),
      idempotencyKey: crypto.randomUUID()
    });
    if (ok) commentBody = '';
  }

  async function report() {
    if (!selected?.workId) return;
    const ok = await action('reportEntity', {
      targetEntityId: selected.workId,
      reasonCode: 'community_report',
      detail: null,
      idempotencyKey: crypto.randomUUID()
    });
    if (ok) status = t('dreamsnaps.gallery.reported', {}, $locale);
  }
</script>

<svelte:head><title>{t('dreamsnaps.gallery.title', {}, $locale)} | Dreamwish Wand</title></svelte:head>

<section class="inside-page container">
  <a class="inline-link" href={`${base}/gallery/`}>← {t('gallery.title', {}, $locale)}</a>
  <p class="eyebrow">{t('gallery.eyebrow', {}, $locale)}</p>
  <h1>{t('dreamsnaps.gallery.title', {}, $locale)}</h1>
  <p class="page-intro">{t('dreamsnaps.gallery.intro', {}, $locale)}</p>

  <form class="search" on:submit|preventDefault={browse}>
    <label>
      <span>{t('dreamsnaps.gallery.search', {}, $locale)}</span>
      <input bind:value={query} maxlength="100" />
    </label>
    <button type="submit" disabled={busy}>{t('community.action.search', {}, $locale)}</button>
  </form>

  <div class="grid">
    {#each works as work}
      <button class="card" type="button" on:click={() => openWork(String(work.workId))}>
        {#if mediaUrls[work.mediaId]}<img src={mediaUrls[work.mediaId]} alt={t('dreamsnaps.gallery.entryAlt', {}, $locale)} />{/if}
        <span><strong>{work.challengeTitle}</strong><small>{work.creatorDisplayName}</small></span>
      </button>
    {:else}
      <p>{t('dreamsnaps.gallery.empty', {}, $locale)}</p>
    {/each}
  </div>

  {#if selected}
    <section class="detail" aria-labelledby="dreamsnap-gallery-detail">
      <div class="detail-head">
        <div>
          <p class="eyebrow">{t('dreamsnaps.gallery.archive', {}, $locale)}</p>
          <h2 id="dreamsnap-gallery-detail">{selected.challengeTitle}</h2>
          <p>{selected.creator?.displayName ?? ''}</p>
        </div>
        <button type="button" on:click={() => (selected = null)}>{t('community.action.close', {}, $locale)}</button>
      </div>

      {#if mediaUrls[selected.mediaId]}
        <img class="hero" src={mediaUrls[selected.mediaId]} alt={t('dreamsnaps.gallery.entryAlt', {}, $locale)} />
      {/if}

      {#if selected.caption}<p>{selected.caption}</p>{/if}

      {#if selected.officialResult}
        <section class="official">
          <h3>{t('dreamsnaps.gallery.sharedOfficial', {}, $locale)}</h3>
          {#if selected.officialResult.score != null}<span>{t('dreamsnaps.official.score', {}, $locale)}: {selected.officialResult.score}</span>{/if}
          {#if selected.officialResult.rank != null}<span>{t('dreamsnaps.official.rank', {}, $locale)}: {selected.officialResult.rank}</span>{/if}
          {#if selected.officialResult.moonstones != null}<span>{t('dreamsnaps.official.moonstones', {}, $locale)}: {selected.officialResult.moonstones}</span>{/if}
          {#if selected.officialResult.pixelDust != null}<span>{t('dreamsnaps.official.pixelDust', {}, $locale)}: {selected.officialResult.pixelDust}</span>{/if}
        </section>
      {/if}

      <div class="actions">
        <button type="button" on:click={() => action('saveEntity', { targetEntityId: selected.workId })}>{t('community.action.save', {}, $locale)}</button>
        <button type="button" on:click={() => action('addReaction', { targetEntityId: selected.workId, reactionKind: 'like' })}>{t('community.action.react', {}, $locale)}</button>
        <button type="button" on:click={report}>{t('community.action.report', {}, $locale)}</button>
      </div>

      {#if selected.commentsEnabled}
        <section class="comments">
          <h3>{t('gallery.detail.comments', {}, $locale)}</h3>
          {#each selected.comments ?? [] as item}
            <article><p>{item.body}</p></article>
          {:else}<p>{t('dreamsnaps.gallery.noComments', {}, $locale)}</p>{/each}

          {#if client?.session && creatorProfileId}
            <form on:submit|preventDefault={comment}>
              <label>{t('dreamsnaps.gallery.comment', {}, $locale)}<textarea bind:value={commentBody} maxlength="10000"></textarea></label>
              <button type="submit" disabled={busy || !commentBody.trim()}>{t('community.action.comment', {}, $locale)}</button>
            </form>
          {/if}
        </section>
      {:else}
        <p>{t('dreamsnaps.gallery.commentsUnavailable', {}, $locale)}</p>
      {/if}
    </section>
  {/if}

  {#if status}<p class="notice" role="status">{status}</p>{/if}
  {#if error}<p class="error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
</section>

<style>
  .search{display:flex;gap:10px;align-items:end;margin:20px 0}.search label{display:grid;gap:6px;flex:1}.search input,textarea{width:100%;min-height:42px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised);color:var(--ink);padding:9px 11px;font:inherit}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.card{padding:0;overflow:hidden;text-align:left;border:1px solid var(--border);border-radius:18px;background:var(--surface);color:var(--ink)}.card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.card span{display:grid;gap:4px;padding:12px}.card small{color:var(--ink-muted)}
  .detail{display:grid;gap:16px;margin-top:28px;padding:20px;border:1px solid var(--border);border-radius:20px;background:var(--surface)}.detail-head{display:flex;justify-content:space-between;gap:16px}.hero{display:block;width:100%;max-height:68vh;object-fit:contain;background:var(--surface-raised);border-radius:14px}.official,.comments{display:grid;gap:8px}.actions{display:flex;gap:8px;flex-wrap:wrap}.comments article{padding:10px;border:1px solid var(--border);border-radius:12px}.comments form{display:grid;gap:8px}textarea{min-height:90px;resize:vertical}
  button{min-height:40px;border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);padding:8px 12px}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--gold);outline-offset:3px}.error{color:#ffb6b6}
  @media(max-width:650px){.search,.detail-head{display:grid}}
</style>
