<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { loadCollectionRuntime } from '$lib/collection/runtime.js';
  import SharedCatalogDiscovery from '$lib/entity/SharedCatalogDiscovery.svelte';
  import { sharedDirectoryCopy } from '$lib/entity/shared-catalog-directory.mjs';

  let index: any = null;
  let rows: any[] = [];
  let loading = true;
  let failure = false;
  $: copy = sharedDirectoryCopy($locale);

  onMount(async () => {
    try {
      const result = await loadCollectionRuntime(base);
      index = result.index;
      rows = result.rows;
    } catch {
      failure = true;
      index = null;
      rows = [];
    } finally {
      loading = false;
    }
  });
</script>
<svelte:head>
  <title>{copy.search} | Dreamwish Wand</title>
  <meta name="robots" content="noindex,follow" />
  <meta name="description" content="Verified Switch v1.25.0 catalog reference browser. Personal inventory and Save Writer remain disabled." />
</svelte:head>
<section class="inside-page container" data-editor-item-surface="verified-catalog-read-only" data-owned="unknown" data-writer="off">
  <p class="eyebrow">EDITOR / INVENTORY / READ ONLY</p>
  <h1>{copy.search}</h1>
  <p class="intro">{copy.source}</p>
  <p class="warning" role="status">{copy.private}. Save v1.25.3 / schema626 ownership is not joined to this v1.25.0 Catalog; Writer OFF.</p>
  {#if loading}
    <p role="status">{copy.search}…</p>
  {:else if failure}
    <p role="alert">{copy.disabled}</p>
  {:else}
    <SharedCatalogDiscovery {index} {rows} localeCode={$locale} maxResults={48} />
  {/if}
</section>
<style>
 .inside-page{padding-block:48px 90px;min-height:68vh}
 h1{font:500 clamp(28px,5vw,50px) Georgia,serif;overflow-wrap:anywhere}
 .intro,.warning{font-size:13px;line-height:1.7;color:var(--ink-soft)}
 .warning{border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--surface)}
</style>
