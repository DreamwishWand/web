<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { createCommunityBrowserClient } from '$lib/community/browser-client';
  import { createPresetCommunityBridge } from '$lib/wep/preset-community-bridge';
  import {
    buildPublishEnvelope,
    preflightScene,
    validatePublishablePreset
  } from '$lib/wep/scene-preset-runtime';
  import {
    getScenePresetPrivateMaster,
    recordScenePresetPublication
  } from '$lib/wep/scene-preset-private-master';
  import { scenePresetPublishCopy } from '$lib/presets/scene-preset-publish-copy.js';

  let master:any=null;
  let community:any=null;
  let bridge:any=null;
  let creatorProfileId='';
  let publicTitle='';
  let description='';
  let files:File[]=[];
  let previewUrl='';
  let message='';
  let busy=false;
  let publishKey='';
  $: copy=scenePresetPublishCopy($locale);
  $: isUpdate=Boolean(master?.publication);
  $: itemTypes=Object.keys(master?.artifact?.requirements?.itemQuantities??{}).length;

  function clearPreview(){
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    previewUrl='';
  }

  onDestroy(clearPreview);

  onMount(async()=>{
    try{
      const masterId=new URL(window.location.href).searchParams.get('master')??'';
      if(!masterId)throw new Error('WEP_SCENE_MASTER_ID_REQUIRED');
      master=getScenePresetPrivateMaster(localStorage,masterId);
      if(!master)throw new Error('WEP_SCENE_MASTER_NOT_FOUND');
      publicTitle=master.authoredTitle??'';
      publishKey=crypto.randomUUID();
      community=createCommunityBrowserClient();
      if(!community?.session){
        message=copy.account;
        return;
      }
      const me:any=await community.query('me');
      creatorProfileId=String(me?.data?.creatorProfileId??'');
      if(!creatorProfileId)throw new Error('CREATOR_PROFILE_REQUIRED');
      bridge=createPresetCommunityBridge({
        community,
        hooks:{buildPublishEnvelope,validatePublishablePreset,preflightScene}
      });
    }catch(error){
      message=error instanceof Error?error.message:String(error);
    }
  });

  function selectImages(event:Event){
    const input=event.currentTarget as HTMLInputElement;
    files=Array.from(input.files??[]).slice(0,10);
    clearPreview();
    if(files[0])previewUrl=URL.createObjectURL(files[0]);
  }

  async function publish(){
    message='';
    if(!publicTitle.trim()){message=copy.missingTitle;return;}
    if(!isUpdate&&files.length===0){message=copy.missingImage;return;}
    if(!bridge||!creatorProfileId){message=copy.account;return;}
    busy=true;
    message=copy.publishing;
    try{
      const result:any=await bridge.publishSceneProduct({
        artifact:master.artifact,
        creatorProfileId,
        visibility:'public',
        title:publicTitle.trim(),
        description:description.trim()||null,
        metadata:{
          sourceSurface:'scene-preset-publication',
          privateMasterId:master.masterId
        },
        idempotencyKey:'scene-product-'+publishKey,
        images:files,
        existingPresetArtifactId:master.publication?.presetArtifactId??null
      });
      master=recordScenePresetPublication(localStorage,master.masterId,{
        presetArtifactId:result.presetArtifactId,
        presetRevisionId:result.presetRevisionId,
        workId:result.workId,
        workRevisionId:result.workRevisionId,
        galleryWorkId:result.galleryWorkId,
        galleryWorkRevisionId:result.galleryWorkRevisionId,
        checksumSha256:result.checksumSha256,
        byteSize:result.byteSize,
        publishedAt:new Date().toISOString()
      });
      files=[];
      clearPreview();
      publishKey=crypto.randomUUID();
      message=isUpdate?copy.updated:copy.published;
    }catch(error){
      message=error instanceof Error?error.message:String(error);
    }finally{
      busy=false;
    }
  }
</script>

<svelte:head><title>{copy.title} | Dreamwish Wand</title></svelte:head>

