<script lang="ts">
  import { onMount } from 'svelte';
  import { locale, formatNumber } from '$lib/i18n/runtime.js';
  import { nativePresetCopy } from '$lib/presets/native-preset-copy.js';
  import {
    NATIVE_PRESET_LIBRARY_KEY,
    addNativePresetBackup,
    createEmptyNativePresetLibrary,
    createNativePresetBackup,
    normalizeNativePresetLibrary,
    openNativePresetProfile,
    parseNativePresetLibrary,
    removeNativePresetBackup,
    serializeNativePresetLibrary
  } from '$lib/presets/native-preset-runtime.js';

  let opened:any=null, snapshots:any[]=[], selectedIndex=0, sourceName='', status='', loading=false;
  let library:any=createEmptyNativePresetLibrary(), importInput:HTMLInputElement;
  $: copy=nativePresetCopy($locale);
  $: selected=snapshots[selectedIndex]??null;
  $: activeCount=snapshots.filter((x:any)=>!x.deleted).length;

  onMount(()=>{try{const raw=localStorage.getItem(NATIVE_PRESET_LIBRARY_KEY);if(raw)library=parseNativePresetLibrary(raw);}catch{/* retain empty valid library */}});

  function persist(next:any,message:string){
    const valid=normalizeNativePresetLibrary(next);
    try{localStorage.setItem(NATIVE_PRESET_LIBRARY_KEY,serializeNativePresetLibrary(valid));library=valid;status=message;}
    catch{status=copy.quota;}
  }

  async function openSave(event:Event){
    const input=event.currentTarget as HTMLInputElement, file=input.files?.[0]; if(!file)return;
    loading=true;status='';snapshots=[];selectedIndex=0;
    try{
      opened=await openNativePresetProfile(new Uint8Array(await file.arrayBuffer()));
      snapshots=opened.snapshots;sourceName=file.name;status=copy.loaded;
    }catch{opened=null;status=copy.unsupported;}finally{loading=false;input.value='';}
  }

  function backupSelected(){
    if(!selected)return;
    try{
      const backup=createNativePresetBackup(selected,{sourceName});
      persist(addNativePresetBackup(library,backup),copy.backedUp);
    }catch{status=copy.quota;}
  }

  function exportJson(value:any,name:string){
    const blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
  }

  function exportSelected(){
    if(!selected)return;
    const backup=createNativePresetBackup(selected,{sourceName});
    exportJson(backup,'dreamwishwand-native-preset-'+selected.physicalPresetIndex+'.json');
  }

  function exportLibrary(){exportJson(library,'dreamwishwand-native-preset-library-v1.json');}

  async function importLibrary(event:Event){
    const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];if(!file)return;
    try{
      const imported=parseNativePresetLibrary(await file.text());
      const byId=new Map<string,any>();
      for(const backup of [...imported.backups,...library.backups])if(!byId.has(backup.id))byId.set(backup.id,backup);
      const merged=normalizeNativePresetLibrary({...library,updatedAt:new Date().toISOString(),backups:[...byId.values()].slice(0,100)});
      persist(merged,copy.imported);
    }catch{status=copy.unsupported;}finally{input.value='';}
  }

  function removeBackup(id:string){try{persist(removeNativePresetBackup(library,id),'');}catch{/* already absent */}}
</script>

