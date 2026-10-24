<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { createCommunityBrowserClient } from '$lib/community/browser-client';
  import OwnerGalleryMediaPreview from '$lib/gallery/OwnerGalleryMediaPreview.svelte';
  import { parseGalleryRetirementPreflight } from '$lib/community/gallery-preflight.js';
  import { workUrl, GALLERY_OWNER_MUTATION_BLOCKER } from '$lib/gallery/stage1.js';
  import OverflowMenu from '$lib/ui/OverflowMenu.svelte';
  import Sheet from '$lib/ui/Sheet.svelte';
  const client=createCommunityBrowserClient();
  let signedIn=false,busy=false,error='',message='',email='',password='';
  let tab:'works'|'saved'='works';
  let kind='all';
  let query='';
  let data:any={myWorks:[],saved:[]};
  let management:any=null,ownerDetail:any=null;
  let showManagement=false;
  let commentsEnabled=true;
  let managementError='';
  let ownerBusy=false;
  let stagedTitle='', stagedDescription='';
  let showEditPreview=false;
  let preflight:any=null,preflightBusy=false,preflightError='';
  let managementRequest=0;
  let preflightGeneration=0;
  let preflightSessionToken='';
  const dependencyKinds=[
    {key:'scene',label:'galleryv1.depScene'},
    {key:'biome',label:'galleryv1.depBiome'},
    {key:'floating_island',label:'galleryv1.depIsland'},
    {key:'tom_furniture',label:'galleryv1.depToMFurniture'},
    {key:'tom_clothing',label:'galleryv1.depToMClothing'},
    {key:'native_listing',label:'galleryv1.depNative'}
  ] as const;
  function coverageLabel(value:string){
    return value==='VERIFIED'?'galleryv1.depVerified':
      value==='VERIFIED_EMPTY'?'galleryv1.depVerifiedEmpty':
      value==='REGISTRY_MISSING'?'galleryv1.depRegistryMissing':
      value==='VERSION_UNSUPPORTED'?'galleryv1.depUnsupported':
      'galleryv1.depUnknown';
  }

  onMount(()=>{
    signedIn=Boolean(client?.session);
    if(signedIn)void load();
    const check=()=>{
      if(preflightSessionToken && (!client?.session ||
        client.session.accessToken!==preflightSessionToken || client.session.expiresAt<=Date.now())){
        ++preflightGeneration;preflight=null;preflightBusy=false;preflightError='';
        preflightSessionToken='';showEditPreview=false;
      }
    };
    const interval=setInterval(check,1000);
    window.addEventListener('focus',check);
    return ()=>{clearInterval(interval);window.removeEventListener('focus',check)};
  });
  $: if(!showManagement && preflightSessionToken){
    ++preflightGeneration;preflight=null;preflightBusy=false;preflightError='';
    preflightSessionToken='';showEditPreview=false;
  }
  async function run<T>(f:()=>Promise<T>):Promise<T|null>{
    busy=true;error='';
    try{return await f()}catch(e){error=e instanceof Error?e.message:String(e);return null}
    finally{busy=false}
  }
  async function signIn(){
    if(!client)return;
    const ok=await run(()=>client.signInWithPassword(email.trim(),password));
    if(ok){password='';signedIn=true;await load();}
  }
  async function load(){
    if(!client?.session)return;
    const res:any=await run(()=>client.query('myGallery',{limit:100}));
    if(res?.data)data=res.data;
  }
  $: works=(data.myWorks??[]).filter((w:any)=>w.lifecycleState==='published' && w.visibility==='public' &&
    (kind==='all'||(kind==='decorations' ? ['outdoor','indoor'].includes(w.galleryKind) : w.galleryKind?.startsWith('tom_'))) &&
    (!query.trim()||String(w.title??'').toLowerCase().includes(query.trim().toLowerCase())));
  $: saved=(data.saved??[]).filter((s:any)=>s.work && ['outdoor','indoor','tom_furniture','tom_clothing'].includes(s.work.galleryKind) &&
    (kind==='all'||(kind==='decorations'?['outdoor','indoor'].includes(s.work.galleryKind):s.work.galleryKind.startsWith('tom_'))) &&
    (!query.trim()||String(s.work?.title??'').toLowerCase().includes(query.trim().toLowerCase())));
  async function unsave(id:string){
    if(!client?.session)return;
    const ok=await run(()=>client.command('unsaveEntity',{targetEntityId:id}));
    if(ok)await load();
  }
  async function manage(work:any){
    const request=++managementRequest;
    ++preflightGeneration;preflightSessionToken='';
    management=work;ownerDetail=null;managementError='';showManagement=true;ownerBusy=true;
    preflight=null;preflightError='';preflightBusy=false;
    // The server's owner-only preflight is authoritative. Do not gate it on
    // legacy Gallery Detail's optional isOwner projection.
    void loadPreflight(String(work.workId),request);
    stagedTitle=String(work.title??'');stagedDescription='';showEditPreview=false;
    try{
      const result:any=await client?.query('gallery',{workId:work.workId});
      if(request!==managementRequest)return;
      ownerDetail=result?.data??null;
      commentsEnabled=ownerDetail?.commentsEnabled!==false;
      stagedTitle=String(ownerDetail?.title??work.title??'');
      stagedDescription=String(ownerDetail?.description??'');
    }catch(e){if(request===managementRequest)managementError=e instanceof Error?e.message:String(e)}
    finally{if(request===managementRequest)ownerBusy=false}
  }
  async function loadPreflight(workId:string,request=managementRequest){
    const session=client?.session;
    if(!session||session.expiresAt<=Date.now()||management?.workId!==workId||!showManagement){
      preflight=null;preflightError='';preflightBusy=false;return;
    }
    const generation=++preflightGeneration;
    const accessToken=session.accessToken;
    preflightSessionToken=accessToken;
    const current=()=>request===managementRequest&&generation===preflightGeneration&&
      showManagement&&management?.workId===workId&&client?.session?.accessToken===accessToken&&
      (client?.session?.expiresAt??0)>Date.now();
    preflightBusy=true;preflightError='';preflight=null;
    try{
      const result:any=await client!.query('galleryRetirementPreflight',{workId});
      if(!current())return;
      preflight=parseGalleryRetirementPreflight(result?.data,workId);
    }catch{
      // Server and SQL internal errors are never rendered into HTML.
      if(current())preflightError='GALLERY_PREFLIGHT_UNAVAILABLE';
    }finally{if(current())preflightBusy=false}
  }
  async function setComments(){
    if(!client?.session||!management?.workId)return;
    ownerBusy=true;managementError='';
    const newState=!commentsEnabled;
    try{
      await client.command('setGalleryCommentsEnabled',{workId:management.workId,enabled:newState});
      commentsEnabled=newState;
    }catch(e){managementError=e instanceof Error?e.message:String(e)}
    finally{ownerBusy=false}
  }
