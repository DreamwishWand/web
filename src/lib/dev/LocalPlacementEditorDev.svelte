<script>
 import {onMount} from 'svelte';
 import {locale} from '$lib/i18n/runtime.js';
 import {createLocalPlacementDevWorkflow,STEAM626_PLACEMENT_BUILD} from './local-placement-workflow.mjs';
 import {localPlacementCopy} from './local-placement-copy.mjs';
 export let trustedWorkerAdapter=null;
 export let verifiedLocalDevGate=false;
 export let fixedOperation='comp03';
 let operation='comp03',workflow=null,state={phase:'closed',preview:null,backupName:null,editedName:null};
 let file=null,confirmed=false,pending=false,error=false,seed='',grid='',x='',y='',epoch=0,input=null;
 $: words=localPlacementCopy($locale);
 $: title=operation==='comp03'?words.compTitle:words.vaseTitle;
 $: detail=operation==='comp03'?words.compDetail:words.vaseDetail;
 $: p=state.preview;
 $: valid=operation==='comp03'?Number.isSafeInteger(seed)&&seed>0:Number.isSafeInteger(grid)&&grid>0&&Number.isSafeInteger(x)&&x>=0&&Number.isSafeInteger(y)&&y>=0;
 onMount(()=>{
  if(!import.meta.env.DEV||verifiedLocalDevGate!==true||!trustedWorkerAdapter)return;
  try{operation=fixedOperation;workflow=createLocalPlacementDevWorkflow(trustedWorkerAdapter,{trustedLocalHarness:true,operation});state=workflow.snapshot()}catch{workflow=null}
  return ()=>{++epoch;const w=workflow;workflow=null;void w?.close().catch(()=>{})};
 });
 async function act(fn){
  if(!workflow||pending)return;const w=workflow,t=epoch;pending=true;error=false;
  try{const s=await fn(w);if(workflow===w&&epoch===t)state=s}catch{if(workflow===w&&epoch===t){state=w.snapshot();error=true}}finally{if(workflow===w&&epoch===t)pending=false}
 }
 function clear(){file=null;confirmed=false;seed='';grid='';x='';y='';if(input)input.value=''}
 async function select(e){const f=e.currentTarget.files?.[0]||null;e.currentTarget.value='';clear();await act(async w=>{const s=await w.close();file=f;return s})}
 const close=()=>{clear();return act(w=>w.close())};
 const preview=()=>act(w=>w.preview(operation==='comp03'?{seedId:seed}:{gridId:grid,x,y}));
 async function download(which){
  if(!workflow||pending)return;const w=workflow,t=epoch;pending=true;error=false;
  try{const r=await w.downloadVerifiedCopy(which);if(workflow!==w||epoch!==t){r.encryptedBytes.fill(0);return}
   const url=URL.createObjectURL(new Blob([r.encryptedBytes],{type:'application/octet-stream'}));r.encryptedBytes.fill(0);
   try{const a=document.createElement('a');a.href=url;a.download=r.name;document.body.appendChild(a);try{a.click()}finally{a.remove()}}finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
  }catch{if(workflow===w&&epoch===t){state=w.snapshot();error=true}}finally{if(workflow===w&&epoch===t)pending=false}
 }
