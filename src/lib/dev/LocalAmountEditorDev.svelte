<script>
  // DEV-ONLY local module, intentionally NOT imported by any public route.
  // The trusted Worker adapter must be supplied by a future accepted local
  // harness; never create a second Rust reader or load public read-only WASM
  // as a semantic writer. PR929 QA-C/QA-L acceptance is a separate gate.
  import {onMount,tick} from 'svelte';
  import {locale} from '$lib/i18n/runtime.js';
  import {localAmountCopy,localAmountTargetLabel} from './local-amount-copy.mjs';
  import {consumeVerifiedAmountDownloadBytes} from './consume-verified-amount-download-bytes.mjs';
  import {productSwitchChestPortScope} from './product-switch-chest-client.mjs';
  import {productSteamChestPortScope} from './product-steam-chest-client.mjs';
  import {productSwitchCatalog0PortScope} from './product-switch-catalog0-client.mjs';
  import {createLocalAmountDevWorkflow,STEAM626_FULL_VERSION,SWITCH626_CHEST_BID} from './local-amount-workflow.mjs';
  import {acceptedProductAmountReleaseV2Evidence} from './product-amount-release-v2-evidence.mjs';

  export let trustedWorkerAdapter=null;
  export let verifiedLocalDevGate=false;
  // Trusted caller fixes this scope at mount; no user-editable mode selector.
  export let scopedExactOne=false;
  // Trusted mount fixes the exact Switch Build; no user-selectable ABI.
  export let scopedSwitch626Chest=false;
  let exactOne=false,switchChest=false,steamChest=false,switchCatalog0=false,productMode='';
  let workflow=null,available=false,pending=false,error=false;
  let file=null,sourceSha='',buildConfirmed=false,newAmount='';
  let chosen=0,focusTarget=null,fileInput=null,uiEpoch=0;
  let state={phase:'closed',targets:[],preview:null,editedCopy:null,backupVerified:false};
  $: words=localAmountCopy($locale,switchChest,productMode,steamChest,switchCatalog0);
  $: openable=available&&!pending&&file!==null&&
    /^[0-9a-f]{64}$/.test(sourceSha)&&buildConfirmed;
  $: current=state.targets?.[chosen]||null;
  $: proposedAmount=exactOne&&current?current.oldAmount-1:Number(newAmount);
  $: validDecrease=current&&(exactOne||/^[1-9][0-9]*$/.test(newAmount))&&
    Number.isSafeInteger(proposedAmount)&&proposedAmount>0&&proposedAmount<current.oldAmount;
  $: phase=state.phase;
  onMount(()=>{
    // Compile-time Vite guard plus explicit trusted capability. DEV/OFF here
    // never means Owner has authorized PRODUCT_OPERATION_ENABLED or Writer ON.
    const switchScope=productSwitchChestPortScope(trustedWorkerAdapter),steamScope=productSteamChestPortScope(trustedWorkerAdapter);
    const catalogScope=productSwitchCatalog0PortScope(trustedWorkerAdapter);
    const productScope=switchScope||steamScope||catalogScope;
    if(!productScope&&(!import.meta.env.DEV||verifiedLocalDevGate!==true||!trustedWorkerAdapter))return;
    // Scope is taken only from the protected loader's WeakMap-branded Port,
    // never a caller's release claim. Browser Worker != independent OS process.
    const signedEvidence=productScope?acceptedProductAmountReleaseV2Evidence(productScope,
      steamScope?'steam-chest':catalogScope?'switch-catalog0':'switch-chest'):null;
    if(productScope?.mode==='public-accepted'&&!signedEvidence)return;
    try{
      productMode=productScope?.mode||'';
      steamChest=!!steamScope;switchCatalog0=!!catalogScope;
      switchChest=!!switchScope||(!steamChest&&!switchCatalog0&&scopedSwitch626Chest===true);
      exactOne=switchChest||steamChest||switchCatalog0||scopedExactOne===true;
      workflow=createLocalAmountDevWorkflow(trustedWorkerAdapter,{trustedLocalHarness:true,exactOneDecrease:exactOne,switch626Chest:switchChest,steam626Chest:steamChest,switch626Catalog0:switchCatalog0,
         // Private/product scope without a signed accepted Build stays denied.
         // Public release evidence is independently OS-reopened at QA; the
         // browser receipt remains a truthful fresh-Worker-only result.
         requireIndependentProcessReopen:!!productScope,
         publicSignedV2Evidence:signedEvidence});
      available=true;state=workflow.snapshot();
    }catch{available=false}
    return ()=>{++uiEpoch;const active=workflow;workflow=null;available=false;
      if(active)void active.close().catch(()=>{})};
  });
  function resetInput(){
    file=null;sourceSha='';buildConfirmed=false;newAmount='';chosen=0;
    if(fileInput)fileInput.value='';
  }
  async function chooseFile(e){
    const input=e.currentTarget,f=input.files?.[0]||null;
    input.value=''; // Native selection of the same original must work again.
    if(!workflow||pending)return;
    const active=workflow,token=++uiEpoch;
    pending=true;error=false;resetInput();
    // close() revokes the old workflow synchronously before its Worker await.
    // Do not permit a new open or display an old result during that barrier.
    try{
      const closing=active.close();
      state=active.snapshot();
      const v=await closing;
      if(workflow!==active||token!==uiEpoch)return;
      state=v;file=f;
      if((switchChest||steamChest||switchCatalog0)&&f){
        if(f.size<1||f.size>128*1024*1024||!f.name.toLowerCase().endsWith('.p1g'))throw Error('FILE_DENIED');
        const bytes=new Uint8Array(await Blob.prototype.arrayBuffer.call(f));
        try{
          const digest=await crypto.subtle.digest('SHA-256',bytes);
          if(workflow!==active||token!==uiEpoch)return;
          sourceSha=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
        }finally{bytes.fill(0)}
      }
    }catch{
      if(workflow===active&&token===uiEpoch){resetInput();error=true;state=active.snapshot()}
    }finally{if(workflow===active&&token===uiEpoch)pending=false}
  }
  async function act(operation){
    if(!workflow||pending)return;
    const active=workflow,token=uiEpoch;
    pending=true;error=false;
    try{
      const v=await operation();
      if(workflow===active&&token===uiEpoch)state=v;
    }catch{
      if(workflow===active&&token===uiEpoch){error=true;state=active.snapshot()}
      // Never display a raw Rust/Worker stack or private paths/IDs.
    }finally{if(workflow===active&&token===uiEpoch)pending=false}
  }
  const open=()=>act(()=>workflow.open({
    file,...((switchChest||switchCatalog0)?{switchBid:SWITCH626_CHEST_BID}:{fullVersion:STEAM626_FULL_VERSION}),originalSha256:sourceSha,
    buildConfirmed
  }));
  const backup=()=>act(()=>workflow.backupAndRead());
  const stage=()=>act(()=>workflow.stage(chosen,proposedAmount));
  const undo=()=>act(()=>workflow.undo());
  const redo=()=>act(()=>workflow.redo());
  const exportCopy=()=>act(()=>workflow.exportEditedCopy());
  async function downloadCopy(which){
    if(!workflow||pending)return;
    const active=workflow;
    pending=true;error=false;
    try{
      const result=await active.downloadVerifiedCopy(which);
      // Even when a different File/Session wins the race or DOM/URL creation
      // fails, never retain the original verified-download Uint8Array.
      // The Blob constructor copies the encrypted bytes before zeroization.
      consumeVerifiedAmountDownloadBytes(result.encryptedBytes,bytes=>{
        if(workflow!==active||active.snapshot().phase==='closed')return;
        const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
        try{
          const a=document.createElement('a');a.href=url;a.download=result.name;
          document.body.appendChild(a);
          try{a.click()}finally{a.remove()}
        }finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
      });
    }catch{
      if(workflow===active){error=true;state=active.snapshot()}
    }finally{if(workflow===active)pending=false}
  }
  async function close(){
    if(!workflow||pending)return;
    const active=workflow,token=++uiEpoch;
    pending=true;error=false;resetInput();
    try{
      const closing=active.close();state=active.snapshot();
      const v=await closing;
      if(workflow!==active||token!==uiEpoch)return;
      state=v;
    }catch{if(workflow===active&&token===uiEpoch){error=true;state=active.snapshot()}}
    finally{if(workflow===active&&token===uiEpoch)pending=false}
    await tick();if(workflow===active&&token===uiEpoch)focusTarget?.focus();
  }
