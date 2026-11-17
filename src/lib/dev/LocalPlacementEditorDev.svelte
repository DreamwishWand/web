<script>
 import {onMount} from 'svelte';
 import {locale} from '$lib/i18n/runtime.js';
 import {createLocalPlacementDevWorkflow,STEAM626_PLACEMENT_BUILD,SWITCH626_BACKPACK_BUILD} from './local-placement-workflow.mjs';
 import {localPlacementCopy} from './local-placement-copy.mjs';
 import Comp03ReferencePattern from '$lib/wep/Comp03ReferencePattern.svelte';
 import {productPlacementPortScope} from './product-placement-client.mjs';
 export let trustedWorkerAdapter=null;
 export let verifiedLocalDevGate=false;
 export let fixedOperation='comp03';
 let operation='comp03',productMode='',workflow=null,state={phase:'closed',preview:null,backupName:null,editedName:null};
 let file=null,confirmed=false,pending=false,error=false,seed='',grid='',x='',y='',epoch=0,input=null,oldIds=[null,null,null,null];
 $: words=localPlacementCopy($locale);
 $: backpack=operation.startsWith('backpack-');
 $: wardrobe=operation.startsWith('wardrobe-');
 $: fd01=operation==='fd01';
 $: fd02=operation==='fd02';
 $: fd03=operation==='fd03';
 $: orthoL=operation==='ortho-l';
 $: diagonal90=operation==='diagonal90';
 $: orthoT=operation==='ortho-t';
 $: fenceAdd=fd01||fd02||fd03||orthoL||diagonal90||orthoT;
 $: fenceAddCount=orthoT?7:orthoL||diagonal90?5:3;
 $: fe01=operation==='fe01';
 $: fence=fenceAdd||fe01;
 $: mixedRoad=operation==='sr03'||operation==='rm01';
 $: appearance=operation==='hair'||operation==='skin';
 $: eye=operation==='eyecolor2'||operation==='eyecolor2-switch';
 $: makeup=operation==='makeup-color1'||operation==='makeup-color1-switch';
 $: rawTitle=fd01?words.fd01Title:fd02?words.fd02Title:fd03?words.fd03Title:orthoL?words.orthoLTitle:diagonal90?words.diagonal90Title:orthoT?words.orthoTTitle:fe01?words.fe01Title:eye?(operation==='eyecolor2-switch'?words.switchEyeColor2Title:words.eyeColor2Title):makeup?(operation==='makeup-color1-switch'?words.switchMakeupColor1Title:words.makeupColor1Title):operation==='hair'?words.hairTitle:operation==='skin'?words.skinTitle:operation==='comp03'?words.compTitle:operation==='vase'?words.vaseTitle:operation==='sr03'?words.sr03Title:operation==='rm01'?words.rm01Title:operation==='backpack-steam'?words.backpackSteamTitle:operation==='backpack-switch'?words.backpackSwitchTitle:operation==='wardrobe-steam'?words.wardrobeSteamTitle:words.wardrobeSwitchTitle;
 $: title=productMode?rawTitle.split(' — ')[0]+(productMode==='private-product-v2'?' — V2':''):rawTitle;
 $: detail=fd01?words.fd01Detail:fd02?words.fd02Detail:fd03?words.fd03Detail:orthoL?words.orthoLDetail:diagonal90?words.diagonal90Detail:orthoT?words.orthoTDetail:fe01?words.fe01Detail:eye?(operation==='eyecolor2-switch'?words.switchEyeColor2Detail:words.eyeColor2Detail):makeup?(operation==='makeup-color1-switch'?words.switchMakeupColor1Detail:words.makeupColor1Detail):appearance?(operation==='hair'?words.hairDetail:words.skinDetail):wardrobe?words.wardrobeDetail:backpack?words.backpackDetail:operation==='comp03'?words.compDetail:mixedRoad?words.sr03Detail:words.vaseDetail;
 $: p=state.preview;
 $: addedFenceIds=p&&fenceAdd?Array.from({length:fenceAddCount},(_,i)=>p.nextObjectId+i):[];
 $: valid=fe01?Number.isSafeInteger(grid)&&grid>0&&grid<=0xffffffff&&oldIds.every(v=>Number.isSafeInteger(v)&&v>0&&v<=0xffffffff)&&new Set(oldIds).size===4:fenceAdd?Number.isSafeInteger(grid)&&grid>0&&grid<=0xffffffff&&[x,y].every(v=>Number.isSafeInteger(v)&&v>=0&&v<=0xffffffff):(wardrobe||appearance||eye||makeup)?true:backpack?Number.isSafeInteger(x)&&x>=0&&x<256&&Number.isSafeInteger(y)&&y>=0&&y<256&&x!==y:operation==='comp03'?Number.isSafeInteger(seed)&&seed>0:Number.isSafeInteger(grid)&&grid>0&&Number.isSafeInteger(x)&&x>=0&&Number.isSafeInteger(y)&&y>=0&&(!mixedRoad||(x>0&&y>0&&x!==y));
 onMount(()=>{
  const scope=productPlacementPortScope(trustedWorkerAdapter);
  if(!scope&&(!import.meta.env.DEV||verifiedLocalDevGate!==true||!trustedWorkerAdapter))return;
  if(scope&&scope.uiOperation!==fixedOperation)return;
  try{productMode=scope?.mode||'';operation=fixedOperation;workflow=createLocalPlacementDevWorkflow(trustedWorkerAdapter,{trustedLocalHarness:true,operation,spatialPreviewEnabled:scope?.spatialPreviewEnabled===true});state=workflow.snapshot()}catch{workflow=null}
  return ()=>{++epoch;const w=workflow;workflow=null;void w?.close().catch(()=>{})};
 });
 async function act(fn){
  if(!workflow||pending)return;const w=workflow,t=epoch;pending=true;error=false;
  try{const s=await fn(w);if(workflow===w&&epoch===t)state=s}catch{if(workflow===w&&epoch===t){state=w.snapshot();error=true}}finally{if(workflow===w&&epoch===t)pending=false}
 }
 function clear(){file=null;confirmed=false;seed='';grid='';x='';y='';oldIds=[null,null,null,null];if(input)input.value=''}
 async function select(e){const f=e.currentTarget.files?.[0]||null;e.currentTarget.value='';clear();await act(async w=>{const s=await w.close();file=f;return s})}
 const close=()=>{clear();return act(w=>w.close())};
 const preview=()=>act(w=>w.preview(fe01?{gridId:grid,oldIds:[...oldIds]}:(wardrobe||appearance||eye||makeup)?undefined:backpack?{sourceSlot:x,destinationSlot:y}:operation==='comp03'?{seedId:seed}:mixedRoad?{gridId:grid,retainedId:x,movedId:y}:{gridId:grid,x,y}));
 async function download(which){
  if(!workflow||pending)return;const w=workflow,t=epoch;pending=true;error=false;
  try{const r=await w.downloadVerifiedCopy(which);if(workflow!==w||epoch!==t){r.encryptedBytes.fill(0);return}
   const url=URL.createObjectURL(new Blob([r.encryptedBytes],{type:'application/octet-stream'}));r.encryptedBytes.fill(0);
   try{const a=document.createElement('a');a.href=url;a.download=r.name;document.body.appendChild(a);try{a.click()}finally{a.remove()}}finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
  }catch{if(workflow===w&&epoch===t){state=w.snapshot();error=true}}finally{if(workflow===w&&epoch===t)pending=false}
 }
