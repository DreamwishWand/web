<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { moodboardCopy } from '$lib/moodboards/copy.js';
  import { moodboardCoverTiles } from '$lib/moodboards/cover-preview.mjs';
  import { MOODBOARD_PORTABLE_MAX_BYTES, readMoodboardMigrationSnapshot, importPortableMoodboard, exportPortableMoodboard, decodePortableMoodboardBytes } from '$lib/moodboards/origin-portability.mjs';
  import {
    MOODBOARD_BACKUP_KEY,
    MOODBOARD_REFERENCE_TYPES,
    MOODBOARD_STORAGE_KEY,
    addMoodboardReference,
    assignMoodboardReferenceGroups,
    createEmptyMoodboardDocument,
    createMoodboard,
    createMoodboardGroup,
    deleteMoodboard,
    deleteMoodboardGroup,
    moodboardSections,
    parseMoodboardDocument,
    removeMoodboardReference,
    serializeMoodboardDocument,
    updateMoodboardGroup
  } from '$lib/moodboards/store.js';
  import { currentWorldEditorEnvironmentSupported } from '$lib/wep/world-editor-environment';
  import {
    createMoodboardHandoff,
    writeWorldEditorHandoff
  } from '$lib/wep/world-editor-handoff';

  let document:any=createEmptyMoodboardDocument();
  let selectedId='', filter='', status='', worldEditorSupported=false;
  let newTitle='', groupTitle='';
  let workspaceHeading:HTMLHeadingElement;
  let referenceType='ITEM', referenceLabel='', referenceEntity='', referenceNote='';
  let importInput:HTMLInputElement;
  let importing=false;
  $: copy=moodboardCopy($locale);
  $: selected=document.boards.find((board:any)=>board.id===selectedId)??null;
  $: sections=selected?moodboardSections(selected):[];
  $: visibleSections=sections.map((section:any)=>({
    ...section,
    title:section.kind==='UNSORTED'?copy.unsorted:section.title,
    references:section.references.filter((reference:any)=>!filter.trim()||[reference.label,reference.note,reference.entityId,reference.type].some((value)=>String(value??'').toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())))
  }));

  onMount(()=>{
    worldEditorSupported=currentWorldEditorEnvironmentSupported();
    try{const stored=localStorage.getItem(MOODBOARD_STORAGE_KEY);if(stored)document=parseMoodboardDocument(stored);}catch{status=copy.invalid;}
    selectedId=document.boards[0]?.id??'';
  });

  function persist(next:any){
    const current=localStorage.getItem(MOODBOARD_STORAGE_KEY);
    if(current)localStorage.setItem(MOODBOARD_BACKUP_KEY,current);
    localStorage.setItem(MOODBOARD_STORAGE_KEY,serializeMoodboardDocument(next));
    document=next;
    status=copy.saved;
  }

  function createBoard(){
    const result=createMoodboard(document,{title:newTitle});
    persist(result.document);selectedId=result.board.id;newTitle='';status=copy.created;
    tick().then(()=>workspaceHeading?.focus());
  }

  function removeBoard(boardId:string){
    if(!document.boards.some((board:any)=>board.id===boardId))return;
    const next=deleteMoodboard(document,boardId);persist(next);
    if(selectedId===boardId)selectedId=next.boards[0]?.id??'';
    status=copy.deleted;
  }

  function addGroup(){
    if(!selected||!groupTitle.trim())return;
    const result=createMoodboardGroup(document,selected.id,groupTitle);
    persist(result.document);groupTitle='';
  }

  function toggleGroup(group:any){
    if(!selected)return;
    persist(updateMoodboardGroup(document,selected.id,group.id,{collapsed:!group.collapsed}));
  }

  // DEC-UX-49: remove a Group container only, never its Item/Preset/Note.
  // This uses the accepted local Store's non-destructive ungroup operation;
  // persist() keeps the previous full document as the immediate rollback.
  function ungroup(groupId:string){
    if(!selected||!selected.groups.some((group:any)=>group.id===groupId))return;
    const next=deleteMoodboardGroup(document,selected.id,groupId,{deleteExclusiveContents:false});
    persist(next);status=copy.ungrouped;
  }

  function addReference(){
    if(!selected||!referenceLabel.trim())return;
    if((referenceType==='ITEM'||referenceType==='WAND_PRESET')&&!referenceEntity.trim()){
      status=copy.invalid;return;
    }
    const result=addMoodboardReference(document,selected.id,{
      type:referenceType,label:referenceLabel,entityId:referenceEntity||null,note:referenceNote||null
    });
    persist(result.document);referenceLabel='';referenceEntity='';referenceNote='';status=copy.added;
  }

  function removeReference(referenceId:string){
    if(!selected)return;
    persist(removeMoodboardReference(document,selected.id,referenceId));status=copy.removed;
  }

  function assignGroups(reference:any,event:Event){
    if(!selected)return;
    const select=event.currentTarget as HTMLSelectElement;
    const ids=Array.from(select.selectedOptions).map((option)=>option.value).filter(Boolean);
    persist(assignMoodboardReferenceGroups(document,selected.id,reference.id,ids));
  }

  function exportBackup(previous=false){
    try{
      const raw=exportPortableMoodboard(localStorage,previous);
      const blob=new Blob([raw],{type:'application/json'});
      const url=URL.createObjectURL(blob);const anchor=documentElement('a');anchor.href=url;
      anchor.download=previous?'dreamwish-wand-moodboards-previous.json':'dreamwish-wand-moodboards.json';
      anchor.click();URL.revokeObjectURL(url);
    }catch{status=copy.portableInvalid;}
  }
  function documentElement(tag:'a'):HTMLAnchorElement{return window.document.createElement(tag);}

  async function importBackup(event:Event){
    const input=event.currentTarget as HTMLInputElement;const file=input.files?.[0];if(!file||importing)return;
    importing=true;
    try{
      const expected=readMoodboardMigrationSnapshot(localStorage);
      if(!file.size||file.size>MOODBOARD_PORTABLE_MAX_BYTES)throw Error('MOODBOARD_PORTABLE_INVALID');
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(bytes.byteLength!==file.size)throw Error('MOODBOARD_PORTABLE_INVALID');
      const result=importPortableMoodboard(localStorage,expected,decodePortableMoodboardBytes(bytes));
      document=result.document;selectedId=document.boards[0]?.id??'';status=copy.imported;
    }catch(e){status=e instanceof Error&&/MOODBOARD_PORTABLE_(?:COLLISION|STALE)/.test(e.message)?copy.portableCollision:copy.portableInvalid;}
    finally{input.value='';importing=false;}
  }

  function restoreBackup(){
    const previous=localStorage.getItem(MOODBOARD_BACKUP_KEY);if(!previous){status=copy.noBackup;return;}
    try{const next=parseMoodboardDocument(previous);localStorage.setItem(MOODBOARD_STORAGE_KEY,serializeMoodboardDocument(next));document=next;selectedId=next.boards[0]?.id??'';status=copy.restored;}catch{status=copy.invalid;}
  }

  async function openInWorldEditor(){
    if(!selected||!worldEditorSupported)return;
    writeWorldEditorHandoff(localStorage,createMoodboardHandoff(selected.id));
    await goto(base+'/editor/world/');
  }

  function typeLabel(type:string){
    if(type==='ITEM')return copy.item;
    if(type==='WAND_PRESET')return copy.preset;
    if(type==='NOTE')return copy.noteType;
    return type;
  }
