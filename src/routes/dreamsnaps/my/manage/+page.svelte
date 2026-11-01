<script lang="ts">
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { createCommunityBrowserClient } from '$lib/community/browser-client';
  import { dreamsnapOwnerCopy } from '$lib/dreamsnaps/owner-management-copy.js';
  import {
    OWNER_PRODUCT_READONLY_ENABLED, OWNER_PRODUCT_MANAGED_INGRESS_ACCEPTED,
    ownerProductSignedSessionCandidate, createOwnerProductReadOnlyAdapter
  } from '$lib/dreamsnaps/owner-product-readonly.js';
  import {
    createOwnerReadRevalidation, attachOwnerReadBrowserLifecycle
  } from '$lib/dreamsnaps/owner-read-revalidation.js';
  import {
    OWNER_MANAGEMENT_ENABLED, OWNER_BACKEND_CAPABILITIES,
    parseOwnerWorkRoute, validateOwnerDraft
  } from '$lib/dreamsnaps/owner-management.js';

  const client = createCommunityBrowserClient();
  let signedIn = false;
  let route: {status:string;workId:string|null} = {status:'draft',workId:null};
  let kind = 'PostEventCreation';
  let challengeId = '';
  let concept = '';
  let preview: ReturnType<typeof validateOwnerDraft> | null = null;
  let ownerSource: ReturnType<typeof createOwnerReadRevalidation> | null = null;
  let ownerSourceStatus = 'BACKEND_UNAVAILABLE';
  let ownerSourceView: any = null;
  let ownerSourceInspect = false;
  let ownerSourceFresh = false;
  const productReadAvailable=OWNER_PRODUCT_READONLY_ENABLED &&
    OWNER_PRODUCT_MANAGED_INGRESS_ACCEPTED;
  const readCopy: Record<string,{inspect:string;fresh:string;hint:string}> = {
    en:{inspect:'Check this Work',fresh:'Start a fresh read',hint:'Signed read-only source information, not verified Owner access'},
    fr:{inspect:'Vérifier cette œuvre',fresh:'Commencer une nouvelle lecture',hint:'Données de source signées, pas un droit de gestion vérifié'},
    it:{inspect:'Verifica questa opera',fresh:'Avvia una nuova lettura',hint:'Informazioni firmate di sola lettura, non autorizzazione verificata'},
    de:{inspect:'Werk prüfen',fresh:'Neue Leseanfrage starten',hint:'Signierte Quelldaten, keine bestätigten Besitzerrechte'},
    'es-ES':{inspect:'Comprobar esta obra',fresh:'Iniciar nueva lectura',hint:'Información firmada de solo lectura, sin derechos verificados'},
    ja:{inspect:'この作品を再確認',fresh:'新しい読取りを開始',hint:'署名付きSource候補のみ。Owner権限の確認・付与ではありません'},
    'zh-CN':{inspect:'检查该作品',fresh:'开始新读取',hint:'仅签名来源数据，不表示已验证拥有者权限'},
    'pt-BR':{inspect:'Verificar esta obra',fresh:'Iniciar nova leitura',hint:'Dados de origem assinados, sem direitos verificados'}
  };
  $: ownerReadCopy=readCopy[$locale]??readCopy.en;

  $: copy = dreamsnapOwnerCopy($locale);
  $: canPreview = signedIn && route.status === 'draft' && !OWNER_MANAGEMENT_ENABLED;
  // No backend consumer, Work-ID lookup, media signer, optimistic mutation or upload
  // is permitted until the authenticated Owner backend passes independent QA.
  onMount(() => {
    signedIn=Boolean(client?.session);
    if(!productReadAvailable || !client)return;
    // This section cannot activate without a separately accepted managed
    // auth/ingress contract; the public flags remain false.
    const gateway=createOwnerProductReadOnlyAdapter({
      client,
      endpoint:import.meta.env.VITE_OWNER_MANAGED_READ_ENDPOINT,
      appOrigin:window.location.origin,
      sourceOrigin:client.config.supabaseUrl,
      fetchImpl:fetch
    });
    ownerSource=createOwnerReadRevalidation({
      read:gateway.read,
      onChange:state=>{
        ownerSourceStatus=state.status;
        ownerSourceView=state.view;
        ownerSourceInspect=state.canInspect;
        ownerSourceFresh=state.canFreshRead;
      }
    });
    const detach=attachOwnerReadBrowserLifecycle(ownerSource,{
      documentRef:document,windowRef:window
    });
    const syncSignedSession=()=>{
      const candidate=ownerProductSignedSessionCandidate(client);
      if(!candidate){
        ownerSource?.invalidate('SESSION_CHANGED');
        ownerSourceView=null;
      }
    };
    window.addEventListener('focus',syncSignedSession);
    window.addEventListener('pageshow',syncSignedSession);
    if(route.status==='authority-pending'){
      ownerSource.routeChanged(route.workId);
      const candidate=ownerProductSignedSessionCandidate(client);
      if(candidate)ownerSource.replaceSession(candidate.token,candidate.anonKey);
    }
    return ()=>{
      detach();
      window.removeEventListener('focus',syncSignedSession);
      window.removeEventListener('pageshow',syncSignedSession);
      ownerSource?.dispose();
      ownerSource=null;
    };
  });
  afterNavigate(({to}) => {
    route = parseOwnerWorkRoute(to?.url?.search ?? '');
    ownerSourceView=null;
    ownerSource?.routeChanged(route.workId);
    // Never carry an old signed session or displayed candidate across Work.
    if(productReadAvailable && route.status==='authority-pending'){
      const candidate=ownerProductSignedSessionCandidate(client);
      if(candidate)ownerSource?.replaceSession(candidate.token,candidate.anonKey);
    }
    preview = null; // no stale local preview when the SPA route changes.
    challengeId = ''; concept = '';
  });

  async function inspectOwnerSource(fresh=false){
    if(!productReadAvailable || !client || route.status!=='authority-pending' ||
       !ownerSource || !ownerProductSignedSessionCandidate(client))return;
    await ownerSource.revalidate({fresh});
  }
  function showPreview() {
    if (!canPreview) return;
    preview = validateOwnerDraft({ kind, challengeId, concept });
  }
