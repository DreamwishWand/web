<script lang="ts">
  import {onMount} from 'svelte';
  import {afterNavigate} from '$app/navigation';
  import {createCommunityBrowserClient} from '$lib/community/browser-client';
  import {parseOwnerWorkRoute,OWNER_MANAGEMENT_ENABLED} from '$lib/dreamsnaps/owner-management.js';
  import {createOwnerSharedAuthConsumer} from '$lib/dreamsnaps/owner-shared-auth-consumer.js';
  import {createOwnerReadRevalidation,OWNER_REVALIDATION_PRODUCTION_ENABLED} from '$lib/dreamsnaps/owner-read-revalidation.js';
  import {readIsolatedSource153Owner,SOURCE153_BROWSER_E2_PRODUCTION_ENABLED} from '$lib/dreamsnaps/source153-owner-browser-e2.js';
  import {SOURCE153_OWNER_V2_LIVE_ENABLED} from '$lib/dreamsnaps/source153-owner-consumer-v2.js';
  import {OWNER_PRODUCT_READONLY_ENABLED,OWNER_PRODUCT_MANAGED_INGRESS_ACCEPTED} from '$lib/dreamsnaps/owner-product-readonly.js';

  // Disposable experiment ONLY. Even a VITE_* toggle cannot enable the
  // regular Owner route, this page in production, or native/privileged actions.
  const localOnly=import.meta.env.DEV &&
    import.meta.env.VITE_DDVRE_E2_OWNER_READONLY==='LOCAL_DISPOSABLE_ONLY' &&
    import.meta.env.VITE_DDVRE_SHARED_BRIDGE==='LOCAL_DISPOSABLE_ONLY' &&
    !OWNER_MANAGEMENT_ENABLED && !SOURCE153_OWNER_V2_LIVE_ENABLED &&
    !SOURCE153_BROWSER_E2_PRODUCTION_ENABLED && !OWNER_REVALIDATION_PRODUCTION_ENABLED &&
    !OWNER_PRODUCT_READONLY_ENABLED && !OWNER_PRODUCT_MANAGED_INGRESS_ACCEPTED;
  let client:any=null,consumer:any=null,controller:any=null;
  let route:{status:string;workId:string|null}={status:'invalid',workId:null};
  let email='',password='',signedIn=false,working=false;
  let status='AUTH_REQUIRED',view:any=null,canInspect=false,canFresh=false;
  const state=(next:any)=>{
    status=next.status;view=next.view;canInspect=next.canInspect;
    canFresh=next.canFreshRead;working=next.working;
  };
  function routeChange(search:string){
    route=parseOwnerWorkRoute(search);
    consumer?.routeChanged(route.workId);
  }
  afterNavigate(({to})=>routeChange(to?.url?.search??''));
  onMount(()=>{
    if(!localOnly)return;
    client=createCommunityBrowserClient();
    if(!client)return;
    controller=createOwnerReadRevalidation({
      read:(args:any)=>readIsolatedSource153Owner({fetchImpl:fetch,...args}),
      onChange:state
    });
    consumer=createOwnerSharedAuthConsumer({
      client,controller,enabled:true,onSessionChange:(value:boolean)=>{signedIn=value;}
    });
    consumer.attach();
    routeChange(window.location.search);
    return ()=>{
      consumer?.dispose();controller?.dispose();
      client=null;consumer=null;controller=null;email='';password='';
    };
  });
  async function login(){
    if(!localOnly||!client||working)return;
    working=true;
    const a=email,b=password;
    email='';password='';
    try {await client.signInWithPassword(a,b);}
    catch {status='AUTH_REQUIRED';signedIn=false;}
    finally {working=false;}
  }
  async function inspect(fresh=false){
    if(!localOnly || !signedIn || !consumer ||
      route.status!=='authority-pending'||!route.workId)return;
    await consumer.inspect({fresh});
  }
  async function logout(){
    if(!client)return;
    // Shared Auth invalidates in memory synchronously before network logout.
    try{await client.signOut();}catch{ /* local invalidation is already final */ }
    email='';password='';
  }
</script>

<svelte:head><title>Disposable signed Owner bridge | Wand</title></svelte:head>
{#if localOnly}
<section class="inside-page container" data-disposable-owner-bridge="local-only"
  data-owner-actions="disabled" data-source-candidate="only">
  <h1>Disposable signed Owner bridge</h1>
  <p>Actual local GoTrue + Source153 read. Candidate only; no verified Owner rights, publication or actions.</p>
  {#if route.status!=='authority-pending'}
    <p role="alert" data-bridge-invalid>INVALID_WORK</p>
  {:else}
    <form on:submit|preventDefault={login} data-bridge-login>
      <label for="bridge-email">Ephemeral test email</label>
      <input id="bridge-email" type="email" autocomplete="off" bind:value={email}/>
      <label for="bridge-pass">Ephemeral test password</label>
      <input id="bridge-pass" type="password" autocomplete="off" bind:value={password}/>
      <button type="submit" disabled={working}>Sign in (disposable)</button>
    </form>
    <button type="button" on:click={()=>inspect(false)} data-bridge-inspect
      disabled={!signedIn||working||(!canInspect&&status!=='AUTH_REQUIRED')}>
      Inspect signed Work
    </button>
    <button type="button" on:click={()=>inspect(true)} data-bridge-fresh
      disabled={!signedIn||working||!canFresh}>Explicit Fresh</button>
    <button type="button" on:click={logout} data-bridge-logout
      disabled={!signedIn}>Logout</button>
    <p role="status" aria-live="polite" data-bridge-status>{status}</p>
    {#if view}
      <dl data-bridge-projection="source-candidate-only">
        <dt>Kind</dt><dd data-bridge-kind>{view.kind}</dd>
        <dt>Entry</dt><dd data-bridge-entry>{view.entryState}</dd>
        <dt>Grant</dt><dd data-bridge-grant>{view.grantState}</dd>
        <dt>Public disabled</dt><dd data-bridge-public-disabled>{String(view.publicDisabled)}</dd>
      </dl>
    {/if}
  {/if}
  <p data-bridge-capabilities="all-disabled">No Owner verified, Media, Writer or Apply access.</p>
</section>
{:else}
  <section data-disposable-owner-bridge="disabled"><p role="status">Unavailable</p></section>
{/if}
<style>
  section{max-width:780px;padding-block:24px 56px}
  form{display:grid;gap:8px;max-width:420px}
  button{margin:8px 12px 8px 0}
  dl{display:grid;grid-template-columns:170px 1fr;gap:8px}
</style>
