<script>
 import {onMount} from 'svelte';
 import {locale} from '$lib/i18n/runtime.js';
 import {collectionExact1Copy} from './collection-exact1-copy.mjs';
 import {createCollectionExact1Consumer} from './collection-exact1-consumer.mjs';
 // Source-only isolated consumer. No import from public /editor/items yet.
 export let trustedWorkerAdapter=null;
 export let verifiedLocalDevGate=false;
 let consumer=null,pending=false,error=false,choice=0,epoch=0;
 let state={phase:'closed',targets:[],preview:null,backupName:null,editedName:null,sourceName:''};
 $: words=collectionExact1Copy($locale);
 $: phase=state.phase;
 onMount(()=>{
  if(!import.meta.env.DEV||verifiedLocalDevGate!==true||!trustedWorkerAdapter)return;
  try{consumer=createCollectionExact1Consumer(trustedWorkerAdapter,{trustedLocalHarness:true});state=consumer.snapshot()}catch{}
  return ()=>{epoch++;const active=consumer;consumer=null;if(active)void active.close().catch(()=>{})};
 });
 async function act(fn){
  if(!consumer||pending)return;
  const active=consumer,t=epoch;pending=true;error=false;
  try{const r=await fn(active);if(consumer===active&&t===epoch)state=r}
  catch{if(consumer===active&&t===epoch){state=active.snapshot();error=true}}
  finally{if(consumer===active&&t===epoch)pending=false}
 }
 async function close(){
  if(!consumer)return;const a=consumer,t=++epoch;pending=true;error=false;choice=0;
  const p=a.close();state=a.snapshot();
  try{await p}catch{if(consumer===a&&epoch===t)error=true}
  finally{if(consumer===a&&epoch===t){state=a.snapshot();pending=false}}
 }
 async function download(which){
  if(!consumer||pending)return;const a=consumer,t=epoch;pending=true;error=false;
  try{
   const r=await a.downloadVerifiedCopy(which);if(consumer!==a||t!==epoch||a.snapshot().phase==='closed'){r.encryptedBytes.fill(0);return}
   const url=URL.createObjectURL(new Blob([r.encryptedBytes],{type:'application/octet-stream'}));
   try{const link=document.createElement('a');link.href=url;link.download=r.name;document.body.append(link);try{link.click()}finally{link.remove()}}
   finally{r.encryptedBytes.fill(0);setTimeout(()=>URL.revokeObjectURL(url),1000)}
  }catch{if(consumer===a&&t===epoch){state=a.snapshot();error=true}}
  finally{if(consumer===a&&t===epoch)pending=false}
 }
</script>
<section class="collection-exact1" data-collection-exact1 data-product-writer="off" data-public-route="off" aria-label={words.title}>
 <h2>{words.title}</h2><p>{words.intro}</p>
 {#if !consumer}<p role="status">{words.off}</p>
 {:else}
  {#if phase==='closed'}<button type="button" on:click={()=>act(a=>a.load())} disabled={pending}>{words.load}</button>
  {:else if phase==='close-failed'}
   <button type="button" on:click={close} disabled={pending}>{words.close}</button>
  {:else}
   <p><code>{state.sourceName}</code></p><button type="button" on:click={close}>{words.close}</button>
   {#if phase==='opened'}<button type="button" on:click={()=>act(a=>a.backupOriginal())} disabled={pending}>{words.backup}</button>{/if}
   {#if state.backupName}<button type="button" on:click={()=>download('backup')} disabled={pending}>{words.downloadBackup}</button>{/if}
   {#if phase==='ready'||phase==='previewed'}
    {#if state.targets.length===0}<p role="status">{words.empty}</p>
    {:else}
     <label for="collection-exact1-target">{words.target}</label>
     <select id="collection-exact1-target" bind:value={choice} disabled={pending}>
      {#each state.targets as t,i}<option value={i}>{t.itemId} · {t.definitionId}/{t.groupIndex}</option>{/each}
     </select>
     <button type="button" on:click={()=>act(a=>a.preview(choice))} disabled={pending}>{words.review}</button>
     {#if phase==='previewed'}<button type="button" on:click={()=>act(a=>a.stage())} disabled={pending||state.preview?.choice!==choice}>{words.stage}</button>{/if}
    {/if}
   {/if}
   {#if state.preview}<div class="preview" aria-live="polite"><strong>{state.preview.itemId}: {words.before} → {words.after}</strong><p>{words.remaining}: {state.preview.remainingFalseCount}</p></div>{/if}
   {#if phase==='staged'}<div class="actions"><button type="button" disabled={pending} on:click={()=>act(a=>a.undo())}>{words.undo}</button><button type="button" disabled={pending} on:click={()=>act(a=>a.exportEditedCopy())}>{words.export}</button></div>
   {:else if phase==='undone'}<button type="button" disabled={pending} on:click={()=>act(a=>a.redo())}>{words.redo}</button>
   {:else if phase==='exported'}<p role="status">{words.done}</p><p><code>{state.editedName}</code></p><button type="button" disabled={pending} on:click={()=>download('edited')}>{words.downloadEdited}</button>{/if}
  {/if}
  {#if error}<p role="alert">{words.denied}</p>{/if}
 {/if}
</section>
<style>
 .collection-exact1{box-sizing:border-box;min-width:0;max-width:100%;display:grid;gap:12px;border:1px solid var(--border);border-radius:14px;padding:16px;background:var(--surface);overflow-wrap:anywhere}
 h2,p{margin:0}button,select{font:inherit;min-width:0;max-width:100%;min-height:44px;padding:9px 12px;color:var(--ink);border:1px solid var(--border);border-radius:9px;background:var(--surface-raised)}
 button:focus-visible,select:focus-visible{outline:2px solid var(--gold);outline-offset:2px}button:disabled{opacity:.5;cursor:not-allowed}
 .actions{display:flex;flex-wrap:wrap;gap:8px}.preview{padding:12px;border:1px solid var(--border);border-radius:9px}code{overflow-wrap:anywhere}
</style>
