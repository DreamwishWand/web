<script lang="ts">
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { createCommunityBrowserClient } from '$lib/community/browser-client';
  import { dreamsnapOwnerCopy } from '$lib/dreamsnaps/owner-management-copy.js';
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

  $: copy = dreamsnapOwnerCopy($locale);
  $: canPreview = signedIn && route.status === 'draft' && !OWNER_MANAGEMENT_ENABLED;
  // No backend consumer, Work-ID lookup, media signer, optimistic mutation or upload
  // is permitted until the authenticated Owner backend passes independent QA.
  onMount(() => { signedIn = Boolean(client?.session); });
  afterNavigate(({to}) => {
    route = parseOwnerWorkRoute(to?.url?.search ?? '');
    preview = null; // no stale local preview when the SPA route changes.
    challengeId = ''; concept = '';
  });

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
