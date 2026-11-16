<script>
 import {onMount} from 'svelte';
 import {locale} from '$lib/i18n/runtime.js';
 import {localPlacementCopy} from './local-placement-copy.mjs';
 import {createLocalPlacementDevWorkflow,STEAM626_PLACEMENT_BUILD,SWITCH626_BACKPACK_BUILD} from './local-placement-workflow.mjs';
 import {createProductCatalog0PortablePort,createProductChestPortablePort,createProductSwitchCatalog0PortablePort,createProductSwitchChestPortablePort,productPlacementPortScope} from './product-placement-client.mjs';
 export let fixedOperation='portable-catalog0';
 const labels={
 en:['Catalog0 portable backup / restore','Linked chest portable backup / restore','Capture .wand.json','Restore source (.wand.json)','Same existing target only; decrease by one. No Apply or increase.','Container ID','Slot (0–47)'],
 ja:['Catalog0 ポータブルバックアップ・復元','連結チェストのポータブルバックアップ・復元','.wand.json を作成','復元元 (.wand.json)','同一の既存対象のみ、数量1減少。別対象への適用・増加は不可。','コンテナ ID','スロット (0–47)'],
 fr:['Sauvegarde / restauration Catalog0','Sauvegarde / restauration coffre lié','Créer .wand.json','Source (.wand.json)','Même cible existante, −1 uniquement. Ni transfert ni augmentation.','ID conteneur','Case (0–47)'],
 de:['Catalog0 sichern / wiederherstellen','Verknüpfte Truhe sichern / wiederherstellen','.wand.json erstellen','Quelle (.wand.json)','Nur dasselbe vorhandene Ziel, −1. Kein Übertragen oder Erhöhen.','Container-ID','Platz (0–47)'],
 it:['Backup / ripristino Catalog0','Backup / ripristino baule collegato','Crea .wand.json','Origine (.wand.json)','Solo lo stesso bersaglio esistente, −1. Nessun trasferimento o aumento.','ID contenitore','Slot (0–47)'],
 'es-ES':['Copia / restauración Catalog0','Copia / restauración cofre vinculado','Crear .wand.json','Origen (.wand.json)','Solo mismo destino existente, −1. Sin traslado ni aumento.','ID contenedor','Ranura (0–47)'],
 'zh-CN':['Catalog0 便携备份 / 恢复','关联宝箱便携备份 / 恢复','创建 .wand.json','恢复来源 (.wand.json)','仅相同现有目标，数量减一。不支持转移或增加。','容器 ID','槽位 (0–47)'],
 'pt-BR':['Backup / restauração Catalog0','Backup / restauração baú vinculado','Criar .wand.json','Origem (.wand.json)','Somente mesmo alvo existente, −1. Sem transferência ou aumento.','ID contêiner','Slot (0–47)']};
 let port=null,workflow=null,scope=null,epoch=0,pending=false,error=false,state={phase:'closed',preview:null,backupName:null,editedName:null};
 let file=null,restoreFile=null,previewFile=null,confirmed=false,itemId=null,containerId=null,slotIndex=null;
 $: words=localPlacementCopy($locale);
 $: l=labels[$locale]||labels.en;
 $: sw=fixedOperation.startsWith('portable-switch-');
 $: chest=fixedOperation.endsWith('chest');
 $: title=l[chest?1:0]+' · '+(sw?'Switch626':'Steam626');
 $: selector=chest?{containerId,slotIndex}:{itemId:sw?40000076:itemId};
 $: valid=chest?Number.isSafeInteger(containerId)&&containerId>1&&containerId<=4294967295&&Number.isSafeInteger(slotIndex)&&slotIndex>=0&&slotIndex<48:sw||Number.isSafeInteger(itemId)&&itemId>=40000000&&itemId<50000000;
 $: previewMatches=!!state.preview&&previewFile===restoreFile&&(chest?state.preview.containerId===containerId&&state.preview.slotIndex===slotIndex:state.preview.itemId===selector.itemId);
 onMount(()=>{
  const abort=new AbortController(),create=sw?(chest?createProductSwitchChestPortablePort:createProductSwitchCatalog0PortablePort):(chest?createProductChestPortablePort:createProductCatalog0PortablePort);
  const clear=()=>{++epoch;port?.dispose();port=null;workflow=null;scope=null;state={phase:'closed',preview:null,backupName:null,editedName:null};file=null;restoreFile=null;previewFile=null;confirmed=false;pending=false};
  void create({signal:abort.signal,onFault:clear}).then(p=>{if(abort.signal.aborted){p.dispose();return}const s=productPlacementPortScope(p);if(s?.uiOperation!==fixedOperation){p.dispose();return}port=p;scope=s;workflow=createLocalPlacementDevWorkflow(p,{trustedLocalHarness:true,operation:fixedOperation});state=workflow.snapshot()}).catch(clear);
  return ()=>{abort.abort();clear()};
 });
 async function act(fn){if(!workflow||pending)return;const w=workflow,t=epoch;pending=true;error=false;try{const r=await fn(w);if(workflow===w&&epoch===t)state=r}catch{if(workflow===w&&epoch===t){state=w.snapshot();error=true;previewFile=null}}finally{if(workflow===w&&epoch===t)pending=false}}
 function select(e){file=e.currentTarget.files?.[0]||null;confirmed=false}
 function pickRestore(e){restoreFile=e.currentTarget.files?.[0]||null;previewFile=null}
 function close(){file=null;restoreFile=null;previewFile=null;confirmed=false;itemId=null;containerId=null;slotIndex=null;return act(w=>w.close())}
 function preview(){const f=restoreFile;return act(async w=>{const s=await w.preview(selector,f);previewFile=f;return s})}
 async function download(which){if(!workflow||pending)return;const w=workflow,t=epoch;pending=true;error=false;let bytes;
  try{const r=which==='portable'?await w.capturePortableBackup(selector):await w.downloadVerifiedCopy(which);bytes=which==='portable'?r.portableBytes:r.encryptedBytes;if(workflow!==w||epoch!==t)return;
   const url=URL.createObjectURL(new Blob([bytes],{type:which==='portable'?'application/json':'application/octet-stream'}));try{const a=document.createElement('a');a.href=url;a.download=r.name;document.body.appendChild(a);try{a.click()}finally{a.remove()}}finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
  }catch{if(workflow===w&&epoch===t){state=w.snapshot();error=true}}finally{bytes?.fill(0);if(workflow===w&&epoch===t)pending=false}}
