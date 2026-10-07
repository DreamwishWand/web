<script lang="ts">
  import { onMount } from 'svelte';
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
    createScenePresetMasterStore,
    markScenePresetPublished,
    scenePresetPublishReadiness,
    updateScenePresetPrivateMaster
  } from '$lib/wep/scene-preset-master';
  import { scenePresetProductCopy } from '$lib/presets/scene-product-copy.js';

  const client=createCommunityBrowserClient();
  const store=typeof indexedDB==='undefined'?null:createScenePresetMasterStore();
  const bridge=client?createPresetCommunityBridge({
    community:client,
    hooks:{buildPublishEnvelope,validatePublishablePreset,preflightScene}
  }):null;

  let master:any=null;
  let masterId='';
  let creatorProfileId='';
  let title='';
  let description='';
  let files:File[]=[];
  let busy=false;
  let error='';
  let status='';
  let published:any=null;
  $: copy=scenePresetProductCopy($locale);
  $: readiness=master?scenePresetPublishReadiness(master,files.length):{ready:false,blockers:[],operation:'PUBLISH'};

  onMount(async()=>{
    masterId=new URLSearchParams(location.search).get('master')??'';
    if(!store||!masterId){error=copy.masterMissing;return;}
    master=await store.get(masterId);
    if(!master){error=copy.masterMissing;return;}
    title=String(master.authoredTitle??'');
    description=String(master.description??'');
    if(client?.session){
      try{
        const me:any=await client.query('me');
        creatorProfileId=String(me?.data?.creatorProfileId??'');
      }catch(cause){error=cause instanceof Error?cause.message:String(cause);}
    }
  });

  function chooseFiles(event:Event){
    files=Array.from((event.currentTarget as HTMLInputElement).files??[]).slice(0,10);
    error='';
  }

  async function persistPrivateEdits(){
    if(!master||!store)return;
    master=updateScenePresetPrivateMaster(master,{authoredTitle:title,description});
    await store.put(master);
  }

  async function publish(){
    if(!client||!bridge||!store||!master||!creatorProfileId)return;
    await persistPrivateEdits();
    const gate=scenePresetPublishReadiness(master,files.length);
    if(!gate.ready){
      error=gate.blockers.includes('PUBLIC_TITLE_REQUIRED')?copy.missingTitle:
        gate.blockers.includes('PUBLIC_IMAGE_REQUIRED')?copy.missingImage:
        gate.blockers.join(', ');
      return;
    }
    busy=true;error='';status='';
    const uploaded:string[]=[];
    try{
      for(const file of files){
        const result=await client.uploadAndFinalizeImage(file);
        uploaded.push(result.mediaId);
      }
      const current=master.currentPublication;
      const result:any=await bridge.publishScene({
        artifact:master.artifact,
        creatorProfileId,
        title:master.authoredTitle.trim(),
        description:master.description.trim()||null,
        mediaIds:uploaded,
        metadata:{
          sourceSurface:'world-editor',
          artifactType:'scene',
          privateMasterId:master.masterId
        },
        presetArtifactId:current?.presetArtifactId??null,
        expectedPresetRevisionId:current?.presetRevisionId??null,
        idempotencyKey:`scene-${master.masterId}-${crypto.randomUUID()}`
      });
      master=markScenePresetPublished(master,{
        presetArtifactId:result.presetArtifactId,
        presetRevisionId:result.presetRevisionId,
        presetWorkId:result.presetWorkId,
        presetWorkRevisionId:result.presetWorkRevisionId,
        galleryWorkId:result.galleryWorkId,
        galleryRevisionId:result.galleryRevisionId,
        revisionNumber:result.revisionNumber,
        checksumSha256:result.checksumSha256,
        byteSize:result.byteSize
      });
      await store.put(master);
      published=result;
      status=current?copy.updatePublished:copy.published;
      files=[];
    }catch(cause){
      for(const mediaId of uploaded){
        try{await client.media('discard',{mediaId});}catch{}
      }
      error=cause instanceof Error?cause.message:String(cause);
    }finally{busy=false;}
  }

  async function lifecycle(action:'unpublish'|'delete'){
    if(!bridge||!master?.currentPublication||busy)return;
    if(action==='delete'&&!confirm(copy.deleteConfirm))return;
    busy=true;error='';
    try{
      await bridge.changeLifecycle(
        master.currentPublication.presetArtifactId,
        master.currentPublication.presetRevisionId,
        action,
        crypto.randomUUID()
      );
      if(action==='delete'){
        await store?.delete(master.masterId);
        location.href=`${base}/presets/`;
      }else{
        status=copy.unpublish;
      }
    }catch(cause){error=cause instanceof Error?cause.message:String(cause);}
    finally{busy=false;}
  }
</script>

<svelte:head><title>{master?.currentPublication?copy.publishUpdateHeading:copy.publishHeading} | Dreamwish Wand</title></svelte:head>

