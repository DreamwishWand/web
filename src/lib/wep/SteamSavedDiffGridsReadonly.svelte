<script>
  import {onMount,tick} from 'svelte';
  import {locale} from '$lib/i18n/runtime.js';
  import {savedDiffGridsCopy} from './steam-saved-diffgrids-copy.mjs';
  import {createSavedDiffGridsUiClient,STEAM_FULL_VERSION} from './steam-saved-diffgrids-ui-client.mjs';
  let client=null,ready=false,busy=false,opened=false,error=false;
  let chosenFile=null,originalSha='',buildConfirmed=false;
  let count=null,rows=[],page=0,hasNext=false;
  let openButton=null;
  $: words=savedDiffGridsCopy($locale);
  $: valid=ready&&!busy&&chosenFile!==null&&
    /^[a-f0-9]{64}$/.test(originalSha)&&buildConfirmed;
  $: message=!ready?words.unavailable:
    busy?(opened?words.reading:words.opening):
    error?words.error:
    !opened?words.ready:
    (count===0?words.zero:words.count+' '+count);
  onMount(()=>{
    const factory=()=>new Worker(
      new URL('./steam-saved-diffgrids.consumer.worker.ts',import.meta.url),
      {type:'module',name:'wand-steam-diffgrids-readonly'}
    );
    client=createSavedDiffGridsUiClient(factory);
    client.start(state=>{ready=state.ready===true; if(!ready){opened=false;rows=[];count=null}});
    return ()=>{client?.dispose();client=null;ready=false};
  });
  function selectFile(event){
    chosenFile=event.currentTarget.files?.[0]||null;
    originalSha='';buildConfirmed=false;error=false;
    if(opened)void clear();
  }
  async function clear(){
    opened=false;rows=[];page=0;count=null;hasNext=false;
    busy=false;
    try{await client?.close()}catch{ /* no trusted receipt survives */ }
  }
  async function openReadOnly(){
    if(!valid||!client)return;
    const file=chosenFile;
    error=false;busy=true;rows=[];opened=false;count=null;hasNext=false;
    try{
      const receipt=await client.open(file,originalSha,true);
      if(!receipt||receipt.writerAuthorized!==false)throw Error('DENIED');
      count=receipt.recordCount;opened=true;
      if(count>0)await nextPage();
    }catch{
      error=true;await clear();
    }finally{busy=false}
  }
  async function nextPage(){
    if(!client||!opened)return;
    busy=true;error=false;
    try{
      const result=await client.readNext();
      rows=result.records;page=result.pageIndex+1;hasNext=result.hasNext;
    }catch{
      await clear();error=true;
    }finally{busy=false}
  }
  async function closeSession(){
    await clear();
    chosenFile=null;originalSha='';buildConfirmed=false;
    await tick();openButton?.focus();
  }
</script>

<details class="diffgrids-readonly" data-steam-diffgrids-readonly data-writer="off"
 data-cloud="off" data-product-read="off">
  <summary>{words.title} · {words.subtitle}</summary>
  <div class="content">
    <p>{words.intro}</p>
    <p role="status" aria-live="polite" data-diffgrids-status>{message}</p>
    {#if ready}
      <div class="controls" data-diffgrids-manual-only>
        <label for="steam-diffgrids-file">{words.file}</label>
        <input id="steam-diffgrids-file" type="file" accept=".p1g,application/octet-stream"
          disabled={busy} on:change={selectFile}/>
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
          <button type="button" bind:this={openButton} on:click={openReadOnly}
            disabled={!valid} data-diffgrids-open>{words.open}</button>
          <button type="button" on:click={closeSession} disabled={!opened&&!busy}
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
  .diffgrids-readonly{box-sizing:border-box;max-width:100%;margin:16px 0;
    border:1px solid var(--border);border-radius:14px;
    background:var(--surface);color:var(--ink);overflow:hidden}
  summary{cursor:pointer;padding:14px 18px;font-weight:750;line-height:1.55;
    color:var(--ink);overflow-wrap:anywhere}
  summary:focus-visible,button:focus-visible,input:focus-visible,
  .table-scroller:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .content{display:grid;gap:12px;padding:0 18px 18px;min-width:0;
    overflow-wrap:anywhere;font-size:clamp(12px,1rem,16px);line-height:1.55}
  p{margin:0;overflow-wrap:anywhere}
  .controls{display:grid;gap:9px;min-width:0}
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
  .results{display:grid;gap:12px;min-width:0}
  .table-scroller{max-width:100%;overflow-x:auto}
  table{width:100%;border-collapse:collapse;min-width:370px;text-align:start}
  th,td{padding:8px;border-bottom:1px solid var(--border);text-align:start}
  th{font-weight:650}
  .safety{color:var(--ink-muted)}
  code{overflow-wrap:anywhere;word-break:break-all}
  @media(max-width:350px){.content{padding-inline:12px}.actions button{width:100%}}
</style>
