<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient } from '$lib/community/browser-client';

  const client = createCommunityBrowserClient();
  let workId = '';
  let work: any = null;
  let creatorProfileId = '';
  let email = '', password = '', commentBody = '';
  let busy = false, error = '';

  onMount(() => {
    workId = new URLSearchParams(window.location.search).get('work') ?? '';
    if (client?.session) void load();
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
    password = '';
    await load();
  }

  async function load() {
    if (!client?.session || !workId) return;
    const me: any = await run(() => client.query('me'));
    creatorProfileId = String(me?.data?.creatorProfileId ?? '');
    const result: any = await run(() => client.query('gallery', { workId }));
    work = result?.data ?? null;
  }

  async function command(name: string, payload: Record<string, unknown>) {
    if (!client?.session) return null;
    const result = await run(() => client.command(name, payload));
    if (result) await load();
    return result;
  }

  async function addComment() {
    if (!creatorProfileId || !commentBody.trim()) return;
    const ok = await command('addComment', {
      creatorProfileId,
      targetEntityId: workId,
      parentCommentId: null,
      body: commentBody.trim(),
      idempotencyKey: crypto.randomUUID()
    });
    if (ok) commentBody = '';
  }

  async function report(targetEntityId: string) {
    await command('reportEntity', {
      targetEntityId,
      reasonCode: 'community_report',
      detail: null,
      idempotencyKey: crypto.randomUUID()
    });
  }
</script>

<svelte:head><title>{t('gallery.title', {}, $locale)} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <a class="inline-link" href={`${base}/gallery/?work=${workId}`}>← {t('gallery.title', {}, $locale)}</a>

  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else if !client.session}
    <div class="panel auth">
      <label>{t('community.auth.email', {}, $locale)}<input type="email" bind:value={email} autocomplete="email" /></label>
      <label>{t('community.auth.password', {}, $locale)}<input type="password" bind:value={password} autocomplete="current-password" /></label>
      <button type="button" disabled={busy || !email || !password} on:click={signIn}>{t('community.auth.signIn', {}, $locale)}</button>
    </div>
  {:else if work}
    <article class="panel">
      <p class="eyebrow">{work.galleryKind}</p>
      <h1>{work.title}</h1>
      <p>{work.description}</p>
      <div class="actions">
        <button type="button" on:click={() => command('saveEntity', { targetEntityId: workId })}>{t('community.action.save', {}, $locale)}</button>
        <button type="button" on:click={() => command('addReaction', { targetEntityId: workId, reactionKind: 'like' })}>{t('community.action.react', {}, $locale)}</button>
        <button type="button" on:click={() => command('followCreator', { creatorProfileId: work.creatorProfileId })}>+ {work.creator?.displayName ?? t('gallery.detail.creator', {}, $locale)}</button>
        <button type="button" on:click={() => report(workId)}>{t('community.action.report', {}, $locale)}</button>
      </div>
    </article>

    <section class="panel">
      <h2>{t('gallery.detail.comments', {}, $locale)}</h2>
      {#each work.comments ?? [] as comment}
        <article class="comment">
          <p>{comment.body}</p>
          <button type="button" on:click={() => report(String(comment.commentId))}>{t('community.action.report', {}, $locale)}</button>
        </article>
      {/each}

      {#if work.commentsEnabled !== false && creatorProfileId}
        <form class="comment-form" on:submit|preventDefault={addComment}>
          <label>
            <span class="visually-hidden">{t('gallery.detail.comments', {}, $locale)}</span>
            <textarea bind:value={commentBody} maxlength="10000" placeholder={t('gallery.detail.comments', {}, $locale)}></textarea>
          </label>
          <button type="submit" disabled={busy || !commentBody.trim()}>{t('community.action.comment', {}, $locale)}</button>
        </form>
      {/if}
    </section>
  {/if}

  {#if error}<p class="error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
</section>

<style>
  .panel{display:grid;gap:12px;margin-top:22px;padding:20px;border:1px solid var(--border);border-radius:20px;background:var(--surface)}.auth{grid-template-columns:1fr 1fr auto;align-items:end}.auth label,.comment-form label{display:grid;gap:6px}.auth input,.comment-form textarea{min-height:42px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised);color:var(--ink);padding:9px 11px;font:inherit}.comment-form textarea{min-height:100px;resize:vertical}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions button,.comment button,.comment-form button,.auth button{min-height:40px;border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);padding:7px 12px}.comment{padding:12px;border:1px solid var(--border);border-radius:13px}.comment-form{display:grid;gap:10px}.error{color:#ffb6b6}@media(max-width:680px){.auth{grid-template-columns:1fr}}
</style>
