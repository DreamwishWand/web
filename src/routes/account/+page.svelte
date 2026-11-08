<script lang="ts">
  import { onMount } from 'svelte';
  import { locale } from '$lib/i18n/runtime.js';
  import ResponsiveFrame from '$lib/ui/ResponsiveFrame.svelte';
  import { CommunityLabClient } from '$lib/community/staging-http-client';
  import { firstAccountCopy } from '$lib/account-ui/copy.mjs';
  import {
    resolveFirstAccountTestGate, registerDisposableFirstAccount,
    signInDisposableFirstAccount, signOutDisposableFirstAccount,
    verifyDisposableFirstAccount
  } from '$lib/account-ui/test-contract.mjs';

  const LOCAL_TEST_FLAG=import.meta.env.VITE_WAND_DISPOSABLE_ACCOUNT_TEST ?? '';
  const STAGING_URL=import.meta.env.VITE_SUPABASE_URL ?? '';
  const STAGING_PUBLISHABLE_KEY=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
  let testEnabled=false;
  let client: CommunityLabClient | null=null;
  let email='';
  let password='';
  let phase: 'OFF'|'READY'|'WAIT_EMAIL'|'VERIFIED'|'ERROR'|'SIGNED_OUT'='OFF';
  let busy=false;

  $: copy=firstAccountCopy($locale);

  onMount(()=>{
    const gate=resolveFirstAccountTestGate({
      flag:LOCAL_TEST_FLAG,hostname:window.location.hostname,
      supabaseUrl:STAGING_URL,publishableKey:STAGING_PUBLISHABLE_KEY
    });
    if(!gate.allowed)return;
    try{
      client=new CommunityLabClient({supabaseUrl:STAGING_URL,publishableKey:STAGING_PUBLISHABLE_KEY});
      testEnabled=true;
      phase='READY';
      // Never trust a token restored from sessionStorage without a fresh
      // signed current-actor query; a revoked/other-Account session stays hidden.
      if(client.session){
        busy=true;
        void verifyDisposableFirstAccount(client).then(()=>{
          phase='VERIFIED';
        }).catch(()=>{
          phase='ERROR';
        }).finally(()=>{busy=false;});
      }
    }catch{
      client=null;
      testEnabled=false;
      phase='OFF';
    }
  });

  async function register():Promise<void>{
    if(!testEnabled||!client||busy||!email.trim()||!password)return;
    busy=true;
    try {
      await registerDisposableFirstAccount(client,email,password);
      phase='WAIT_EMAIL';
    }catch{
      phase='ERROR';
    }finally{
      password='';
      busy=false;
    }
  }

  async function login():Promise<void>{
    if(!testEnabled||!client||busy||!email.trim()||!password)return;
    busy=true;
    try{
      await signInDisposableFirstAccount(client,email,password);
      phase='VERIFIED';
    }catch{
      phase='ERROR';
    }finally{
      password='';
      busy=false;
    }
  }

  async function logout():Promise<void>{
    if(!testEnabled||!client||busy)return;
    busy=true;
    try{
      await signOutDisposableFirstAccount(client);
    }catch{
      // The canonical client clears local session even after a failed provider call.
      // Do not keep the previous authenticated user visible after attempted logout.
    }finally{
      phase='SIGNED_OUT';
      password='';
      busy=false;
    }
  }
</script>

<svelte:head>
  <title>{copy.title} | Dreamwish Wand</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<ResponsiveFrame className="first-account">
  <section class="first-account-panel" data-account-entry
    data-account-test-runtime={testEnabled ? 'disposable-only' : 'off'}
    data-account-public="off" data-private-library="off">
    <p class="eyebrow">{copy.test}</p>
    <h1>{copy.title}</h1>
    <p>{copy.intro}</p>
    {#if !testEnabled}
      <p class="account-off" role="status" data-account-off>{copy.off}</p>
    {:else}
      <p class="account-test" data-account-disposable-only>{copy.test}</p>
    {/if}
    <form data-first-account-form on:submit|preventDefault={login}>
      <fieldset disabled={!testEnabled || busy}>
        <label>{copy.email}
          <input data-first-account-email type="email" bind:value={email}
            autocomplete="username" required />
        </label>
        <label>{copy.password}
          <input data-first-account-password type="password" bind:value={password}
            autocomplete="current-password" minlength="15" required />
        </label>
        <div class="first-account-actions">
          <button type="button" data-first-account-register on:click={register}
            disabled={!testEnabled || busy || !email.trim() || !password}>{copy.register}</button>
          <button type="submit" data-first-account-login
            disabled={!testEnabled || busy || !email.trim() || !password}>{copy.signIn}</button>
        </div>
      </fieldset>
    </form>
    <div class="first-account-state" role="status" aria-live="polite" data-first-account-state={phase}>
      {#if phase==='WAIT_EMAIL'}{copy.pending}
      {:else if phase==='VERIFIED'}{copy.signed}
      {:else if phase==='SIGNED_OUT'}{copy.out}
      {:else if phase==='ERROR'}{copy.failed}
      {:else if !testEnabled}{copy.off}
      {:else}{copy.test}{/if}
    </div>
    {#if testEnabled && phase==='VERIFIED'}
      <button type="button" on:click={logout} disabled={busy}
        data-first-account-logout>{copy.signOut}</button>
    {/if}
    <p class="first-account-links" aria-disabled="true" data-private-library-route-off>{copy.library}</p>
    <p data-account-private-warning>{copy.libraryOff}</p>
    <p data-account-public-profile-warning>{copy.profileOff}</p>
  </section>
</ResponsiveFrame>

<style>
  .first-account-panel{max-width:680px;margin:24px auto 60px;padding:clamp(16px,4vw,30px);border:1px solid var(--border);border-radius:18px;background:var(--surface);color:var(--ink)}
  .first-account-panel h1{font:600 clamp(30px,5vw,44px)/1.25 Georgia,serif;margin:8px 0}
  .first-account-panel p{font-size:14px;line-height:1.7;color:var(--ink-soft);overflow-wrap:anywhere}
  .first-account-panel .eyebrow{font-size:11px;color:var(--gold)}
  .account-off,.account-test,.first-account-state{padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-raised)}
  fieldset{border:0;padding:0;min-width:0}
  fieldset:disabled{opacity:.55}
  label{display:grid;gap:6px;margin:12px 0;font-size:13px}
  input{width:100%;box-sizing:border-box;min-width:0;border:1px solid var(--border);border-radius:9px;min-height:44px;padding:10px;background:var(--surface-raised);color:var(--ink)}
  .first-account-actions,.first-account-links{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}
  button,.first-account-links a{border:1px solid var(--border);border-radius:10px;min-height:44px;padding:10px 16px;background:var(--surface-raised);color:var(--ink);font:inherit}
  button:disabled{cursor:not-allowed;opacity:.5}
  button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
</style>
