<script>
 import {onMount} from 'svelte';
 import {locale} from '$lib/i18n/runtime.js';
 import {collectionExact1Copy} from './collection-exact1-copy.mjs';
 import {createCollectionExact1Consumer,COLLECTION_EXACT1_BUILDS} from './collection-exact1-consumer.mjs';
 import {productCollectionPortScope} from './product-collection-client.mjs';
 // The existing DEV harness remains unchanged; the product mount accepts
 // only a branded port from the trusted sealed-release Worker.
 export let trustedWorkerAdapter=null;
 export let verifiedLocalDevGate=false;
 let consumer=null,pending=false,error=false,choice=0,epoch=0;
 let fileMode=false,file=null,platform='',confirmed=false,productScope=null;
 $: allowedPlatforms=productScope?productScope.builds.map(b=>b.platform):['steam-windows','switch'];
 $: selectedBuild=allowedPlatforms.includes(platform)?COLLECTION_EXACT1_BUILDS[platform]||null:null;
 let state={phase:'closed',targets:[],preview:null,backupName:null,editedName:null,sourceName:''};
 $: words=collectionExact1Copy($locale);
 $: phase=state.phase;
 onMount(()=>{
  productScope=productCollectionPortScope(trustedWorkerAdapter);
  if(!productScope&&(!import.meta.env.DEV||verifiedLocalDevGate!==true||!trustedWorkerAdapter))return;
  try{consumer=createCollectionExact1Consumer(trustedWorkerAdapter,{trustedLocalHarness:true});fileMode=typeof trustedWorkerAdapter.open==='function';state=consumer.snapshot()}catch{productScope=null}
  return ()=>{epoch++;const active=consumer;consumer=null;if(active)void active.close().catch(()=>{})};
 });
 async function act(fn){
  if(!consumer||pending)return;
  const active=consumer,t=epoch;pending=true;error=false;
  try{const r=await fn(active);if(consumer===active&&t===epoch)state=r}
  catch{if(consumer===active&&t===epoch){state=active.snapshot();error=true}}
  finally{if(consumer===active&&t===epoch)pending=false}
 }
 async function chooseFile(e){
  const f=e.currentTarget.files?.[0]||null;e.currentTarget.value='';
  if(!consumer||pending)return;
  const a=consumer,t=++epoch;pending=true;error=false;file=null;confirmed=false;choice=0;
  try{const p=a.close();state=a.snapshot();await p;if(consumer===a&&epoch===t)file=f}
  catch{if(consumer===a&&epoch===t)error=true}
  finally{if(consumer===a&&epoch===t){state=a.snapshot();pending=false}}
 }
 async function close(){
  if(!consumer)return;const a=consumer,t=++epoch;pending=true;error=false;choice=0;file=null;confirmed=false;
  const p=a.close();state=a.snapshot();
  try{await p}catch{if(consumer===a&&epoch===t)error=true}
  finally{if(consumer===a&&epoch===t){state=a.snapshot();pending=false}}
 }
 async function download(which){
  if(!consumer||pending)return;const a=consumer,t=epoch;pending=true;error=false;
  try{
   const r=await a.downloadVerifiedCopy(which);
   let url;
   try{
    if(consumer!==a||t!==epoch||a.snapshot().phase==='closed')return;
    url=URL.createObjectURL(new Blob([r.encryptedBytes],{type:'application/octet-stream'}));
   }finally{r.encryptedBytes.fill(0)}
   try{const link=document.createElement('a');link.href=url;link.download=r.name;document.body.append(link);try{link.click()}finally{link.remove()}}
   finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
  }catch{if(consumer===a&&t===epoch){state=a.snapshot();error=true}}
  finally{if(consumer===a&&t===epoch)pending=false}
 }
</script>
<section class="collection-exact1" data-collection-exact1 data-product-writer="off" data-public-route={productScope?.mode==='public-accepted'?'on':'off'} data-collection-runtime={productScope?.mode||'dev-off'} aria-label={words.title}>
 <h2>{words.title}</h2><p>{words.intro}</p>
 {#if !consumer}<p role="status">{words.off}</p>
 {:else}
  {#if phase==='closed'}
   {#if fileMode}
    <label for="collection-local-file">{words.file}</label>
    <input id="collection-local-file" type="file" accept=".p1g,application/octet-stream" on:change={chooseFile} disabled={pending}/>
    {#if file}<p><code>{file.name}</code></p>{/if}
    <label for="collection-local-build">{words.platform}</label>
    <select id="collection-local-build" bind:value={platform} on:change={()=>confirmed=false} disabled={pending}>
     <option value="">{words.chooseBuild}</option>
     {#if allowedPlatforms.includes('steam-windows')}<option value="steam-windows">Steam (Windows)</option>{/if}
     {#if allowedPlatforms.includes('switch')}<option value="switch">Nintendo Switch</option>{/if}
    </select>
    {#if selectedBuild}<p><code>{selectedBuild.buildId}</code> · schema 626</p>
     <label class="check"><input type="checkbox" bind:checked={confirmed} disabled={pending}/><span>{words.confirmBuild}</span></label>
    {/if}
    <button type="button" data-collection-open on:click={()=>act(a=>a.openFile({file,build:selectedBuild}))} disabled={pending||!file||!selectedBuild||!confirmed}>{words.openFile}</button>
   {:else}<button type="button" on:click={()=>act(a=>a.load())} disabled={pending}>{words.load}</button>{/if}
   {#if pending}<button type="button" on:click={close}>{words.close}</button>{/if}
  {:else if phase==='close-failed'}
   <button type="button" on:click={close} disabled={pending}>{words.close}</button>
  {:else}
   <p><code>{state.sourceName}</code></p>{#if fileMode&&state.build}<p><code>{state.build.buildId}</code> · schema 626</p>{/if}<button type="button" on:click={close}>{words.close}</button>
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
  {#if error}<p role="alert">{phase==='close-failed'?words.closeFailed:words.denied}</p>{/if}
 {/if}
</section>
<style>
 .collection-exact1{box-sizing:border-box;min-width:0;max-width:100%;display:grid;gap:12px;border:1px solid var(--border);border-radius:14px;padding:16px;background:var(--surface);overflow-wrap:anywhere}
 h2,p{margin:0}button,select,input[type=file]{box-sizing:border-box;font:inherit;min-width:0;max-width:100%;min-height:44px;padding:9px 12px;color:var(--ink);border:1px solid var(--border);border-radius:9px;background:var(--surface-raised)}
 input[type=file]{width:100%}.check{display:flex;align-items:flex-start;gap:8px;min-width:0}.check input{flex-shrink:0}
 button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--gold);outline-offset:2px}button:disabled{opacity:.5;cursor:not-allowed}
 .actions{display:flex;flex-wrap:wrap;gap:8px}.preview{padding:12px;border:1px solid var(--border);border-radius:9px}code{overflow-wrap:anywhere}
</style>