</script>
<section class="placement" data-dev-placement data-product-writer="off" data-public-route="off" data-operation={operation}>
 <h2>{title}</h2><p>{words.safety}</p><p>{detail}</p>
 {#if !workflow}<p role="status">{words.off}</p>
 {:else}
  {#if state.phase==='closed'}
   <label>{words.file}<input bind:this={input} type="file" accept=".p1g,application/octet-stream" disabled={pending} on:change={select}/></label>
   <p>{words.platform}: <code>{STEAM626_PLACEMENT_BUILD.buildId}</code></p>
   <label class="confirm"><input type="checkbox" bind:checked={confirmed} disabled={pending}/>{words.confirmBuild}</label>
   <button disabled={pending||!file||!confirmed} on:click={()=>act(w=>w.openFile({file,buildConfirmed:confirmed}))}>{words.openFile}</button>
  {:else}
   <button disabled={pending} on:click={close}>{words.close}</button>
   {#if state.phase==='opened'}<button disabled={pending} on:click={()=>act(w=>w.backupOriginal())}>{words.backup}</button>{/if}
   {#if state.backupName}<button disabled={pending} on:click={()=>download('backup')}>{words.downloadBackup}</button>{/if}
   {#if ['ready','previewed'].includes(state.phase)}
    {#if operation==='comp03'}<label>{words.seed}<input type="number" min="1" max="4294967295" step="1" bind:value={seed} disabled={pending}/></label>
    {:else}<label>{words.grid}<input type="number" min="1" max="4294967295" step="1" bind:value={grid} disabled={pending}/></label><label>{words.x}<input type="number" min="0" max="4294967295" step="1" bind:value={x} disabled={pending}/></label><label>{words.y}<input type="number" min="0" max="4294967295" step="1" bind:value={y} disabled={pending}/></label>{/if}
    <button disabled={pending||!valid} on:click={preview}>{words.review}</button>
   {/if}
   {#if p}
    <div class="review" aria-live="polite" data-placement-preview>
     <strong>{words.verified}</strong><p>{words.grid}: {p.gridId} · Item ID: {p.itemId}</p>
     {#if operation==='comp03'}<p>{words.seed}: {p.seedId}</p><div class="shape" aria-label={words.compDetail}>{#each Array(9) as _,i}<span class:seed={i===0}>{i===0?'1':'+'}</span>{/each}</div><p>{words.existing}: 1 · {words.added}: 8</p>
     {:else}<p>X: {p.x} · Y: {p.y} · {p.orientation}</p>{/if}
     <p>{p.oldAmount} → {p.newAmount}</p><p>{detail}</p>
    </div>
   {/if}
   {#if state.phase==='previewed'}<button disabled={pending||!valid||(operation==='comp03'?p?.seedId!==seed:p?.gridId!==grid||p?.x!==x||p?.y!==y)} on:click={()=>act(w=>w.stage())}>{words.stagePlacement}</button>{/if}
   {#if state.phase==='staged'}<button disabled={pending} on:click={()=>act(w=>w.undo())}>{words.undo}</button><button disabled={pending} on:click={()=>act(w=>w.exportEditedCopy())}>{words.export}</button>{/if}
   {#if state.phase==='undone'}<button disabled={pending} on:click={()=>act(w=>w.redo())}>{words.redo}</button>{/if}
   {#if state.phase==='exported'}<p role="status">{words.done}</p><p><code>{state.editedName}</code></p><button disabled={pending} on:click={()=>download('edited')}>{words.downloadEdited}</button>{/if}
  {/if}
  {#if error}<p role="alert">{state.phase==='close-failed'?words.closeFailed:words.denied}</p>{/if}
 {/if}
</section>
<style>
 .placement{box-sizing:border-box;display:grid;gap:12px;min-width:0;max-width:100%;padding:16px;border:1px solid var(--border);border-radius:14px;overflow-wrap:anywhere}
 .placement label{display:grid;gap:5px;min-width:0}.placement input,.placement button{box-sizing:border-box;max-width:100%;min-width:0;padding:10px;font:inherit;border:1px solid var(--border);border-radius:8px;background:var(--surface-raised);color:var(--ink)}
 .placement button{min-height:44px;cursor:pointer}.placement button:disabled{opacity:.5;cursor:not-allowed}.placement .confirm{display:flex;align-items:flex-start;gap:8px}
 .review{display:grid;gap:8px;padding:12px;border:1px solid var(--border);border-radius:10px}.shape{display:grid;grid-template-columns:repeat(3,minmax(32px,52px));gap:3px}.shape span{aspect-ratio:1;display:grid;place-items:center;border:1px solid var(--border);border-radius:4px;background:var(--surface-raised)}.shape .seed{border:2px solid var(--gold)}
 p,h2{margin:0}code{overflow-wrap:anywhere}.placement button:focus-visible,.placement input:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
</style>