</script>
<svelte:head><title>{t('galleryv1.myGallery',{},$locale)} | Dreamwish Wand</title></svelte:head>
<section class="gallery-my responsive-frame">
  <a href={base+'/gallery/'} class="inline-link">← {t('galleryv1.returnToGallery',{},$locale)}</a>
  <header><h1>{t('galleryv1.myGallery',{},$locale)}</h1><a class="publish-link" href={base+'/gallery/publish/'}>{t('galleryv1.publishWork',{},$locale)}</a></header>
  {#if !client}<p role="status" class="notice">{t('community.configUnavailable',{},$locale)}</p>
  {:else if !signedIn}
    <div class="sign-in">
      <h2>{t('galleryv1.signIn',{},$locale)}</h2>
      <label>{t('community.auth.email',{},$locale)}<input type="email" autocomplete="email" bind:value={email}/></label>
      <label>{t('community.auth.password',{},$locale)}<input type="password" autocomplete="current-password" bind:value={password}/></label>
      <button type="button" disabled={busy||!email||!password} on:click={signIn}>{t('community.auth.signIn',{},$locale)}</button>
    </div>
  {:else}
    <div class="switcher" role="group" aria-label={t('galleryv1.myGallery',{},$locale)}>
      <button type="button" aria-pressed={tab==='works'} class:active={tab==='works'} on:click={()=>tab='works'}>{t('galleryv1.myWorks',{},$locale)}</button>
      <button type="button" aria-pressed={tab==='saved'} class:active={tab==='saved'} on:click={()=>tab='saved'}>{t('galleryv1.saved',{},$locale)}</button>
    </div>
    <div class="controls">
      <label>{t('galleryv1.category',{},$locale)}
        <select bind:value={kind}>
          <option value="all">{t('galleryv1.all',{},$locale)}</option>
          <option value="decorations">{t('galleryv1.decorations',{},$locale)}</option>
          <option value="tom">{t('galleryv1.tom',{},$locale)}</option>
        </select>
      </label>
      <label>{t('galleryv1.search',{},$locale)}<input bind:value={query}/></label>
      <button type="button" disabled={busy} on:click={load}>{t('galleryv1.retry',{},$locale)}</button>
    </div>
    {#if busy}<p role="status">{t('galleryv1.loading',{},$locale)}</p>{/if}
    {#if error}<p role="alert">{t('galleryv1.error',{},$locale)}: {error}</p>{/if}
    {#if tab==='works'}
      <div class="my-grid">
        {#each works as work (work.workId)}
          <article class="my-card">
            <a href={workUrl(base,work.workId)}>
              <strong>{work.title??work.galleryKind}</strong>
              <small>{work.galleryKind} · PUBLIC</small>
            </a>
            <OverflowMenu label={t('galleryv1.manageMenu',{},$locale)}>
              <a href={workUrl(base,work.workId)}>{t('galleryv1.viewWork',{},$locale)}</a>
              <button type="button" on:click={()=>manage(work)}>{t('galleryv1.manageComments',{},$locale)}</button>
              <button type="button" on:click={()=>manage(work)}>{t('galleryv1.editPresentation',{},$locale)}</button>
              <button type="button" on:click={()=>manage(work)}>{t('galleryv1.deleteWork',{},$locale)}</button>
            </OverflowMenu>
          </article>
        {:else}<p role="status">{t('galleryv1.emptyWorks',{},$locale)}</p>{/each}
      </div>
    {:else}
      <div class="my-grid">
        {#each saved as item (item.targetEntityId)}
          <article class="my-card">
            {#if item.accessible}
              <a href={workUrl(base,item.targetEntityId)}><strong>{item.work.title??item.targetEntityId}</strong></a>
            {:else}<span>{t('galleryv1.unavailable',{},$locale)}</span>{/if}
            <button type="button" disabled={busy} on:click={()=>unsave(String(item.targetEntityId))}>{t('gallery.my.unsave',{},$locale)}</button>
          </article>
        {:else}<p role="status">{t('galleryv1.emptySaved',{},$locale)}</p>{/each}
      </div>
    {/if}
  {/if}
  {#if message}<p role="status">{message}</p>{/if}
</section>
<Sheet bind:open={showManagement} title={t('galleryv1.ownerActions',{},$locale)} closeLabel={t('community.action.close',{},$locale)} position="end">
  {#if management}
    <section class="owner-panel">
      <h3>{management.title}</h3>
      <p>{t('galleryv1.publicOnly',{},$locale)}</p>
      <a href={workUrl(base,management.workId)}>{t('galleryv1.viewWork',{},$locale)}</a>
      {#if ownerBusy}<p role="status">{t('galleryv1.loading',{},$locale)}</p>{/if}
      {#if managementError}<p role="alert">{managementError}</p>{/if}
      {#if ownerDetail?.isOwner}
        <label class="comment-control"><input type="checkbox" checked={commentsEnabled} disabled={ownerBusy} on:change={setComments}/>{t('galleryv1.manageComments',{},$locale)}</label>
      {/if}
      <div class="blocked-actions">
        <h3>{t('galleryv1.editPresentation',{},$locale)}</h3>
        {#if ownerDetail?.isOwner}
          <label>{t('galleryv1.title',{},$locale)}<input bind:value={stagedTitle} maxlength="240" /></label>
          <label>{t('galleryv1.description',{},$locale)}<textarea bind:value={stagedDescription} maxlength="20000"></textarea></label>
          <button type="button" on:click={()=>showEditPreview=!showEditPreview}>{t('galleryv1.preview',{},$locale)}</button>
          {#if showEditPreview && showManagement && client?.session}
            {#key String(management.workId)}
              <OwnerGalleryMediaPreview {client} workId={String(management.workId)}
                mediaIds={(ownerDetail?.mediaIds??[]).map(String)}
                title={stagedTitle} description={stagedDescription}
                creator={String(ownerDetail?.creator?.displayName??'')}
                category={String(management.galleryKind)} />
            {/key}
          {/if}
        {/if}
        <p>{t('galleryv1.uploadNotReady',{},$locale)} <code>{GALLERY_OWNER_MUTATION_BLOCKER}</code></p>
        <button type="button" disabled aria-disabled="true">{t('galleryv1.publishUpdate',{},$locale)}</button>
        {#if signedIn}
          <section class="gallery-retirement-preflight" aria-label={t('galleryv1.retirementPreflight',{},$locale)}>
            <h3>{t('galleryv1.retirementPreflight',{},$locale)}</h3>
            <p>{t('galleryv1.preflightReadOnly',{},$locale)}</p>
            {#if preflightBusy}<p role="status">{t('galleryv1.loading',{},$locale)}</p>
            {:else if preflightError}<p role="alert">{t('galleryv1.cloudPreflightError',{},$locale)}</p>
            {:else if preflight}
              <p role="status" class="cloud-preservation-summary">{t('galleryv1.cloudReadOnlySummary',{},$locale)}</p>
              <p>{t('galleryv1.graphState',{},$locale)}: {preflight.graphComplete?t('galleryv1.complete',{},$locale):t('galleryv1.incomplete',{},$locale)}</p>
              {#if preflight.dependencyProjection}
                {@const dep=preflight.dependencyProjection}
                <section class="gallery-dependency-readiness" aria-label={t('galleryv1.depTitle',{},$locale)}>
                  <h4>{t('galleryv1.depTitle',{},$locale)}</h4>
                  <p role="status">{t('galleryv1.depDiagnosticOnly',{},$locale)}</p>
                  <dl class="cloud-readiness-grid">
                    <div><dt>{t('galleryv1.depSourceVersion',{},$locale)}</dt><dd>{t(coverageLabel(dep.sourceVersionState??'SEMANTICS_UNKNOWN'),{},$locale)}</dd></div>
                    {#each dependencyKinds as item}
                      <div><dt>{t(item.label,{},$locale)}</dt><dd>{t(coverageLabel(dep.classification[item.key]),{},$locale)}</dd></div>
                    {/each}
                    <div><dt>{t('galleryv1.depRelationCoverage',{},$locale)}</dt><dd>{Object.keys(dep.relationCoverage).length} {t('galleryv1.depRelationsObserved',{},$locale)}</dd></div>
                    <div><dt>{t('galleryv1.depMissingSources',{},$locale)}</dt><dd>{dep.missingSources.length}</dd></div>
                    <div><dt>{t('galleryv1.depBlockedReasons',{},$locale)}</dt><dd>{dep.blockedReasons.length}</dd></div>
                    <div><dt>{t('galleryv1.depOwnerMismatch',{},$locale)}</dt><dd>{dep.ownerMismatchEdgeCount===0?t('galleryv1.depNoMismatch',{},$locale):t('galleryv1.depMismatchFound',{},$locale)}</dd></div>
                    <div><dt>{t('galleryv1.depCreatorMismatch',{},$locale)}</dt><dd>{dep.creatorMismatchEdgeCount===0?t('galleryv1.depNoMismatch',{},$locale):t('galleryv1.depMismatchFound',{},$locale)}</dd></div>
                    <div><dt>{t('galleryv1.depFingerprint',{},$locale)}</dt><dd>{dep.graphFingerprintSha256?t('galleryv1.depFingerprintObserved',{},$locale):t('galleryv1.cloudNotVerified',{},$locale)}</dd></div>
                  </dl>
                  <p>{t('galleryv1.depMissingDisclaimer',{},$locale)}</p>
                </section>
              {:else}
                <p class="gallery-dependency-legacy" role="status">{t('galleryv1.depLegacyUnknown',{},$locale)}</p>
              {/if}
              {#if preflight.cloudPreservation}
                {@const cp=preflight.cloudPreservation}
                <div class="cloud-preservation-readiness" aria-label={t('galleryv1.cloudReadinessTitle',{},$locale)}>
                  <h4>{t('galleryv1.cloudReadinessTitle',{},$locale)}</h4>
                  <p>{t('galleryv1.cloudManifestExplanation',{},$locale)}</p>
                  <dl class="cloud-readiness-grid">
                    <div><dt>{t('galleryv1.cloudWorkStructure',{},$locale)}</dt><dd>{t(cp.status.workStructureObserved?'galleryv1.cloudObserved':'galleryv1.cloudNotVerified',{},$locale)}</dd></div>
                    <div><dt>{t('galleryv1.cloudRevisionHistory',{},$locale)}</dt><dd>{t(cp.status.revisionHistoryObserved?'galleryv1.cloudObserved':'galleryv1.cloudNotVerified',{},$locale)} ({cp.databaseManifest.historicalRevisionRowCount})</dd></div>
                    <div><dt>{t('galleryv1.cloudCoverReferences',{},$locale)}</dt><dd>{t(cp.status.coverReferencesObserved?'galleryv1.cloudObserved':'galleryv1.cloudNotVerified',{},$locale)}</dd></div>
                    <div><dt>{t('galleryv1.cloudMediaOwnership',{},$locale)}</dt><dd>{t(cp.status.mediaOwnershipObserved?'galleryv1.cloudObserved':'galleryv1.cloudNotVerified',{},$locale)}</dd></div>
                    <div><dt>{t('galleryv1.cloudOwnerCreator',{},$locale)}</dt><dd>{t(cp.status.ownerCreatorObserved?'galleryv1.cloudObserved':'galleryv1.cloudNotVerified',{},$locale)}</dd></div>
                    <div><dt>{t('galleryv1.cloudEntitlement',{},$locale)}</dt><dd>{t(cp.entitlement.source==='not_configured'?'galleryv1.cloudNotConfigured':'galleryv1.cloudNotVerified',{},$locale)}</dd></div>
                    <div><dt>{t('galleryv1.cloudStorageReadback',{},$locale)}</dt><dd>{t(cp.status.storageBytesVerified?'galleryv1.cloudEvidenceObserved':'galleryv1.cloudNotVerified',{},$locale)}</dd></div>
                    <div><dt>{t('galleryv1.cloudPrivateAccess',{},$locale)}</dt><dd>{t(cp.status.privateAclVerified?'galleryv1.cloudEvidenceObserved':'galleryv1.cloudNotVerified',{},$locale)}</dd></div>
                    <div><dt>{t('galleryv1.cloudBackupRestore',{},$locale)}</dt><dd>{t(cp.status.backupRestoreVerified?'galleryv1.cloudEvidenceObserved':'galleryv1.cloudNotVerified',{},$locale)}</dd></div>
                    <div><dt>{t('galleryv1.cloudDependentWorks',{},$locale)}</dt><dd>{t(cp.status.dependencyGraphVerified && preflight.graphComplete?'galleryv1.cloudEvidenceObserved':'galleryv1.cloudNotVerified',{},$locale)}</dd></div>
                    <div><dt>{t('galleryv1.cloudPreviousLinks',{},$locale)}</dt><dd>{t(cp.signedUrlAndCacheRevocationProven && preflight.previousSignedUrlsRevoked && preflight.cdnAndBrowserPurgeProven?'galleryv1.cloudEvidenceObserved':'galleryv1.cloudNotVerified',{},$locale)}</dd></div>
                  </dl>
                  <p class="cloud-unavailable-reasons">{t('galleryv1.cloudUnavailableReasons',{},$locale)}</p>
                  {#if cp.databaseManifest.coverWithoutCompositionCount>0 || cp.databaseManifest.invalidOrNonOwnedMediaCount>0 ||
                    !cp.databaseManifest.structuralIntegrityObserved}
                    <p role="alert">{t('galleryv1.cloudManifestProblems',{},$locale)}</p>
                  {/if}
                  <p class="cloud-private-disabled">{t('galleryv1.cloudActionsDisabled',{},$locale)}</p>
                </div>
              {:else}
                <p role="status">{t('galleryv1.cloudLegacyUnavailable',{},$locale)}</p>
              {/if}
            {:else}
              <p role="status">{t('galleryv1.cloudPreflightEmpty',{},$locale)}</p>
            {/if}
            <button type="button" disabled={preflightBusy} on:click={()=>loadPreflight(String(management.workId))}>{t('galleryv1.retry',{},$locale)}</button>
          </section>
        {/if}
        <p role="status">{t('galleryv1.retirementBlocked',{},$locale)}</p>
        <button type="button" disabled aria-disabled="true">{t('galleryv1.unpublish',{},$locale)}</button>
        <h3>{t('galleryv1.deleteWork',{},$locale)}</h3>
        <p>{t('galleryv1.removeNote',{},$locale)}</p>
        <button type="button" disabled aria-disabled="true">{t('galleryv1.deleteWork',{},$locale)}</button>
      </div>
    </section>
  {/if}
</Sheet>
<style>
.gallery-my{width:min(1150px,calc(100% - 32px));margin:auto;padding:26px 0 68px}
header{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin:18px 0}
h1{font:600 clamp(30px,5vw,48px) Georgia,serif;margin:0}
button,.publish-link{min-height:44px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--ink);padding:9px 14px;font:inherit}
button:disabled{opacity:.55}.switcher{display:flex;gap:8px;margin:20px 0}.switcher button.active{border-color:var(--gold);font-weight:800}
.controls{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin:16px 0}.controls label,.sign-in label{display:grid;gap:6px;min-width:200px;flex:1;color:var(--ink-soft)}
input:not([type=checkbox]),select{min-height:44px;min-width:0;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-raised);color:var(--ink);font:inherit}
.sign-in{display:grid;gap:12px;max-width:540px;padding:20px;border:1px solid var(--border);border-radius:20px}
.my-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr));gap:14px}
.my-card{min-height:140px;min-width:0;display:flex;justify-content:space-between;align-items:start;gap:10px;padding:18px;border:1px solid var(--border);border-radius:20px;background:var(--surface)}
.my-card a{display:grid;gap:10px;min-width:0;overflow-wrap:anywhere;color:var(--ink)}.my-card small{color:var(--ink-muted)}
.owner-panel{display:grid;gap:12px}
.cloud-preservation-readiness{display:grid;gap:10px;min-width:0}
.cloud-preservation-readiness h4,.gallery-dependency-readiness h4{margin:0}
.gallery-dependency-readiness{display:grid;gap:10px;min-width:0}
.gallery-dependency-readiness p{overflow-wrap:anywhere}
.cloud-readiness-grid{display:grid;gap:8px;min-width:0;margin:0}
.cloud-readiness-grid>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;border-bottom:1px solid var(--border);padding:6px 0;min-width:0}
.cloud-readiness-grid dt,.cloud-readiness-grid dd{margin:0;overflow-wrap:anywhere}
.cloud-readiness-grid dd{color:var(--ink-soft);text-align:end}
.cloud-unavailable-reasons,.cloud-private-disabled,.cloud-preservation-summary{overflow-wrap:anywhere}
@media(max-width:360px){.cloud-readiness-grid>div{grid-template-columns:1fr;gap:4px}.cloud-readiness-grid dd{text-align:start}}
.blocked-actions{display:grid;gap:12px;padding:14px;border:1px solid var(--border);border-radius:15px;overflow-wrap:anywhere}
.comment-control{display:flex;align-items:center;gap:10px}.blocked-actions label{display:grid;gap:6px}.blocked-actions input,.blocked-actions textarea{width:100%;min-width:0;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--surface-raised);color:var(--ink)}.blocked-actions textarea{min-height:100px;resize:vertical}.notice{padding:15px;background:var(--surface)}
</style>
