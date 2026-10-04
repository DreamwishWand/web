<script lang="ts">
  import { onMount } from 'svelte';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient } from '$lib/community/browser-client';
  import DreamsnapsTabs from '$lib/community/DreamsnapsTabs.svelte';

  const client = createCommunityBrowserClient();
  let email = '', password = '';
  let entries: any[] = [];
  let mediaUrls: Record<string,string> = {};
  let selectedFields: Record<string,string[]> = {};
  let busy = false, error = '', status = '';

  onMount(() => { if (client?.session) void load(); });

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    busy = true; error = ''; status = '';
    try { return await fn(); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); return null; }
    finally { busy = false; }
  }

  async function signIn() {
    if (!client) return;
    const session = await run(() => client.signInWithPassword(email.trim(), password));
    if (!session) return;
    password = ''; await load();
  }

  async function load() {
    if (!client?.session) return;
    const result: any = await run(() => client.query('myDreamsnaps', { limit: 200 }));
    entries = result?.data ?? [];
    mediaUrls = {};
    for (const entry of entries) {
      selectedFields[String(entry.entryId)] = [...(entry.officialPublicFields ?? [])];
      const mediaId = String(entry.mediaId ?? '');
      if (!mediaId) continue;
      const signed: any = await run(() => client.media('read', { mediaId }));
      const url = String(signed?.media?.signedUrl ?? '');
      if (url) mediaUrls[mediaId] = url;
    }
  }

  function toggleField(entryId: string, field: string, checked: boolean) {
    const current = new Set(selectedFields[entryId] ?? []);
    if (checked) current.add(field); else current.delete(field);
    selectedFields[entryId] = [...current];
  }

  async function saveOfficialSharing(entryId: string) {
    if (!client?.session) return;
    const ok = await run(() => client.command('setDreamsnapOfficialResultPublication', {
      entryId, publicFields: selectedFields[entryId] ?? []
    }));
    if (ok) { status = t('dreamsnaps.my.privacySaved', {}, $locale); await load(); }
  }

  async function publishGallery(entryId: string, commentsEnabled: boolean) {
    if (!client?.session) return;
    const ok = await run(() => client.command('publishDreamsnapGallery', {
      entryId, commentsEnabled
    }));
    if (ok) { status = t('dreamsnaps.my.galleryPublished', {}, $locale); await load(); }
  }
</script>

<svelte:head><title>{t('dreamsnaps.tab.my', {}, $locale)} | Dreamwish Wand</title></svelte:head>