<section class="publish-page container">
  <header>
    <p class="eyebrow">{copy.eyebrow}</p>
    <h1>{copy.title}</h1>
    <p>{copy.intro}</p>
  </header>

  {#if master}
    <section class="panel">
      <p class="eyebrow">{copy.readiness}</p>
      <div class="facts">
        <div><span>{copy.privateMaster}</span><strong>{master.authoredTitle||'Untitled Scene'}</strong></div>
        <div><span>{copy.capture}</span><strong>{master.artifact.bounds.w} × {master.artifact.bounds.h}</strong></div>
        <div><span>{copy.rootObjects}</span><strong>{master.artifact.objects.length}</strong></div>
        <div><span>{copy.usedItems}</span><strong>{itemTypes}</strong></div>
      </div>
      {#if master.publication}
        <p class="revision">{copy.publicRevision}: #{master.publication.presetRevisionId}</p>
        {#if master.changesNotPublished}<p class="changes">{copy.changes}</p>{/if}
      {/if}
    </section>

    <section class="panel">
      <p class="eyebrow">{copy.presentation}</p>
      <label>
        <span>{copy.publicTitle}</span>
        <input bind:value={publicTitle} maxlength="240" />
      </label>
      <label>
        <span>{copy.description}</span>
        <textarea bind:value={description} maxlength="20000" rows="4"></textarea>
      </label>
      <label>
        <span>{copy.images}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple on:change={selectImages} />
      </label>
      <p class="hint">{copy.imagesHint}</p>
    </section>

    <section class="panel preview">
      <p class="eyebrow">{copy.preview}</p>
      {#if previewUrl}<img src={previewUrl} alt="" />{/if}
      <h2>{publicTitle.trim()||'Untitled Scene'}</h2>
      {#if description.trim()}<p>{description}</p>{/if}
      <div class="preview-facts">
        <span>Scene</span>
        <span>{master.artifact.bounds.w} × {master.artifact.bounds.h}</span>
        <span>{master.artifact.objects.length} root objects</span>
      </div>
    </section>

    <div class="actions">
      <button class="primary" disabled={busy} on:click={publish}>
        {isUpdate?copy.publishUpdate:copy.publish}
      </button>
      <a href={base+'/editor/world/'}>{copy.back}</a>
      {#if master.publication}
        <a href={base+'/presets/detail/?work='+master.publication.workId}>{copy.openDetail}</a>
      {/if}
    </div>
  {/if}

  <p class="boundary">{copy.boundary}</p>
  {#if message}<p class="status" aria-live="polite">{message}</p>{/if}
</section>

<style>
.publish-page{max-width:980px;padding-block:60px 90px}.eyebrow{font-size:10px;letter-spacing:.18em;font-weight:900;color:var(--gold)}h1{font-family:Georgia,serif;font-size:clamp(36px,6vw,62px);font-weight:500;margin:8px 0 12px}.panel{margin-top:20px;padding:22px;border:1px solid var(--border);border-radius:20px;background:var(--surface)}.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.facts div{padding:12px;border-radius:12px;background:var(--surface-raised)}.facts span,label span{display:block;font-size:10px;color:var(--ink-muted);margin-bottom:7px}.panel label{display:block;margin-top:14px}.panel input[type="text"],.panel input:not([type]),.panel textarea{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:12px;background:var(--surface-raised);color:var(--ink);padding:11px 12px}.hint,.revision,.changes,.boundary,.status{font-size:12px;line-height:1.7;color:var(--ink-soft)}.changes{color:var(--gold)}.preview img{width:100%;max-height:420px;object-fit:cover;border-radius:16px}.preview h2{font-family:Georgia,serif;font-weight:500;font-size:30px}.preview-facts,.actions{display:flex;gap:10px;flex-wrap:wrap}.preview-facts span{border:1px solid var(--border);border-radius:999px;padding:6px 10px;font-size:11px}.actions{margin-top:22px}.actions button,.actions a{min-height:44px;border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);padding:10px 16px;font-weight:800;text-decoration:none}.actions .primary{color:var(--gold)}.boundary,.status{margin-top:16px;padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface)}@media(max-width:760px){.facts{grid-template-columns:1fr 1fr}}@media(max-width:480px){.facts{grid-template-columns:1fr}}
</style>