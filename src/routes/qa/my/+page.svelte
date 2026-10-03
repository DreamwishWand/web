<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient } from '$lib/community/browser-client';

  const client = createCommunityBrowserClient();
  let signedIn = false, busy = false, error = '';
  let email = '', password = '';
  let activity: any = { contributions: [], sameHere: [], answerUtility: [] };

  onMount(() => { signedIn = Boolean(client?.session); if (signedIn) void load(); });

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
    password = ''; signedIn = true; await load();
  }

  async function load() {
    if (!client?.session) return;
    const result: any = await run(() => client.query('myQaActivity', { limit: 150 }));
    if (result?.data) activity = result.data;
  }
</script>

<svelte:head><title>{t('qa.activity.title', {}, $locale)} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <a class="inline-link" href={`${base}/qa/`}>← {t('qa.title', {}, $locale)}</a>
  <h1>{t('qa.activity.title', {}, $locale)}</h1>

  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else if !signedIn}
    <div class="auth">
      <label>{t('community.auth.email', {}, $locale)}<input type="email" bind:value={email} /></label>
      <label>{t('community.auth.password', {}, $locale)}<input type="password" bind:value={password} /></label>
      <button type="button" disabled={busy || !email || !password} on:click={signIn}>{t('community.auth.signIn', {}, $locale)}</button>
    </div>
  {:else}
    <section class="panel">
      {#each activity.contributions ?? [] as item}
        <a class="entry" href={item.kind === 'answer' ? `${base}/qa/?question=${item.questionId}` : `${base}/qa/?question=${item.entityId}`}>
          <strong>{item.title ?? item.kind}</strong>
          <span>{item.freshness ?? ''} {item.resolutionState ?? ''}</span>
        </a>
      {:else}<p>{t('qa.activity.empty', {}, $locale)}</p>{/each}
    </section>

    <div class="columns">
      <section class="panel">
        <h2>{t('qa.sameHere', {}, $locale)}</h2>
        {#each activity.sameHere ?? [] as item}
          <a class="entry" href={`${base}/qa/?question=${item.questionId}`}><code>{item.questionId}</code></a>
        {/each}
      </section>
      <section class="panel">
        <h2>{t('qa.utility.helpful', {}, $locale)}</h2>
        {#each activity.answerUtility ?? [] as item}
          <div class="entry"><code>{item.answerId}</code><span>{item.utility}</span></div>
        {/each}
      </section>
    </div>
  {/if}

  {#if error}<p class="error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
</section>

<style>
  .auth,.panel{margin-top:22px;padding:18px;border:1px solid var(--border);border-radius:18px;background:var(--surface)}.auth{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.auth label{display:grid;gap:5px;flex:1}.auth input{min-height:42px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised);color:var(--ink);padding:9px 11px}.auth button{min-height:42px;border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);padding:8px 13px}.panel{display:grid;gap:8px}.entry{display:flex;justify-content:space-between;gap:10px;padding:11px;border:1px solid var(--border);border-radius:11px;color:var(--ink)}.entry span{font-size:12px;color:var(--ink-muted)}.columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}.error{color:#ffb6b6}@media(max-width:700px){.columns{grid-template-columns:1fr}}
</style>
