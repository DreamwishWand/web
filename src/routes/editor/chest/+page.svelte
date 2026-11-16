<script>
 import {onMount} from 'svelte';
 import {locale} from '$lib/i18n/runtime.js';
 import LocalAmountEditorDev from '$lib/dev/LocalAmountEditorDev.svelte';
 import {localAmountCopy} from '$lib/dev/local-amount-copy.mjs';
 import {createProductSwitchChestPort,productSwitchChestPortScope} from '$lib/dev/product-switch-chest-client.mjs';
 let adapter=null,scope=null;
 $: words=localAmountCopy($locale,true,scope?.mode||'');
 onMount(()=>{
  const abort=new AbortController();
  const clear=()=>{const a=adapter;adapter=null;scope=null;a?.dispose()};
  void createProductSwitchChestPort({signal:abort.signal,onFault:clear}).then(a=>{
   if(abort.signal.aborted){a.dispose();return}
   adapter=a;scope=productSwitchChestPortScope(a);
  }).catch(()=>clear());
  return ()=>{abort.abort();clear()};
 });
</script>
<svelte:head><title>{words.title} | Dreamwish Wand</title><meta name="robots" content="noindex,follow"/></svelte:head>
<section class="container switch-chest-product" data-switch-chest-product-route data-switch-chest-scope={scope?.mode||'off'}>
 <p class="eyebrow">EDITOR / CHEST / SWITCH</p>
 {#if adapter&&scope}
  <LocalAmountEditorDev trustedWorkerAdapter={adapter}/>
 {:else}
  <h1>{words.title}</h1><p role="status">{words.waiting}</p>
 {/if}
</section>
<style>
 .switch-chest-product{box-sizing:border-box;padding-block:48px 90px;min-height:68vh;min-width:0;max-width:100%;overflow-wrap:anywhere}
 h1{font:500 clamp(28px,5vw,50px) Georgia,serif}
</style>
