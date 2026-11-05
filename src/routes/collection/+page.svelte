<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { collectionCopy } from '$lib/collection/copy.js';
  import { collectionFacetLabel, decodeCollectionRecord, filterCollectionRecords, loadCollectionRuntime } from '$lib/collection/runtime.js';
  import {
    STAGE1_COLLECTION_ORDER, STAGE1_COLLECTION_WRITER_ENABLED, STAGE1_COLLECTION_PERSONAL_PROGRESS_ENABLED,
    stage1CollectionCopy, stage1CategoryLabel, stage1RootCategories,
    stage1ScopeRecords, groupStage1CategoryResults, groupStage1UniverseResults
  } from '$lib/collection/stage1-root.mjs';
  import ResponsiveFrame from '$lib/ui/ResponsiveFrame.svelte';
  import ItemThumb from '$lib/ui/ItemThumb.svelte';
  import ItemImagePreferences from '$lib/ui/ItemImagePreferences.svelte';
  import { itemImagePreferences } from '$lib/item-media/public-item-images.mjs';
  import { sharedEntityHref } from '$lib/entity/shared-catalog-detail.mjs';

  let runtimeIndex: any = null;
  let rawRows: any[] = [];
  let loading = true;
  let error = '';
  let query = '';
  let category = '';
  let selectedWorlds: string[] = [];
  let selectedUniverses: string[] = [];
  let filterOpen = false;
  let infoId: number | null = null;
  let pageLimit = 72;

  $: copy = collectionCopy($locale);
  $: ui = stage1CollectionCopy($locale);
  $: records = runtimeIndex ? rawRows.map(row=>decodeCollectionRecord(runtimeIndex,row,$locale)) : [];
  $: rootCategories = stage1RootCategories(runtimeIndex);
  $: worlds = runtimeIndex?.w ?? [];
  $: universes = runtimeIndex?.u ?? [];
  $: scoped = stage1ScopeRecords(records,{
    query,category,worlds:selectedWorlds,universes:selectedUniverses
  });
  $: searchGroups = query.trim() ? groupStage1CategoryResults(scoped) : [];
  $: browseGroups = category && !query.trim() ? groupStage1UniverseResults(scoped,$locale) : [];
  $: info = scoped.find((item:any)=>item.itemId===infoId) ?? null;
  $: categoryIsSupported = rootCategories.some(item=>item.id===category&&item.sourceAvailable);
  $: filterCount = selectedWorlds.length + selectedUniverses.length;

  onMount(async()=>{
    try{
      const loaded=await loadCollectionRuntime(base);
      runtimeIndex=loaded.index;
      rawRows=loaded.rows;
    }catch(cause){
      error=cause instanceof Error?cause.message:String(cause);
    }finally{loading=false;}
  });

  function chooseCategory(id:string):void{
    if(!rootCategories.some(item=>item.id===id&&item.sourceAvailable))return;
    category=id;
    query='';
    infoId=null;
    pageLimit=72;
  }
  function backToCategories():void{
    category='';query='';infoId=null;pageLimit=72;
  }
  function toggleFacet(which:'world'|'universe',id:string):void{
    if(which==='world') selectedWorlds=selectedWorlds.includes(id)?selectedWorlds.filter(x=>x!==id):[...selectedWorlds,id];
    else selectedUniverses=selectedUniverses.includes(id)?selectedUniverses.filter(x=>x!==id):[...selectedUniverses,id];
    pageLimit=72; infoId=null;
  }
  function clearFilters():void{selectedWorlds=[];selectedUniverses=[];pageLimit=72;infoId=null;}
  function worldLabel(id:string,code:string):string{
    return runtimeIndex?collectionFacetLabel(runtimeIndex,'world',id,code):'';
  }
  function universeLabel(id:string,code:string):string{
    return runtimeIndex?collectionFacetLabel(runtimeIndex,'universe',id,code):'';
  }
  function label(id:string,code:string):string{return stage1CategoryLabel(code,id);}
  function selectInfo(id:number):void{infoId=id;}
  const inertProgress='— / —';
