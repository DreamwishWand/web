<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { callPublicCommunityRpc, getCommunityBrowserConfig } from '$lib/community/browser-client';
  import GalleryDetail from '$lib/community/GalleryDetail.svelte';
  let workId = '';
  let selected: any = null;
  let busy=false, error='';
  onMount(()=>{
    workId=new URLSearchParams(location.search).get('work')??'';
    if(workId)void openWork();
  });
  async function openWork(){
    busy=true;error='';
    try { selected=await callPublicCommunityRpc('community_get_gallery_public_v1',{p_work_id:workId}); }
    catch(e){error=e instanceof Error?e.message:String(e);selected=null;}
    finally{busy=false;}
  }
</script>
<svelte:head>
  <title>{selected?.title ?? t('gallery.title',{},$locale)} | Dreamwish Wand</title>
  {#if workId}<link rel="canonical" href={base+'/gallery/?work='+encodeURIComponent(workId)} />{/if}
</svelte:head>
<section class="gallery-home responsive-frame">
  {#if workId}
    <a class="inline-link" href={base+'/gallery/'}>← {t('galleryv1.returnToGallery',{},$locale)}</a>
    {#if busy}<p role="status">{t('galleryv1.loading',{},$locale)}</p>
    {:else if error}<div role="alert">{t('galleryv1.error',{},$locale)}: {error} <button type="button" on:click={openWork}>{t('galleryv1.retry',{},$locale)}</button></div>
    {:else if selected}<GalleryDetail work={selected} onClose={()=>location.assign(base+'/gallery/')} />{/if}
  {:else}
    <h1>{t('gallery.title',{},$locale)}</h1>
    <div class="gallery-entries">
      <a class="gallery-entry main" href={base+'/gallery/decorations/'}>
        <strong>{t('galleryv1.decorations',{},$locale)}</strong>
        <span>{t('gallery.kind.outdoor',{},$locale)} · {t('gallery.kind.indoor',{},$locale)}</span>
      </a>
      <a class="gallery-entry" href={base+'/gallery/tom/'}>
        <strong>{t('galleryv1.tom',{},$locale)}</strong>
        <span>{t('galleryv1.furniture',{},$locale)} · {t('galleryv1.clothing',{},$locale)}</span>
      </a>
      <a class="gallery-entry" href={base+'/gallery/my/'}>
        <strong>{t('galleryv1.myGallery',{},$locale)}</strong>
        <span>{t('galleryv1.myWorks',{},$locale)} · {t('galleryv1.saved',{},$locale)}</span>
      </a>
    </div>
  {/if}
</section>
<style>
.gallery-home{width:min(1280px,calc(100% - 32px));margin:0 auto;padding:30px 0 70px}
h1{font:600 clamp(32px,5vw,50px) Georgia,serif}
.gallery-entries{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.gallery-entry{display:grid;align-content:end;gap:10px;min-height:210px;border-radius:24px;padding:clamp(20px,4vw,36px);background:var(--surface);color:var(--ink);border:1px solid var(--border);overflow-wrap:anywhere}
.gallery-entry.main{grid-column:1/-1;min-height:240px}
.gallery-entry strong{font:600 clamp(25px,3vw,38px) Georgia,serif}.gallery-entry span{color:var(--ink-soft)}
.gallery-entry:hover{border-color:var(--gold)}
@media(max-width:560px){.gallery-entries{grid-template-columns:1fr}.gallery-entry.main{grid-column:auto}}
</style>
