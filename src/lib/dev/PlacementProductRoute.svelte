<script>
 import {onMount} from 'svelte';
 import {locale} from '$lib/i18n/runtime.js';
 import {localPlacementCopy} from './local-placement-copy.mjs';
 import LocalPlacementEditorDev from './LocalPlacementEditorDev.svelte';
 import {createComp03ReviewPort} from './comp03-product-route-port.mjs';
 import {createProductVaseAddPort,createProductSr03Port,createProductRm01Port,createProductFrp01Port,createProductSteamBackpackPort,createProductSwitchBackpackPort,createProductSteamWardrobePort,createProductSwitchWardrobePort,createProductHairPort,createProductSkinPort,productPlacementPortScope} from './product-placement-client.mjs';
 export let fixedOperation='comp03';
 let port=null,scope=null;
 $: words=localPlacementCopy($locale);
 $: title=(fixedOperation==='frp01'?words.frp01Title:fixedOperation==='hair'?words.hairTitle:fixedOperation==='skin'?words.skinTitle:fixedOperation==='comp03'?words.compTitle:fixedOperation==='vase'?words.vaseTitle:fixedOperation==='sr03'?words.sr03Title:fixedOperation==='rm01'?words.rm01Title:fixedOperation==='backpack-steam'?words.backpackSteamTitle:fixedOperation==='backpack-switch'?words.backpackSwitchTitle:fixedOperation==='wardrobe-steam'?words.wardrobeSteamTitle:words.wardrobeSwitchTitle).split(' — ')[0];
 onMount(()=>{
  const abort=new AbortController(),create=({hair:createProductHairPort,skin:createProductSkinPort,comp03:createComp03ReviewPort,vase:createProductVaseAddPort,'backpack-steam':createProductSteamBackpackPort,'backpack-switch':createProductSwitchBackpackPort,'wardrobe-steam':createProductSteamWardrobePort,'wardrobe-switch':createProductSwitchWardrobePort,sr03:createProductSr03Port,rm01:createProductRm01Port,frp01:createProductFrp01Port})[fixedOperation];
  if(!create)return;
  const clear=()=>{const p=port;port=null;scope=null;p?.dispose()};
  void create({signal:abort.signal,onFault:clear}).then(p=>{if(abort.signal.aborted){p.dispose();return}port=p;scope=productPlacementPortScope(p)}).catch(clear);
  return ()=>{abort.abort();clear()};
 });
</script>
<svelte:head><title>{title} | Dreamwish Wand</title><meta name="robots" content="noindex,follow"/></svelte:head>
<section class="container placement-product" data-placement-product-route={fixedOperation} data-placement-scope={scope?.mode||'off'}>
 <p class="eyebrow">EDITOR / {['hair','skin'].includes(fixedOperation)?'APPEARANCE':fixedOperation.startsWith('backpack-')?'BACKPACK':fixedOperation.startsWith('wardrobe-')?'WARDROBE':'WORLD'} / DATA EDITOR</p>
 {#if port&&scope}<LocalPlacementEditorDev trustedWorkerAdapter={port} {fixedOperation}/>
 {:else}<h1>{title}</h1><p role="status">{words.off}</p>{/if}
</section>
<style>.placement-product{padding-block:48px 90px;min-height:68vh;min-width:0;max-width:100%;overflow-wrap:anywhere}h1{font:500 clamp(28px,5vw,50px) Georgia,serif}</style>