</script>

<svelte:head>
  <title>Collection | Dreamwish Wand</title>
  <meta name="description" content="Browse Disney Dreamlight Valley Collection categories with verified local reference data." />
</svelte:head>

<ResponsiveFrame width="wide">
  <section class="collection-stage1" data-stage1-collection-root data-personal-progress="unknown" data-writer="off" data-media-rights="unverified">
    <header class="collection-heading">
      <h1>{copy.title}</h1>
    </header>
    <ItemImagePreferences />
    {#if loading}
      <p class="state-panel" role="status" aria-live="polite">{copy.loading}</p>
    {:else if error}
      <p class="state-panel" role="alert">{copy.failed}</p>
    {:else}
      <div class="collection-toolbar">
        <label class="search-field"><span>{copy.search}</span>
          <input data-stage1-search type="search" bind:value={query} on:input={()=>{infoId=null;pageLimit=72;}}
            placeholder={copy.search} />
        </label>
        <div class="personal-state" role="group" aria-label="Collection personal state">
          <button type="button" aria-pressed="true" class="selected">{ui.all}</button>
          <button type="button" disabled title={ui.unknown}>{ui.owned}</button>
          <button type="button" disabled title={ui.unknown}>{ui.missing}</button>
        </div>
        <button type="button" class="filter-toggle" aria-expanded={filterOpen} aria-controls="collection-filters" on:click={()=>filterOpen=!filterOpen}>
          {ui.filter}{filterCount ? ' ('+filterCount+')' : ''}
        </button>
      </div>
      {#if filterOpen}
        <div id="collection-filters" class="filter-panel" data-stage1-facets>
          <fieldset>
            <legend>{ui.world}</legend>
            <div class="filter-options">
              {#each worlds as id}
                <button type="button" aria-pressed={selectedWorlds.includes(id)}
                  class:active={selectedWorlds.includes(id)} on:click={()=>toggleFacet('world',id)}>{worldLabel(id,$locale)}</button>
              {/each}
            </div>
          </fieldset>
          <fieldset>
            <legend>{ui.universe}</legend>
            <div class="filter-options">
              {#each universes as id}
                <button type="button" aria-pressed={selectedUniverses.includes(id)}
                  class:active={selectedUniverses.includes(id)} on:click={()=>toggleFacet('universe',id)}>{universeLabel(id,$locale)}</button>
              {/each}
            </div>
          </fieldset>
        </div>
      {/if}
      {#if filterCount}
        <div class="active-filters" aria-label={ui.filter}>
          {#each selectedWorlds as id}
            <button type="button" on:click={()=>toggleFacet('world',id)}>{worldLabel(id,$locale)} ×</button>
          {/each}
          {#each selectedUniverses as id}
            <button type="button" on:click={()=>toggleFacet('universe',id)}>{universeLabel(id,$locale)} ×</button>
          {/each}
          <button type="button" class="clear" on:click={clearFilters}>{ui.clear}</button>
        </div>
      {/if}

      {#if !category && !query.trim()}
        <div class="category-grid" data-stage1-category-grid>
          {#each rootCategories as item (item.id)}
            <button type="button" class="category-card" disabled={!item.sourceAvailable}
              on:click={()=>chooseCategory(item.id)} data-category={item.id}
              data-source-verified={item.sourceAvailable ? 'true' : 'false'}
              aria-label={label(item.id,$locale) + ': ' + ui.unknown}>
              <span class="category-art" aria-hidden="true"><span class="category-glyph">{label(item.id,$locale).slice(0,1)}</span></span>
              <span class="category-name">{label(item.id,$locale)}</span>
              <span class="category-measure" aria-label={ui.unknown}>
                {inertProgress}<span class="category-percent">—%</span>
              </span>
              {#if !item.sourceAvailable}<small>{ui.unavailable}</small>{/if}
            </button>
          {/each}
        </div>
      {:else}
        <div class="browse-heading">
          <button type="button" on:click={backToCategories} class="back-category">{ui.back}</button>
          <h2>{category ? label(category,$locale) : ui.results}</h2>
          {#if category && !categoryIsSupported}<p>{ui.unavailable}</p>{/if}
        </div>
        {#if query.trim()}
          <div data-stage1-search-groups>
            {#each searchGroups as group (group.id)}
              <section class="item-section" data-result-category={group.id}>
                <h3>{label(group.id,$locale)}</h3>
                <div class="item-grid" class:compact-media={$itemImagePreferences.density==='compact'}>
                  {#each group.items.slice(0,pageLimit) as item (item.itemId)}
                    <button type="button" class="item-card" on:click={()=>selectInfo(item.itemId)}>
                      <ItemThumb itemId={item.itemId} label={item.label} /><span>{item.label}</span>
                    </button>
                  {/each}
                </div>
                {#if group.items.length>pageLimit}
                  <button type="button" class="more" on:click={()=>pageLimit+=72}>{copy.more}</button>
                {/if}
              </section>
            {/each}
            {#if !searchGroups.length}<p class="state-panel">{ui.empty}</p>{/if}
          </div>
        {:else}
          <div data-stage1-category-browse>
            {#each browseGroups as group (group.id)}
              <section class="item-section" data-universe-group={group.id || 'unscoped'}>
                {#if group.id}<h3>{universeLabel(group.id,$locale)}</h3>{/if}
                <div class="item-grid" class:compact-media={$itemImagePreferences.density==='compact'}>
                  {#each group.items.slice(0,pageLimit) as item (item.itemId)}
                    <button type="button" class="item-card" on:click={()=>selectInfo(item.itemId)}>
                      <ItemThumb itemId={item.itemId} label={item.label} /><span>{item.label}</span>
                    </button>
                  {/each}
                </div>
                {#if group.items.length>pageLimit}
                  <button type="button" class="more" on:click={()=>pageLimit+=72}>{copy.more}</button>
                {/if}
              </section>
            {/each}
            {#if !browseGroups.length}<p class="state-panel">{ui.empty}</p>{/if}
          </div>
        {/if}
        {#if info}
          <aside class="collection-info" data-stage1-item-info aria-label={info.label}>
            <ItemThumb itemId={info.itemId} label={info.label} />
            <div><p class="eyebrow">{ui.categories} · {label(info.family,$locale)}</p><h3>{info.label}</h3><p>{copy.itemId} {info.itemId}</p>
              <p>{ui.unknown}</p></div>
            <div class="info-actions">
              <a href={sharedEntityHref(base,$locale,info.itemId)}>{ui.details}</a>
              <button type="button" on:click={()=>infoId=null}>{ui.close}</button>
            </div>
          </aside>
        {/if}
      {/if}
    {/if}
  </section>
</ResponsiveFrame>

<style>
.collection-stage1{padding:36px 0 90px;min-height:70vh}.collection-heading{margin:0 0 18px}.collection-heading h1{font-family:Georgia,serif;font-weight:500;letter-spacing:-.035em;font-size:clamp(34px,4vw,54px);margin:0}
.collection-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) auto auto;gap:12px;align-items:end;margin:0 0 20px}.search-field{display:grid;gap:6px;font-size:11px;color:var(--ink-muted)}.search-field input{width:100%;box-sizing:border-box;min-height:44px;border:1px solid var(--border);border-radius:12px;background:var(--surface);padding:10px 14px;color:var(--ink)}.personal-state{display:flex;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:4px}.personal-state button,.filter-toggle{border:0;border-radius:9px;background:transparent;color:var(--ink-soft);padding:10px 13px;min-height:44px;white-space:nowrap}.personal-state button.selected{background:var(--surface-raised);color:var(--ink);font-weight:700}.personal-state button:disabled{opacity:.4;cursor:not-allowed}.filter-toggle{border:1px solid var(--border);background:var(--surface);font-weight:700}.filter-panel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;padding:18px;margin:0 0 14px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}.filter-panel fieldset{min-width:0;border:0;padding:0;margin:0}.filter-panel legend{font-weight:700;color:var(--ink);padding:0 0 9px}.filter-options{display:flex;flex-wrap:wrap;gap:6px}.filter-options button,.active-filters button{border:1px solid var(--border);border-radius:99px;padding:8px 12px;background:var(--surface-raised);color:var(--ink-soft)}.filter-options button.active{border-color:var(--gold);color:var(--gold)}.active-filters{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 16px}.active-filters .clear{color:var(--ink)}
.category-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.category-card{text-align:left;display:flex;flex-direction:column;align-items:stretch;gap:9px;min-width:0;min-height:200px;padding:14px;border:1px solid var(--border);border-radius:18px;color:var(--ink);background:var(--surface);transition:border-color .15s,transform .15s;cursor:pointer}.category-card:not(:disabled):hover{border-color:var(--gold);transform:translateY(-2px)}.category-card:disabled{cursor:default;opacity:.66}.category-art{height:84px;display:grid;place-items:center;background:var(--surface-raised);border-radius:13px;color:var(--gold)}.category-glyph{font-family:Georgia,serif;font-size:36px;line-height:1}.category-name{font-weight:750;font-size:13px;line-height:1.35;overflow-wrap:anywhere;min-height:32px}.category-measure{display:flex;align-items:center;justify-content:space-between;color:var(--ink-muted);font-size:12px;font-variant-numeric:tabular-nums}.category-percent{font-size:11px}.category-card small{font-size:9px;color:var(--ink-muted)}.browse-heading{margin:14px 0 18px}.browse-heading h2{font-family:Georgia,serif;font-size:clamp(26px,3vw,42px);font-weight:500}.back-category{border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);color:var(--ink);margin-bottom:8px}.item-section{margin:0 0 24px}.item-section h3{font-size:16px;font-weight:700;margin:0 0 12px}.item-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.item-card{display:flex;gap:10px;align-items:center;text-align:left;min-width:0;min-height:74px;padding:12px;border:1px solid var(--border);border-radius:14px;background:var(--surface);color:var(--ink)}.item-card span:last-child{min-width:0;overflow-wrap:anywhere}.item-icon{display:grid;place-items:center;min-width:38px;height:38px;border-radius:9px;background:var(--surface-raised);color:var(--gold)}.more{padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--ink);margin:10px 0}.collection-info{display:flex;justify-content:space-between;gap:20px;align-items:start;border:1px solid var(--border);border-radius:18px;background:var(--surface);padding:20px}.collection-info h3{font-size:22px;margin:7px 0}.collection-info p{color:var(--ink-muted)}.info-actions{display:flex;gap:10px;flex-wrap:wrap}.info-actions a,.info-actions button{border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--surface-raised);color:var(--ink);text-decoration:none}.state-panel{padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:14px;color:var(--ink-muted)}
button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
@media(max-width:1180px){.category-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.item-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:820px){.collection-toolbar{grid-template-columns:1fr auto}.search-field{grid-column:1/-1}.category-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.filter-panel{grid-template-columns:1fr}.item-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:540px){.collection-stage1{padding:24px 0 65px}.collection-toolbar{grid-template-columns:1fr}.category-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.category-card{padding:10px;min-height:178px}.category-art{height:70px}.item-grid{grid-template-columns:1fr}.collection-info{flex-direction:column}}
@media(max-width:360px){.category-card{min-height:165px}.category-art{height:60px}.category-name{font-size:12px}}
.item-grid.compact-media{gap:6px}.item-grid.compact-media .item-card{padding:7px;min-height:54px}
</style>
