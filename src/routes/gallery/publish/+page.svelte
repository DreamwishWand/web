<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, t } from '$lib/i18n/runtime.js';
  import { createCommunityBrowserClient } from '$lib/community/browser-client';

  const client = createCommunityBrowserClient();
  let signedIn = false;
  let creatorProfileId = '';
  let email = '', password = '', handle = '', displayName = '';
  let title = '', description = '', kind = 'outdoor';
  let presetRevisionId = '', usedItems = '', featuredItems = '', moodboard = '';
  let files: File[] = [];
  let busy = false, error = '', publishedWorkId = '';

  onMount(() => { signedIn = Boolean(client?.session); if (signedIn) void loadIdentity(); });

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    busy = true; error = '';
    try { return await fn(); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); return null; }
    finally { busy = false; }
  }

  async function signIn() {
    if (!client) return;
    const result = await run(() => client.signInWithPassword(email.trim(), password));
    if (!result) return;
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

  function ids(raw: string): number[] {
    return Array.from(new Set(raw.split(/[\s,]+/).map(Number).filter((v) => Number.isSafeInteger(v) && v > 0)));
  }

  async function publish() {
    if (!client?.session || !creatorProfileId || files.length < 1 || files.length > 10) return;
    const result: any = await run(async () => {
      const mediaIds: string[] = [];
      for (const file of files) mediaIds.push((await client.uploadAndFinalizeImage(file)).mediaId);
      const created: any = await client.command('createGalleryWork', {
        creatorProfileId, galleryKind: kind, idempotencyKey: crypto.randomUUID()
      });
      return client.command('publishGallery', {
        workId: created.data.workId,
        expectedVersion: created.data.rowVersion,
        title: title.trim(),
        description: description.trim() || null,
        mediaIds,
        presetRevisionIds: presetRevisionId.trim() ? [presetRevisionId.trim()] : [],
        usedItemIds: ids(usedItems),
        featuredItemIds: ids(featuredItems),
        moodboardSnapshotRef: moodboard.trim() || null,
        idempotencyKey: crypto.randomUUID()
      });
    });
    publishedWorkId = String(result?.data?.workId ?? '');
  }

  function chooseFiles(event: Event) {
    files = Array.from((event.currentTarget as HTMLInputElement).files ?? []).slice(0, 10);
  }
</script>

<svelte:head><title>{t('gallery.publish.heading', {}, $locale)} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <a class="inline-link" href={`${base}/gallery/`}>← {t('gallery.title', {}, $locale)}</a>
  <h1>{t('gallery.publish.heading', {}, $locale)}</h1>

  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else if !signedIn}
    <div class="form-card">
      <label>{t('community.auth.email', {}, $locale)}<input type="email" bind:value={email} autocomplete="email" /></label>
      <label>{t('community.auth.password', {}, $locale)}<input type="password" bind:value={password} autocomplete="current-password" /></label>
      <button type="button" disabled={busy || !email || !password} on:click={signIn}>{t('community.auth.signIn', {}, $locale)}</button>
    </div>
  {:else if !creatorProfileId}
    <div class="form-card">
      <p>{t('community.auth.creatorRequired', {}, $locale)}</p>
      <label>{t('community.creator.handle', {}, $locale)}<input bind:value={handle} /></label>
      <label>{t('community.creator.displayName', {}, $locale)}<input bind:value={displayName} /></label>
      <button type="button" disabled={busy || !handle.trim() || !displayName.trim()} on:click={ensureCreator}>{t('community.creator.create', {}, $locale)}</button>
    </div>
  {:else}
    <div class="form-card">
      <label>{t('gallery.publish.kind', {}, $locale)}
        <select bind:value={kind}>
          <option value="outdoor">{t('gallery.kind.outdoor', {}, $locale)}</option>
          <option value="indoor">{t('gallery.kind.indoor', {}, $locale)}</option>
          <option value="tom_furniture">{t('gallery.kind.tomFurniture', {}, $locale)}</option>
          <option value="tom_clothing">{t('gallery.kind.tomClothing', {}, $locale)}</option>
        </select>
      </label>
      <label>{t('gallery.publish.title', {}, $locale)}<input maxlength="240" bind:value={title} /></label>
      <label>{t('gallery.publish.description', {}, $locale)}<textarea maxlength="20000" bind:value={description}></textarea></label>
      <label>{t('gallery.publish.media', {}, $locale)}<input type="file" multiple accept="image/jpeg,image/png,image/webp" on:change={chooseFiles} /><span>{files.length}/10</span></label>
      <label>{t('gallery.publish.preset', {}, $locale)}<input bind:value={presetRevisionId} /></label>
      <label>{t('gallery.publish.usedItems', {}, $locale)}<input bind:value={usedItems} placeholder="1001, 1002" /></label>
      <label>{t('gallery.publish.featuredItems', {}, $locale)}<input bind:value={featuredItems} placeholder="1002" /></label>
      <label>{t('gallery.publish.moodboard', {}, $locale)}<input bind:value={moodboard} /></label>
      <button type="button" disabled={busy || !title.trim() || files.length < 1} on:click={publish}>{t('community.action.publish', {}, $locale)}</button>
    </div>
  {/if}

  {#if error}<p class="form-error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
  {#if publishedWorkId}<div class="notice">{t('gallery.publish.success', {}, $locale)} <code>{publishedWorkId}</code></div>{/if}
</section>

<style>
  .form-card{display:grid;gap:13px;max-width:760px;margin-top:24px;padding:22px;border:1px solid var(--border);border-radius:20px;background:var(--surface)}label{display:grid;gap:6px;font-size:12px;color:var(--ink-soft)}input,textarea,select{min-height:44px;border:1px solid var(--border);border-radius:12px;background:var(--surface-raised);color:var(--ink);padding:10px 12px;font:inherit}textarea{min-height:110px;resize:vertical}button{min-height:44px;border:1px solid var(--gold);border-radius:999px;background:var(--gold-strong);color:#27324f;padding:9px 15px;font-weight:800}.form-error{color:#ffb6b6}
</style>
