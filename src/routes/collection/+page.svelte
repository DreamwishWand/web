<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, formatNumber } from '$lib/i18n/runtime.js';
  import { collectionCopy, collectionFamilyLabel } from '$lib/collection/copy.js';
  import { collectionFacetLabel, decodeCollectionRecord, filterCollectionRecords, loadCollectionRuntime } from '$lib/collection/runtime.js';
  import ResponsiveFrame from '$lib/ui/ResponsiveFrame.svelte';

  type ViewMode = 'category' | 'world' | 'universe';
  let runtimeIndex: any = null;
  let rawRows: any[] = [];
  let loading = true;
  let error = '';
  let view: ViewMode = 'category';
  let query = '';
  let family = '';
  let world = '';
  let universe = '';
  const DISPLAY_LIMIT = 120;

  $: copy = collectionCopy($locale);
  $: records = runtimeIndex ? rawRows.map((row) => decodeCollectionRecord(runtimeIndex, row, $locale)) : [];
  $: filtered = filterCollectionRecords(records, { query, family, world, universe }).sort((a: any, b: any) => a.label.localeCompare(b.label, $locale));
  $: visible = filtered.slice(0, DISPLAY_LIMIT);
  $: families = runtimeIndex?.f ?? [];
  $: worlds = runtimeIndex?.w ?? [];
  $: universes = runtimeIndex?.u ?? [];

  onMount(async () => {
    try {
      const loaded = await loadCollectionRuntime(base);
      runtimeIndex = loaded.index;
      rawRows = loaded.rows;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading = false;
    }
  });

  function setView(next: ViewMode): void {
    view = next;
    if (next !== 'category') family = '';
    if (next !== 'world') world = '';
    if (next !== 'universe') universe = '';
  }

  function worldLabel(value: string): string {
    return runtimeIndex ? collectionFacetLabel(runtimeIndex, 'world', value, $locale) : '';
  }

  function universeLabel(value: string): string {
    return runtimeIndex ? collectionFacetLabel(runtimeIndex, 'universe', value, $locale) : '';
  }

  function familyLabel(value: string): string {
    return collectionFamilyLabel($locale, value);
  }

  function initials(familyName: string): string {
    return familyName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }
</script>

<svelte:head>
  <title>Collection | Dreamwish Wand</title>
  <meta name="description" content="Browse collection-relevant Disney Dreamlight Valley entities in Dreamwish Wand." />
</svelte:head>

