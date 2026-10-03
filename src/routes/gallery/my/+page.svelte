<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, t } from '$lib/i18n/runtime.js';
  import { createCommunityBrowserClient } from '$lib/community/browser-client';

  const client = createCommunityBrowserClient();
  let signedIn = false, busy = false, error = '';
  let email = '', password = '';
  let data: any = { myWorks: [], saved: [] };

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
    const result: any = await run(() => client.query('myGallery', { limit: 100 }));
    if (result?.data) data = result.data;
  }

  async function unsave(id: string) {
    if (!client?.session) return;
    await run(() => client.command('unsaveEntity', { targetEntityId: id }));
    await load();
  }
</script>

<svelte:head><title>{t('gallery.my.title', {}, $locale)} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <a class="inline-link" href={`${base}/gallery/`}>← {t('gallery.title', {}, $locale)}</a>
  <h1>{t('gallery.my.title', {}, $locale)}</h1>

  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else if !signedIn}
    <div class="form-card">
      <label>{t('community.auth.email', {}, $locale)}<input type="email" bind:value={email} /></label>
      <label>{t('community.auth.password', {}, $locale)}<input type="password" bind:value={password} /></label>
      <button type="button" disabled={busy || !email || !password} on:click={signIn}>{t('community.auth.signIn', {}, $locale)}</button>
    </div>
  {:else}
    <div class="columns">
      <section class="panel">
        <h2>{t('gallery.my.works', {}, $locale)}</h2>
        {#each data.myWorks ?? [] as work}
          <a class="row" href={`${base}/gallery/?work=${work.workId}`}><strong>{work.title ?? work.galleryKind}</strong><span>{work.moderationState}</span></a>
        {:else}<p>{t('gallery.my.emptyWorks', {}, $locale)}</p>{/each}
      </section>
      <section class="panel">
        <h2>{t('gallery.my.saved', {}, $locale)}</h2>
        {#each data.saved ?? [] as saved}
          <div class="saved">
            <a class="row" aria-disabled={!saved.accessible} href={saved.accessible ? `${base}/gallery/?work=${saved.targetEntityId}` : undefined}><strong>{saved.work?.title ?? saved.targetEntityId}</strong></a>
            <button type="button" on:click={() => unsave(String(saved.targetEntityId))}>{t('gallery.my.unsave', {}, $locale)}</button>
          </div>
        {:else}<p>{t('gallery.my.emptySaved', {}, $locale)}</p>{/each}
      </section>
    </div>
  {/if}

  {#if error}<p class="form-error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
</section>

<style>
  .form-card,.panel{margin-top:22px;padding:20px;border:1px solid var(--border);border-radius:20px;background:var(--surface)}.form-card{display:grid;gap:12px;max-width:620px}label{display:grid;gap:5px}input{min-height:42px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised);color:var(--ink);padding:9px 11px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:18px}.panel{display:grid;gap:9px}.row{display:flex;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--border);border-radius:12px;color:var(--ink)}.row span{color:var(--ink-muted);font-size:12px}.saved{display:grid;grid-template-columns:1fr auto;gap:8px}.saved button,.form-card button{border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);padding:8px 12px}.form-error{color:#ffb6b6}@media(max-width:760px){.columns{grid-template-columns:1fr}}
</style>
