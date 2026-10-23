<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient, callPublicCommunityRpc, getPublicCommunityMedia } from '$lib/community/browser-client';
  import { categoryFor, workUrl } from '$lib/gallery/stage1.js';

  export let family: 'decorations' | 'tom';
  const client = createCommunityBrowserClient();
  let query = '';
  let filter = 'all';
  let busy = false, error = '';
  let results: any[] = [];
  let coverUrls: Record<string,string> = {};
  $: options = family === 'decorations' ? ['all','outdoor','indoor'] : ['all','tom_furniture','tom_clothing'];
  $: visible = results.filter((work)=> {
    const kind=String(work.facets?.galleryKind ?? '');
    return categoryFor(kind)===family && (filter==='all'||kind===filter);
  });
  onMount(()=>{void browse();});

  async function browse() {
    if (!client) return;
    busy=true;error='';
    try {
      // Search index is Community-owned; cover preview currently requires an
      // additional allowlisted public detail + media read (no privileged data).
      results=await client.searchPublicWorks({query:query.trim()||null,workType:'gallery',limit:50});
      for(const work of results.filter((x:any)=>categoryFor(String(x.facets?.galleryKind ?? ''))===family).slice(0,16)){
        const id=String(work.work_id);
        if(coverUrls[id])continue;
        try {
          const detail:any=await callPublicCommunityRpc('community_get_gallery_public_v1',{p_work_id:id});
          const first=detail?.mediaIds?.[0];
          if(first) {
            const media=await getPublicCommunityMedia(String(first));
            coverUrls={...coverUrls,[id]:media.signedUrl};
          }
        }catch { /* no invented public media access */ }
      }
    }catch(e){error=e instanceof Error?e.message:String(e);}
    finally{busy=false;}
  }
</script>

<svelte:head><title>{family==='decorations'?t('galleryv1.decorations',{},$locale):t('galleryv1.tom',{},$locale)} | Dreamwish Wand</title></svelte:head>
<section class="gallery-browse responsive-frame">
  <a href={base+'/gallery/'} class="inline-link">← {t('galleryv1.returnToGallery',{},$locale)}</a>
  <header>
    <h1>{family==='decorations'?t('galleryv1.decorations',{},$locale):t('galleryv1.tom',{},$locale)}</h1>
    <a class="publish-link" href={base+'/gallery/publish/?type='+family}>{t('galleryv1.publishWork',{},$locale)}</a>
  </header>
  <div class="filters" role="group" aria-label={t('galleryv1.category',{},$locale)}>
    {#each options as option}
      <button type="button" aria-pressed={filter===option} class:active={filter===option} on:click={()=>filter=option}>
        {option==='all'?t('galleryv1.all',{},$locale):option==='outdoor'?t('galleryv1.outdoor',{},$locale):option==='indoor'?t('galleryv1.indoor',{},$locale):option==='tom_furniture'?t('galleryv1.furniture',{},$locale):t('galleryv1.clothing',{},$locale)}
      </button>
    {/each}
  </div>
  <form class="search" on:submit|preventDefault={browse}>
    <label><span>{t('gallery.search.label',{},$locale)}</span><input bind:value={query} maxlength="120" /></label>
    <button type="submit" disabled={busy}>{t('galleryv1.search',{},$locale)}</button>
  </form>
  {#if !client}<p class="notice" role="status">{t('community.configUnavailable',{},$locale)}</p>
  {:else if busy}<p role="status">{t('galleryv1.loading',{},$locale)}</p>
  {:else if error}<p role="alert">{t('galleryv1.error',{},$locale)}: {error} <button type="button" on:click={browse}>{t('galleryv1.retry',{},$locale)}</button></p>
  {:else if !visible.length}<p role="status">{t('gallery.empty',{},$locale)}</p>
  {:else}
    <div class="gallery-grid">
      {#each visible as work (work.work_id)}
        <a class="gallery-card" href={workUrl(base,work.work_id)}>
          {#if coverUrls[String(work.work_id)]}
            <img src={coverUrls[String(work.work_id)]} alt={t('galleryv1.coverAlt',{},$locale)} loading="lazy" />
          {:else}<div class="missing-image">{t('gallery.media.placeholder',{},$locale)}</div>{/if}
          <div class="card-text"><strong>{work.title}</strong><small>{work.facets?.galleryKind ?? ''}</small></div>
        </a>
      {/each}
    </div>
  {/if}
</section>
<style>
.gallery-browse{width:min(1360px,calc(100% - 32px));margin:0 auto;padding:28px 0 68px;min-width:0}
header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;margin:16px 0}h1{font:600 clamp(28px,4vw,48px) Georgia,serif;margin:0}
.publish-link,button{min-height:44px;display:inline-flex;align-items:center;padding:10px 16px;border:1px solid var(--border);border-radius:999px;color:var(--ink);background:var(--surface);font:inherit}
.filters{display:flex;flex-wrap:wrap;gap:8px}.filters button.active{border-color:var(--gold);font-weight:800}
.search{display:flex;align-items:end;flex-wrap:wrap;gap:12px;margin:22px 0}.search label{display:grid;gap:7px;flex:1;min-width:min(100%,240px)}
.search input{min-height:44px;min-width:0;padding:10px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--ink)}
.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,235px),1fr));gap:16px}
.gallery-card{min-width:0;overflow:hidden;border:1px solid var(--border);border-radius:18px;background:var(--surface);color:var(--ink)}
.gallery-card img,.missing-image{display:block;width:100%;aspect-ratio:16/10;object-fit:cover}.missing-image{display:grid;place-items:center;color:var(--ink-muted);padding:10px}
.card-text{display:grid;gap:6px;padding:14px;overflow-wrap:anywhere}.card-text small{color:var(--ink-muted)}.notice{padding:15px;border:1px solid var(--border);border-radius:12px}
</style>