<section class="inside-page container">
  <p class="eyebrow">{t('dreamsnaps.eyebrow', {}, $locale)}</p>
  <h1>{t('dreamsnaps.tab.my', {}, $locale)}</h1>
  <DreamsnapsTabs />

  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else if !client.session}
    <div class="panel auth">
      <label>{t('community.auth.email', {}, $locale)}<input type="email" bind:value={email} autocomplete="email" /></label>
      <label>{t('community.auth.password', {}, $locale)}<input type="password" bind:value={password} autocomplete="current-password" /></label>
      <button type="button" disabled={busy || !email || !password} on:click={signIn}>{t('community.auth.signIn', {}, $locale)}</button>
    </div>
  {:else}
    <div class="list">
      {#each entries as entry}
        <article class="entry">
          <div class="image">
            {#if mediaUrls[entry.mediaId]}<img src={mediaUrls[entry.mediaId]} alt={t('dreamsnaps.my.entryAlt', {}, $locale)} />{/if}
          </div>
          <div class="body">
            <p class="state">{entry.challengeState}</p>
            <h2>{entry.challengeTitle}</h2>
            <p>{t('dreamsnaps.my.participation', {}, $locale)}: {entry.entryState} · {entry.eligibilityState}</p>
            {#if entry.entryFrozen}<p>{t('dreamsnaps.my.frozenRevision', {}, $locale)}</p>{/if}

            {#if entry.wandResult}
              <section>
                <h3>{t('dreamsnaps.results.wand', {}, $locale)}</h3>
                <p>#{entry.wandResult.placement} · {t('dreamsnaps.results.formalScore', {}, $locale)}: {entry.wandResult.formalScore}</p>
              </section>
            {/if}

            {#if entry.officialResult}
              <section class="official">
                <h3>{t('dreamsnaps.results.ingame', {}, $locale)}</h3>
                <p>{t('dreamsnaps.my.officialPrivate', {}, $locale)}</p>
                {#if entry.officialResult.score != null}<span>{t('dreamsnaps.official.score', {}, $locale)}: {entry.officialResult.score}</span>{/if}
                {#if entry.officialResult.rank != null}<span>{t('dreamsnaps.official.rank', {}, $locale)}: {entry.officialResult.rank}</span>{/if}
                {#if entry.officialResult.moonstones != null}<span>{t('dreamsnaps.official.moonstones', {}, $locale)}: {entry.officialResult.moonstones}</span>{/if}
                {#if entry.officialResult.pixelDust != null}<span>{t('dreamsnaps.official.pixelDust', {}, $locale)}: {entry.officialResult.pixelDust}</span>{/if}
                <fieldset>
                  <legend>{t('dreamsnaps.my.shareOfficial', {}, $locale)}</legend>
                  {#each ['score','rank','moonstones','pixel_dust'] as field}
                    <label class="check"><input type="checkbox"
                      checked={(selectedFields[entry.entryId] ?? []).includes(field)}
                      on:change={(event) => toggleField(String(entry.entryId), field, (event.currentTarget as HTMLInputElement).checked)} />
                      <span>{field === 'pixel_dust' ? t('dreamsnaps.official.pixelDust', {}, $locale) : t(`dreamsnaps.official.${field}`, {}, $locale)}</span>
                    </label>
                  {/each}
                </fieldset>
                <button type="button" on:click={() => saveOfficialSharing(String(entry.entryId))}>{t('dreamsnaps.my.savePrivacy', {}, $locale)}</button>
              </section>
            {/if}

            {#if ['results','closed'].includes(entry.challengeState)}
              <section>
                <h3>{t('dreamsnaps.my.gallery', {}, $locale)}</h3>
                <p>{entry.galleryState ?? t('dreamsnaps.my.notPublished', {}, $locale)}</p>
                <button type="button" on:click={() => publishGallery(String(entry.entryId), true)}>{t('dreamsnaps.my.publishGallery', {}, $locale)}</button>
              </section>
            {/if}
          </div>
        </article>
      {:else}
        <p>{t('dreamsnaps.my.empty', {}, $locale)}</p>
      {/each}
    </div>
  {/if}

  {#if status}<p class="notice" role="status">{status}</p>{/if}
  {#if error}<p class="error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
</section>

<style>
  .panel{display:grid;gap:12px;margin-top:20px;padding:18px;border:1px solid var(--border);border-radius:18px;background:var(--surface)}.auth{grid-template-columns:1fr 1fr auto;align-items:end}.list{display:grid;gap:18px}.entry{display:grid;grid-template-columns:minmax(220px,360px) 1fr;border:1px solid var(--border);border-radius:20px;overflow:hidden;background:var(--surface)}.image img{display:block;width:100%;height:100%;min-height:220px;object-fit:cover}.body{display:grid;gap:12px;padding:18px}.state{margin:0;color:var(--ink-muted);font-size:12px}.official{display:grid;gap:7px}fieldset{display:flex;gap:10px;flex-wrap:wrap;border:1px solid var(--border);border-radius:13px;padding:10px}.check{display:flex;gap:6px;align-items:center}input{min-height:42px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised);color:var(--ink);padding:9px 11px}button{min-height:40px;border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);padding:8px 12px;width:max-content}button:focus-visible,input:focus-visible{outline:3px solid var(--gold);outline-offset:3px}.error{color:#ffb6b6}
  @media(max-width:760px){.auth,.entry{grid-template-columns:1fr}.image img{height:auto}}
</style>
