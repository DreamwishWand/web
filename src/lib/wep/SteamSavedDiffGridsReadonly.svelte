<script>
  import {onMount,tick} from 'svelte';
  import {locale} from '$lib/i18n/runtime.js';
  import {base} from '$app/paths';
  export let preformal=false;
  import {savedDiffGridsCopy} from './steam-saved-diffgrids-copy.mjs';
  import {createSavedDiffGridsUiClient,STEAM_FULL_VERSION} from './steam-saved-diffgrids-ui-client.mjs';
  let client=null,ready=false,busy=false,opened=false,error=false;
  let chosenFile=null,originalSha='',buildConfirmed=false;
  let count=null,rows=[],page=0,hasNext=false;
  let disclosure=null,fileInput=null,closing=false,epoch=0;
  const current=token=>token===epoch&&client!==null;
  $: words=savedDiffGridsCopy($locale);
  $: valid=ready&&!busy&&!opened&&chosenFile!==null&&
    /^[a-f0-9]{64}$/.test(originalSha)&&buildConfirmed;
  $: message=!ready?words.unavailable:
    busy?(opened?words.reading:words.opening):
    error?words.error:
    !opened?words.ready:
    (count===0?words.zero:words.count+' '+count);
  onMount(()=>{
    // The ordinary Timing panel remains OFF; only the dedicated route
    // instantiates the existing Steam Worker. This is UI isolation, not
    // a trust grant: the Worker verifies its signed anchor and typed facade.
    if(!preformal||location.pathname!==base+'/editor/steam-reader/')return;
    const factory=()=>new Worker(
      new URL('./steam-saved-diffgrids.consumer.worker.ts',import.meta.url),
      {type:'module',name:'wand-steam-diffgrids-readonly'}
    );
    client=createSavedDiffGridsUiClient(factory);
    client.start(state=>{
      ready=state.ready===true;
      if(!ready){epoch++;resetResults();resetSelection();busy=false;closing=false}
    });
    return ()=>{epoch++;client?.dispose();client=null;ready=false};
  });
  function resetResults(){
    opened=false;rows=[];page=0;count=null;hasNext=false;
  }
  function resetSelection(){
    chosenFile=null;originalSha='';buildConfirmed=false;
    if(fileInput)fileInput.value='';
  }
  async function clear(reset=false,focus=false){
    if(closing)return;
    const token=++epoch;
    closing=true;busy=true;resetResults();
    if(reset){resetSelection();error=false}
    try{await client?.close()}catch{ /* no trusted receipt survives */ }
    finally{
      if(current(token)){
        closing=false;busy=false;
        if(focus){await tick();if(current(token))disclosure?.focus()}
      }
    }
  }
  async function selectFile(event){
    if(busy||closing||!ready)return;
    const file=event.currentTarget.files?.[0]||null;
    chosenFile=file;originalSha='';buildConfirmed=false;error=false;
    if(opened)await clear();
  }
  async function openReadOnly(){
    if(!valid||busy||closing||opened||!client)return;
    const token=++epoch,file=chosenFile,sha=originalSha;
    error=false;busy=true;resetResults();
    try{
      const receipt=await client.open(file,sha,true);
      if(!current(token))return;
      if(!receipt||receipt.writerAuthorized!==false)throw Error('DENIED');
      count=receipt.recordCount;opened=true;
      if(count>0)await loadPage(token);
    }catch{
      if(current(token)){error=true;await clear()}
    }finally{if(current(token))busy=false}
  }
  async function loadPage(token){
    const result=await client.readNext();
    if(!current(token))return;
    rows=result.records;page=result.pageIndex+1;hasNext=result.hasNext;
  }
  async function nextPage(){
    if(!client||!opened||busy||closing)return;
    const token=++epoch;
    busy=true;error=false;
    try{await loadPage(token)}
    catch{if(current(token)){error=true;await clear()}}
    finally{if(current(token))busy=false}
  }
  async function closeSession(){
    if(closing||(!opened&&!busy))return;
    await clear(true,true);
  }
</script>

