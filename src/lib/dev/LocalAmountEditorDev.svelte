<script>
  // DEV-ONLY local module, intentionally NOT imported by any public route.
  // The trusted Worker adapter must be supplied by a future accepted local
  // harness; never create a second Rust reader or load public read-only WASM
  // as a semantic writer. PR929 QA-C/QA-L acceptance is a separate gate.
  import {onMount,tick} from 'svelte';
  import {locale} from '$lib/i18n/runtime.js';
  import {localAmountCopy} from './local-amount-copy.mjs';
  import {createLocalAmountDevWorkflow,STEAM626_FULL_VERSION} from './local-amount-workflow.mjs';

  export let trustedWorkerAdapter=null;
  export let verifiedLocalDevGate=false;
  let workflow=null,available=false,pending=false,error=false;
  let file=null,sourceSha='',buildConfirmed=false,newAmount='';
  let chosen=0,focusTarget=null,fileInput=null,uiEpoch=0;
  let state={phase:'closed',targets:[],preview:null,editedCopy:null,backupVerified:false};
  $: words=localAmountCopy($locale);
  $: openable=available&&!pending&&file!==null&&
    /^[0-9a-f]{64}$/.test(sourceSha)&&buildConfirmed;
  $: current=state.targets?.[chosen]||null;
  $: validDecrease=current&&/^[1-9][0-9]*$/.test(newAmount)&&
    Number.isSafeInteger(Number(newAmount))&&
    Number(newAmount)>0&&Number(newAmount)<current.oldAmount;
  $: phase=state.phase;
  onMount(()=>{
    // Compile-time Vite guard plus explicit trusted capability. DEV/OFF here
    // never means Owner has authorized PRODUCT_OPERATION_ENABLED or Writer ON.
    if(!import.meta.env.DEV||verifiedLocalDevGate!==true||!trustedWorkerAdapter)return;
    try{
      workflow=createLocalAmountDevWorkflow(trustedWorkerAdapter,{trustedLocalHarness:true});
      available=true;state=workflow.snapshot();
    }catch{available=false}
    return ()=>{++uiEpoch;const active=workflow;workflow=null;available=false;
      if(active)void active.close()};
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
    }catch{
      if(workflow===active&&token===uiEpoch){error=true;state=active.snapshot()}
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
    file,fullVersion:STEAM626_FULL_VERSION,originalSha256:sourceSha,
    buildConfirmed
  }));
  const backup=()=>act(()=>workflow.backupAndRead());
  const stage=()=>act(()=>workflow.stage(chosen,Number(newAmount)));
  const undo=()=>act(()=>workflow.undo());
  const redo=()=>act(()=>workflow.redo());
  const exportCopy=()=>act(()=>workflow.exportEditedCopy());
  async function downloadCopy(which){
    if(!workflow||pending)return;
    const active=workflow;
    pending=true;error=false;
    try{
      const result=await active.downloadVerifiedCopy(which);
      if(workflow!==active||active.snapshot().phase==='closed')return;
      const url=URL.createObjectURL(new Blob([result.encryptedBytes],{type:'application/octet-stream'}));
      try{
        const a=document.createElement('a');a.href=url;a.download=result.name;
        document.body.appendChild(a);
        try{a.click()}finally{a.remove()}
      }finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
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

<details class="dev-amount-editor" data-dev-amount-editor data-product-writer="off"
 data-public-route="off" data-cloud="off" data-original-overwrite="off">
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
        <label for="dev-amount-sha">{words.sha}</label>
        <input id="dev-amount-sha" type="text" maxlength="64" pattern="[a-f0-9]{64}"
          spellcheck="false" autocapitalize="off" autocomplete="off"
          bind:value={sourceSha} disabled={pending}/>
        <p>{words.build}: <code>{STEAM626_FULL_VERSION}</code> · schema 626</p>
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
            disabled={pending||phase!=='ready'}>
            {#each state.targets as t,i}
              <option value={i}>{t.kind==='InventoryExistingAmountDecrease'?'Inventory':'Chest'} ·
                {t.itemId} · {words.before} {t.oldAmount}</option>
            {/each}
          </select>
          <label for="dev-amount-new">{words.newAmount}</label>
          <input id="dev-amount-new" type="number" min="1"
            max={Math.max(1,(current?.oldAmount||1)-1)}
            step="1" inputmode="numeric" bind:value={newAmount} disabled={pending||phase!=='ready'}/>
          {#if phase==='ready'}
            <button type="button" data-dev-stage on:click={stage}
              disabled={pending||!validDecrease}>{words.stage}</button>
          {/if}
          {#if state.preview}
            <div class="preview" data-dev-preview aria-live="polite">
              <strong>{words.preview}</strong>
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
