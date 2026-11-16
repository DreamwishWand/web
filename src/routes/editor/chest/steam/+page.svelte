<script>
 import {onMount} from 'svelte';
 import {locale} from '$lib/i18n/runtime.js';
 import LocalAmountEditorDev from '$lib/dev/LocalAmountEditorDev.svelte';
 import {localAmountCopy} from '$lib/dev/local-amount-copy.mjs';
 import {createProductSteamChestPort,productSteamChestPortScope} from '$lib/dev/product-steam-chest-client.mjs';
 let adapter=null,scope=null;
 $: words=localAmountCopy($locale,false,scope?.mode||'',true);
 onMount(()=>{
  const abort=new AbortController();
  const clear=()=>{const a=adapter;adapter=null;scope=null;a?.dispose()};
  void createProductSteamChestPort({signal:abort.signal,onFault:clear}).then(a=>{
   if(abort.signal.aborted){a.dispose();return}
   adapter=a;scope=productSteamChestPortScope(a);
  }).catch(()=>clear());
  return ()=>{abort.abort();clear()};
 });
</script>
<svelte:head><title>{words.title} | Dreamwish Wand</title><meta name="robots" content="noindex,follow"/></svelte:head>
<section class="container steam-chest-product" data-steam-chest-product-route data-steam-chest-scope={scope?.mode||'off'}>
 <p class="eyebrow">EDITOR / CHEST / STEAM</p>
 {#if adapter&&scope}
  <LocalAmountEditorDev trustedWorkerAdapter={adapter}/>
 {:else}
  <h1>{words.title}</h1><p role="status">{words.waiting}</p>
 {/if}
</section>
<style>
 .steam-chest-product{box-sizing:border-box;padding-block:48px 90px;min-height:68vh;min-width:0;max-width:100%;overflow-wrap:anywhere}
 h1{font:500 clamp(28px,5vw,50px) Georgia,serif}
</style>
