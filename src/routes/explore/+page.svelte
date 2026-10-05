<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { locale, formatNumber } from '$lib/i18n/runtime.js';
  import { exploreCopy } from '$lib/explore/copy.js';
  import { collectionFamilyLabel } from '$lib/collection/copy.js';
  import { collectionFacetLabel, decodeCollectionRecord, filterCollectionRecords, loadCollectionRuntime } from '$lib/collection/runtime.js';
  import {
    MOODBOARD_BACKUP_KEY,
    MOODBOARD_STORAGE_KEY,
    addMoodboardReference,
    createEmptyMoodboardDocument,
    parseMoodboardDocument,
    removeMoodboardReference,
    serializeMoodboardDocument
  } from '$lib/moodboards/store.js';
  import { createSwitchWorldReadAdapter } from '$lib/wep/world-browser-adapter';
  import { currentWorldEditorEnvironmentSupported } from '$lib/wep/world-editor-environment';
  import {
    createExploreItemHandoff,
    writeWorldEditorHandoff
  } from '$lib/wep/world-editor-handoff';

  const DECORATION_FAMILIES=['Buildings','Furniture','Landscaping','Roads & Fences','Touch of Magic','Wallpaper & Flooring'];
  const LIMIT=120;
  let runtimeIndex:any=null, rawRows:any[]=[], loading=true, error='', query='', family='', universe='', selectedBoardId='', status='';
  let moodboards:any=createEmptyMoodboardDocument();
  let placementBinding:any=null;
  let worldEditorSupported=false;
  let selectedItem:any=null;
  let selectedPlacement:any=null;
  let quickReviewCloseButton:HTMLButtonElement;
  let quickReviewOpener:HTMLElement|null=null;

  $: copy=exploreCopy($locale);
  $: allRecords=runtimeIndex ? rawRows.map((row)=>decodeCollectionRecord(runtimeIndex,row,$locale)) : [];
  $: decorationRecords=allRecords.filter((record)=>DECORATION_FAMILIES.includes(record.family));
  $: filtered=filterCollectionRecords(decorationRecords,{query,family,universe}).sort((a:any,b:any)=>a.label.localeCompare(b.label,$locale));
  $: visible=filtered.slice(0,LIMIT);
  $: universes=runtimeIndex?.u ?? [];
  $: boards=moodboards.boards ?? [];
  $: selectedPlacement=selectedItem ? placementFor(selectedItem) : null;

  onMount(async()=>{
    worldEditorSupported=currentWorldEditorEnvironmentSupported();
    try{
      const [loaded,binding]=await Promise.all([
        loadCollectionRuntime(base),
        createSwitchWorldReadAdapter({basePath:base}).catch(()=>null)
      ]);
      runtimeIndex=loaded.index; rawRows=loaded.rows; placementBinding=binding;
      try{const stored=localStorage.getItem(MOODBOARD_STORAGE_KEY);if(stored)moodboards=parseMoodboardDocument(stored);}catch{/* keep empty valid document */}
      selectedBoardId=moodboards.boards[0]?.id ?? '';
    }catch(cause){error=cause instanceof Error?cause.message:String(cause);}finally{loading=false;}
  });

  function universeLabel(value:string){return runtimeIndex?collectionFacetLabel(runtimeIndex,'universe',value,$locale):'';}
  function familyLabel(value:string){return collectionFamilyLabel($locale,value);}
  function initials(value:string){return familyLabel(value).split(/\s+/).map((x:string)=>x[0]).join('').slice(0,2).toUpperCase();}
  function activeBoard(){return moodboards.boards.find((board:any)=>board.id===selectedBoardId)??null;}
  function itemReference(item:any){return activeBoard()?.references.find((reference:any)=>reference.type==='ITEM'&&reference.entityId===String(item.itemId))??null;}
  function isInMoodboard(item:any){return Boolean(itemReference(item));}

  function persistMoodboards(next:any){
    const current=localStorage.getItem(MOODBOARD_STORAGE_KEY);
    if(current)localStorage.setItem(MOODBOARD_BACKUP_KEY,current);
    localStorage.setItem(MOODBOARD_STORAGE_KEY,serializeMoodboardDocument(next));
    moodboards=next;
  }

  function toggleMoodboard(item:any){
    if(!selectedBoardId){status=copy.noBoards;return;}
    try{
      const existing=itemReference(item);
      if(existing){
        persistMoodboards(removeMoodboardReference(moodboards,selectedBoardId,existing.id));
        status=copy.removed;
      }else{
        persistMoodboards(addMoodboardReference(moodboards,selectedBoardId,{
          type:'ITEM',
          label:item.label,
          entityId:String(item.itemId),
          note:familyLabel(item.family)
        }).document);
        status=copy.added;
      }
    }catch(cause){status=cause instanceof Error?cause.message:String(cause);}
  }

  function placementFor(item:any){
    if(!placementBinding?.resolveDraftPlacementSource)return null;
    try{return placementBinding.resolveDraftPlacementSource(Number(item.itemId),1);}
    catch{return null;}
  }

  async function openQuickReview(item:any,event:MouseEvent){
    selectedItem=item;
    quickReviewOpener=event.currentTarget as HTMLElement;
    await tick();
    quickReviewCloseButton?.focus();
  }

  function closeQuickReview(){
    selectedItem=null;
    selectedPlacement=null;
    const opener=quickReviewOpener;
    quickReviewOpener=null;
    tick().then(()=>opener?.focus());
  }

  function handleWindowKeydown(event:KeyboardEvent){
    if(event.key==='Escape'&&selectedItem){event.preventDefault();closeQuickReview();}
  }

  async function placeInWorldEditor(item:any){
    if(!worldEditorSupported)return;
    const capability=placementFor(item);
    if(!capability?.draftPlacementSupported)return;
    writeWorldEditorHandoff(localStorage,createExploreItemHandoff(Number(item.itemId)));
    await goto(base+'/editor/world/');
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} />
<svelte:head><title>Explore | Dreamwish Wand</title><meta name="description" content="Explore verified decorating items and save inspiration to Dreamwish Wand Moodboards." /></svelte:head>

