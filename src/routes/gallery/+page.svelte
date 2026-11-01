<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient, callPublicCommunityRpc } from '$lib/community/browser-client';
  import GalleryBrowse from '$lib/community/GalleryBrowse.svelte';
  import GalleryDetail from '$lib/community/GalleryDetail.svelte';
  import { parseTypedWorkQuery, canonicalWorkId, resolveTypedWorkRoute } from '$lib/community/typed-work-route.js';
  import { dreamsnapPrivacyCopy } from '$lib/dreamsnaps/privacy-copy.js';

  const client = createCommunityBrowserClient();
  let query = '';
  let works: any[] = [];
  let selected: any = null;
  let busy = false;
  let browseBusy = false, detailBusy = false;
  let error = '', invalidWorkUrl = false;
  let routeVersion = 0, browseVersion = 0, detailVersion = 0;
  $: busy = browseBusy || detailBusy;
  afterNavigate(({to}) => {
    if (!to?.url) return;
    const current = ++routeVersion;
    // Invalidate all earlier search/detail responses before parsing this URL.
    ++browseVersion;
    ++detailVersion;
    selected = null;
    works = [];
    error = '';
    query = '';
    browseBusy = false;
    detailBusy = false;
    invalidWorkUrl = false;
    if (!to.url.search) { void browse(current); return; }
    const parsed = parseTypedWorkQuery(to.url.search,'work');
    if (parsed.status !== 'valid' || !parsed.workId) { invalidWorkUrl = true; return; }
    void browse(current);
    void openWork(parsed.workId,current);
  });

  async function browse(expectedRoute = routeVersion) {
    if (!client || invalidWorkUrl) return;
    const generation = ++browseVersion;
    const requestedQuery = query.trim();
    browseBusy = true;
    error = '';
    try {
      const candidates = await client.searchPublicWorks({
        query: requestedQuery || null,
        workType: 'gallery',
        limit: 30
      });
      if (expectedRoute !== routeVersion || generation !== browseVersion || invalidWorkUrl) return;
      // Search is a list of candidates, not proof that every row is a Gallery Work.
      works = Array.isArray(candidates) ? candidates.filter(work =>
        resolveTypedWorkRoute(base,work?.work_type ?? work?.workType,
          work?.work_id ?? work?.workId,work).status === 'ready' &&
        (work?.work_type ?? work?.workType) === 'gallery' &&
        canonicalWorkId(work?.work_id) !== null
      ) : [];
    } catch {
      if (expectedRoute === routeVersion && generation === browseVersion && !invalidWorkUrl)
        error = 'PUBLIC_GALLERY_UNAVAILABLE';
    } finally {
      if (expectedRoute === routeVersion && generation === browseVersion)
        browseBusy = false;
    }
  }

  async function openWork(workId: string, expectedRoute = routeVersion) {
    const id = canonicalWorkId(workId);
    const generation = ++detailVersion;
    selected = null;
    if (!id || invalidWorkUrl || expectedRoute !== routeVersion) return;
    detailBusy = true;
    error = '';
    try {
      const detail: any = await callPublicCommunityRpc('community_get_gallery_public_v1', {
        p_work_id: id
      });
      if (expectedRoute !== routeVersion || generation !== detailVersion || invalidWorkUrl) return;
      // A successful RPC is not enough: require the exact requested Gallery Work.
      if (!detail || canonicalWorkId(detail.workId) !== id ||
          (detail.workType != null && detail.workType !== 'gallery') ||
          (detail.work_type != null && detail.work_type !== 'gallery')) return;
      selected = detail;
    } catch {
      if (expectedRoute === routeVersion && generation === detailVersion && !invalidWorkUrl)
        error = 'PUBLIC_GALLERY_UNAVAILABLE';
    } finally {
      if (expectedRoute === routeVersion && generation === detailVersion)
        detailBusy = false;
    }
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
    {#if invalidWorkUrl}<p class="notice" role="alert" data-gallery-state="invalid-work-url">{dreamsnapPrivacyCopy($locale).legacyUnavailable}</p>{:else}
    <GalleryBrowse bind:query {works} {busy} onSearch={browse} onSelect={openWork} />
    {#if selected}<GalleryDetail work={selected} onClose={() => (selected = null)} />{/if}
    {/if}
  {/if}
</section>

<style>
  .route-links{display:flex;gap:18px;flex-wrap:wrap;margin:22px 0}.form-error{color:#ffb6b6}
</style>
