<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, formatNumber } from '$lib/i18n/runtime.js';
  import { exploreCopy } from '$lib/explore/copy.js';
  import { collectionFamilyLabel } from '$lib/collection/copy.js';
  import { collectionFacetLabel, decodeCollectionRecord, filterCollectionRecords, loadCollectionRuntime } from '$lib/collection/runtime.js';
  import { MOODBOARD_BACKUP_KEY, MOODBOARD_STORAGE_KEY, addMoodboardReference, createEmptyMoodboardDocument, parseMoodboardDocument, serializeMoodboardDocument } from '$lib/moodboards/store.js';

  const DECORATION_FAMILIES=['Buildings','Furniture','Landscaping','Roads & Fences','Touch of Magic','Wallpaper & Flooring'];
  const LIMIT=120;
  let runtimeIndex:any=null, rawRows:any[]=[], loading=true, error='', query='', family='', universe='', selectedBoardId='', status='';
  let moodboards:any=createEmptyMoodboardDocument();
  $: copy=exploreCopy($locale);
  $: allRecords=runtimeIndex ? rawRows.map((row)=>decodeCollectionRecord(runtimeIndex,row,$locale)) : [];
  $: decorationRecords=allRecords.filter((record)=>DECORATION_FAMILIES.includes(record.family));
  $: filtered=filterCollectionRecords(decorationRecords,{query,family,universe}).sort((a:any,b:any)=>a.label.localeCompare(b.label,$locale));
  $: visible=filtered.slice(0,LIMIT);
  $: universes=runtimeIndex?.u ?? [];
  $: boards=moodboards.boards ?? [];

  onMount(async()=>{
    try{
      const loaded=await loadCollectionRuntime(base); runtimeIndex=loaded.index; rawRows=loaded.rows;
      try{const stored=localStorage.getItem(MOODBOARD_STORAGE_KEY);if(stored)moodboards=parseMoodboardDocument(stored);}catch{/* keep empty valid document */}
      selectedBoardId=moodboards.boards[0]?.id ?? '';
    }catch(cause){error=cause instanceof Error?cause.message:String(cause);}finally{loading=false;}
  });

  function universeLabel(value:string){return runtimeIndex?collectionFacetLabel(runtimeIndex,'universe',value,$locale):'';}
  function familyLabel(value:string){return collectionFamilyLabel($locale,value);}
  function initials(value:string){return familyLabel(value).split(/\s+/).map((x)=>x[0]).join('').slice(0,2).toUpperCase();}

  function addToMoodboard(item:any){
    if(!selectedBoardId){status=copy.noBoards;return;}
    try{
      const next=addMoodboardReference(moodboards,selectedBoardId,{type:'ITEM',label:item.label,entityId:String(item.itemId),note:familyLabel(item.family)},{idFactory:()=>crypto.randomUUID()}).document;
      const current=localStorage.getItem(MOODBOARD_STORAGE_KEY);
      if(current)localStorage.setItem(MOODBOARD_BACKUP_KEY,current);
      localStorage.setItem(MOODBOARD_STORAGE_KEY,serializeMoodboardDocument(next));
      moodboards=next; status=copy.added;
    }catch(cause){status=cause instanceof Error?cause.message:String(cause);}
  }
</script>
<svelte:head><title>Explore | Dreamwish Wand</title><meta name="description" content="Explore verified decorating items and save inspiration to Dreamwish Wand Moodboards." /></svelte:head>

<section class="explore-page container">
  <header class="heading"><div><p class="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p class="page-intro">{copy.intro}</p></div>
    <div class="actions"><a href={base+'/moodboards/'}>{copy.openMoodboards}</a><a href={base+'/editor/world/'}>{copy.worldEditor}</a></div>
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
      <article class="card"><div class="icon" aria-hidden="true">{initials(item.family)}</div><div class="body"><span>{familyLabel(item.family)}</span><h2>{item.label}</h2><div class="facets">{#each item.universes.slice(0,2) as value}<small>{universeLabel(value)}</small>{/each}</div><footer><code>{copy.itemId} {item.itemId}</code><button type="button" on:click={()=>addToMoodboard(item)} disabled={!boards.length}>{copy.add}</button></footer></div></article>
    {/each}</div>{#if filtered.length>LIMIT}<p class="more">{copy.more}</p>{/if}
    {:else}<div class="empty"><strong>{copy.empty}</strong></div>{/if}
  {/if}
</section>
<style>
.explore-page{padding-block:64px 96px;min-height:72vh}.heading{display:flex;justify-content:space-between;align-items:end;gap:28px}.heading h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,68px);font-weight:500;letter-spacing:-.055em;margin:12px 0}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions a{border:1px solid var(--border);border-radius:999px;padding:10px 14px;color:var(--gold);font-size:10px;font-weight:800}.boundaries{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:26px 0 14px}.boundaries div,.status{border:1px solid var(--border);border-radius:13px;background:var(--surface);padding:12px 14px;color:var(--ink-muted);font-size:10px;line-height:1.65}.status.error{color:var(--decor-accent)}.status code{display:block;margin-top:6px;color:var(--ink-muted)}.controls{display:grid;grid-template-columns:2fr repeat(3,minmax(150px,1fr));gap:10px;border:1px solid var(--border);border-radius:17px;background:var(--surface);padding:13px}.controls label{display:grid;gap:6px;font-size:9px;font-weight:800;color:var(--ink-muted)}.controls input,.controls select{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--surface-raised);color:var(--ink)}.summary{display:flex;justify-content:space-between;margin:16px 2px 9px;font-size:10px;color:var(--ink-muted)}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.card{display:flex;gap:11px;min-width:0;border:1px solid var(--border);border-radius:15px;background:var(--surface);padding:13px}.icon{width:42px;height:42px;flex:none;display:grid;place-items:center;border-radius:12px;background:var(--surface-raised);color:var(--gold);font-family:Georgia,serif}.body{min-width:0;flex:1}.body>span{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-muted)}.body h2{font-family:Georgia,serif;font-size:16px;font-weight:500;margin:5px 0 8px;overflow-wrap:anywhere}.facets{display:flex;gap:4px;flex-wrap:wrap;min-height:18px}.facets small{border:1px solid var(--border);border-radius:999px;padding:3px 6px;color:var(--ink-muted);font-size:7px}.card footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px}.card code{font-size:7px;color:var(--ink-muted)}.card button{border:1px solid var(--border);border-radius:8px;background:var(--surface-raised);color:var(--ink);font-size:8px;font-weight:800;padding:6px 8px}.card button:disabled{opacity:.45}.more,.empty{text-align:center;color:var(--ink-muted);font-size:10px;margin:18px}.empty{min-height:280px;display:grid;place-items:center}@media(max-width:1050px){.controls{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.heading{align-items:flex-start;flex-direction:column}.boundaries,.controls{grid-template-columns:1fr}.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:480px){.explore-page{padding-block:44px 70px}.grid{grid-template-columns:1fr}}
</style>
