<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { locale } from '$lib/i18n/runtime.js';
  import { getCommunityBrowserConfig } from '$lib/community/browser-client';
  import { parseOwnerWorkRoute } from '$lib/dreamsnaps/owner-management.js';
  import {
    DISPOSABLE_SIGNED_OWNER_BROWSER_ENABLED,
    localOwnerTestOrigin, disposableGoTrueLogin, readDisposableSignedOwner
  } from '$lib/dreamsnaps/disposable-signed-owner-browser.js';
  import { disposableOwnerReadCopy } from '$lib/dreamsnaps/disposable-owner-read-copy.js';

  const config=getCommunityBrowserConfig();
  // Disposable runner-local public anon key; never a user credential or production issuer.
  const localApiKey=String(import.meta.env.VITE_DDVRE_DISPOSABLE_ANON_KEY??'');
  let origin: string | null = null;
  let email='', password='', token='';
  let generation=0, pending=false, loginPending=false;
  let route: {status:string; workId:string|null}={status:'draft',workId:null};
  let view: any=null;
  let readStatus='unavailable';
  $: copy=disposableOwnerReadCopy($locale);

  afterNavigate(({to})=>{
    origin=typeof window === 'undefined' || !config
      ? null : localOwnerTestOrigin(config.supabaseUrl+'/',window.location.hostname);
    const current=++generation;
    route=parseOwnerWorkRoute(to?.url?.search??'');
    view=null;
    readStatus='unavailable';
    pending=false;
    if(token && origin && route.workId && route.status==='authority-pending')
      void refresh(current);
  });

  async function login() {
    if(!DISPOSABLE_SIGNED_OWNER_BROWSER_ENABLED || !origin || !config || loginPending) return;
    const current=++generation;
    view=null;
    readStatus='unavailable';
    loginPending=true;
    let accessToken: string | null = null;
    try {
      accessToken=await disposableGoTrueLogin({
        origin,publishableKey:localApiKey,email,password
      });
    } finally {
      password='';
      loginPending=false;
    }
    if(current!==generation)return;
    token=accessToken??'';
    if(token && route.workId && route.status==='authority-pending') void refresh();
  }

  function logout() {
    ++generation;
    token=''; password='';email='';
    view=null;pending=false;readStatus='unavailable';
  }

  async function refresh(expectedGeneration=++generation) {
    if(!DISPOSABLE_SIGNED_OWNER_BROWSER_ENABLED || !origin || !config ||
       !token || !route.workId || route.status!=='authority-pending')return;
    const workId=route.workId;
    const current=expectedGeneration;
    pending=true;
    view=null;
    readStatus='unavailable';
    const result=await readDisposableSignedOwner({
      origin,publishableKey:localApiKey,
      accessToken:token,workId,requestGeneration:current,latestGeneration:current,
      getLatestGeneration:()=>generation
    });
    if(current!==generation || route.workId!==workId)return;
    pending=false;
    // Strict WEB267 result is ONLY a schema candidate, never a verified owner.
    view=result.safeView??null;
    readStatus=view ? 'candidate' : 'unavailable';
  }
</script>

{#if DISPOSABLE_SIGNED_OWNER_BROWSER_ENABLED && origin}
  <section class="local-test" data-local-owner-browser="isolated-only"
    data-owner-actions-enabled="false" aria-labelledby="local-owner-heading">
    <h2 id="local-owner-heading">{copy.heading}</h2>
    <p class="muted">{copy.intro}</p>
    {#if !token}
      <form on:submit|preventDefault={login} autocomplete="off">
        <label for="test-owner-email">{copy.email}</label>
        <input id="test-owner-email" type="email" bind:value={email}
          autocomplete="off" spellcheck="false" required />
        <label for="test-owner-password">{copy.password}</label>
        <input id="test-owner-password" type="password" bind:value={password}
          autocomplete="off" required />
        <button type="submit" disabled={loginPending}>{copy.login}</button>
      </form>
    {:else}
      <div class="actions">
        <button type="button" on:click={()=>void refresh()} disabled={pending || route.status!=='authority-pending'}>
          {copy.refresh}
        </button>
        <button type="button" on:click={logout}>{copy.logout}</button>
      </div>
      {#if route.status==='invalid'}
        <p data-local-owner-state="invalid" role="alert">{copy.unavailable}</p>
      {:else if route.status==='authority-pending'}
        {#if view && readStatus==='candidate'}
          <div role="status" data-local-owner-state="source-candidate-only"
            data-local-owner-kind={view.kind}
            data-local-owner-entry={view.entryStatus}
            data-local-owner-grant={view.grantStatus}
            data-local-owner-policy={view.policyStatus}>
            <p>{copy.candidate}</p>
            <p>{view.kind==='OriginalCompetition' ? copy.original : copy.post}</p>
            <p>{view.grantStatus==='withdrawn' ? copy.withdrawn : copy.recorded}</p>
            <p>{view.policyStatus==='unverified' ? copy.unverified : copy.synthetic}</p>
            <p>{copy.purge}</p>
          </div>
        {:else if !pending}
          <p data-local-owner-state="unavailable" role="status">{copy.unavailable}</p>
        {:else}
          <p data-local-owner-state="pending" role="status">{copy.unavailable}</p>
        {/if}
      {/if}
    {/if}
    <p data-owner-operations="all-disabled">{copy.actionsDisabled}</p>
  </section>
{/if}

<style>
  .local-test{display:grid;gap:12px;margin:20px 0;padding:16px;min-width:0;
    background:var(--surface);border:1px dashed var(--border);border-radius:18px}
  .local-test h2{font-size:1.1rem;margin:0}
  .muted{color:var(--ink-muted)}
  form{display:grid;gap:8px;max-width:500px}
  input{width:100%;min-width:0;padding:10px;border-radius:10px;border:1px solid var(--border);
    background:var(--surface-raised);color:var(--ink);font:inherit}
  button{min-height:44px;max-width:100%;width:fit-content;border:1px solid var(--border);
    padding:10px 14px;border-radius:999px;color:var(--ink);background:var(--surface-raised);
    overflow-wrap:anywhere}
  button:focus-visible,input:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
  .actions{display:flex;gap:12px;flex-wrap:wrap}
  [data-local-owner-state]{overflow-wrap:anywhere}
  @media(max-width:400px){.local-test{padding:12px}button{width:100%}}
</style>