<section class="explore-page container">
  <header class="heading"><div><p class="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p class="page-intro">{copy.intro}</p></div>
    <div class="actions"><a href={base+'/moodboards/'}>{copy.openMoodboards}</a>{#if worldEditorSupported}<a href={base+'/editor/world/'}>{copy.worldEditor}</a>{/if}</div>
  </header>
  <div class="boundaries"><div>{copy.media}</div><div>{copy.facets}</div></div>
  {#if status}<div class="status" role="status" aria-live="polite">{status}</div>{/if}
  {#if loading}<div class="status">{copy.loading}</div>
  {:else if error}<div class="status error" role="alert"><strong>{copy.failed}</strong><code>{error}</code></div>
  {:else}
    <div class="controls">
      <label><span>{copy.search}</span><input type="search" bind:value={query} /></label>
      <label><span>{copy.family}</span><select bind:value={family}><option value="">{copy.all}</option>{#each DECORATION_FAMILIES as value}<option value={value}>{familyLabel(value)}</option>{/each}</select></label>
      <label><span>{copy.universe}</span><select bind:value={universe}><option value="">{copy.all}</option>{#each universes as value}<option value={value}>{universeLabel(value)}</option>{/each}</select></label>
      <label><span>{copy.moodboard}</span><select bind:value={selectedBoardId} disabled={!boards.length}><option value="">{boards.length?copy.chooseBoard:copy.noBoards}</option>{#each boards as board}<option value={board.id}>{board.title}</option>{/each}</select></label>
    </div>
    <div class="summary"><strong>{formatNumber(filtered.length,{},$locale)} {copy.results}</strong><span>{copy.showing} {formatNumber(visible.length,{},$locale)}</span></div>
    {#if visible.length}<div class="grid">{#each visible as item}
      <article class="card">
        <button type="button" class="card-review" aria-label={copy.quickReview+': '+item.label} on:click={(event)=>openQuickReview(item,event)}>
          <div class="icon" aria-hidden="true">{initials(item.family)}</div>
          <div class="body"><span>{familyLabel(item.family)}</span><h2>{item.label}</h2><div class="facets">{#each item.universes.slice(0,2) as value}<small>{universeLabel(value)}</small>{/each}</div><code>{copy.itemId} {item.itemId}</code></div>
        </button>
        <footer><button type="button" aria-pressed={isInMoodboard(item)} on:click={()=>toggleMoodboard(item)} disabled={!boards.length}>{isInMoodboard(item)?copy.remove:copy.add}</button></footer>
      </article>
    {/each}</div>{#if filtered.length>LIMIT}<p class="more">{copy.more}</p>{/if}
    {:else}<div class="empty"><strong>{copy.empty}</strong></div>{/if}
  {/if}

  {#if selectedItem}
    <div class="modal-backdrop" role="presentation" on:click|self={closeQuickReview}>
      <div class="quick-review" role="dialog" aria-modal="true" aria-labelledby="quick-review-title">
        <header><div><p class="eyebrow">{copy.quickReview}</p><h2 id="quick-review-title">{selectedItem.label}</h2></div><button bind:this={quickReviewCloseButton} type="button" on:click={closeQuickReview}>{copy.close}</button></header>
        <dl>
          <div><dt>{copy.family}</dt><dd>{familyLabel(selectedItem.family)}</dd></div>
          <div><dt>{copy.itemId}</dt><dd>{selectedItem.itemId}</dd></div>
          <div><dt>{copy.footprint}</dt><dd>{selectedPlacement?.footprintSize ? selectedPlacement.footprintSize.w+' × '+selectedPlacement.footprintSize.h : '—'}</dd></div>
        </dl>
        {#if selectedPlacement?.footprint?.length}
          <div class="footprint" aria-label={copy.footprint} style:--fp-w={selectedPlacement.footprintSize.w}>
            {#each selectedPlacement.footprint as cell}<span title={cell.x+','+cell.y}></span>{/each}
          </div>
        {/if}
        {#if worldEditorSupported && selectedPlacement?.draftPlacementSupported}
          <button class="place" type="button" on:click={()=>placeInWorldEditor(selectedItem)}>{copy.placeInWorldEditor}</button>
        {:else if worldEditorSupported}
          <p class="unavailable">{copy.placementUnavailable}</p>
        {/if}
      </div>
    </div>
  {/if}
</section>

<style>
.explore-page{padding-block:64px 96px;min-height:72vh}.heading{display:flex;justify-content:space-between;align-items:end;gap:28px}.heading h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,68px);font-weight:500;letter-spacing:-.055em;margin:12px 0}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions a{border:1px solid var(--border);border-radius:999px;padding:10px 14px;color:var(--gold);font-size:10px;font-weight:800}.boundaries{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:26px 0 14px}.boundaries div,.status{border:1px solid var(--border);border-radius:13px;background:var(--surface);padding:12px 14px;color:var(--ink-muted);font-size:10px;line-height:1.65}.status.error{color:var(--decor-accent)}.status code{display:block;margin-top:6px;color:var(--ink-muted)}.controls{display:grid;grid-template-columns:2fr repeat(3,minmax(150px,1fr));gap:10px;border:1px solid var(--border);border-radius:17px;background:var(--surface);padding:13px}.controls label{display:grid;gap:6px;font-size:9px;font-weight:800;color:var(--ink-muted)}.controls input,.controls select{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--surface-raised);color:var(--ink)}.summary{display:flex;justify-content:space-between;margin:16px 2px 9px;font-size:10px;color:var(--ink-muted)}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.card{min-width:0;border:1px solid var(--border);border-radius:15px;background:var(--surface);padding:10px}.card-review{display:flex;gap:11px;width:100%;min-width:0;padding:3px;border:0;background:transparent;color:var(--ink);text-align:left;border-radius:11px}.card-review:focus-visible,.card footer button:focus-visible,.quick-review button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}.icon{width:42px;height:42px;flex:none;display:grid;place-items:center;border-radius:12px;background:var(--surface-raised);color:var(--gold);font-family:Georgia,serif}.body{min-width:0;flex:1}.body>span{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-muted)}.body h2{font-family:Georgia,serif;font-size:16px;font-weight:500;margin:5px 0 8px;overflow-wrap:anywhere}.facets{display:flex;gap:4px;flex-wrap:wrap;min-height:18px}.facets small{border:1px solid var(--border);border-radius:999px;padding:3px 6px;color:var(--ink-muted);font-size:7px}.body code{display:block;margin-top:8px;font-size:7px;color:var(--ink-muted)}.card footer{display:flex;justify-content:flex-end;margin-top:8px}.card footer button,.quick-review button{border:1px solid var(--border);border-radius:8px;background:var(--surface-raised);color:var(--ink);font-size:8px;font-weight:800;padding:7px 9px}.card footer button:disabled{opacity:.45}.more,.empty{text-align:center;color:var(--ink-muted);font-size:10px;margin:18px}.empty{min-height:280px;display:grid;place-items:center}.modal-backdrop{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:20px}.quick-review{width:min(560px,100%);max-height:min(760px,90vh);overflow:auto;border:1px solid var(--border);border-radius:22px;background:var(--surface);padding:22px;box-shadow:var(--shadow)}.quick-review header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.quick-review h2{font-family:Georgia,serif;font-size:28px;font-weight:500;margin:5px 0}.quick-review dl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.quick-review dl>div{background:var(--surface-raised);border-radius:10px;padding:10px}.quick-review dt{font-size:8px;color:var(--ink-muted)}.quick-review dd{margin:5px 0 0;font-size:11px}.footprint{display:grid;grid-template-columns:repeat(var(--fp-w),18px);gap:2px;margin:16px 0}.footprint span{width:18px;height:18px;border:1px solid var(--gold);background:var(--surface-raised);box-sizing:border-box}.place{margin-top:12px}.unavailable{font-size:11px;line-height:1.6;color:var(--ink-muted)}@media(max-width:1050px){.controls{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.heading{align-items:flex-start;flex-direction:column}.boundaries,.controls{grid-template-columns:1fr}.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:480px){.explore-page{padding-block:44px 70px}.grid{grid-template-columns:1fr}.quick-review dl{grid-template-columns:1fr}}
</style>