</script>

<svelte:head><title>{copy.heading} | Dreamwish Wand</title></svelte:head>

<section class="inside-page container" data-owner-management="private-preview"
  data-public-detail="disabled" data-media-operations="disabled">
  <p class="eyebrow">DreamSnaps</p>
  <h1>{copy.heading}</h1>
  <p class="notice" role="status" data-owner-feature="off">{copy.previewOnly}</p>

  {#if route.status === 'invalid'}
    <p class="notice" role="alert" data-owner-state="invalid-url">{copy.invalidLink}</p>
  {:else if !client}
    <p class="notice" role="status" data-owner-state="config-unavailable">{copy.configUnavailable}</p>
  {:else if !signedIn}
    <p class="notice" role="status" data-owner-state="authentication-required">
      {copy.signIn} <a href={`${base}/dreamsnaps/my/`}>My DreamSnaps</a>
    </p>
  {:else if route.status === 'authority-pending'}
    <p class="notice" role="status" data-owner-state="backend-unavailable">{copy.ownerPending}</p>
    {#if productReadAvailable}
      <section class="panel" data-owner-product-read="source-only">
        <p role="status" aria-live="polite" data-owner-product-status>{ownerSourceStatus}</p>
        <p class="hint">{ownerReadCopy.hint}</p>
        <button type="button" on:click={() => inspectOwnerSource(false)}
          disabled={!ownerSourceInspect} data-owner-product-inspect>{ownerReadCopy.inspect}</button>
        {#if ownerSourceFresh}
          <button type="button" on:click={() => inspectOwnerSource(true)}
            disabled={!ownerSourceFresh} data-owner-product-fresh>{ownerReadCopy.fresh}</button>
        {/if}
        {#if ownerSourceView}
          <dl data-owner-product-projection="candidate-only">
            <dt>Work kind</dt><dd>{ownerSourceView.kind}</dd>
            <dt>Grant state</dt><dd>{ownerSourceView.grantState}</dd>
            <dt>Public disabled</dt><dd>{String(ownerSourceView.publicDisabled)}</dd>
          </dl>
        {/if}
      </section>
    {:else}
      <p class="hint" role="status" data-owner-product-read="disabled">{copy.ownerPending}</p>
    {/if}
  {:else}
    <section class="panel" data-owner-state="local-draft">
      <h2>{copy.preview}</h2>
      <label for="ds-kind">{copy.mode}</label>
      <select id="ds-kind" bind:value={kind} on:change={() => preview = null}>
        <option value="OriginalCompetition">{copy.original}</option>
        <option value="PostEventCreation">{copy.postEvent}</option>
      </select>
      <p class="hint" data-owner-kind-rule={kind}>{kind === 'OriginalCompetition' ? copy.originalRule : copy.postEventRule}</p>
      <label for="ds-challenge">{copy.challenge}</label>
      <input id="ds-challenge" type="text" autocomplete="off" spellcheck="false"
        bind:value={challengeId} on:input={() => preview = null} />
      <label for="ds-concept">{copy.concept}</label>
      <textarea id="ds-concept" rows="4" maxlength="2000"
        bind:value={concept} on:input={() => preview = null}></textarea>
      <button type="button" on:click={showPreview}>{copy.preview}</button>
      {#if preview?.status === 'preview-only'}
        <p role="status" data-owner-preview="local-only">{copy.previewReady}</p>
      {:else if preview?.status === 'invalid'}
        <p role="alert" data-owner-preview="invalid">{copy.invalidDraft}</p>
      {/if}
      <p class="hint">{copy.imageRule}</p>
    </section>
  {/if}

  <section class="panel" aria-labelledby="ds-rights">
    <h2 id="ds-rights">{copy.unofficial}</h2>
    <p>{copy.noOwnership}</p>
    <p>{copy.limitedGrant}</p>
    <p class="notice" data-owner-consent="backend-unavailable">{copy.consentPending}</p>
    <button type="button" disabled aria-disabled="true" data-owner-action="image-grant">{copy.consentPending}</button>
  </section>

  <section class="panel" aria-labelledby="ds-erasure">
    <h2 id="ds-erasure">{copy.deleteStates}</h2>
    <p>{copy.deleteRule}</p>
    <p class="notice" role="status" data-owner-erasure="unknown">{copy.deletePending}</p>
    <ol class="states">
      <li>{copy.requested}</li>
      <li>{copy.queued}</li>
      <li>{copy.processing}</li>
      <li>{copy.publicDisabled}</li>
      <li>{copy.mediaPurged}</li>
      <li>{copy.legalHold}</li>
    </ol>
    <button type="button" disabled aria-disabled="true" data-owner-action="request-delete">{copy.deletePending}</button>
  </section>
  <p class="notice" data-owner-capabilities="all-disabled" role="status">
    {copy.publishDisabled}
  </p>
  {#if OWNER_BACKEND_CAPABILITIES.ownerRead || OWNER_MANAGEMENT_ENABLED}
    <p role="alert" data-owner-state="unsafe-configuration">{copy.ownerPending}</p>
  {/if}
</section>

<style>
  .panel{display:grid;gap:10px;margin:18px 0;padding:18px;border:1px solid var(--border);border-radius:18px;background:var(--surface);min-width:0}
  .panel h2{font-size:1.1rem;line-height:1.4;overflow-wrap:anywhere}
  .panel p,.states li{overflow-wrap:anywhere}
  .states{padding-left:22px;display:grid;gap:6px}
  label{font-weight:600}input,textarea,select{min-width:0;width:100%;font:inherit;min-height:42px;padding:9px 10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-raised);color:var(--ink)}
  button{font:inherit;min-height:42px;padding:10px 14px;border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);width:fit-content;max-width:100%;overflow-wrap:anywhere}
  button:disabled{opacity:.75;cursor:not-allowed}
  button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
  .hint{font-size:.92rem;color:var(--ink-muted)}
  @media(max-width:400px){.panel{padding:12px}button{width:100%}}
</style>