<section class="scene-publish container">
  <a class="back" href={`${base}/presets/`}>← {copy.backPresets}</a>
  <header>
    <p class="eyebrow">SCENE WAND PRESET</p>
    <h1>{master?.currentPublication?copy.publishUpdateHeading:copy.publishHeading}</h1>
    <p>{copy.publishIntro}</p>
  </header>

  {#if error}<p class="notice error" role="alert">{error}</p>{/if}
  {#if status}<p class="notice" role="status">{status}</p>{/if}

  {#if !client}
    <p class="notice">{copy.configUnavailable}</p>
  {:else if !master}
    <p class="notice">{copy.masterMissing}</p>
  {:else if !client.session}
    <p class="notice">{copy.signInToReuse}</p>
  {:else if !creatorProfileId}
    <p class="notice">Creator Profile required.</p>
  {:else}
    <div class="layout">
      <form class="card" on:submit|preventDefault={publish}>
        <label>
          <span>{copy.title} *</span>
          <input maxlength="240" bind:value={title} on:blur={persistPrivateEdits} />
        </label>
        <label>
          <span>{copy.description}</span>
          <textarea maxlength="20000" rows="5" bind:value={description} on:blur={persistPrivateEdits}></textarea>
        </label>
        <label>
          <span>{copy.images} *</span>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" on:change={chooseFiles} />
          <small>{copy.imagesHint} · {files.length}/10</small>
        </label>
        {#if readiness.blockers.length}
          <div class="blockers">
            {#each readiness.blockers as blocker}<code>{blocker}</code>{/each}
          </div>
        {/if}
        <button class="primary" disabled={busy||!readiness.ready}>
          {master.currentPublication?copy.publishUpdate:copy.publish}
        </button>
      </form>

      <aside class="card summary">
        <span>{copy.privateMaster}</span>
        <strong>{master.provisionalTitle}</strong>
        <code>{master.masterId}</code>
        <p>{copy.historyImmutable}</p>
        {#if master.currentPublication}
          <dl>
            <div><dt>{copy.currentRevision}</dt><dd>#{master.currentPublication.revisionNumber}</dd></div>
            <div><dt>PresetArtifact</dt><dd><code>{master.currentPublication.presetArtifactId}</code></dd></div>
            <div><dt>Gallery Work</dt><dd><code>{master.currentPublication.galleryWorkId}</code></dd></div>
          </dl>
          <div class="lifecycle">
            <button type="button" disabled={busy} on:click={()=>lifecycle('unpublish')}>{copy.unpublish}</button>
            <button type="button" disabled={busy} on:click={()=>lifecycle('delete')}>{copy.delete}</button>
          </div>
        {/if}
      </aside>
    </div>
  {/if}

  {#if published}
    <div class="notice success">
      <strong>{copy.publicRevision} #{published.revisionNumber}</strong>
      <a href={`${base}/presets/detail/?work=${encodeURIComponent(published.presetWorkId)}`}>{copy.detailHeading}</a>
    </div>
  {/if}
</section>

<style>
.scene-publish{padding-block:54px 90px;max-width:1100px}.back{font-size:12px;color:var(--ink-soft)}header{max-width:760px;margin:28px 0}h1{font-family:Georgia,serif;font-size:clamp(38px,5vw,60px);font-weight:500;margin:10px 0}.eyebrow{font-size:10px;letter-spacing:.18em;color:var(--gold);font-weight:900}.layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.75fr);gap:18px}.card{display:grid;gap:16px;padding:24px;border:1px solid var(--border);border-radius:22px;background:var(--surface)}label{display:grid;gap:7px;font-size:12px;color:var(--ink-soft)}input,textarea{border:1px solid var(--border);border-radius:12px;background:var(--surface-raised);color:var(--ink);padding:11px 12px;font:inherit}small{color:var(--ink-muted)}button{min-height:42px;border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);padding:9px 14px;font-weight:800}.primary{border-color:var(--gold);background:var(--gold-strong);color:#27324f}.primary:disabled,button:disabled{opacity:.45}.notice{padding:13px 15px;border:1px solid var(--border);border-radius:13px;background:var(--surface);margin:14px 0}.error{color:#ffb6b6}.success{display:flex;justify-content:space-between;gap:16px;align-items:center}.summary strong,.summary code{overflow-wrap:anywhere}.summary dl{display:grid;gap:10px;margin:0}.summary dl>div{background:var(--surface-raised);padding:10px;border-radius:10px}.summary dt{font-size:9px;color:var(--ink-muted);text-transform:uppercase}.summary dd{margin:5px 0 0}.lifecycle{display:flex;gap:8px;flex-wrap:wrap}.blockers{display:flex;gap:6px;flex-wrap:wrap}.blockers code{font-size:10px;color:var(--decor-accent)}@media(max-width:760px){.layout{grid-template-columns:1fr}.scene-publish{padding-block:38px 70px}}
</style>
