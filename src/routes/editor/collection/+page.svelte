<script>
 import {onMount} from 'svelte';
 import {locale} from '$lib/i18n/runtime.js';
 import {collectionExact1Copy} from '$lib/collection/collection-exact1-copy.mjs';
 import CollectionExact1Dev from '$lib/collection/CollectionExact1Dev.svelte';
 import {createProductCollectionPort,productCollectionPortScope} from '$lib/collection/product-collection-client.mjs';
 let adapter=null,scope=null;
 $: words=collectionExact1Copy($locale);
 onMount(()=>{
  const abort=new AbortController();
  const clear=()=>{const a=adapter;adapter=null;scope=null;a?.dispose()};
  void createProductCollectionPort({signal:abort.signal,onFault:clear}).then(a=>{
   if(abort.signal.aborted){a.dispose();return}
   adapter=a;scope=productCollectionPortScope(a);
  }).catch(()=>clear());
  // Termination revokes the one actual Worker even if Close is pending.
  return ()=>{abort.abort();clear()};
 });
</script>
<svelte:head><title>{words.title} | Dreamwish Wand</title><meta name="robots" content="noindex,follow"/></svelte:head>
<section class="container collection-product" data-collection-product-route data-collection-scope={scope?.mode||'off'}>
 <p class="eyebrow">EDITOR / COLLECTION</p>
 {#if adapter&&scope}
  <CollectionExact1Dev trustedWorkerAdapter={adapter}/>
 {:else}
  <h1>{words.title}</h1><p role="status">{words.off}</p>
 {/if}
</section>
<style>
 .collection-product{box-sizing:border-box;padding-block:48px 90px;min-height:68vh;min-width:0;max-width:100%;overflow-wrap:anywhere}
 h1{font:500 clamp(28px,5vw,50px) Georgia,serif}
</style>