</script>

<details open={steamChest||switchCatalog0} class="dev-amount-editor" data-dev-amount-editor data-product-writer="off"
 data-public-route={productMode==='public-accepted'?'on':'off'} data-cloud="off" data-original-overwrite="off">
  <summary bind:this={focusTarget} data-dev-amount-summary>{words.title}</summary>
  <section class="content" aria-label={words.title}>
    <p>{words.intro}</p>
    {#if !available}
      <p role="status" data-dev-disabled>{words.waiting}</p>
    {:else}
      <div class="fields">
        <label for="dev-amount-p1g">{words.file}</label>
        <input id="dev-amount-p1g" type="file" accept=".p1g,application/octet-stream"
          bind:this={fileInput} on:change={chooseFile} disabled={pending}/>
        {#if file&&(switchChest||steamChest||switchCatalog0)&&/^[0-9a-f]{64}$/.test(sourceSha)}
          <!-- The native input is cleared for same-file reselection. The
               verified original stays visible locally until File/Session close. -->
          <p role="status" data-dev-selected-original><strong>{words.file}:</strong>
            <code>{file.name}</code> ({file.size} B)</p>
        {/if}
        <label for="dev-amount-sha">{words.sha}</label>
        <input id="dev-amount-sha" type="text" maxlength="64" pattern="[a-f0-9]{64}"
          spellcheck="false" autocapitalize="off" autocomplete="off"
          bind:value={sourceSha} readonly={switchChest||steamChest||switchCatalog0} disabled={pending}/>
        <p>{words.build}: <code>{switchChest||switchCatalog0?SWITCH626_CHEST_BID:STEAM626_FULL_VERSION}</code> · schema 626</p>
        <label class="check">
          <input type="checkbox" bind:checked={buildConfirmed} disabled={pending}/>
          <span>{words.confirm}</span>
        </label>
      </div>
      <div class="actions">
        {#if phase==='closed'}
          <button type="button" data-dev-open on:click={open} disabled={!openable}>{words.open}</button>
        {:else}
          <button type="button" data-dev-close on:click={close} disabled={pending}>{words.close}</button>
        {/if}
        {#if phase==='opened'}
          <button type="button" data-dev-backup on:click={backup} disabled={pending}>{words.backup}</button>
        {/if}
      </div>
      {#if state.backupVerified}
        <p role="status" data-backup-verified>{words.backupOk}</p>
        <button type="button" data-dev-download-backup on:click={()=>downloadCopy('backup')} disabled={pending}>{words.downloadBackup}</button>
      {/if}
      {#if phase==='ready' || phase==='staged' || phase==='undone'}
        {#if state.targets.length===0}
          <p role="status" data-no-verified-targets>{words.empty}</p>
        {:else}
          <label for="dev-amount-target">{words.target}</label>
          <select id="dev-amount-target" bind:value={chosen}
            aria-describedby={phase==='ready'?'dev-amount-target-review':undefined}
            disabled={pending||phase!=='ready'}>
            {#each state.targets as t,i}
              <option value={i}>{localAmountTargetLabel(t,words)}</option>
            {/each}
          </select>
          <label for="dev-amount-new">{words.newAmount}</label>
          {#if exactOne}
            <input id="dev-amount-new" type="number" value={proposedAmount} readonly
              disabled={pending||phase!=='ready'} data-scoped-exact-one/>
          {:else}
            <input id="dev-amount-new" type="number" min="1"
              max={Math.max(1,(current?.oldAmount||1)-1)}
              step="1" inputmode="numeric" bind:value={newAmount} disabled={pending||phase!=='ready'}/>
          {/if}
          {#if phase==='ready'}
            {#if current}
              <div id="dev-amount-target-review" class="preview" aria-live="polite" data-dev-target-review>
                <strong>{words.review}</strong>
                <p>{localAmountTargetLabel(current,words)}</p>
                {#if validDecrease}<p>{words.before}: {current.oldAmount} → {words.after}: {proposedAmount}</p>{/if}
              </div>
            {/if}
            <button type="button" data-dev-stage on:click={stage}
              disabled={pending||!validDecrease}>{words.stage}</button>
          {/if}
          {#if state.preview}
            <div class="preview" data-dev-preview aria-live="polite">
              <strong>{words.preview}</strong>
              <p>{localAmountTargetLabel(state.targets[state.choice],words)}</p>
              <p>{words.before}: {state.preview.oldAmount} → {words.after}: {state.preview.newAmount}</p>
            </div>
          {/if}
          <div class="actions">
            {#if phase==='staged'}
              <button type="button" data-dev-undo on:click={undo} disabled={pending}>{words.undo}</button>
              <button type="button" data-dev-export on:click={exportCopy} disabled={pending}>{words.export}</button>
            {:else if phase==='undone'}
              <button type="button" data-dev-redo on:click={redo} disabled={pending}>{words.redo}</button>
            {/if}
          </div>
        {/if}
      {/if}
      {#if phase==='exported' && state.editedCopy}
        <p role="status" data-dev-edited-copy>{words.done}</p>
        <p><code>{state.editedCopy.name}</code></p>
        <button type="button" data-dev-download-edited on:click={()=>downloadCopy('edited')} disabled={pending}>{words.downloadEdited}</button>
      {/if}
      {#if error}<p role="alert" data-dev-error>{words.failed}</p>{/if}
    {/if}
    <p class="warning">{words.note}</p>
  </section>
</details>

<style>
  /* Counter app.css html/body 320px minimum only when this isolated
     DEV module is mounted; never hide global horizontal overflow. */
  :global(html:has([data-dev-amount-editor])),
  :global(body:has([data-dev-amount-editor])){min-width:0}
  .dev-amount-editor{box-sizing:border-box;width:100%;max-width:100%;min-width:0;
    margin:16px 0;border:1px solid var(--border);border-radius:14px;background:var(--surface)}
  summary{box-sizing:border-box;max-width:100%;min-width:0;cursor:pointer;
    padding:14px 16px;font-weight:750;overflow-wrap:anywhere}
  summary:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{
    outline:2px solid var(--gold);outline-offset:2px}
  .content{box-sizing:border-box;display:grid;gap:12px;min-width:0;max-width:100%;
    padding:12px 16px 20px;overflow-wrap:anywhere;line-height:1.55}
  .fields{display:grid;min-width:0;max-width:100%;gap:10px}
  input,select,button{box-sizing:border-box;min-width:0;max-width:100%;font:inherit;
    border:1px solid var(--border);color:var(--ink);background:var(--surface-raised);
    border-radius:9px;min-height:42px;padding:10px}
  input[type=file],input[type=text]{width:100%}
  .check{display:flex;align-items:flex-start;gap:10px;overflow-wrap:anywhere}
  .check input{flex-shrink:0;margin-top:4px;min-height:initial}
  .actions{display:flex;flex-wrap:wrap;gap:10px;min-width:0}
  button{cursor:pointer}
  button:disabled{opacity:.5;cursor:not-allowed}
  .preview{box-sizing:border-box;min-width:0;max-width:100%;
    border:1px solid var(--border);border-radius:10px;padding:12px}
  p{margin:0;overflow-wrap:anywhere}
  code{overflow-wrap:anywhere;word-break:break-all}
  .warning{color:var(--ink-muted)}
  @media(max-width:350px){.content{padding-inline:12px}.actions button{width:100%}}
</style>
