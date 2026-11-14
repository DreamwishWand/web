<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { savedDiffGridsCopy } from '$lib/wep/steam-saved-diffgrids-copy.mjs';
  import { editorHubCopy } from '$lib/product-home/editor-hub-copy.mjs';
  $: reader = savedDiffGridsCopy($locale);
  $: copy = editorHubCopy($locale);
</script>
<svelte:head><title>{copy.title} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container" data-editor-hub>
  <p class="eyebrow">THE WAND WORKSHOP</p>
  <h1>{copy.title}</h1>
  <p class="page-intro">{copy.intro}</p>

  <a class="feature-tile reader-entry" data-steam-reader-entry data-sveltekit-reload href={base + '/editor/steam-reader/'}>
    <span class="tile-emoji" aria-hidden="true">◇</span>
    <h2>{reader.preformal}</h2>
    <p>{reader.title} · {reader.subtitle}</p>
  </a>

  <div class="feature-grid">
    <a class="feature-tile" data-editor-catalog href={`${base}/editor/items/`}>
      <span class="tile-emoji" aria-hidden="true">✧</span>
      <h2>{copy.catalogTitle}</h2>
      <p>{copy.catalogDetail}</p>
      <span>{copy.catalogAction} →</span>
    </a>

    <a class="feature-tile" data-editor-world href={`${base}/editor/world/`}>
      <span class="tile-emoji" aria-hidden="true">◇</span>
      <h2>{copy.worldTitle}</h2>
      <p>{copy.worldDetail}</p>
      <span>{copy.worldAction} →</span>
    </a>
    <a class="feature-tile" data-editor-timing href={base + '/editor/timing/'}>
      <span class="tile-emoji" aria-hidden="true">◷</span>
      <h2>{copy.timingTitle}</h2>
      <p>{copy.timingDetail}</p>
      <span>{copy.timingAction} →</span>
    </a>
  </div>

  <div class="notice" data-editor-writer-boundary role="status">{copy.boundary}</div>
</section>

<style>
  .reader-entry { display:block; margin-block:20px; min-width:0; overflow-wrap:anywhere; }
  .reader-entry:focus-visible { outline:3px solid var(--focus-ring); outline-offset:3px; }
  .feature-tile, .notice { min-width:0; overflow-wrap:anywhere; }
</style>
