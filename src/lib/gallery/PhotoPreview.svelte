<script lang="ts">
  import { locale, ct as t } from '$lib/i18n/community.js';
  export let title = '';
  export let description = '';
  export let creator = '';
  export let category = '';
  export let target = '';
  export let imageUrls: string[] = [];
</script>

<div class="gallery-preview">
  <section class="gallery-preview-card" aria-label={t('galleryv1.previewCard',{},$locale)}>
    {#if imageUrls[0]}<img src={imageUrls[0]} alt={t('galleryv1.coverAlt',{},$locale)} />{:else}<div class="missing">{t('gallery.media.placeholder',{},$locale)}</div>{/if}
    <div class="copy"><small>{category}{target ? ' · '+target : ''}</small><h3>{title}</h3><p>{creator}</p></div>
  </section>
  <section class="gallery-preview-detail" aria-label={t('galleryv1.previewDetail',{},$locale)}>
    <h3>{title}</h3><p>{creator}</p><p>{description}</p>
    <div class="images">
      {#each imageUrls as url,i}<img src={url} alt={t('galleryv1.imageOrdinal',{number:i+1},$locale)} />{/each}
    </div>
  </section>
</div>
<style>
  .gallery-preview{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:18px;align-items:start}
  .gallery-preview-card,.gallery-preview-detail{min-width:0;border:1px solid var(--border);background:var(--surface);border-radius:20px;overflow:hidden}
  .gallery-preview-card>img,.missing{width:100%;aspect-ratio:16/10;object-fit:cover}.missing{display:grid;place-items:center;padding:18px}
  .copy,.gallery-preview-detail{padding:18px;overflow-wrap:anywhere}.copy h3,.gallery-preview-detail h3{margin:8px 0}.copy small{color:var(--gold)}.copy p{color:var(--ink-muted)}
  .images{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:10px}
  .images img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:12px}
  @media(max-width:700px){.gallery-preview{grid-template-columns:1fr}}
</style>
