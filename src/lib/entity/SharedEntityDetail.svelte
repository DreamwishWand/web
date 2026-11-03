<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import ResponsiveFrame from '$lib/ui/ResponsiveFrame.svelte';
  import { collectionFamilyLabel } from '$lib/collection/copy.js';
  import { collectionFacetLabel, loadCollectionRuntime } from '$lib/collection/runtime.js';
  import { resolveSharedCatalogEntity, sharedEntityLabels } from '$lib/entity/shared-catalog-detail.mjs';

  export let primaryId: string;
  export let localeCode: string;
  let index: any = null;
  let rows: any[] = [];
  let loading = true;
  let failure = false;
  $: copy = sharedEntityLabels(localeCode);
  $: outcome = index ? resolveSharedCatalogEntity(index, rows, primaryId, localeCode) : null;
  $: item = outcome?.status === 'FOUND' ? outcome.item : null;
  $: family = item ? collectionFamilyLabel(localeCode, item.family) : '';
  $: worldNames = item && index ? item.worlds.map((x: string) => collectionFacetLabel(index,'world',x,localeCode)).filter(Boolean) : [];
  $: universeNames = item && index ? item.universes.map((x: string) => collectionFacetLabel(index,'universe',x,localeCode)).filter(Boolean) : [];

  onMount(async () => {
    try {
      const result = await loadCollectionRuntime(base);
      index = result.index;
      rows = result.rows;
    } catch {
      failure = true;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>{item ? item.label + ' | Dreamwish Wand' : copy.detail + ' | Dreamwish Wand'}</title>
  <meta name="robots" content="noindex,follow" />
  <meta name="description" content={copy.notPersonal} />
</svelte:head>

<ResponsiveFrame>
  <section class="shared-entity" data-shared-entity-detail="preview" data-public-indexable="false" data-writer="off" lang={localeCode}>
    <nav aria-label={copy.back}><a href={base + '/collection/'}>{copy.back}</a></nav>
    {#if loading}
      <p role="status">{copy.loading}…</p>
    {:else if failure || !item}
      <h1>{copy.unavailable}</h1>
      <p role="status">{copy.unavailable}</p>
    {:else}
      <header>
        <p class="eyebrow">{copy.detail}</p>
        <h1>{item.label}</h1>
        <p>{copy.notPersonal}</p>
      </header>
      <div class="entity-grid">
        <section>
          <h2>{copy.category}</h2>
          <p>{family}</p>
        </section>
        {#if worldNames.length}
          <section><h2>{copy.world}</h2><p>{worldNames.join(' · ')}</p></section>
        {/if}
        {#if universeNames.length}
          <section><h2>{copy.universe}</h2><p>{universeNames.join(' · ')}</p></section>
        {/if}
        <section><h2>{copy.source}</h2><p>Nintendo Switch · DDV v1.25.0</p></section>
      </div>
      <p class="media-note">{copy.rights}</p>
      {#if outcome && 'canExplore' in outcome && outcome.canExplore}
        <p><a href={base + '/explore/'}>{copy.explore}</a></p>
      {/if}
    {/if}
  </section>
</ResponsiveFrame>
<style>
 .shared-entity{max-width:1000px;padding-block:42px 100px;min-height:60vh}
 nav a{color:var(--gold);font-weight:650}
 header{margin:32px 0}
 h1{font-family:Georgia,serif;font-weight:500;font-size:clamp(30px,5vw,60px);overflow-wrap:anywhere}
 header p{max-width:68ch;color:var(--ink-soft)}
 .eyebrow{letter-spacing:.12em;color:var(--gold);font-size:12px}
 .entity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
 .entity-grid section{border:1px solid var(--border);background:var(--surface);border-radius:14px;padding:18px}
 h2{font-size:13px;color:var(--ink-soft)}
 .entity-grid p{font-size:16px;overflow-wrap:anywhere}
 .media-note{margin:20px 0;color:var(--ink-muted);font-size:13px}
 @media(max-width:620px){.entity-grid{grid-template-columns:1fr}}
</style>
