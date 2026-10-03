<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient } from '$lib/community/browser-client';

  const client = createCommunityBrowserClient();
  let questionId = '', answerId = '', creatorProfileId = '';
  let email = '', password = '', title = '', body = '';
  let question: any = null;
  let signedIn = false;
  let busy = false, error = '', tipId = '';

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    questionId = params.get('question') ?? '';
    answerId = params.get('answer') ?? '';
    signedIn = Boolean(client?.session);
    if (signedIn) void load();
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
    signedIn = true;
    await load();
  }

  async function load() {
    if (!client?.session || !questionId) return;
    const me: any = await run(() => client.query('me'));
    creatorProfileId = String(me?.data?.creatorProfileId ?? '');
    const result: any = await run(() => client.query('question', { questionId }));
    question = result?.data ?? null;
    const source = question?.answers?.find((item: any) => String(item.answerId) === answerId);
    if (source && !body) body = String(source.body ?? '');
    if (question && !title) title = String(question.title ?? '');
  }

  async function createTip() {
    if (!client?.session || !creatorProfileId || !answerId || !title.trim() || !body.trim()) return;
    const result: any = await run(() => client.command('createTip', {
      creatorProfileId,
      title: title.trim(),
      body: body.trim(),
      contextTags: null,
      platform: null,
      gameVersion: null,
      sourceQuestionId: questionId,
      sourceAnswerId: answerId,
      idempotencyKey: crypto.randomUUID()
    }));
    tipId = String(result?.data?.tipId ?? '');
  }
</script>

<svelte:head><title>{t('qa.tip.create', {}, $locale)} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <a class="inline-link" href={`${base}/qa/participate/?question=${questionId}`}>← {t('qa.title', {}, $locale)}</a>
  <h1>{t('qa.tip.create', {}, $locale)}</h1>

  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else if !signedIn}
    <div class="card">
      <label>{t('community.auth.email', {}, $locale)}<input type="email" bind:value={email} /></label>
      <label>{t('community.auth.password', {}, $locale)}<input type="password" bind:value={password} /></label>
      <button type="button" disabled={busy || !email || !password} on:click={signIn}>{t('community.auth.signIn', {}, $locale)}</button>
    </div>
  {:else}
    <div class="card">
      {#if question}
        <div class="tags">{#each question.contextTags ?? [] as tag}<span>{tag}</span>{/each}</div>
      {/if}
      <label>{t('gallery.publish.title', {}, $locale)}<input bind:value={title} maxlength="240" /></label>
      <label>{t('gallery.publish.description', {}, $locale)}<textarea bind:value={body} maxlength="20000"></textarea></label>
      <button type="button" disabled={busy || !title.trim() || !body.trim() || !answerId} on:click={createTip}>{t('community.action.createTip', {}, $locale)}</button>
    </div>
  {/if}

  {#if error}<p class="error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
  {#if tipId}<div class="notice"><a class="inline-link" href={`${base}/qa/?tip=${tipId}`}>{t('qa.tip.create', {}, $locale)}</a></div>{/if}
</section>

<style>
  .card{display:grid;gap:12px;max-width:760px;margin-top:22px;padding:20px;border:1px solid var(--border);border-radius:18px;background:var(--surface)}label{display:grid;gap:6px}input,textarea{min-height:42px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised);color:var(--ink);padding:9px 11px;font:inherit}textarea{min-height:130px;resize:vertical}button{min-height:42px;border:1px solid var(--gold);border-radius:999px;background:var(--gold-strong);color:#27324f;padding:8px 13px;font-weight:800}.tags{display:flex;gap:7px;flex-wrap:wrap}.tags span{border:1px solid var(--border);border-radius:999px;padding:5px 9px;font-size:11px}.error{color:#ffb6b6}
</style>