<!-- Dedicated Reader is immediately visible; optional Timing disclosure stays closed. -->
<details open={preformal} class="diffgrids-readonly" data-steam-diffgrids-readonly data-writer="off"
 data-cloud="off" data-product-read="off" data-preformal-read={preformal?'scoped':'off'}>
  <summary bind:this={disclosure} data-diffgrids-summary>{words.title} · {words.subtitle}</summary>
  <div class="content">
    <p>{words.intro}</p>
    {#if !preformal}<p><a data-sveltekit-reload href={base+'/editor/steam-reader/'}>{words.preformal}</a></p>{/if}
    <p role="status" aria-live="polite" data-diffgrids-status>{message}</p>
    {#if ready}
      <div class="controls" data-diffgrids-manual-only>
        <label for="steam-diffgrids-file">{words.file}</label>
        <input id="steam-diffgrids-file" type="file" accept=".p1g,application/octet-stream"
          bind:this={fileInput} disabled={busy} on:change={selectFile}/>
        <label for="steam-diffgrids-sha">{words.sha}</label>
        <input id="steam-diffgrids-sha" type="text" spellcheck="false" autocapitalize="off"
          autocomplete="off" maxlength="64" pattern="[a-f0-9]{64}"
          disabled={busy} bind:value={originalSha}/>
        <p>{words.version}: <code>{STEAM_FULL_VERSION}</code> · schema 626</p>
        <label class="confirmation">
          <input type="checkbox" disabled={busy} bind:checked={buildConfirmed}/>
          <span>{words.confirm}</span>
        </label>
        <div class="actions">
          <button type="button" on:click={openReadOnly}
            disabled={!valid} data-diffgrids-open>{words.open}</button>
          <button type="button" on:click={closeSession} disabled={closing||(!opened&&!busy)}
            data-diffgrids-close>{words.close}</button>
        </div>
      </div>
    {/if}
    {#if error}<p role="alert" data-diffgrids-error>{words.error}</p>{/if}
    {#if opened}
      <div class="results" data-diffgrids-count={count} data-diffgrids-page={page}>
        <p role="status">{words.count}: <strong>{count}</strong>
          {#if count>0} · {words.page} {page}{/if}</p>
        {#if rows.length}
          <div class="table-scroller" tabindex="0" role="region" aria-label={words.title}>
            <table>
              <thead><tr>
                <th scope="col">{words.gridId}</th>
                <th scope="col">{words.modified}</th>
                <th scope="col">{words.removed}</th>
                <th scope="col">{words.overlap}</th>
                <th scope="col">{words.layout}</th>
              </tr></thead>
              <tbody>{#each rows as row}
                <tr><th scope="row">{row.gridId}</th>
                  <td>{row.modifiedObjectCount}</td>
                  <td>{row.removedObjectCount}</td>
                  <td>{row.modifiedRemovedSameIdPairs}</td>
                  <td>{words.unresolved}</td>
                </tr>
              {/each}</tbody>
            </table>
          </div>
        {:else if count===0}<p>{words.zero}</p>{/if}
        {#if hasNext}
          <button type="button" disabled={busy} on:click={nextPage}
            data-diffgrids-next>{words.next}</button>
        {/if}
      </div>
    {/if}
    <p class="safety">{words.safety}</p>
    <p class="safety">{words.off}</p>
  </div>
</details>

<style>
  /* app.css gives html/body min-width:320px. Under root zoom:2 that
     becomes 640 physical px, even in a 320px viewport. Remove only on
     the Timing route containing this optional panel; never clip a page. */
  :global(html:has([data-steam-diffgrids-readonly])),
  :global(body:has([data-steam-diffgrids-readonly])){min-width:0}
  .diffgrids-readonly{box-sizing:border-box;width:100%;min-width:0;max-width:100%;margin:16px 0;
    border:1px solid var(--border);border-radius:14px;
    background:var(--surface);color:var(--ink);overflow:hidden}
  summary{box-sizing:border-box;min-width:0;max-width:100%;cursor:pointer;padding:14px 18px;font-weight:750;line-height:1.55;
    color:var(--ink);overflow-wrap:anywhere}
  summary:focus-visible,button:focus-visible,input:focus-visible,
  .table-scroller:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .content{box-sizing:border-box;display:grid;gap:12px;padding:0 18px 18px;min-width:0;max-width:100%;
    overflow-wrap:anywhere;font-size:clamp(12px,1rem,16px);line-height:1.55}
  p{margin:0;overflow-wrap:anywhere}
  .controls{display:grid;gap:9px;min-width:0;max-width:100%}
  input[type="text"],input[type="file"]{box-sizing:border-box;min-width:0;
    max-width:100%;width:100%;padding:10px;border:1px solid var(--border);
    background:var(--surface-raised);color:var(--ink);border-radius:8px}
  .confirmation{display:flex;gap:8px;align-items:start;overflow-wrap:anywhere}
  .confirmation input{margin-top:4px;flex-shrink:0}
  .actions{display:flex;gap:10px;flex-wrap:wrap}
  button{cursor:pointer;padding:10px 14px;min-height:40px;
    background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);
    border-radius:9px;font:inherit}
  button:disabled{opacity:.48;cursor:not-allowed}
  .results{box-sizing:border-box;display:grid;gap:12px;min-width:0;max-width:100%}
  .table-scroller{box-sizing:border-box;width:100%;min-width:0;max-width:100%;overflow-x:auto}
  table{width:100%;border-collapse:collapse;min-width:370px;text-align:start}
  th,td{padding:8px;border-bottom:1px solid var(--border);text-align:start}
  th{font-weight:650}
  .safety{color:var(--ink-muted)}
  code{overflow-wrap:anywhere;word-break:break-all}
  @media(max-width:350px){.content{padding-inline:12px}.actions button{width:100%}}
</style>