</script>
<section class="placement" data-dev-placement data-product-writer="off" data-public-route={productMode==='public-accepted'?'on':'off'} data-operation={operation}>
 <h2>{title}</h2><p>{eye?(operation==='eyecolor2-switch'?words.switchEyeColor2Safety:words.eyeColor2Safety):makeup?(operation==='makeup-color1-switch'?words.switchMakeupColor1Safety:words.makeupColor1Safety):wardrobe?words.wardrobeSafety:backpack?words.backpackSafety:(operation==='rm01'||fence)?words.rm01Safety:words.safety}</p><p>{detail}</p>
 {#if !workflow}<p role="status">{words.off}</p>
 {:else}
  {#if state.phase==='closed'}
   <label>{words.file}<input bind:this={input} type="file" accept=".p1g,application/octet-stream" disabled={pending} on:change={select}/></label>
   <p>{words.platform}: <code>{operation==='backpack-switch'||operation==='wardrobe-switch'||operation==='rm01'||fence||(operation==='eyecolor2-switch'||operation==='makeup-color1-switch')?SWITCH626_BACKPACK_BUILD.buildId:STEAM626_PLACEMENT_BUILD.buildId}</code></p>
   <label class="confirm"><input type="checkbox" bind:checked={confirmed} disabled={pending}/>{words.confirmBuild}</label>
   <button disabled={pending||!file||!confirmed} on:click={()=>act(w=>w.openFile({file,buildConfirmed:confirmed}))}>{words.openFile}</button>
  {:else}
   <button disabled={pending} on:click={close}>{words.close}</button>
   {#if state.phase==='opened'}<button disabled={pending} on:click={()=>act(w=>w.backupOriginal())}>{words.backup}</button>{/if}
   {#if state.backupName}<button disabled={pending} on:click={()=>download('backup')}>{words.downloadBackup}</button>{/if}
   {#if ['ready','previewed'].includes(state.phase)}
    {#if fe01}<label>{words.grid}<input type="number" min="1" max="4294967295" step="1" bind:value={grid} disabled={pending}/></label>{#each oldIds as _,i}<label>{i<2?words.retainedId:words.fenceDeleteId} {i%2+1}<input type="number" min="1" max="4294967295" step="1" bind:value={oldIds[i]} disabled={pending}/></label>{/each}{:else if eye}<p>{operation==='eyecolor2-switch'?words.switchEyeColor2Detail:words.eyeColor2Detail}</p>
     {:else if makeup}<p>{operation==='makeup-color1-switch'?words.switchMakeupColor1Detail:words.makeupColor1Detail}</p>
      {:else if appearance}<p>{detail}</p>
    {:else if wardrobe}<p>{words.wardrobeDetail}</p>
    {:else if backpack}<label>{words.sourceSlot}<input type="number" min="0" max="255" step="1" bind:value={x} disabled={pending}/></label><label>{words.destinationSlot}<input type="number" min="0" max="255" step="1" bind:value={y} disabled={pending}/></label>
    {:else if operation==='comp03'}<label>{words.seed}<input type="number" min="1" max="4294967295" step="1" bind:value={seed} disabled={pending}/></label>
    {:else}<label>{words.grid}<input type="number" min="1" max="4294967295" step="1" bind:value={grid} disabled={pending}/></label><label>{mixedRoad?words.retainedId:words.x}<input type="number" min={mixedRoad?1:0} max="4294967295" step="1" bind:value={x} disabled={pending}/></label><label>{mixedRoad?words.movedId:words.y}<input type="number" min={mixedRoad?1:0} max="4294967295" step="1" bind:value={y} disabled={pending}/></label>{/if}
    <button disabled={pending||!valid} on:click={preview}>{words.review}</button>
   {/if}
   {#if p}
    <div class="review" aria-live="polite" data-placement-preview>
     <strong>{words.verified}</strong>
     {#if wardrobe}<p>{words.wardrobeSlot}: {p.slot}</p><p>Item ID: {p.oldItemId} → {p.newItemId}</p>
     {:else if eye}<p>Eyeball Item {p.eyeballItemId} · {p.field}: {p.oldColorIndex} → {p.newColorIndex}</p><p>Inventory Δ{p.inventoryDelta}</p>
      {:else if makeup}<p>Makeup slot {p.slot} · Item {p.makeupItemId} · {p.field}: {p.oldColorIndex} → {p.newColorIndex}</p><p>Inventory Δ{p.inventoryDelta}</p>
      {:else if appearance}<p>{p.old} → {p.new}</p>{#if operation==='skin'}<p>Character ID: {p.characterId}</p>{/if}
     {:else if backpack}<p>Backpack 0 · Item ID: {p.itemId}</p><p>{words.sourceSlot}: {p.sourceSlot} · {p.oldAmount} → {p.newSourceAmount}</p><p>{words.destinationSlot}: {p.destinationSlot} · 0 → {p.newDestinationAmount}</p>
     {:else}<p>{words.grid}: {p.gridId} · Item ID: {p.itemId}</p>
     {#if operation==='comp03'}<p>{words.seed}: {p.seedId}</p><Comp03ReferencePattern locale={$locale}/>
     {#if state.phase==='previewed'&&!pending&&p.seedId===seed&&state.spatialPreview}
      <figure class="spatial-review" data-comp03-spatial-review>
       <figcaption>{words.verified} · {words.grid}: {state.spatialPreview.gridId}</figcaption>
       <svg viewBox="0 0 480 320" role="img" aria-label={words.verified+' · '+words.grid+': '+state.spatialPreview.gridId}>
        {#each state.spatialPreview.markers as m (m.objectId)}
         <g transform={'translate('+m.screenX+' '+m.screenY+')'} data-comp03-anchor={m.role}>
          <circle r="11" class:retained={m.role==='retained'}/>
          <text text-anchor="middle" dominant-baseline="central">{m.role==='retained'?'1':'+'}</text>
         </g>
        {/each}
       </svg>
       <div class="anchor-list">
        {#each state.spatialPreview.markers as m (m.objectId)}
         <p>{m.role==='retained'?words.existing:words.added} · #{m.objectId} · X: {m.x} · Y: {m.y}</p>
        {/each}
       </div>
      </figure>
     {/if}
     {:else if fe01}<p>{words.retainedId}: {p.retainedIds.join(', ')} · {words.fenceDeleteId}: {p.deletedIds.join(', ')}</p><p>{words.added}: {p.nextObjectId}, {p.nextObjectId+1}, {p.nextObjectId+2}, {p.nextObjectId+3}</p>
     {:else if fenceAdd}<p>{words.x}: {p.x} · {words.y}: {p.y}</p><p>{words.added}: {addedFenceIds.join(', ')}</p>
     {:else if mixedRoad}<p>{words.retainedId}: {p.retainedId} · {words.movedId}: {p.movedId}</p><p>{words.added}: {p.nextObjectId}, {p.nextObjectId+1}, {p.nextObjectId+2}</p>
     {:else}<p>X: {p.x} · Y: {p.y} · {p.orientation}</p>{/if}
     {#if !fe01}<p>{p.oldAmount} → {p.newAmount}</p>{/if}{/if}<p>{detail}</p>
    </div>
   {/if}
   {#if state.phase==='previewed'&&makeup}<button disabled={pending||!valid||p?.makeupItemId!==140100014||p?.slot!==1||p?.field!=='ColorIndex1'||p?.oldColorIndex!==53||p?.newColorIndex!==60||p?.inventoryDelta!==0} on:click={()=>act(w=>w.stage())}>{words.stagePlacement}</button>{/if}
    {#if state.phase==='previewed'&&eye}<button disabled={pending||!valid||p?.eyeballItemId!==70000010||p?.field!=='ColorIndex2'||p?.oldColorIndex!==64||p?.newColorIndex!==69||p?.inventoryDelta!==0} on:click={()=>act(w=>w.stage())}>{words.stagePlacement}</button>{/if}
   {#if !eye&&!makeup}
   {#if state.phase==='previewed'}<button disabled={pending||!valid||(fe01?p?.gridId!==grid||!p?.oldIds?.every((v,i)=>v===oldIds[i]):appearance?(p?.old!==(operation==='hair'?74:170000054)||p?.new!==(operation==='hair'?20:170000000)||(operation==='skin'&&p?.characterId!==10000053)):wardrobe?p?.slot!==0||p?.oldItemId!==50000352||p?.newItemId!==50000214:backpack?p?.sourceSlot!==x||p?.destinationSlot!==y:operation==='comp03'?p?.seedId!==seed:mixedRoad?p?.gridId!==grid||p?.retainedId!==x||p?.movedId!==y:p?.gridId!==grid||p?.x!==x||p?.y!==y)} on:click={()=>act(w=>w.stage())}>{words.stagePlacement}</button>{/if}
   {/if}
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
 .review{display:grid;gap:8px;padding:12px;border:1px solid var(--border);border-radius:10px}
 .spatial-review{margin:0;min-width:0;display:grid;gap:8px}.spatial-review svg{width:100%;max-width:480px;height:auto;border:1px solid var(--border);border-radius:8px;pointer-events:none}.spatial-review circle{fill:var(--surface-raised);stroke:currentColor;stroke-width:1.5;stroke-dasharray:3 2}.spatial-review circle.retained{stroke-width:2.5;stroke-dasharray:none}.spatial-review text{fill:currentColor;font-size:14px;font-weight:600}.anchor-list{display:grid;gap:4px;font-size:.875rem;overflow-wrap:anywhere}
 p,h2{margin:0}code{overflow-wrap:anywhere}.placement button:focus-visible,.placement input:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
</style>
