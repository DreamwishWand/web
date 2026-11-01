<script lang="ts">
  import {afterNavigate} from '$app/navigation';
  import {locale} from '$lib/i18n/runtime.js';
  import {parseOwnerWorkRoute} from '$lib/dreamsnaps/owner-management.js';
  import {
    loginDisposableGoTrue,readIsolatedSource153Owner,
    SOURCE153_BROWSER_E2_PRODUCTION_ENABLED
  } from '$lib/dreamsnaps/source153-owner-browser-e2.js';
  import {SOURCE153_OWNER_V2_LIVE_ENABLED} from '$lib/dreamsnaps/source153-owner-consumer-v2.js';
  import {OWNER_MANAGEMENT_ENABLED} from '$lib/dreamsnaps/owner-management.js';

  // A disposable local fixture opt-in, excluded from production builds.
  const localOnly = import.meta.env.DEV &&
    import.meta.env.VITE_DDVRE_E2_OWNER_READONLY === 'LOCAL_DISPOSABLE_ONLY' &&
    !SOURCE153_BROWSER_E2_PRODUCTION_ENABLED &&
    !SOURCE153_OWNER_V2_LIVE_ENABLED && !OWNER_MANAGEMENT_ENABLED;
  const anonKey=localOnly ? String(import.meta.env.VITE_DDVRE_E2_LOCAL_ANON_KEY??'') : '';
  const copy: Record<string,string[]> = {
    en:['Isolated Owner read-only inspection','Test-only signed local session','Inspect this Work','Source-shaped candidate only, not verified Owner authority','Unavailable; do not publish or apply'],
    fr:['Inspection privée isolée','Session locale signée de test','Inspecter cette œuvre','Données candidates uniquement, sans autorisation confirmée','Indisponible, ne pas publier'],
    it:['Ispezione privata isolata','Sessione locale firmata di prova','Esamina opera','Solo dati candidati, non autorizzazione verificata','Non disponibile, non pubblicare'],
    de:['Isolierte Owner-Leseprüfung','Lokale signierte Testsitzung','Werk prüfen','Nur Quelldatenkandidat, keine bestätigte Berechtigung','Nicht verfügbar, nicht veröffentlichen'],
    'es-ES':['Inspección privada aislada','Sesión local firmada de prueba','Inspeccionar obra','Solo datos candidatos, sin autorización verificada','No disponible, no publicar'],
    ja:['隔離環境のOwner読取り検査','実署名のローカル検証セッション','このWorkを検査','Source候補の表示のみ。Owner権限は未確定です','使用不可：公開・Applyは禁止'],
    'zh-CN':['隔离Owner只读检查','本地签名测试会话','检查作品','仅供检查的Source候选，非已验证Owner授权','不可用，不得发布'],
    'pt-BR':['Inspeção privada isolada','Sessão local assinada de teste','Inspecionar trabalho','Somente candidato de fonte, não autorização verificada','Indisponível, não publicar']
  };
  $: labels = copy[$locale] ?? copy.en;
  let route: {status:string;workId:string|null} = {status:'invalid',workId:null};
  let email='',password='',token='',status='AUTH_REQUIRED';
  let view:any=null,working=false,epoch=0,aborter:AbortController|null=null;
  function clear(statusText='AUTH_REQUIRED') {
    ++epoch;
    aborter?.abort();
    aborter=null;
    view=null;status=statusText;working=false;
  }
  afterNavigate(({to})=>{
    clear();
    token='';email='';password='';
    route=parseOwnerWorkRoute(to?.url?.search??'');
  });
  async function signIn(){
    if(!localOnly || !anonKey)return;
    clear('CHECKING_SESSION');
    token='';
    const sequence=epoch;
    const controller=new AbortController();
    aborter=controller;working=true;
    const result=await loginDisposableGoTrue({
      fetchImpl:fetch,email,password,anonKey,signal:controller.signal
    });
    password='';
    if(sequence!==epoch || controller.signal.aborted)return;
    token=result.token??'';
    status=result.status;
    working=false;
  }
  async function inspect(){
    if(!localOnly || !token || route.status!=='authority-pending' || !route.workId)return;
    // Carry only the last displayed source CAS, never caller-supplied authority.
    // A changed server Work must reject this prior observation on re-inspection.
    const previousCas=view?.sourceCandidateOnly ? {
      expectedRowVersion:view.rowVersion,
      expectedAuthorizationEpoch:view.authorizationEpoch
    } : {};
    clear('READING_SOURCE');
    const sequence=epoch;
    const controller=new AbortController();
    aborter=controller;working=true;
    // Work ID is a locator only. Source153 binds GoTrue subject on the server.
    const result=await readIsolatedSource153Owner({
      fetchImpl:fetch,token,anonKey,workId:route.workId,
      requestGeneration:sequence,latestGeneration:sequence,
      ...previousCas,
      signal:controller.signal
    });
    if(sequence!==epoch || controller.signal.aborted)return;
    view=result.sourceCandidateOnly ? result:null;
    status=result.status;
    working=false;
  }
</script>

<svelte:head><title>{labels[0]} | Dreamwish Wand</title></svelte:head>
{#if localOnly}
<section class="inside-page container" data-source153-e2="local-only" data-owner-actions="disabled">
  <h1>{labels[0]}</h1>
  <p role="status">{labels[3]}</p>
  {#if route.status !== 'authority-pending'}
    <p role="alert" data-e2-state="invalid-work">{labels[4]}</p>
  {:else}
    <form on:submit|preventDefault={signIn} data-e2-login>
      <label for="e2-email">Synthetic email</label>
      <input id="e2-email" type="email" autocomplete="off" bind:value={email}/>
      <label for="e2-password">Synthetic password</label>
      <input id="e2-password" type="password" autocomplete="off" bind:value={password}/>
      <button type="submit" disabled={working}>{labels[1]}</button>
    </form>
    <button type="button" on:click={inspect} disabled={working || !token}
       data-e2-inspect>{labels[2]}</button>
    <p role="status" aria-live="polite" data-e2-status>{status}</p>
    {#if view}
      <dl data-e2-projection="candidate-only">
        <dt>Work kind</dt><dd data-e2-kind>{view.kind}</dd>
        <dt>Competition entry</dt><dd data-e2-entry>{view.entryState}</dd>
        <dt>Grant state</dt><dd data-e2-grant>{view.grantState}</dd>
        <dt>Policy scope</dt><dd data-e2-policy>{view.policyScope}</dd>
        <dt>Public disabled</dt><dd data-e2-public-disabled>{String(view.publicDisabled)}</dd>
      </dl>
    {/if}
  {/if}
  <p role="status" data-e2-capabilities="all-disabled">{labels[4]}</p>
</section>
{:else}
  <section class="inside-page container" data-source153-e2="disabled">
    <p role="status">Unavailable</p>
  </section>
{/if}
<style>
  section{max-width:800px;padding-block:24px 56px}
  h1{font-size:clamp(1.2rem,4vw,2rem);overflow-wrap:anywhere}
  form,dl{display:grid;gap:8px;max-width:600px}
  form{margin-block:22px}
  input,button{font:inherit;min-width:0;max-width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:10px;color:var(--ink);background:var(--surface)}
  button{margin-block:12px;min-height:44px}
  :is(button,input):focus-visible{outline:3px solid var(--gold);outline-offset:3px}
  dd{margin:0;overflow-wrap:anywhere}
  dl{grid-template-columns:minmax(0,1fr) minmax(0,2fr)}
  @media(max-width:400px){dl{grid-template-columns:1fr}}
</style>
