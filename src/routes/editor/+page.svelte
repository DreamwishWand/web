<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { savedDiffGridsCopy } from '$lib/wep/steam-saved-diffgrids-copy.mjs';
  import { editorHubCopy } from '$lib/product-home/editor-hub-copy.mjs';
  import { BETA_EDITOR_PENDING_OPERATIONS, editorBetaCopy } from '$lib/product-home/editor-beta-availability.mjs';
  import { collectionExact1Copy } from '$lib/collection/collection-exact1-copy.mjs';
  import { getScopedCollectionMountInfo } from '$lib/ddv/core/save/product-scoped-collection-release.mjs';
  let collectionReady=false;
  onMount(()=>{let live=true;void getScopedCollectionMountInfo().then(()=>{if(live)collectionReady=true}).catch(()=>{});return ()=>{live=false}});
  $: reader = savedDiffGridsCopy($locale);
  $: copy = editorHubCopy($locale);
  $: beta = editorBetaCopy($locale);
  $: collection = collectionExact1Copy($locale);
</script>
<svelte:head><title>{copy.title} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container" data-editor-hub>
  <p class="eyebrow">THE WAND WORKSHOP</p>
  <h1>{copy.title}</h1>
  <p class="page-intro">{copy.intro}</p>
  <div class="beta-overview" data-beta-editor-availability data-beta-save-authorized="false">
    <h2>{beta.title}</h2>
    <p>{beta.intro}</p>
  </div>

  <a class="feature-tile reader-entry" data-steam-reader-entry data-beta-capability="test-steam-reader" data-beta-state="test" data-beta-save-authorized="false" data-sveltekit-reload href={base + '/editor/steam-reader/'}>
    <span class="tile-emoji" aria-hidden="true">◇</span>
    <h2>{reader.preformal}</h2>
    <p>{reader.title} · {reader.subtitle}</p>
    <p class="beta-state-note"><strong>{beta.test}</strong> · {beta.readerDetail}</p>
  </a>

  <div class="feature-grid">
    <a class="feature-tile" data-editor-moodboards data-beta-capability="local-moodboards"
      data-beta-state="local" data-beta-save-authorized="false" href={base + '/moodboards/'}>
      <h2>{beta.moodboards}</h2>
      <p>{beta.moodboardsDetail}</p>
      <p class="beta-state-note"><strong>{beta.local}</strong></p>
    </a>
    {#if collectionReady}
      <a class="feature-tile" data-editor-collection data-beta-capability="test-collection" data-beta-state="test" data-beta-save-authorized="false" data-sveltekit-reload href={base + '/editor/collection/'}>
        <span class="tile-emoji" aria-hidden="true">◇</span><h2>{collection.title}</h2><p>{collection.intro}</p><p class="beta-state-note"><strong>{beta.test}</strong> · {beta.collectionDetail}</p>
      </a>
    {/if}
    <a class="feature-tile" data-editor-catalog data-beta-capability="catalog-read" data-beta-state="read" data-beta-save-authorized="false" href={`${base}/editor/items/`}>
      <span class="tile-emoji" aria-hidden="true">✧</span>
      <h2>{copy.catalogTitle}</h2>
      <p>{copy.catalogDetail}</p><p class="beta-state-note"><strong>{beta.read}</strong> · {beta.catalogDetail}</p>
      <span>{copy.catalogAction} →</span>
    </a>

    <a class="feature-tile" data-editor-world data-beta-capability="local-world" data-beta-state="local" data-beta-save-authorized="false" href={`${base}/editor/world/`}>
      <span class="tile-emoji" aria-hidden="true">◇</span>
      <h2>{copy.worldTitle}</h2>
      <p>{copy.worldDetail}</p><p class="beta-state-note"><strong>{beta.local}</strong> · {beta.worldDetail}</p>
      <span>{copy.worldAction} →</span>
    </a>
    <a class="feature-tile" data-editor-timing data-beta-capability="timing-read" data-beta-state="read" data-beta-save-authorized="false" href={base + '/editor/timing/'}>
      <span class="tile-emoji" aria-hidden="true">◷</span>
      <h2>{copy.timingTitle}</h2>
      <p>{copy.timingDetail}</p><p class="beta-state-note"><strong>{beta.read}</strong> · {beta.timingDetail}</p>
      <span>{copy.timingAction} →</span>
    </a>
  </div>

  <section class="beta-save" data-beta-save-operations data-beta-save-authorized="false" aria-labelledby="beta-save-title">
    <h2 id="beta-save-title">{beta.pendingTitle}</h2>
    <p>{beta.pendingDetail}</p>
    <ul class="beta-save-grid">
      {#each BETA_EDITOR_PENDING_OPERATIONS as operation,i (operation.id)}
        <li class="beta-save-item" data-beta-operation={operation.id}
          data-beta-state="pending" data-beta-writer-authorized="false"
          aria-disabled="true">
          <strong>{beta.operations[i]}</strong>
          <span>{beta.pending}</span>
        </li>
      {/each}
    </ul>
  </section>

  <div class="notice" data-editor-writer-boundary role="status">{collectionReady?collection.intro:copy.boundary}</div>
</section>

<style>
  .reader-entry { display:block; margin-block:20px; min-width:0; overflow-wrap:anywhere; }
  .reader-entry:focus-visible { outline:3px solid var(--focus-ring); outline-offset:3px; }
  .feature-tile, .notice { min-width:0; overflow-wrap:anywhere; }
  .beta-overview{margin-block:20px;max-width:78ch}
  .beta-overview h2,.beta-save h2{font:500 clamp(22px,3vw,30px) Georgia,serif;margin:0 0 8px}
  .beta-overview p,.beta-save>p{font-size:13px;line-height:1.65;color:var(--ink-soft)}
  .beta-state-note{font-size:12px;line-height:1.5;overflow-wrap:anywhere}
  .beta-state-note strong{font-weight:800}
  .beta-save{margin-top:26px;border:1px solid var(--border);border-radius:16px;background:var(--surface);padding:20px;min-width:0}
  .beta-save-grid{list-style:none;padding:0;margin:16px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px}
  .beta-save-item{box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;gap:9px;min-width:0;border:1px solid var(--border);border-radius:12px;padding:15px;background:var(--surface-raised);opacity:.67;cursor:not-allowed}
  .beta-save-item strong{font-size:13px;line-height:1.45;overflow-wrap:anywhere}
  .beta-save-item span{font-size:11px;font-weight:750;overflow-wrap:anywhere}
  @media(max-width:480px){.beta-save{padding:14px}.beta-save-grid{grid-template-columns:1fr}.beta-save-item{min-height:66px}}
</style>
