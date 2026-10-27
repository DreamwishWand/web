<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient, callPublicCommunityRpc } from '$lib/community/browser-client';
  import GalleryBrowse from '$lib/community/GalleryBrowse.svelte';
  import GalleryDetail from '$lib/community/GalleryDetail.svelte';

  const client = createCommunityBrowserClient();
  let query = '';
  let works: any[] = [];
  let selected: any = null;
  let busy = false;
  let error = '';

  onMount(() => { const workId = new URLSearchParams(window.location.search).get('work'); void browse(); if (workId) void openWork(workId); });

  async function browse() {
    if (!client) return;
    busy = true; error = '';
    try {
      works = await client.searchPublicWorks({
        query: query.trim() || null,
        workType: 'gallery',
        limit: 30
      });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally { busy = false; }
  }

  async function openWork(workId: string) {
    busy = true; error = '';
    try {
      selected = await callPublicCommunityRpc('community_get_gallery_public_v1', {
        p_work_id: workId
      });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally { busy = false; }
  }
</script>

<svelte:head><title>{t('gallery.title', {}, $locale)} | Dreamwish Wand</title></svelte:head>

<section class="inside-page container">
  <p class="eyebrow">{t('gallery.eyebrow', {}, $locale)}</p>
  <h1>{t('gallery.title', {}, $locale)}</h1>
  <p class="page-intro">{t('gallery.intro', {}, $locale)}</p>
  <p class="route-links">
    <a class="inline-link" href={`${base}/gallery/publish/`}>{t('gallery.tab.publish', {}, $locale)}</a>
    <a class="inline-link" href={`${base}/gallery/my/`}>{t('gallery.tab.my', {}, $locale)}</a>
  </p>

  {#if !client}
    <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
  {:else}
    {#if error}<p class="form-error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
    <GalleryBrowse bind:query {works} {busy} onSearch={browse} onSelect={openWork} />
    {#if selected}<GalleryDetail work={selected} onClose={() => (selected = null)} />{/if}
  {/if}
</section>

<style>
  .route-links{display:flex;gap:18px;flex-wrap:wrap;margin:22px 0}.form-error{color:#ffb6b6}
</style>
