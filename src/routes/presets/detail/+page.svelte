<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { scenePresetDetailCopy } from '$lib/presets/scene-preset-detail-copy.js';
  import { scenePresetItemsCopy } from '$lib/presets/scene-preset-items-copy.js';
  import { decodeCollectionRecord, loadCollectionRuntime } from '$lib/collection/runtime.js';
  import { callPublicCommunityRpc, createCommunityBrowserClient, getPublicCommunityMedia } from '$lib/community/browser-client';
  import { createPresetCommunityBridge } from '$lib/wep/preset-community-bridge';
  import { buildPublishEnvelope, preflightScene, validatePublishablePreset } from '$lib/wep/scene-preset-runtime';
  import { createScenePresetHandoff, writeWorldEditorHandoff } from '$lib/wep/world-editor-handoff';

  let detail:any=null, mediaUrls:Record<string,string>={}, loading=true, message='', useState='', handoffReady=false;
  let client:any=null, bridge:any=null;
  let collectionIndex:any=null;
  let collectionRowsById=new Map<number,any>();
  $: copy=scenePresetDetailCopy($locale);
  $: itemCopy=scenePresetItemsCopy($locale);
  $: usedItems=detail
    ? Object.entries(detail?.metadata?.wepScene?.itemQuantities??{}).map(([itemId,quantity])=>{
        const numericId=Number(itemId);
        const row=collectionRowsById.get(numericId);
        const decoded=row&&collectionIndex
          ? decodeCollectionRecord(collectionIndex,row,$locale)
          : null;
        return {itemId:numericId,quantity:Number(quantity),label:decoded?.label??(itemCopy.fallback+' '+numericId)};
      })
    : [];

  onMount(async()=>{
    try{
      const workId=new URL(window.location.href).searchParams.get('work')??'';
      if(!workId)throw new Error('PRESET_WORK_ID_REQUIRED');
      detail=await callPublicCommunityRpc('community_get_scene_preset_public_v1',{p_work_id:workId});
      const entries:Array<[string,string]>=[];
      for(const mediaId of (detail?.mediaIds??[]).slice(0,10)){
        try{const media=await getPublicCommunityMedia(String(mediaId));entries.push([String(mediaId),media.signedUrl]);}catch{}
      }
      mediaUrls=Object.fromEntries(entries);
      try{
        const runtime=await loadCollectionRuntime(base);
        collectionIndex=runtime.index;
        collectionRowsById=new Map(runtime.rows.map((row:any)=>[Number(row?.[0]),row]));
      }catch{
        collectionIndex=null;
        collectionRowsById=new Map();
      }
      client=createCommunityBrowserClient();
      if(client)bridge=createPresetCommunityBridge({community:client,hooks:{buildPublishEnvelope,validatePublishablePreset,preflightScene}});
    }catch(error){message=error instanceof Error?error.message:String(error);}
    finally{loading=false;}
  });

  async function savePreset(){
    if(!client?.session||!detail?.presetArtifactId){message=copy.signIn;return;}
    try{await client.command('saveEntity',{targetEntityId:detail.presetArtifactId});message=copy.saved;}
    catch(error){message=error instanceof Error?error.message:String(error);}
  }

  async function prepareWorldEditor(){
    if(!client?.session||!bridge||!detail?.presetArtifactId){useState=copy.signIn;return;}
    useState=copy.preflight;handoffReady=false;
    try{
      await bridge.loadPresetRevision(
        detail.presetArtifactId,
        detail.presetRevisionId,
        {
          expectedChecksumSha256:detail.checksumSha256,
          expectedByteSize:detail.byteSize
        }
      );
      writeWorldEditorHandoff(localStorage,createScenePresetHandoff({
        presetArtifactId:detail.presetArtifactId,
        presetRevisionId:detail.presetRevisionId,
        checksumSha256:detail.checksumSha256,
        byteSize:detail.byteSize
      }));
      useState=copy.ready;handoffReady=true;
    }catch(error){useState=error instanceof Error?error.message:String(error);}
  }
