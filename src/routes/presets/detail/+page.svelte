<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import {
    callPublicCommunityRpc,
    createCommunityBrowserClient,
    getPublicCommunityMedia
  } from '$lib/community/browser-client';
  import { createPresetCommunityBridge } from '$lib/wep/preset-community-bridge';
  import {
    buildPublishEnvelope,
    preflightScene,
    validatePublishablePreset
  } from '$lib/wep/scene-preset-runtime';
  import {
    createScenePresetHandoff,
    writeWorldEditorHandoff
  } from '$lib/wep/world-editor-handoff';
  import { scenePresetProductCopy } from '$lib/presets/scene-product-copy.js';

  const client=createCommunityBrowserClient();
  const bridge=client?createPresetCommunityBridge({
    community:client,
    hooks:{buildPublishEnvelope,validatePublishablePreset,preflightScene}
  }):null;

  let workId='';
  let detail:any=null;
  let mediaUrls:Record<string,string>={};
  let busy=false;
  let error='';
  let status='';
  let verified:any=null;
  $: copy=scenePresetProductCopy($locale);

  onMount(async()=>{
    workId=new URLSearchParams(location.search).get('work')??'';
    if(!workId){error='PRESET_WORK_ID_REQUIRED';return;}
    await loadDetail();
  });

  async function loadDetail(){
    busy=true;error='';
    try{
      detail=await callPublicCommunityRpc<any>('community_get_scene_preset_public_v1',{
        p_work_id:workId
      });
      const urls:Record<string,string>={};
      for(const id of detail?.mediaIds??[]){
        const media=await getPublicCommunityMedia(String(id));
        urls[String(id)]=media.signedUrl;
      }
      mediaUrls=urls;
    }catch(cause){error=cause instanceof Error?cause.message:String(cause);}
    finally{busy=false;}
  }

  async function savePreset(){
    if(!bridge||!detail?.presetArtifactId)return;
    busy=true;error='';
    try{
      await bridge.saveToLibrary(String(detail.presetArtifactId));
      status=copy.saved;
    }catch(cause){error=cause instanceof Error?cause.message:String(cause);}
    finally{busy=false;}
  }

  async function useInWorldEditor(){
    if(!bridge||!detail?.presetArtifactId||!detail?.presetRevisionId)return;
    busy=true;error='';
    try{
      const loaded=await bridge.loadPreset(String(detail.presetArtifactId),{
        expectedPresetRevisionId:String(detail.presetRevisionId)
      });
      verified=loaded.authoritative;
      const handoff=createScenePresetHandoff({
        workId:String(detail.workId),
        presetArtifactId:String(loaded.authoritative.presetArtifactId),
        presetRevisionId:String(loaded.authoritative.presetRevisionId),
        schemaVersion:Number(loaded.authoritative.schemaVersion),
        byteSize:Number(loaded.authoritative.byteSize),
        checksumSha256:String(loaded.authoritative.checksumSha256)
      });
      writeWorldEditorHandoff(localStorage,handoff);
      location.href=`${base}/editor/world/`;
    }catch(cause){error=cause instanceof Error?cause.message:String(cause);}
    finally{busy=false;}
  }
</script>

<svelte:head><title>{detail?.title||copy.detailHeading} | Dreamwish Wand</title></svelte:head>

<section class="scene-detail container">
  <a class="back" href={`${base}/presets/`}>← {copy.backPresets}</a>
  {#if error}<p class="notice error" role="alert">{error}</p>{/if}
  {#if status}<p class="notice" role="status">{status}</p>{/if}

  {#if busy && !detail}
    <p class="notice">Loading…</p>
  {:else if detail}
    <header>
      <p class="eyebrow">SCENE WAND PRESET</p>
      <h1>{detail.title}</h1>
      {#if detail.description}<p>{detail.description}</p>{/if}
      <div class="identity">
        <span>{copy.creator}: <strong>{detail.creator?.displayName??detail.creator?.handle??detail.creatorProfileId}</strong></span>
        <span>{copy.publicRevision}: <code>{detail.presetRevisionId}</code></span>
      </div>
    </header>

    <div class="media-grid" aria-label={copy.media}>
      {#each detail.mediaIds??[] as mediaId}
        {#if mediaUrls[String(mediaId)]}
          <img src={mediaUrls[String(mediaId)]} alt="" loading="lazy" />
        {/if}
      {/each}
    </div>

    <section class="reuse">
      <div>
        <strong>{copy.galleryWork}</strong>
        <code>{detail.galleryWorkId}</code>
      </div>
      <div>
        <strong>PresetArtifact</strong>
        <code>{detail.presetArtifactId}</code>
      </div>
      <p>{copy.noOwnershipTransfer}</p>

      {#if client?.session}
        <div class="actions">
          <button type="button" disabled={busy} on:click={savePreset}>{copy.save}</button>
          <button class="primary" type="button" disabled={busy} on:click={useInWorldEditor}>
            {copy.useWorldEditor}
          </button>
        </div>
      {:else}
        <p class="notice">{copy.signInToReuse}</p>
      {/if}

      {#if verified}
        <div class="verified">
          <strong>{copy.verified}</strong>
          <code>{verified.presetRevisionId}</code>
          <span>SHA-256 {verified.checksumSha256}</span>
          <span>{verified.byteSize} bytes · schema {verified.schemaVersion}</span>
        </div>
      {/if}
    </section>
  {/if}
</section>

<style>
.scene-detail{padding-block:54px 90px;max-width:1100px}.back{font-size:12px;color:var(--ink-soft)}header{max-width:820px;margin:28px 0}h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,68px);font-weight:500;margin:10px 0}.eyebrow{font-size:10px;letter-spacing:.18em;color:var(--gold);font-weight:900}.identity{display:flex;gap:14px;flex-wrap:wrap;color:var(--ink-soft);font-size:12px}.identity code{overflow-wrap:anywhere}.media-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.media-grid img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:18px;border:1px solid var(--border);background:var(--surface)}.reuse{margin-top:18px;display:grid;gap:13px;padding:22px;border:1px solid var(--border);border-radius:20px;background:var(--surface)}.reuse>div:not(.actions):not(.verified){display:grid;gap:5px}.reuse code{overflow-wrap:anywhere}.actions{display:flex;gap:10px;flex-wrap:wrap}.actions button{min-height:44px;border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);padding:10px 16px;font-weight:800}.actions .primary{border-color:var(--gold);background:var(--gold-strong);color:#27324f}.notice,.verified{padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface)}.error{color:#ffb6b6}.verified{display:grid;gap:5px;font-size:11px}.verified strong{color:var(--help-accent)}@media(max-width:650px){.media-grid{grid-template-columns:1fr}.scene-detail{padding-block:38px 70px}}
</style>
