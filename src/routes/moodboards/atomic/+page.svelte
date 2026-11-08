<script lang="ts">
 import { onMount, onDestroy } from 'svelte';
 import { base } from '$app/paths';
 import { locale } from '$lib/i18n/runtime.js';
 import { moodboardCopy } from '$lib/moodboards/copy.js';
 import { decodeCollectionRecord,loadCollectionRuntime } from '$lib/collection/runtime.js';
 import { ATOMIC_FIRST_BOARD_GATE,openAtomicFirstBoardDatabase,verifiedAtomicFirstBoardReopen,
  createAtomicFirstBoard,toggleAtomicFirstBoardItem,deleteAtomicFirstBoard
 } from '$lib/moodboards/atomic-first-board.mjs';
 let db:IDBDatabase|null=null, snapshot:any=null, ready=false, catalogReady=false;
 let records:any[]=[],title='',itemIdInput='',message='',outcome='NOT_STARTED',busy=false;
 $: copy=moodboardCopy($locale);
 $: board=snapshot&&!snapshot.deleted?snapshot.document.boards[0]:null;
 onMount(async()=>{
  try{db=await openAtomicFirstBoardDatabase();snapshot=await verifiedAtomicFirstBoardReopen(db);ready=true;}
  catch(e){message=String(e);outcome='UNAVAILABLE';}
  try{const data=await loadCollectionRuntime(base);
   records=data.rows.map((row:any)=>decodeCollectionRecord(data.index,row,$locale));catalogReady=true;
  }catch{catalogReady=false;}
 });
 onDestroy(()=>db?.close());
 async function create(){
  if(!db||snapshot||busy)return;
  busy=true;outcome='PENDING';
  try{
   const result=await createAtomicFirstBoard(db,title);
   snapshot=await verifiedAtomicFirstBoardReopen(db);
   if(!snapshot||snapshot.boardId!==result.boardId||snapshot.revision!==result.revision)
    throw Error('REOPEN_FAILED');
   title='';message=copy.created;outcome='CREATED';
  }catch(e){message=String(e);outcome='REJECTED';}finally{busy=false;}
 }
 async function toggle(){
  if(!db||!board||!catalogReady||busy)return;
  if(!/^[1-9][0-9]{0,15}$/.test(itemIdInput.trim())||
    !Number.isSafeInteger(Number(itemIdInput))){message='Invalid ItemID';outcome='REJECTED';return;}
  busy=true;outcome='PENDING';
  try{
   const result=await toggleAtomicFirstBoardItem(db,{
    boardId:snapshot.boardId,expectedRevision:snapshot.revision,
    itemId:Number(itemIdInput),verifiedRecords:records
   });
   snapshot=await verifiedAtomicFirstBoardReopen(db);
   if(snapshot?.revision!==result.revision)throw Error('REOPEN_FAILED');
   message=copy.saved;outcome='ITEM_SAVED';
  }catch(e){message=String(e);outcome='REJECTED';}finally{busy=false;}
 }
 async function reopen(){
  if(!db||busy)return;
  try{snapshot=await verifiedAtomicFirstBoardReopen(db);message='';outcome='REOPENED';}
  catch(e){message=String(e);outcome='REJECTED';}
 }
 async function remove(){
  if(!db||!board||busy)return;
  busy=true;outcome='PENDING';
  try{
   await deleteAtomicFirstBoard(db,{boardId:snapshot.boardId,expectedRevision:snapshot.revision});
   snapshot=await verifiedAtomicFirstBoardReopen(db);
   message=copy.deleted;outcome='DELETED';
  }catch(e){message=String(e);outcome='REJECTED';}finally{busy=false;}
 }
 function backup(){
  if(!snapshot)return;
  const u=URL.createObjectURL(new Blob([snapshot.backup],{type:'application/json'}));
  const a=window.document.createElement('a');a.href=u;a.download='dreamwish-wand-atomic-first-backup.json';
  a.click();URL.revokeObjectURL(u);
 }
</script>
<svelte:head><title>Local first Moodboard | Dreamwish Wand</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<section class="atomic-first container" data-atomic-first-board data-atomic-gate={ATOMIC_FIRST_BOARD_GATE}
 data-atomic-ready={ready?'true':'false'} data-atomic-catalog={catalogReady?'ready':'unavailable'}
 data-atomic-outcome={outcome} data-atomic-board-id={snapshot?.boardId??''}
 data-atomic-revision={snapshot?.revision??0} data-writer="off" data-media-public="off">
 <header><h1>{copy.title}</h1>
  <p>Isolated local-only IndexedDB preview. Legacy Moodboards and their Backup remain unchanged. Not migrated or publicly enabled.</p>
  <a href={base+'/moodboards/'}>{copy.boards}</a></header>
 {#if message}<p data-atomic-status role="status">{message}</p>{/if}
 {#if !ready}<p>Local transactional storage unavailable.</p>
 {:else if !snapshot}
  <form on:submit|preventDefault={create} data-atomic-create-form>
   <label>{copy.titleLabel}<input data-atomic-title bind:value={title} required maxlength="120"/></label>
   <button data-atomic-create type="submit" disabled={busy||!title.trim()}>{copy.create}</button>
  </form>
 {:else if snapshot.deleted}
  <p data-atomic-tombstone>Deleted. Permanent tombstone prevents duplicate first-board IDs.</p>
 {:else if board}
  <article data-atomic-board><h2>{board.title}</h2><p>BoardID: <code>{snapshot.boardId}</code> · Revision: {snapshot.revision}</p>
   <form on:submit|preventDefault={toggle} data-atomic-item-form>
    <label>{copy.item} ItemID<input data-atomic-item-id bind:value={itemIdInput} inputmode="numeric" required/></label>
    <button data-atomic-save-item type="submit" disabled={busy||!catalogReady}>{copy.add}</button>
   </form>
   <ul data-atomic-items>{#each board.references as reference}
    <li data-atomic-item={reference.entityId}>{reference.label} ({reference.entityId})</li>
   {/each}</ul>
   <p data-atomic-backup-count>Backup: {snapshot.backupDocument.boards[0]?.references.length??0} items</p>
   <button data-atomic-export type="button" on:click={backup}>{copy.export}</button>
   <button data-atomic-delete type="button" on:click={remove} disabled={busy}>{copy.delete}</button>
  </article>
 {/if}
 <button data-atomic-reopen type="button" on:click={reopen} disabled={!ready||busy}>Reopen local transaction</button>
</section>
<style>
.atomic-first{padding-block:55px 95px;max-width:900px}.atomic-first h1{font-family:Georgia,serif;font-size:clamp(32px,5vw,58px);font-weight:500}
.atomic-first p{color:var(--ink-muted);line-height:1.65}
.atomic-first form,.atomic-first article{display:grid;gap:12px;border:1px solid var(--border);border-radius:15px;background:var(--surface);padding:18px;margin:18px 0}
.atomic-first label{display:grid;gap:8px}.atomic-first input{width:100%;box-sizing:border-box;padding:10px;background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:10px}
.atomic-first button{padding:10px 14px;margin:8px 6px 8px 0;border:1px solid var(--border);border-radius:9px;background:var(--surface-raised);color:var(--ink);cursor:pointer}
.atomic-first button:disabled{opacity:.45}.atomic-first a:focus-visible,.atomic-first button:focus-visible,.atomic-first input:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.atomic-first code{overflow-wrap:anywhere}@media(max-width:480px){.atomic-first{padding-block:35px 65px}.atomic-first button{width:100%}}
</style>
