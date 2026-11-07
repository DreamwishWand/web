<script lang="ts">
  import { onMount, tick } from 'svelte';
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
  import { sharedEntityHref, sharedEntityLabels, PUBLIC_DETAIL_ACCEPTED } from '$lib/entity/shared-catalog-detail.mjs';

  // Static Pages does not have an HTTP200 direct ItemID route; dev inspection remains.
  const detailNavigationAvailable = import.meta.env.DEV || PUBLIC_DETAIL_ACCEPTED;
  let runtimeIndex: any = null;
  let rawRows: any[] = [];
  let loading = true;
  let error = '';
  let query = '';
  let category = '';
  let selectedWorlds: string[] = [];
  let selectedUniverses: string[] = [];
  let filterOpen = false;
  let mobileFilter = false;
  let filterToggleButton: HTMLButtonElement | undefined;
  let filterCloseButton: HTMLButtonElement | undefined;
  let filterPanelElement: HTMLElement | undefined;
  let sheetMaxHeight = '85dvh';
  let previousBodyOverflow: string | null = null;
  let infoId: number | null = null;
  let pageLimit = 72;
  type InfoReturn = { trigger: HTMLElement; itemId: number; context: string; x: number; y: number };
  let infoReturn: InfoReturn | null = null;

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

  // COL-UX-44: mobile-only modal sheet; desktop facets stay in document flow.
  function lockFilterScroll():void{
    if(previousBodyOverflow!==null)return;
    previousBodyOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
  }
  function unlockFilterScroll():void{
    if(previousBodyOverflow===null)return;
    document.body.style.overflow=previousBodyOverflow;
    previousBodyOverflow=null;
  }
  function updateSheetMaxHeight():void{
    // CSS zoom on the page root scales fixed descendants; cap to the *visible* viewport.
    const declaredZoom=Number.parseFloat(getComputedStyle(document.documentElement).zoom);
    const rootZoom=Number.isFinite(declaredZoom)&&declaredZoom>0?declaredZoom:1;
    sheetMaxHeight=Math.max(1,Math.floor(window.innerHeight*0.85/rootZoom))+'px';
  }
  async function openFilters():Promise<void>{
    if(filterOpen)return;
    filterOpen=true;
    if(mobileFilter){
      updateSheetMaxHeight();
      lockFilterScroll();
      await tick();
      if(filterOpen&&mobileFilter)filterCloseButton?.focus();
    }
  }
  async function closeFilters():Promise<void>{
    if(!filterOpen)return;
    filterOpen=false;
    unlockFilterScroll();
    await tick();
    if(!filterOpen)filterToggleButton?.focus({preventScroll:true});
  }
  function onFilterKeydown(event:KeyboardEvent):void{
    if(!mobileFilter||!filterOpen)return;
    if(event.key==='Escape'){
      event.preventDefault();
      event.stopPropagation();
      void closeFilters();
      return;
    }
    if(event.key!=='Tab')return;
    const buttons=Array.from(filterPanelElement?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[])
      .filter(button=>button.getClientRects().length>0);
    if(!buttons.length)return;
    const first=buttons[0],last=buttons[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){
      event.preventDefault();last.focus();
    }else if(!event.shiftKey&&document.activeElement===last){
      event.preventDefault();first.focus();
    }
  }
  onMount(()=>{
    const media=window.matchMedia('(max-width: 820px)');
    mobileFilter=media.matches;
    const onMediaChange=(event:MediaQueryListEvent)=>{
      const wasMobile=mobileFilter;
      mobileFilter=event.matches;
      if(!filterOpen)return;
      if(!mobileFilter)unlockFilterScroll();
      else if(!wasMobile){
        updateSheetMaxHeight();
        lockFilterScroll();
        void tick().then(()=>{if(filterOpen&&mobileFilter)filterCloseButton?.focus();});
      }
    };
    media.addEventListener('change',onMediaChange);
    return ()=>{
      media.removeEventListener('change',onMediaChange);
      unlockFilterScroll();
    };
  });

  function chooseCategory(id:string):void{
    if(!rootCategories.some(item=>item.id===id&&item.sourceAvailable))return;
    category=id;
    query='';
    infoId=null;
    infoReturn=null;
    pageLimit=72;
  }
  function backToCategories():void{
    category='';query='';infoId=null;infoReturn=null;pageLimit=72;
  }
  function toggleFacet(which:'world'|'universe',id:string):void{
    if(which==='world') selectedWorlds=selectedWorlds.includes(id)?selectedWorlds.filter(x=>x!==id):[...selectedWorlds,id];
    else selectedUniverses=selectedUniverses.includes(id)?selectedUniverses.filter(x=>x!==id):[...selectedUniverses,id];
    pageLimit=72; infoId=null; infoReturn=null;
  }
  function clearFilters():void{selectedWorlds=[];selectedUniverses=[];pageLimit=72;infoId=null;infoReturn=null;}
  function worldLabel(id:string,code:string):string{
    return runtimeIndex?collectionFacetLabel(runtimeIndex,'world',id,code):'';
  }
  function universeLabel(id:string,code:string):string{
    return runtimeIndex?collectionFacetLabel(runtimeIndex,'universe',id,code):'';
  }
  function label(id:string,code:string):string{return stage1CategoryLabel(code,id);}
  function infoContext():string{
    return JSON.stringify([query,category,selectedWorlds,selectedUniverses,pageLimit]);
  }
  function selectInfo(id:number,event:MouseEvent):void{
    const trigger=event.currentTarget;
    if(!(trigger instanceof HTMLElement)||trigger.dataset.stage1ItemId!==String(id)||
       !scoped.some((item:any)=>item.itemId===id))return;
    infoReturn={trigger,itemId:id,context:infoContext(),x:window.scrollX,y:window.scrollY};
    infoId=id;
  }
  async function closeInfo():Promise<void>{
    const origin=infoReturn;
    const selected=infoId;
    infoId=null;
    infoReturn=null;
    await tick();
    // A new selection, changed scope, or unmounted card must not receive stale focus.
    if(!origin||selected!==origin.itemId||infoId!==null||infoReturn!==null||
       origin.context!==infoContext()||!origin.trigger.isConnected||
       origin.trigger.dataset.stage1ItemId!==String(origin.itemId)||
       !scoped.some((item:any)=>item.itemId===origin.itemId))return;
    origin.trigger.focus({preventScroll:true});
    window.scrollTo(origin.x,origin.y);
  }
  const inertProgress='— / —';
