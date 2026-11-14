<script lang="ts">
  import { onMount } from 'svelte';
  import { locale, formatNumber } from '$lib/i18n/runtime.js';
  import { nativePresetCopy } from '$lib/presets/native-preset-copy.js';
  import {
    createEmptyNativePresetLibrary,
    createNativePresetBackup,
    openNativePresetProfile
  } from '$lib/presets/native-preset-runtime.js';
  import {inspectNativePresetLocalFileBytes,NATIVE_LOCAL_PRESET_FILE_MAX_BYTES,transactNativePresetLibrary} from '$lib/presets/native-local-file-import-contract.mjs';

  let opened:any=null, snapshots:any[]=[], selectedIndex=0, sourceName='', status='', loading=false;
  let library:any=createEmptyNativePresetLibrary(), importInput:HTMLInputElement, libraryBusy=false;
  $: copy=nativePresetCopy($locale);
  $: selected=snapshots[selectedIndex]??null;
  $: activeCount=snapshots.filter((x:any)=>!x.deleted).length;

  onMount(()=>{void refreshLibrary();});
  async function refreshLibrary(){
    try{library=(await transactNativePresetLibrary({operation:'read'})).library;}
    catch{status=copy.unsupported;}
  }
  async function mergeBackups(backups:any[],message:string){
    const result=await transactNativePresetLibrary({operation:'merge',backups});
    library=result.library;status=message;
  }

  async function openSave(event:Event){
    const input=event.currentTarget as HTMLInputElement, file=input.files?.[0]; if(!file)return;
    loading=true;status='';snapshots=[];selectedIndex=0;
    try{
      opened=await openNativePresetProfile(new Uint8Array(await file.arrayBuffer()));
      snapshots=opened.snapshots;sourceName=file.name;status=copy.loaded;
    }catch{opened=null;status=copy.unsupported;}finally{loading=false;input.value='';}
  }

  async function backupSelected(){
    if(!selected||libraryBusy)return;
    libraryBusy=true;
    try{
      const backup=createNativePresetBackup(selected,{sourceName});
      await mergeBackups([backup],copy.backedUp);
    }catch{status=copy.quota;}finally{libraryBusy=false;}
  }

  function exportJson(value:any,name:string){
    const blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function exportSelected(){
    if(!selected)return;
    const backup=createNativePresetBackup(selected,{sourceName});
    exportJson(backup,'dreamwishwand-native-preset-'+selected.physicalPresetIndex+'.json');
  }

  async function exportLibrary(){
    if(libraryBusy)return;
    libraryBusy=true;
    try{
      const result=await transactNativePresetLibrary({operation:'read'});
      library=result.library;
      if(!library.backups.length)throw Error('NATIVE_PRESET_LIBRARY_EMPTY');
      // Local incarnation metadata is never portable across origins.
      const {localEntryIncarnations,...portable}=library;
      exportJson(portable,'dreamwishwand-native-preset-library-v1.json');
    }catch{status=copy.unsupported;}finally{libraryBusy=false;}
  }

  async function importLibrary(event:Event){
    const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];if(!file||libraryBusy)return;
    libraryBusy=true;
    try{
      // A user-selected PC JSON file only; this path NEVER restores into a
      // DDV P1G and NEVER uploads a local backup to Community/Provider.
      if(!file.size||file.size>NATIVE_LOCAL_PRESET_FILE_MAX_BYTES)throw Error('NATIVE_PRESET_IMPORT_FILE_BOUNDS');
      const reviewed=await inspectNativePresetLocalFileBytes(new Uint8Array(await file.arrayBuffer()));
      if(!reviewed.localFileReady||!reviewed.backups)throw Error('NATIVE_PRESET_IMPORT_INVALID');
      await mergeBackups(reviewed.backups.map((x:any)=>x.backup),
        reviewed.status==='LOCAL_FILE_VALIDATED_WITH_QUARANTINED_BACKUPS'?copy.backupWarning:copy.imported);
    }catch{status=copy.unsupported;}finally{input.value='';libraryBusy=false;}
  }

  async function removeBackup(backup:any){
    if(libraryBusy)return;
    // Capture the entry displayed by this tab before any asynchronous work.
    const id=backup.id,expectedEntry=JSON.stringify(backup);
    const expectedIncarnation=library.localEntryIncarnations?.entries[id]??0;
    libraryBusy=true;
    try{library=(await transactNativePresetLibrary({operation:'remove',id,expectedEntry,expectedIncarnation})).library;status='';}
    catch{await refreshLibrary();status=copy.unsupported;}finally{libraryBusy=false;}
  }
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
            <div class="actions"><button type="button" on:click={backupSelected} disabled={libraryBusy}>{copy.backup}</button><button type="button" on:click={exportSelected}>{copy.export}</button></div>
            <div class="blocked-actions"><button type="button" disabled title={copy.blocked}>{copy.restore}</button><button type="button" disabled title={copy.blocked}>{copy.push}</button><span>{copy.blocked}</span></div>
          {/if}
        </article>
      </div>
    {:else}<div class="empty"><strong>{copy.empty}</strong></div>{/if}
  {/if}

  <section class="local-library">
    <header><div><p class="eyebrow">LOCAL</p><h3>{copy.localLibrary}</h3><p>{copy.localIntro}</p></div><div class="library-actions"><button type="button" data-native-library-export on:click={exportLibrary} disabled={libraryBusy||!library.backups.length}>{copy.exportLibrary}</button><button type="button" data-native-library-import on:click={()=>importInput.click()} disabled={libraryBusy}>{copy.importLibrary}</button><input class="visually-hidden" bind:this={importInput} data-native-library-file type="file" accept=".json,application/json" on:change={importLibrary} /></div></header>
    {#if library.backups.length}<div class="backup-grid">{#each library.backups as backup}
      <article><span>{backup.deleted?copy.deleted:copy.activeSlot+' '+((backup.source.activeSlotOrdinalZeroBased??0)+1)}</span><h4>{backup.summary.presetName}</h4><small>{backup.createdAt}</small><div><button type="button" on:click={()=>exportJson(backup,'dreamwishwand-native-preset-'+backup.id+'.json')}>{copy.export}</button><button type="button" data-native-library-remove on:click={()=>removeBackup(backup)} disabled={libraryBusy}>{copy.remove}</button></div></article>
    {/each}</div>{:else}<div class="empty small"><strong>{copy.noBackup}</strong></div>{/if}
  </section>
</section>

<style>
.native-manager{display:grid;gap:16px}.heading{display:flex;align-items:end;justify-content:space-between;gap:20px}.heading h2,.local-library h3{font-family:Georgia,serif;font-weight:500;margin:7px 0}.heading h2{font-size:30px}.heading p,.local-library p{margin:0;color:var(--ink-soft);font-size:11px;line-height:1.7}.file-button{position:relative;overflow:hidden;flex:none;border:1px solid var(--border);background:var(--surface-raised);border-radius:11px;padding:10px 14px;font-size:11px;font-weight:800;cursor:pointer}.file-button input{position:absolute;inset:0;opacity:0;cursor:pointer}.boundary,.status{display:grid;gap:4px;border:1px solid var(--border);background:var(--page-2);border-radius:11px;padding:11px 13px;font-size:9px;line-height:1.6;color:var(--ink-muted)}.boundary strong{color:var(--help-accent)}.source-summary{display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px}.source-summary>div{padding:11px;background:var(--surface-raised);border-radius:10px;display:grid;gap:4px}.source-summary span,.inspector dt{font-size:8px;text-transform:uppercase;color:var(--ink-muted)}.source-summary strong{font-size:10px;overflow-wrap:anywhere}.workspace{display:grid;grid-template-columns:minmax(220px,320px) minmax(0,1fr);gap:12px}.preset-list{display:grid;gap:6px;align-content:start}.preset-list button{text-align:left;border:1px solid var(--border);background:transparent;color:var(--ink);border-radius:10px;padding:10px}.preset-list button.active{background:var(--surface-raised);border-color:var(--gold)}.preset-list strong,.preset-list span{display:block}.preset-list span{margin-top:4px;font-size:8px;color:var(--ink-muted)}.inspector{border:1px solid var(--border);border-radius:14px;background:var(--page-2);padding:16px}.inspector h3{font-family:Georgia,serif;font-size:22px;font-weight:500;margin:6px 0 12px}.inspector dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.inspector dl>div{background:var(--surface-raised);border-radius:9px;padding:9px}.inspector dd{margin:4px 0 0;font-size:10px;overflow-wrap:anywhere}.warning{padding:10px;border:1px solid var(--border);border-radius:9px;color:var(--decor-accent);font-size:9px;line-height:1.6}.actions,.blocked-actions,.library-actions{display:flex;gap:7px;flex-wrap:wrap}.actions{margin-top:12px}.actions button,.blocked-actions button,.library-actions button,.backup-grid button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:9px;padding:8px 10px;font-size:9px;font-weight:800}.blocked-actions{margin-top:10px;align-items:center}.blocked-actions button:disabled{opacity:.4}.blocked-actions span{flex-basis:100%;font-size:8px;color:var(--ink-muted)}.local-library{border-top:1px solid var(--border);padding-top:18px}.local-library>header{display:flex;justify-content:space-between;align-items:end;gap:18px}.backup-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.backup-grid article{border:1px solid var(--border);border-radius:11px;background:var(--page-2);padding:11px;min-width:0}.backup-grid span{font-size:8px;color:var(--gold)}.backup-grid h4{margin:6px 0;font-size:12px}.backup-grid small{display:block;color:var(--ink-muted);font-size:7px;overflow-wrap:anywhere}.backup-grid article>div{display:flex;gap:5px;margin-top:9px}.empty{min-height:150px;display:grid;place-items:center;color:var(--ink-muted)}.empty.small{min-height:90px}.visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}@media(max-width:760px){.heading,.local-library>header{align-items:flex-start;flex-direction:column}.source-summary,.inspector dl{grid-template-columns:1fr}.workspace{grid-template-columns:1fr}.backup-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.backup-grid{grid-template-columns:1fr}}
</style>