<ResponsiveFrame>
<section class="collection-page">
  <header class="collection-heading">
    <div>
      <p class="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p class="page-intro">{copy.intro}</p>
    </div>
    <div class="source-badge"><strong>{copy.source}</strong><span>{runtimeIndex ? formatNumber(runtimeIndex.n, {}, $locale) : '—'} {copy.results}</span></div>
  </header>

  <div class="boundary-grid">
    <div class="boundary"><strong>{copy.personal}</strong><span>{copy.personalDetail}</span></div>
    <div class="boundary"><strong>Media</strong><span>{copy.media}</span></div>
  </div>

  {#if loading}
    <div class="status" role="status" aria-live="polite">{copy.loading}</div>
  {:else if error}
    <div class="status error" role="alert"><strong>{copy.failed}</strong><code>{error}</code></div>
  {:else}
    <div class="collection-controls">
      <div class="view-switch" role="group" aria-label="Collection view">
        <button class:active={view === 'category'} type="button" on:click={() => setView('category')}>{copy.category}</button>
        <button class:active={view === 'world'} type="button" on:click={() => setView('world')}>{copy.world}</button>
        <button class:active={view === 'universe'} type="button" on:click={() => setView('universe')}>{copy.universe}</button>
      </div>
      <label class="search"><span>{copy.search}</span><input type="search" bind:value={query} /></label>
      {#if view === 'category'}
        <label><span>{copy.category}</span><select bind:value={family}><option value="">{copy.all}</option>{#each families as value}<option value={value}>{familyLabel(value)}</option>{/each}</select></label>
      {:else if view === 'world'}
        <label><span>{copy.world}</span><select bind:value={world}><option value="">{copy.all}</option>{#each worlds as value}<option value={value}>{worldLabel(value)}</option>{/each}</select></label>
      {:else}
        <label><span>{copy.universe}</span><select bind:value={universe}><option value="">{copy.all}</option>{#each universes as value}<option value={value}>{universeLabel(value)}</option>{/each}</select></label>
      {/if}
    </div>

    <div class="result-summary" aria-live="polite">
      <strong>{formatNumber(filtered.length, {}, $locale)} {copy.results}</strong>
      <span>{copy.showing} {formatNumber(visible.length, {}, $locale)}</span>
    </div>

    {#if visible.length}
      <div class="collection-grid">
        {#each visible as item}
          <article class="collection-card">
            <div class="family-icon" aria-hidden="true">{initials(familyLabel(item.family))}</div>
            <div class="card-copy">
              <span class="family">{familyLabel(item.family)}</span>
              <h2>{item.label}</h2>
              <div class="facets">
                {#each item.worlds as value}<span>{worldLabel(value)}</span>{/each}
                {#each item.universes.slice(0,2) as value}<span>{universeLabel(value)}</span>{/each}
              </div>
              <div class="card-meta">
                <span>{item.stateClass === 'TRACKED' ? copy.trackable : copy.readonly}</span>
                <code>{copy.itemId} {item.itemId}</code>
              </div>
            </div>
          </article>
        {/each}
      </div>
      {#if filtered.length > DISPLAY_LIMIT}<p class="more-note">{copy.more}</p>{/if}
    {:else}
      <div class="empty"><span aria-hidden="true">✧</span><strong>{copy.empty}</strong></div>
    {/if}
  {/if}
</section>
</ResponsiveFrame>

<style>
  .collection-page{padding-block:64px 96px;min-height:72vh}.collection-heading{display:flex;justify-content:space-between;align-items:end;gap:28px}.collection-heading h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,68px);font-weight:500;letter-spacing:-.055em;margin:12px 0}.source-badge{border:1px solid var(--border);background:var(--surface);border-radius:16px;padding:14px 16px;display:grid;gap:5px;min-width:220px}.source-badge strong{font-size:11px;color:var(--gold)}.source-badge span{font-size:10px;color:var(--ink-muted)}.boundary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:28px 0 16px}.boundary{border:1px solid var(--border);border-radius:14px;background:var(--surface);padding:14px;display:grid;gap:6px}.boundary strong{font-size:11px}.boundary span{font-size:10px;line-height:1.6;color:var(--ink-muted)}.status{padding:18px;border:1px solid var(--border);border-radius:16px;background:var(--surface);color:var(--ink-soft)}.status.error{display:grid;gap:8px;color:var(--decor-accent)}.status code{font-size:9px;overflow-wrap:anywhere;color:var(--ink-muted)}.collection-controls{display:grid;grid-template-columns:auto minmax(260px,1fr) minmax(190px,260px);gap:12px;align-items:end;border:1px solid var(--border);background:var(--surface);border-radius:18px;padding:14px}.view-switch{display:flex;gap:5px;padding:4px;border:1px solid var(--border);border-radius:11px;background:var(--page-2)}.view-switch button{border:1px solid transparent;background:transparent;color:var(--ink-soft);border-radius:8px;padding:9px 11px;font-size:10px;font-weight:800}.view-switch button.active{background:var(--surface-raised);border-color:var(--border);color:var(--gold)}label{display:grid;gap:6px;font-size:9px;font-weight:800;color:var(--ink-muted);letter-spacing:.04em}input,select{width:100%;box-sizing:border-box;background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:10px 11px}.result-summary{display:flex;justify-content:space-between;gap:16px;align-items:center;margin:18px 2px 10px}.result-summary strong{font-size:12px}.result-summary span{font-size:10px;color:var(--ink-muted)}.collection-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.collection-card{min-width:0;border:1px solid var(--border);background:var(--surface);border-radius:15px;padding:13px;display:flex;gap:12px;align-items:flex-start}.family-icon{width:42px;height:42px;flex:none;border-radius:12px;display:grid;place-items:center;background:var(--surface-raised);color:var(--gold);font-family:Georgia,serif;font-size:14px}.card-copy{min-width:0;flex:1}.family{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.collection-card h2{font-family:Georgia,serif;font-weight:500;font-size:16px;line-height:1.25;margin:5px 0 8px;overflow-wrap:anywhere}.facets{display:flex;flex-wrap:wrap;gap:4px;min-height:18px}.facets span{border:1px solid var(--border);border-radius:999px;padding:3px 6px;font-size:7px;color:var(--ink-muted)}.card-meta{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:10px}.card-meta span{font-size:8px;color:var(--help-accent)}.card-meta code{font-size:7px;color:var(--ink-muted);white-space:nowrap}.more-note{text-align:center;color:var(--ink-muted);font-size:10px;margin:18px}.empty{min-height:320px;display:grid;place-items:center;align-content:center;text-align:center;color:var(--ink-muted);gap:8px}.empty span{font-size:40px;color:var(--gold)}@media(max-width:1050px){.collection-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.collection-controls{grid-template-columns:1fr 1fr}.view-switch{grid-column:1/-1;width:max-content}.collection-heading{align-items:flex-start;flex-direction:column}}@media(max-width:760px){.collection-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.boundary-grid,.collection-controls{grid-template-columns:1fr}.view-switch{width:100%;overflow:auto}}@media(max-width:480px){.collection-page{padding-block:44px 70px}.collection-grid{grid-template-columns:1fr}.source-badge{min-width:0;width:100%;box-sizing:border-box}}
</style>
