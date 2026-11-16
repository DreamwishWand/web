<script>
 import {onMount} from 'svelte';
 import {locale} from '$lib/i18n/runtime.js';
 import {localPlacementCopy} from './local-placement-copy.mjs';
 import LocalPlacementEditorDev from './LocalPlacementEditorDev.svelte';
 import {createProductComp03Port,createProductVaseAddPort,productPlacementPortScope} from './product-placement-client.mjs';
 export let fixedOperation='comp03';
 let port=null,scope=null;
 $: words=localPlacementCopy($locale);
 $: title=(fixedOperation==='comp03'?words.compTitle:words.vaseTitle).split(' — ')[0];
 onMount(()=>{
  const abort=new AbortController(),create=fixedOperation==='comp03'?createProductComp03Port:createProductVaseAddPort;
  const clear=()=>{const p=port;port=null;scope=null;p?.dispose()};
  void create({signal:abort.signal,onFault:clear}).then(p=>{if(abort.signal.aborted){p.dispose();return}port=p;scope=productPlacementPortScope(p)}).catch(clear);
  return ()=>{abort.abort();clear()};
 });
</script>
<svelte:head><title>{title} | Dreamwish Wand</title><meta name="robots" content="noindex,follow"/></svelte:head>
<section class="container placement-product" data-placement-product-route={fixedOperation} data-placement-scope={scope?.mode||'off'}>
 <p class="eyebrow">EDITOR / WORLD / DATA EDITOR</p>
 {#if port&&scope}<LocalPlacementEditorDev trustedWorkerAdapter={port} {fixedOperation}/>
 {:else}<h1>{title}</h1><p role="status">{words.off}</p>{/if}
</section>
<style>.placement-product{padding-block:48px 90px;min-height:68vh;min-width:0;max-width:100%;overflow-wrap:anywhere}h1{font:500 clamp(28px,5vw,50px) Georgia,serif}</style>