</script>
<svelte:head><title>{title} | Dreamwish Wand</title><meta name="robots" content="noindex,follow"/></svelte:head>
<section class="container portable" data-portable-product-route={fixedOperation} data-placement-scope={scope?.mode||'off'}>
 <p class="eyebrow">EDITOR / BACKUP &amp; RESTORE / {sw?'SWITCH626':'STEAM626'}</p><h1>{title}</h1><p>{sw?words.safety.replaceAll('Steam626','Switch626').replaceAll('Steam','Switch'):words.safety}</p><p>{l[4]}</p>
 {#if !workflow}<p role="status">{words.off}</p>
 {:else}
 <div class="panel" data-portable-editor>
 {#if state.phase==='closed'}
  <label>{words.file}<input type="file" accept=".p1g,application/octet-stream" disabled={pending} on:change={select}/></label>
  <p>{words.platform}: <code>{(sw?SWITCH626_BACKPACK_BUILD:STEAM626_PLACEMENT_BUILD).buildId}</code></p>
  <label class="confirm"><input type="checkbox" bind:checked={confirmed} disabled={pending}/>{words.confirmBuild}</label>
  <button disabled={pending||!file||!confirmed} on:click={()=>act(w=>w.openFile({file,buildConfirmed:confirmed}))}>{words.openFile}</button>
 {:else}
  <button disabled={pending} on:click={close}>{words.close}</button>
  {#if state.phase==='opened'}<button disabled={pending} on:click={()=>act(w=>w.backupOriginal())}>{words.backup}</button>{/if}
  {#if state.backupName}<button disabled={pending} on:click={()=>download('backup')}>{words.downloadBackup}</button>{/if}
  {#if ['ready','previewed'].includes(state.phase)}
   {#if chest}<label>{l[5]}<input type="number" min="2" max="4294967295" step="1" bind:value={containerId} disabled={pending}/></label><label>{l[6]}<input type="number" min="0" max="47" step="1" bind:value={slotIndex} disabled={pending}/></label>
   {:else if sw}<p>Item ID: <code>40000076</code></p>
   {:else}<label>Item ID<input type="number" min="40000000" max="49999999" step="1" bind:value={itemId} disabled={pending}/></label>{/if}
   {#if state.phase==='ready'}<button disabled={pending||!valid} on:click={()=>download('portable')}>{l[2]}</button>{/if}
   <label>{l[3]}<input type="file" accept=".wand.json,application/json" disabled={pending} on:change={pickRestore}/></label>
   <button disabled={pending||!valid||!restoreFile} on:click={preview}>{words.review}</button>
  {/if}
  {#if state.preview}<div aria-live="polite" data-portable-preview><strong>{words.verified}</strong><p>Item ID: {state.preview.itemId}</p><p>{state.preview.oldAmount} → {state.preview.newAmount}</p></div>{/if}
  {#if state.phase==='previewed'}<button disabled={pending||!valid||!previewMatches} on:click={()=>act(w=>w.stage())}>{words.stagePlacement}</button>{/if}
  {#if state.phase==='staged'}<button disabled={pending} on:click={()=>act(w=>w.undo())}>{words.undo}</button><button disabled={pending} on:click={()=>act(w=>w.exportEditedCopy())}>{words.export}</button>{/if}
  {#if state.phase==='undone'}<button disabled={pending} on:click={()=>act(w=>w.redo())}>{words.redo}</button>{/if}
  {#if state.phase==='exported'}<p role="status">{words.done}</p><p><code>{state.editedName}</code></p><button disabled={pending} on:click={()=>download('edited')}>{words.downloadEdited}</button>{/if}
 {/if}
 {#if error}<p role="alert">{state.phase==='close-failed'?words.closeFailed:words.denied}</p>{/if}
 </div>
 {/if}
</section>
<style>.portable{padding-block:48px 90px;min-height:68vh;overflow-wrap:anywhere}.panel{display:grid;gap:12px;padding:16px;border:1px solid var(--border);border-radius:14px}.panel label{display:grid;gap:5px;min-width:0}.panel .confirm{display:flex;gap:8px;align-items:flex-start}.panel input,.panel button{box-sizing:border-box;min-width:0;max-width:100%;padding:10px;font:inherit;border:1px solid var(--border);border-radius:8px;background:var(--surface-raised);color:var(--ink)}.panel button{min-height:44px;cursor:pointer}.panel button:disabled{opacity:.5;cursor:not-allowed}.panel button:focus-visible,.panel input:focus-visible{outline:2px solid var(--gold);outline-offset:2px}h1{font:500 clamp(28px,5vw,50px) Georgia,serif}</style>
