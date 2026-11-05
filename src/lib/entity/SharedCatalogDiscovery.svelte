<script lang="ts">
  import { base } from '$app/paths';
  import { collectionFamilyLabel } from '$lib/collection/copy.js';
  import { PUBLIC_DETAIL_ACCEPTED } from './shared-catalog-detail.mjs';
  import { collectionFacetLabel } from '$lib/collection/runtime.js';
  import {
    buildSharedCatalogDirectory, relatedSharedCatalogItems, searchSharedCatalogDirectory,
    sharedCatalogDirectoryHref, sharedDirectoryCopy
  } from './shared-catalog-directory.mjs';

  // The unprerendered detail route has no public HTTP200; dev-only links remain.
  const detailNavigationAvailable = import.meta.env.DEV || PUBLIC_DETAIL_ACCEPTED;
  export let index: any = null;
  export let rows: any[] = [];
  export let localeCode: string = 'en';
  export let currentId: string = '';
  export let maxResults: number = 24;

  let query = '';
  let family = '';
  let world = '';
  let universe = '';
  $: copy = sharedDirectoryCopy(localeCode);
  $: directory = buildSharedCatalogDirectory(index, rows, localeCode);
  $: resolved = directory.status === 'READY' ?
    directory.entries.find((item: any) => String(item.itemId) === currentId) : null;
  $: related = resolved ? relatedSharedCatalogItems(directory, resolved) : [];
  $: result = searchSharedCatalogDirectory(directory, {query, family, world, universe}, maxResults);
  $: families = directory.status === 'READY' ? (index?.f ?? []) : [];
  $: worlds = directory.status === 'READY' ? (index?.w ?? []) : [];
  $: universes = directory.status === 'READY' ? (index?.u ?? []) : [];

  function facetLabel(kind: 'world' | 'universe', value: string): string {
    try { return collectionFacetLabel(index, kind, value, localeCode) || value; }
    catch { return value; }
  }
</script>

<section class="shared-discovery" data-shared-discovery={directory.status}
  data-catalog-version="1.25.0" data-personal-state="unknown" data-public-indexable="false">
  {#if directory.status !== 'READY'}
    <p role="status">{copy.disabled}</p>
  {:else}
    {#if currentId && resolved && related.length}
      <div class="related">
        <h2>{copy.related}</h2>
        <ul class="entity-links" data-shared-related="true">
          {#each related as item (item.itemId)}
            <li>
              {#if detailNavigationAvailable}
                <a href={sharedCatalogDirectoryHref(base, localeCode, item)}
                  aria-label={copy.detail + ': ' + item.label}>
                  <span>{item.label}</span><small>{copy.id} {item.itemId}</small>
                </a>
              {:else}
                <span class="unavailable-detail" data-detail-unavailable="true">
                  <span>{item.label}</span><small>{copy.id} {item.itemId}</small>
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
    <div class="faceted">
      <h2>{copy.search}</h2>
      <p class="provenance">{copy.source} · {copy.private}</p>
      <div class="controls">
        <label><span>{copy.search}</span><input type="search" bind:value={query} data-shared-query="true"/></label>
        <label><span>{copy.family}</span>
          <select bind:value={family} data-shared-family="true"><option value="">{copy.all}</option>
            {#each families as value (value)}<option value={value}>{collectionFamilyLabel(localeCode,value)}</option>{/each}
          </select>
        </label>
        <label><span>{copy.world}</span>
          <select bind:value={world} data-shared-world="true"><option value="">{copy.all}</option>
            {#each worlds as value (value)}<option value={value}>{facetLabel('world',value)}</option>{/each}
          </select>
        </label>
        <label><span>{copy.universe}</span>
          <select bind:value={universe} data-shared-universe="true"><option value="">{copy.all}</option>
            {#each universes as value (value)}<option value={value}>{facetLabel('universe',value)}</option>{/each}
          </select>
        </label>
      </div>
      <p class="count" role="status" aria-live="polite">{copy.results}: {result.total} · {copy.more}: {result.items.length}</p>
      {#if result.items.length}
        <ul class="entity-links" data-shared-results="true">
          {#each result.items as item (item.itemId)}
            <li>
              {#if detailNavigationAvailable}
                <a href={sharedCatalogDirectoryHref(base, localeCode, item)}
                  aria-label={copy.detail + ': ' + item.label}>
                  <span>{item.label}</span><small>{copy.id} {item.itemId}</small>
                </a>
              {:else}
                <span class="unavailable-detail" data-detail-unavailable="true">
                  <span>{item.label}</span><small>{copy.id} {item.itemId}</small>
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <p role="status" data-shared-empty="true">{copy.empty}</p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .shared-discovery{display:grid;gap:16px;min-width:0;margin-block:20px}
  .faceted,.related{border:1px solid var(--border);border-radius:15px;background:var(--surface);padding:clamp(14px,3vw,20px)}
  h2{font:500 clamp(18px,3vw,24px) Georgia,serif;margin:0 0 12px}
  .controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  label{display:grid;gap:6px;min-width:0;font-size:13px;color:var(--ink-soft)}
  select,input{box-sizing:border-box;min-width:0;max-width:100%;width:100%;min-height:44px;padding:9px 11px;background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:9px}
  .provenance,.count{font-size:12px;color:var(--ink-soft);line-height:1.6}
  .entity-links{list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0;padding:0}
  .entity-links li{min-width:0}
  .entity-links :is(a,.unavailable-detail){box-sizing:border-box;min-height:64px;height:100%;display:flex;flex-direction:column;justify-content:center;gap:5px;text-decoration:none;color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:11px;overflow-wrap:anywhere}
  .entity-links .unavailable-detail{color:var(--ink-soft);border-style:dashed}
  .entity-links small{font-size:11px;color:var(--ink-muted)}
  a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
  @media(max-width:760px){.entity-links{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:480px){.controls,.entity-links{grid-template-columns:1fr}}
</style>
