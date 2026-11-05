<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient, callPublicCommunityRpc } from '$lib/community/browser-client';
  import GalleryBrowse from '$lib/community/GalleryBrowse.svelte';
  import GalleryDetail from '$lib/community/GalleryDetail.svelte';
  import {
    STAGE1_GALLERY_PRODUCTS, stage1GalleryCopy, stage1GalleryPublicResults
  } from '$lib/community/gallery-stage1-root.mjs';

  const client = createCommunityBrowserClient();
  let query = '';
  let works: any[] = [];
  let selected: any = null;
  let busy = false;
  let error = '';
  let category: 'decorations'|'touchOfMagic'|null = null;
  let facet: string = 'all';
  $: ui=stage1GalleryCopy($locale);
  $: visibleWorks=category?stage1GalleryPublicResults(category,works,facet):[];

  onMount(() => {
    const workId = new URLSearchParams(window.location.search).get('work');
    if (workId) void openWork(workId);
    // Root browsing is not a category-free public query. Explicitly enter a verified Work subtype first.
  });

  function chooseCategory(id:'decorations'|'touchOfMagic') {
    category=id; facet='all'; selected=null;query='';works=[];error='';
    void browse();
  }
  function back() {category=null;facet='all';selected=null;query='';works=[];error='';}

  async function browse() {
    if (!client || !category) return;
    busy = true; error = '';
    try {
      works = await client.searchPublicWorks({
        query: query.trim() || null,
        workType: 'gallery',
        limit: 30
      });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      works = [];
    } finally { busy = false; }
  }

  async function openWork(workId: string) {
    if (!client) return;
    busy = true; error = '';
    try {
      selected = await callPublicCommunityRpc('community_get_gallery_public_v1', {
        p_work_id: workId
      });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally { busy = false; }
  }
  const facetKinds=({decorations:['all','outdoor','indoor'],touchOfMagic:['all','tom_furniture','tom_clothing']});
  function facetLabel(kind:string):string{
    if(kind==='all')return ui.all;
    if(kind==='outdoor')return ui.outdoor;
    if(kind==='indoor')return ui.indoor;
    if(kind==='tom_furniture')return ui.furniture;
    return ui.clothing;
  }
</script>

<svelte:head><title>{t('gallery.title', {}, $locale)} | Dreamwish Wand</title></svelte:head>

<section class="gallery-stage1 inside-page container" data-stage1-gallery-root data-writer="off" data-public-eligibility="provider-gated" data-media-rights="unverified">
  <h1>{t('gallery.title', {}, $locale)}</h1>
  {#if !category}
    <nav class="gallery-hub" aria-label={t('gallery.title', {}, $locale)} data-stage1-gallery-hub>
      {#each STAGE1_GALLERY_PRODUCTS as card}
        {#if card.id==='myGallery'}
          <a class="gallery-hub-card personal-card" data-gallery-child={card.id} href={base+card.href}>
            <span class="gallery-hub-art" aria-hidden="true">◇</span><strong>{ui.mine}</strong><small>{ui.personalWorks}</small>
          </a>
        {:else}
          <button type="button" class="gallery-hub-card" class:prominent={card.id==='decorations'}
            data-gallery-child={card.id} on:click={()=>chooseCategory(card.id as 'decorations'|'touchOfMagic')}>
            <span class="gallery-hub-art" aria-hidden="true">◇</span>
            <strong>{card.id==='decorations'?ui.decorations:ui.tom}</strong><small>{ui.browse}</small>
          </button>
        {/if}
      {/each}
    </nav>
  {:else}
    <button type="button" class="gallery-back" on:click={back}>{ui.back}</button>
    <header class="gallery-browse-head"><h2>{category==='decorations'?ui.decorations:ui.tom}</h2><p>{ui.publicWorks}</p></header>
    <div class="gallery-facets" data-stage1-gallery-facets role="group" aria-label={t('gallery.title', {}, $locale)}>
      {#each facetKinds[category] as kind}
        <button type="button" class:active={facet===kind} aria-pressed={facet===kind} on:click={()=>facet=kind}>{facetLabel(kind)}</button>
      {/each}
    </div>
    {#if !client}
      <div class="notice">{t('community.configUnavailable', {}, $locale)}</div>
    {:else}
      {#if error}<p class="form-error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
      <div class="gallery-browse" data-gallery-subtype={category}>
        <GalleryBrowse bind:query works={visibleWorks} {busy} onSearch={browse} onSelect={openWork} />
      </div>
    {/if}
  {/if}

  {#if selected}
    {#if !category}
      <p class="notice" data-gallery-direct-link>{ui.publicWorks}</p>
    {/if}
    <GalleryDetail work={selected} onClose={() => (selected = null)} />
  {/if}
</section>

<style>
.gallery-stage1{padding-block:48px 90px}.gallery-stage1 h1{font:500 clamp(36px,5vw,62px) Georgia,serif;letter-spacing:-.045em;margin:0 0 25px}.gallery-hub{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:14px}.gallery-hub-card{text-decoration:none;display:flex;flex-direction:column;align-items:stretch;text-align:left;gap:12px;border:1px solid var(--border);border-radius:20px;padding:16px;background:var(--surface);color:var(--ink);min-height:290px;cursor:pointer}.gallery-hub-card.prominent{grid-column:auto;min-height:320px}.gallery-hub-card:hover{border-color:var(--gold)}.gallery-hub-art{height:182px;display:grid;place-items:center;border-radius:15px;background:var(--surface-raised);color:var(--gold);font:52px Georgia,serif}.gallery-hub-card strong{font:500 24px Georgia,serif;line-height:1.2;overflow-wrap:anywhere}.gallery-hub-card small{color:var(--ink-muted);font-size:12px}.gallery-back{border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--ink);padding:12px;min-height:44px}.gallery-browse-head{margin:18px 0}.gallery-browse-head h2{font:500 clamp(26px,4vw,44px) Georgia,serif}.gallery-browse-head p{color:var(--ink-muted)}.gallery-facets{display:flex;gap:9px;flex-wrap:wrap}.gallery-facets button{min-height:44px;border:1px solid var(--border);border-radius:99px;background:var(--surface);padding:9px 16px;color:var(--ink)}.gallery-facets button.active{border-color:var(--gold);color:var(--gold)}.form-error{color:#ffb6b6}.gallery-hub-card:focus-visible,.gallery-back:focus-visible,.gallery-facets button:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
@media(max-width:900px){.gallery-hub{grid-template-columns:1fr 1fr}.gallery-hub-card.prominent{grid-column:1/-1;min-height:270px}.gallery-hub-card{min-height:225px}.gallery-hub-art{height:115px}}
@media(max-width:520px){.gallery-hub{grid-template-columns:1fr}.gallery-hub-card.prominent{grid-column:auto}.gallery-hub-card{min-height:185px}.gallery-hub-art{height:88px}.gallery-hub-card strong{font-size:22px}}
</style>