<section class="native-manager" aria-labelledby="native-preset-manager-title">
  <header class="heading"><div><p class="eyebrow">{copy.eyebrow}</p><h2 id="native-preset-manager-title">{copy.title}</h2><p>{copy.intro}</p></div>
    <label class="file-button">{loading?copy.loading??copy.load:copy.load}<input type="file" accept=".json,application/json,*/*" on:change={openSave} /></label>
  </header>
  <div class="boundary"><strong>{copy.readOnly}</strong><span>{copy.shareNote}</span></div>
  {#if status}<div class="status" role="status" aria-live="polite">{status}</div>{/if}

  {#if opened}
    <div class="source-summary">
      <div><span>{copy.source}</span><strong>{sourceName}</strong></div>
      <div><span>{copy.physical}</span><strong>{formatNumber(snapshots.length,{},$locale)}</strong></div>
      <div><span>{copy.active}</span><strong>{formatNumber(activeCount,{},$locale)} / 20</strong></div>
    </div>
    {#if snapshots.length}
      <div class="workspace">
        <div class="preset-list">{#each snapshots as snapshot,index}
          <button type="button" class:active={selectedIndex===index} on:click={()=>selectedIndex=index}>
            <strong>{snapshot.summary.presetName}</strong><span>#{snapshot.physicalPresetIndex} · {snapshot.deleted?copy.deleted:copy.activeSlot+' '+(snapshot.activeSlotOrdinalZeroBased+1)}</span>
          </button>
        {/each}</div>
        <article class="inspector">
          {#if selected}
            <p class="eyebrow">{copy.selected}</p><h3>{selected.summary.presetName}</h3>
            <dl>
              <div><dt>{copy.physicalIndex}</dt><dd>{selected.physicalPresetIndex}</dd></div>
              <div><dt>{copy.activeSlot}</dt><dd>{selected.deleted?'—':selected.activeSlotOrdinalZeroBased+1}</dd></div>
              <div><dt>{copy.grids}</dt><dd>{selected.summary.gridCount}</dd></div>
              <div><dt>{copy.objects}</dt><dd>{selected.summary.objectCount}</dd></div>
              <div><dt>{copy.subgrids}</dt><dd>{selected.summary.subGridReferenceCount}</dd></div>
              <div><dt>{copy.thumbnails}</dt><dd>{selected.summary.thumbnailItems.length}</dd></div>
              <div><dt>{copy.share}</dt><dd>{selected.summary.shareInfoPresent?copy.present:copy.none}</dd></div>
              <div><dt>{copy.stateFlags}</dt><dd>{selected.summary.stateFlags}</dd></div>
              <div><dt>{copy.warnings}</dt><dd>{selected.warnings.length?selected.warnings.length:copy.clean}</dd></div>
            </dl>
            {#if selected.warnings.length}<p class="warning">{copy.backupWarning}</p>{/if}
            <div class="actions"><button type="button" on:click={backupSelected}>{copy.backup}</button><button type="button" on:click={exportSelected}>{copy.export}</button></div>
            <div class="blocked-actions"><button type="button" disabled title={copy.blocked}>{copy.restore}</button><button type="button" disabled title={copy.blocked}>{copy.push}</button><span>{copy.blocked}</span></div>
          {/if}
        </article>
      </div>
    {:else}<div class="empty"><strong>{copy.empty}</strong></div>{/if}
  {/if}

  <section class="local-library">
    <header><div><p class="eyebrow">LOCAL</p><h3>{copy.localLibrary}</h3><p>{copy.localIntro}</p></div><div class="library-actions"><button type="button" on:click={exportLibrary} disabled={!library.backups.length}>{copy.exportLibrary}</button><button type="button" on:click={()=>importInput.click()}>{copy.importLibrary}</button><input class="visually-hidden" bind:this={importInput} type="file" accept=".json,application/json" on:change={importLibrary} /></div></header>
    {#if library.backups.length}<div class="backup-grid">{#each library.backups as backup}
      <article><span>{backup.deleted?copy.deleted:copy.activeSlot+' '+((backup.source.activeSlotOrdinalZeroBased??0)+1)}</span><h4>{backup.summary.presetName}</h4><small>{backup.createdAt}</small><div><button type="button" on:click={()=>exportJson(backup,'dreamwishwand-native-preset-'+backup.id+'.json')}>{copy.export}</button><button type="button" on:click={()=>removeBackup(backup.id)}>{copy.remove}</button></div></article>
    {/each}</div>{:else}<div class="empty small"><strong>{copy.noBackup}</strong></div>{/if}
  </section>
</section>

<style>
.native-manager{display:grid;gap:16px}.heading{display:flex;align-items:end;justify-content:space-between;gap:20px}.heading h2,.local-library h3{font-family:Georgia,serif;font-weight:500;margin:7px 0}.heading h2{font-size:30px}.heading p,.local-library p{margin:0;color:var(--ink-soft);font-size:11px;line-height:1.7}.file-button{position:relative;overflow:hidden;flex:none;border:1px solid var(--border);background:var(--surface-raised);border-radius:11px;padding:10px 14px;font-size:11px;font-weight:800;cursor:pointer}.file-button input{position:absolute;inset:0;opacity:0;cursor:pointer}.boundary,.status{display:grid;gap:4px;border:1px solid var(--border);background:var(--page-2);border-radius:11px;padding:11px 13px;font-size:9px;line-height:1.6;color:var(--ink-muted)}.boundary strong{color:var(--help-accent)}.source-summary{display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px}.source-summary>div{padding:11px;background:var(--surface-raised);border-radius:10px;display:grid;gap:4px}.source-summary span,.inspector dt{font-size:8px;text-transform:uppercase;color:var(--ink-muted)}.source-summary strong{font-size:10px;overflow-wrap:anywhere}.workspace{display:grid;grid-template-columns:minmax(220px,320px) minmax(0,1fr);gap:12px}.preset-list{display:grid;gap:6px;align-content:start}.preset-list button{text-align:left;border:1px solid var(--border);background:transparent;color:var(--ink);border-radius:10px;padding:10px}.preset-list button.active{background:var(--surface-raised);border-color:var(--gold)}.preset-list strong,.preset-list span{display:block}.preset-list span{margin-top:4px;font-size:8px;color:var(--ink-muted)}.inspector{border:1px solid var(--border);border-radius:14px;background:var(--page-2);padding:16px}.inspector h3{font-family:Georgia,serif;font-size:22px;font-weight:500;margin:6px 0 12px}.inspector dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.inspector dl>div{background:var(--surface-raised);border-radius:9px;padding:9px}.inspector dd{margin:4px 0 0;font-size:10px;overflow-wrap:anywhere}.warning{padding:10px;border:1px solid var(--border);border-radius:9px;color:var(--decor-accent);font-size:9px;line-height:1.6}.actions,.blocked-actions,.library-actions{display:flex;gap:7px;flex-wrap:wrap}.actions{margin-top:12px}.actions button,.blocked-actions button,.library-actions button,.backup-grid button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:9px;padding:8px 10px;font-size:9px;font-weight:800}.blocked-actions{margin-top:10px;align-items:center}.blocked-actions button:disabled{opacity:.4}.blocked-actions span{flex-basis:100%;font-size:8px;color:var(--ink-muted)}.local-library{border-top:1px solid var(--border);padding-top:18px}.local-library>header{display:flex;justify-content:space-between;align-items:end;gap:18px}.backup-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.backup-grid article{border:1px solid var(--border);border-radius:11px;background:var(--page-2);padding:11px;min-width:0}.backup-grid span{font-size:8px;color:var(--gold)}.backup-grid h4{margin:6px 0;font-size:12px}.backup-grid small{display:block;color:var(--ink-muted);font-size:7px;overflow-wrap:anywhere}.backup-grid article>div{display:flex;gap:5px;margin-top:9px}.empty{min-height:150px;display:grid;place-items:center;color:var(--ink-muted)}.empty.small{min-height:90px}.visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}@media(max-width:760px){.heading,.local-library>header{align-items:flex-start;flex-direction:column}.source-summary,.inspector dl{grid-template-columns:1fr}.workspace{grid-template-columns:1fr}.backup-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.backup-grid{grid-template-columns:1fr}}
</style>