</script>

<svelte:head><title>{detail?.title?detail.title+' | Dreamwish Wand':'Scene Preset | Dreamwish Wand'}</title></svelte:head>

<section class="detail-page container">
{#if loading}<p class="status" aria-live="polite">{copy.loading}</p>
{:else if !detail}<p class="status" aria-live="polite">{message||copy.notFound}</p>
{:else}
<header><p class="eyebrow">{copy.eyebrow}</p><h1>{detail.title}</h1>
{#if detail.creator}<p>{copy.creator}: <a href={base+'/creator/?id='+detail.creatorProfileId}>{detail.creator.displayName}</a></p>{/if}</header>
<div class="media" aria-label={copy.media}>{#each detail.mediaIds??[] as mediaId}{#if mediaUrls[String(mediaId)]}<img src={mediaUrls[String(mediaId)]} alt="" loading="lazy" />{/if}{/each}</div>
<section class="facts">
<div><span>{copy.revision}</span><strong>#{detail.presetRevisionNumber}</strong></div>
<div><span>{copy.capture}</span><strong>{detail.metadata?.wepScene?.captureRegion?.width??'—'} × {detail.metadata?.wepScene?.captureRegion?.height??'—'}</strong></div>
<div><span>{copy.objects}</span><strong>{detail.metadata?.wepScene?.rootObjectCount??'—'}</strong></div>
<div><span>{copy.signed}</span><strong>{detail.schemaVersion===1?'schema 1':'—'}</strong></div>
</section>
{#if usedItems.length}
<section class="used-items">
<h2>{itemCopy.title}</h2>
<div class="used-list">
{#each usedItems as item}
<div><strong>{item.label}</strong><span>{itemCopy.quantity} {item.quantity}</span><code>#{item.itemId}</code></div>
{/each}
</div>
</section>
{/if}
{#if detail.description}<section><h2>{copy.description}</h2><p>{detail.description}</p></section>{/if}
<div class="actions">
<button type="button" on:click={savePreset}>{copy.save}</button>
<button class="primary" type="button" on:click={prepareWorldEditor}>{copy.use}</button>
<a href={base+'/gallery/interact/?work='+detail.galleryWorkId}>{copy.gallery}</a>
{#if handoffReady}<a class="primary-link" href={base+'/editor/world/'}>{copy.ready}</a>{/if}
</div>
<p class="boundary">{copy.boundary}</p>
{#if message}<p class="status" aria-live="polite">{message}</p>{/if}
{#if useState}<p class="status" aria-live="polite">{useState}</p>{/if}
{/if}
</section>

<style>
.detail-page{padding-block:60px 90px;max-width:1100px}.eyebrow{font-size:10px;letter-spacing:.18em;font-weight:900;color:var(--gold)}h1{font-family:Georgia,serif;font-size:clamp(36px,6vw,64px);font-weight:500;margin:8px 0 12px}.media{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:28px 0}.media img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:18px}.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:24px 0}.facts div{padding:14px;border:1px solid var(--border);border-radius:14px;background:var(--surface)}.facts span{display:block;font-size:10px;color:var(--ink-muted);margin-bottom:6px}.used-items{margin-top:24px}.used-items h2{font-family:Georgia,serif;font-size:28px;font-weight:500}.used-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.used-list div{padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface)}.used-list strong,.used-list span,.used-list code{display:block}.used-list strong{font-size:12px}.used-list span,.used-list code{font-size:9px;color:var(--ink-muted);margin-top:5px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px}.actions button,.actions a{min-height:44px;border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);padding:10px 16px;font-weight:800;text-decoration:none}.actions .primary,.actions .primary-link{color:var(--gold)}.boundary,.status{margin-top:16px;padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--ink-soft);font-size:12px;line-height:1.7}@media(max-width:760px){.media,.facts,.used-list{grid-template-columns:1fr 1fr}}@media(max-width:520px){.media,.facts,.used-list{grid-template-columns:1fr}}
</style>