</script>

<svelte:head><title>Moodboards | Dreamwish Wand</title><meta name="description" content="Plan decorating ideas in local-first Dreamwish Wand Moodboards." /></svelte:head>
<section class="moodboards-page container">
  <header class="heading"><div><p class="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p class="page-intro">{copy.intro}</p></div>
    <div class="backup-actions"><button type="button" data-moodboard-export on:click={()=>exportBackup()}>{copy.export}</button><button type="button" data-moodboard-export-previous on:click={()=>exportBackup(true)}>{copy.exportPrevious}</button><button type="button" data-moodboard-import disabled={importing} on:click={()=>importInput?.click()}>{copy.import}</button><button type="button" on:click={restoreBackup}>{copy.restore}</button><input class="hidden-file" bind:this={importInput} data-moodboard-import-file type="file" accept="application/json,.json" on:change={importBackup}/></div>
  </header>
  <div class="local-note"><strong>{copy.local}</strong><span>{copy.localDetail}</span></div>
  <p class="local-note" data-moodboard-portability-note>{copy.portableNote}</p>
  <!-- W-COLL-017 / R13: explicit opt-in only. This link never reads, imports,
       migrates, overwrites, merges or deletes either store. -->
  <aside class="atomic-entry" data-moodboard-atomic-entry data-storage-separation="explicit"
    data-legacy-migration="off" data-first-collection-create="off">
    <p data-moodboard-atomic-warning>{copy.atomicNote}</p>
    <a data-moodboard-atomic-link href={base+'/moodboards/atomic/'}>{copy.atomicLink}</a>
  </aside>
  {#if status}<div class="status" role="status" aria-live="polite">{status}</div>{/if}

  <div class="layout">
    <aside class="boards-panel">
      <form class="create-board new-board" data-moodboard-quick-create on:submit|preventDefault={createBoard}><h2>{copy.newBoard}</h2><label><span>{copy.titleLabel}</span><input bind:value={newTitle} required/></label><button type="submit">{copy.create}</button></form>
      <div class="board-list" data-moodboard-root-grid><h2>{copy.boards}</h2>{#if document.boards.length}<div class="board-card-grid">{#each document.boards as board (board.id)}
        <div class="board-entry" data-moodboard-root-card>
          <button type="button" class:active={board.id===selectedId} aria-pressed={board.id===selectedId} on:click={()=>selectedId=board.id}>
            <div class="board-cover" data-moodboard-cover aria-hidden="true">
              {#each moodboardCoverTiles(board) as tile,i (i)}<span class:cover-empty={tile.type==='EMPTY'} data-cover-type={tile.type}>{tile.text}</span>{/each}
            </div>
            <strong>{board.title}</strong><span class="board-count">{board.references.length} {copy.count}</span>
          </button>
          <details class="board-menu" data-moodboard-root-menu><summary>{copy.manage}</summary><button class="danger" type="button" on:click={()=>removeBoard(board.id)}>{copy.delete}</button></details>
        </div>{/each}</div>{:else}<p>{copy.empty}</p>{/if}</div>
    </aside>

    <main class="workspace">
      {#if selected}
        <header class="workspace-heading"><div><p class="eyebrow">{copy.inspiration}</p><h2 bind:this={workspaceHeading} tabindex="-1" data-moodboard-workspace-title>{selected.title}</h2>{#if selected.description}<p>{selected.description}</p>{/if}</div>
          <div class="workspace-actions">{#if worldEditorSupported}<button type="button" on:click={openInWorldEditor}>{copy.openWorldEditor}</button>{/if}
            <details class="board-menu workspace-menu" data-moodboard-workspace-menu><summary>{copy.manage}</summary><button class="danger" type="button" on:click={()=>removeBoard(selected.id)}>{copy.delete}</button></details>
          </div>
        </header>
        <div class="workspace-tools">
          <label><span>{copy.filter}</span><input type="search" bind:value={filter}/></label>
          <form class="group-form" on:submit|preventDefault={addGroup}><label><span>{copy.newGroup}</span><input bind:value={groupTitle}/></label><button type="submit" disabled={!groupTitle.trim()}>{copy.createGroup}</button></form>
        </div>

        <form class="add-reference" on:submit|preventDefault={addReference}>
          <h3>{copy.addInspiration}</h3>
          <label><span>{copy.type}</span><select bind:value={referenceType}>{#each MOODBOARD_REFERENCE_TYPES as type}<option value={type}>{typeLabel(type)}</option>{/each}</select></label>
          <label><span>{copy.label}</span><input bind:value={referenceLabel} required/></label>
          {#if referenceType!=='NOTE'}<label><span>{copy.entity}</span><input bind:value={referenceEntity} required/></label>{/if}
          <label><span>{copy.note}</span><textarea bind:value={referenceNote}></textarea></label>
          <button type="submit">{copy.add}</button>
        </form>

        <div class="sections" aria-label={copy.groups}>
          {#each visibleSections as section}
            <section class="group-section" data-group-id={section.id??'unsorted'}>
              <header><h3>{section.title}</h3>{#if section.kind==='GROUP'}<div class="group-actions"><button type="button" aria-expanded={!section.collapsed} on:click={()=>toggleGroup(selected.groups.find((group:any)=>group.id===section.id))}>{section.collapsed?copy.expand:copy.collapse}</button><button type="button" data-moodboard-ungroup={section.id} aria-label={copy.ungroup+': '+section.title} on:click={()=>ungroup(section.id)}>{copy.ungroup}</button></div>{/if}</header>
              {#if section.kind==='UNSORTED' || !selected.groups.find((group:any)=>group.id===section.id)?.collapsed}
                {#if section.references.length}<div class="reference-grid">{#each section.references as reference}
                  <article class="reference-card">
                    <span class="type">{typeLabel(reference.type)}</span><h4>{reference.label}</h4>
                    {#if reference.note}<p>{reference.note}</p>{/if}
                    {#if reference.entityId}<code>{reference.entityId}</code>{/if}
                    {#if reference.type==='ITEM'||reference.type==='WAND_PRESET'}
                      <label class="groups-select"><span>{copy.assignGroups}</span><select multiple value={reference.groupIds} on:change={(event)=>assignGroups(reference,event)}>{#each selected.groups as group}<option value={group.id} selected={reference.groupIds.includes(group.id)}>{group.title}</option>{/each}</select></label>
                    {/if}
                    <button class="remove" type="button" on:click={()=>removeReference(reference.id)}>{copy.remove}</button>
                  </article>
                {/each}</div>{:else}<p class="empty-section">{copy.noRefs}</p>{/if}
              {/if}
            </section>
          {/each}
        </div>
        <aside class="recovery"><strong>{copy.recovery}</strong><p>{copy.recoveryDetail}</p><strong>{copy.cloud}</strong><p>{copy.cloudDetail}</p></aside>
      {:else}<div class="empty-workspace">{copy.choose}</div>{/if}
    </main>
  </div>
</section>

<style>
.atomic-entry{display:grid;gap:12px;min-width:0;margin-top:14px;padding:17px 19px;border:1px solid var(--border);border-radius:14px;background:var(--surface)}
.atomic-entry p{min-width:0;max-width:74ch;margin:0;font-size:12px;line-height:1.7;color:var(--ink-soft);overflow-wrap:anywhere}
.atomic-entry a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;max-width:100%;width:max-content;box-sizing:border-box;padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-raised);color:var(--gold);font-size:12px;font-weight:750;text-align:center;text-decoration:none;overflow-wrap:anywhere}
.atomic-entry a:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
@media(max-width:480px){.atomic-entry{padding:14px}.atomic-entry a{width:100%}}

.moodboards-page{padding-block:64px 100px;min-height:72vh}.heading{display:flex;justify-content:space-between;align-items:end;gap:24px}.heading h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,66px);font-weight:500;letter-spacing:-.055em;margin:12px 0}.backup-actions,.workspace-actions{display:flex;gap:8px;flex-wrap:wrap}.backup-actions button,.workspace-actions button,.new-board button,.add-reference button,.group-form button,.group-section header button,.reference-card button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:10px;padding:9px 12px;font-size:9px;font-weight:800}.hidden-file{display:none}.local-note,.status{margin-top:18px;border:1px solid var(--border);background:var(--surface);border-radius:13px;padding:12px 14px;font-size:10px;color:var(--ink-muted)}.local-note{display:flex;gap:10px}.local-note strong{color:var(--gold)}.layout{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;margin-top:14px}.boards-panel,.workspace{border:1px solid var(--border);border-radius:20px;background:var(--surface);padding:18px}.boards-panel{display:grid;grid-template-columns:minmax(180px,240px) minmax(0,1fr);gap:22px;align-items:start}.new-board button{min-height:44px}.new-board,.add-reference,.group-form{display:grid;gap:9px}.new-board h2,.board-list h2,.add-reference h3{font-family:Georgia,serif;font-weight:500}.new-board label,.add-reference label,.workspace-tools label,.group-form label,.groups-select{display:grid;gap:5px;font-size:8px;color:var(--ink-muted)}input,textarea,select{box-sizing:border-box;width:100%;border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:9px;padding:9px}.board-list{margin-top:0;min-width:0}.board-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,185px),1fr));gap:10px;align-items:start}.board-entry{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:6px;position:relative;margin-top:0;min-width:0}.board-entry>button{display:grid;gap:4px;width:100%;min-width:0;text-align:left;border:1px solid transparent;background:transparent;color:var(--ink);border-radius:11px;padding:8px}.board-entry>button.active{border-color:var(--border);background:var(--surface-raised)}.board-entry>button strong{overflow-wrap:anywhere}.board-count{font-size:8px;color:var(--ink-muted);margin-top:3px}.board-cover{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px;min-width:0;height:92px;margin-bottom:6px;border-radius:8px;overflow:hidden}.board-cover span{display:flex;align-items:center;justify-content:center;min-width:0;min-height:0;overflow:hidden;overflow-wrap:anywhere;padding:5px;background:var(--page-2);font-size:10px;line-height:1.25;text-align:center;color:var(--ink-soft)}.board-cover span[data-cover-type='ITEM']{background:var(--surface-raised)}.board-cover span[data-cover-type='WAND_PRESET']{background:var(--page-2)}.board-cover span[data-cover-type='NOTE']{font-style:italic}.board-cover span.cover-empty{opacity:.35}.board-menu{position:relative;min-width:0}.board-menu summary{box-sizing:border-box;display:grid;place-items:center;min-height:44px;min-width:44px;max-width:100%;border:1px solid var(--border);border-radius:10px;background:var(--surface-raised);color:var(--ink);font-size:11px;cursor:pointer;padding:6px}.board-menu[open]>button{position:absolute;right:0;top:100%;z-index:15;min-width:150px;max-width:210px;background:var(--surface);box-shadow:var(--shadow);border:1px solid var(--border);border-radius:9px;padding:12px;text-align:left;white-space:normal}.board-menu summary:focus-visible{outline:3px solid var(--gold);outline-offset:2px}.workspace-heading{display:flex;justify-content:space-between;gap:18px;align-items:start}.workspace-heading h2{font-family:Georgia,serif;font-size:30px;font-weight:500;margin:6px 0}.workspace-heading p{color:var(--ink-muted);font-size:10px}.danger{color:var(--decor-accent)!important}.workspace-tools{display:grid;grid-template-columns:1fr 1.5fr;gap:12px;margin:18px 0}.group-form{grid-template-columns:1fr auto;align-items:end}.add-reference{grid-template-columns:1fr 1fr 1fr;align-items:end;padding:14px;border:1px solid var(--border);border-radius:14px;background:var(--page-2)}.add-reference h3{grid-column:1/-1;margin:0}.add-reference label:last-of-type{grid-column:1/3}.sections{display:grid;gap:12px;margin-top:16px}.group-section{border:1px solid var(--border);border-radius:15px;padding:13px;background:var(--page-2)}.group-section>header{display:flex;justify-content:space-between;align-items:center}.group-section h3{font-family:Georgia,serif;font-size:18px;font-weight:500;margin:0}.reference-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.reference-card{border:1px solid var(--border);border-radius:12px;background:var(--surface);padding:11px}.reference-card .type{font-size:7px;color:var(--gold);font-weight:900}.reference-card h4{margin:6px 0;font-family:Georgia,serif;font-weight:500}.reference-card p,.reference-card code{font-size:9px;color:var(--ink-muted);overflow-wrap:anywhere}.groups-select{margin-top:10px}.groups-select select{min-height:64px}.reference-card .remove{margin-top:9px}.empty-section,.empty-workspace{color:var(--ink-muted);font-size:10px}.recovery{display:grid;grid-template-columns:auto 1fr;gap:5px 10px;margin-top:18px;border-top:1px solid var(--border);padding-top:14px;font-size:9px;color:var(--ink-muted)}.recovery p{margin:0}.recovery strong{color:var(--gold)}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--gold);outline-offset:2px}@media(max-width:950px){.boards-panel{grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:20px}.reference-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:680px){.heading,.workspace-heading{align-items:flex-start;flex-direction:column}.boards-panel,.workspace-tools,.add-reference{grid-template-columns:1fr}.add-reference label:last-of-type{grid-column:auto}.reference-grid{grid-template-columns:1fr}.recovery{grid-template-columns:1fr}.group-form{grid-template-columns:1fr}}
</style>