</script>

<svelte:window on:resize={()=>{if(filterOpen&&mobileFilter)updateSheetMaxHeight();}} />

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
          <input data-stage1-search type="search" bind:value={query} on:input={()=>{infoId=null;infoReturn=null;pageLimit=72;}}
            placeholder={copy.search} />
        </label>
        <div class="personal-state" role="group" aria-label="Collection personal state">
          <button type="button" aria-pressed="true" class="selected">{ui.all}</button>
          <button type="button" disabled title={ui.unknown}>{ui.owned}</button>
          <button type="button" disabled title={ui.unknown}>{ui.missing}</button>
        </div>
        <button type="button" class="filter-toggle" bind:this={filterToggleButton} aria-expanded={filterOpen} aria-haspopup={mobileFilter ? 'dialog' : undefined} aria-controls="collection-filters" on:click={()=>filterOpen ? closeFilters() : openFilters()}>
          {ui.filter}{filterCount ? ' ('+filterCount+')' : ''}
        </button>
      </div>
      {#if filterOpen}
        <div class="filter-shell" data-stage1-filter-shell>
          <button type="button" class="filter-backdrop" data-stage1-filter-backdrop tabindex="-1" aria-label={ui.close} on:click={closeFilters}></button>
          <div id="collection-filters" class="filter-panel" data-stage1-facets
            bind:this={filterPanelElement} style:max-height={mobileFilter ? sheetMaxHeight : undefined}
            role={mobileFilter ? 'dialog' : undefined}
            aria-modal={mobileFilter ? 'true' : undefined} aria-label={mobileFilter ? ui.filter : undefined}
            on:keydown={onFilterKeydown}>
            <div class="filter-sheet-heading"><strong>{ui.filter}</strong>
              <button type="button" data-stage1-filter-close bind:this={filterCloseButton} on:click={closeFilters}>{ui.close}</button>
            </div>
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
                    <button type="button" class="item-card" data-stage1-item-id={item.itemId} on:click={(event)=>selectInfo(item.itemId,event)}>
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
                    <button type="button" class="item-card" data-stage1-item-id={item.itemId} on:click={(event)=>selectInfo(item.itemId,event)}>
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
              {#if detailNavigationAvailable}<a href={sharedEntityHref(base,$locale,info.itemId)}>{ui.details}</a>{:else}<span data-detail-unavailable="true">{sharedEntityLabels($locale).unavailable}</span>{/if}
              <button type="button" data-stage1-info-close on:click={closeInfo}>{ui.close}</button>
            </div>
          </aside>
        {/if}
      {/if}
    {/if}
  </section>
</ResponsiveFrame>

<style>
.collection-stage1{padding:36px 0 90px;min-height:70vh}.collection-heading{margin:0 0 18px}.collection-heading h1{font-family:Georgia,serif;font-weight:500;letter-spacing:-.035em;font-size:clamp(34px,4vw,54px);margin:0}
.collection-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) auto auto;gap:12px;align-items:end;margin:0 0 20px}.search-field{display:grid;gap:6px;font-size:11px;color:var(--ink-muted)}.search-field input{width:100%;box-sizing:border-box;min-height:44px;border:1px solid var(--border);border-radius:12px;background:var(--surface);padding:10px 14px;color:var(--ink)}.personal-state{display:flex;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:4px}.personal-state button,.filter-toggle{border:0;border-radius:9px;background:transparent;color:var(--ink-soft);padding:10px 13px;min-height:44px;white-space:nowrap}.personal-state button.selected{background:var(--surface-raised);color:var(--ink);font-weight:700}.personal-state button:disabled{opacity:.4;cursor:not-allowed}.filter-toggle{border:1px solid var(--border);background:var(--surface);font-weight:700}.filter-panel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;padding:18px;margin:0 0 14px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}.filter-shell{display:contents}.filter-backdrop,.filter-sheet-heading{display:none}.filter-panel fieldset{min-width:0;border:0;padding:0;margin:0}.filter-panel legend{font-weight:700;color:var(--ink);padding:0 0 9px}.filter-options{display:flex;flex-wrap:wrap;gap:6px}.filter-options button,.active-filters button{border:1px solid var(--border);border-radius:99px;padding:8px 12px;background:var(--surface-raised);color:var(--ink-soft)}.filter-options button.active{border-color:var(--gold);color:var(--gold)}.active-filters{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 16px}.active-filters .clear{color:var(--ink)}
.category-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.category-card{text-align:left;display:flex;flex-direction:column;align-items:stretch;gap:9px;min-width:0;min-height:200px;padding:14px;border:1px solid var(--border);border-radius:18px;color:var(--ink);background:var(--surface);transition:border-color .15s,transform .15s;cursor:pointer}.category-card:not(:disabled):hover{border-color:var(--gold);transform:translateY(-2px)}.category-card:disabled{cursor:default;opacity:.66}.category-art{height:84px;display:grid;place-items:center;background:var(--surface-raised);border-radius:13px;color:var(--gold)}.category-glyph{font-family:Georgia,serif;font-size:36px;line-height:1}.category-name{font-weight:750;font-size:13px;line-height:1.35;overflow-wrap:anywhere;min-height:32px}.category-measure{display:flex;align-items:center;justify-content:space-between;color:var(--ink-muted);font-size:12px;font-variant-numeric:tabular-nums}.category-percent{font-size:11px}.category-card small{font-size:9px;color:var(--ink-muted)}.browse-heading{margin:14px 0 18px}.browse-heading h2{font-family:Georgia,serif;font-size:clamp(26px,3vw,42px);font-weight:500}.back-category{border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);color:var(--ink);margin-bottom:8px}.item-section{margin:0 0 24px}.item-section h3{font-size:16px;font-weight:700;margin:0 0 12px}.item-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.item-card{display:flex;gap:10px;align-items:center;text-align:left;min-width:0;min-height:74px;padding:12px;border:1px solid var(--border);border-radius:14px;background:var(--surface);color:var(--ink)}.item-card span:last-child{min-width:0;overflow-wrap:anywhere}.item-icon{display:grid;place-items:center;min-width:38px;height:38px;border-radius:9px;background:var(--surface-raised);color:var(--gold)}.more{padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--ink);margin:10px 0}.collection-info{display:flex;justify-content:space-between;gap:20px;align-items:start;border:1px solid var(--border);border-radius:18px;background:var(--surface);padding:20px}.collection-info h3{font-size:22px;margin:7px 0}.collection-info p{color:var(--ink-muted)}.info-actions{display:flex;gap:10px;flex-wrap:wrap}.info-actions a,.info-actions button{border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--surface-raised);color:var(--ink);text-decoration:none}.state-panel{padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:14px;color:var(--ink-muted)}
button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
@media(max-width:1180px){.category-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.item-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:820px){.collection-toolbar{grid-template-columns:1fr auto}.search-field{grid-column:1/-1}.category-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.item-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.filter-shell{display:block;position:fixed;inset:0;z-index:120}.filter-backdrop{display:block;position:absolute;inset:0;width:100%;border:0;background:rgba(0,0,0,.54);cursor:pointer}
.filter-panel{position:absolute;left:0;right:0;bottom:0;display:block;width:100%;max-height:85dvh;overflow-y:auto;overscroll-behavior:contain;box-sizing:border-box;margin:0;padding:16px max(16px,env(safe-area-inset-right)) calc(18px + env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));border-radius:20px 20px 0 0;background:var(--surface);box-shadow:0 -12px 36px rgba(0,0,0,.22)}
.filter-sheet-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;color:var(--ink)}.filter-sheet-heading button{min-height:44px;min-width:44px;padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-raised);color:var(--ink)}.filter-panel fieldset+fieldset{margin-top:16px}.filter-options button{min-height:44px}
}
@media(max-width:540px){.collection-stage1{padding:24px 0 65px}.collection-toolbar{grid-template-columns:1fr}.category-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.category-card{padding:10px;min-height:178px}.category-art{height:70px}.item-grid{grid-template-columns:1fr}.collection-info{flex-direction:column}}
@media(max-width:360px){.category-card{min-height:165px}.category-art{height:60px}.category-name{font-size:12px}}
.item-grid.compact-media{gap:6px}.item-grid.compact-media .item-card{padding:7px;min-height:54px}
</style>
