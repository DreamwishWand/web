<script lang="ts">
  import { locale, ct as t } from '$lib/i18n/community.js';
  export let media: {streamUrl:string;mimeType:string;width:number|null;height:number|null}|null=null;
  export let alt='';
  let failed=false;
  let previousUrl='';
  $: if(media?.streamUrl!==previousUrl){previousUrl=media?.streamUrl??'';failed=false;}
  function fail(){failed=true;}
</script>

{#if media && !failed}
  <img class="gallery-proxy-image" src={media.streamUrl} {alt} loading="lazy"
    width={media.width??undefined} height={media.height??undefined}
    on:error={fail} />
{:else}
  <div class="gallery-proxy-placeholder" role="img"
    aria-label={t('gallery.media.placeholder',{},$locale)}>
    <span>{t('gallery.media.placeholder',{},$locale)}</span>
    {#if failed}<small role="status">{t('galleryv1.mediaUnavailable',{},$locale)}</small>{/if}
  </div>
{/if}
<style>
  .gallery-proxy-image,.gallery-proxy-placeholder{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;min-width:0}
  .gallery-proxy-placeholder{display:grid;place-content:center;text-align:center;padding:12px;gap:5px;background:var(--surface-raised);color:var(--ink-muted)}
</style>
