<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { itemImagePreferences } from '$lib/item-media/public-item-images.mjs';
  import { switch1253PublicItemImageSource,
    loadSwitch1253PublicItemImageSource, scopedSwitch1253ItemImageHref } from '$lib/item-media/switch1253-public-item-images.mjs';

  export let itemId: number | string;
  export let label = '';
  export let compact = false;
  let failedUrl = '';
  $: imageHref = $switch1253PublicItemImageSource.status === 'VERIFIED'
    ? scopedSwitch1253ItemImageHref(base,itemId,$switch1253PublicItemImageSource.catalog) : null;
  $: renderHref = imageHref && imageHref!==failedUrl ? imageHref : null;
  onMount(() => { loadSwitch1253PublicItemImageSource(base); });
</script>

<span class="item-image" class:compact data-item-thumb-id={String(itemId)}
  data-media-status={renderHref?'verified-public-image':'unavailable'}
  style:--image-size={$itemImagePreferences.size+'px'}>
  {#if renderHref}
    <img src={renderHref} alt={label} loading="lazy" decoding="async" draggable="false"
      style:object-fit={$itemImagePreferences.fit}
      width="160" height="160"
      on:error={() => { failedUrl = renderHref || ''; }} />
  {:else}
    <span class="image-unavailable" aria-hidden="true">—</span>
  {/if}
</span>

<style>
.item-image{display:inline-grid;place-items:center;width:var(--image-size);height:var(--image-size);
  flex:0 0 var(--image-size);min-width:0;max-width:100%;overflow:hidden;border:1px solid var(--border);
  border-radius:10px;background:var(--surface-raised);box-sizing:border-box}
.item-image img{display:block;width:100%;height:100%;object-position:center;background:transparent}
.image-unavailable{font:20px Georgia,serif;color:var(--ink-muted)}
@media(max-width:360px){.item-image{max-width:min(80px,25vw);max-height:min(80px,25vw)}}
</style>