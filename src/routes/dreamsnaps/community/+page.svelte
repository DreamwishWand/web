<script lang="ts">
  import { locale } from '$lib/i18n/runtime.js';
  import { afterNavigate } from '$app/navigation';
  import { parseTypedWorkQuery } from '$lib/community/typed-work-route.js';
  import { dreamsnapPrivacyCopy } from '$lib/dreamsnaps/privacy-copy.js';
  import DreamsnapsTabs from '$lib/community/DreamsnapsTabs.svelte';
  $: copy = dreamsnapPrivacyCopy($locale);
  let workEntry: 'none' | 'gated' | 'invalid' = 'none';
  afterNavigate(({to}) => {
    if (!to?.url) return;
    if (!to.url.search) { workEntry = 'none'; return; }
    const selection = parseTypedWorkQuery(to.url.search, 'work');
    workEntry = selection.status === 'valid' ? 'gated' : 'invalid';
    // Deliberately never fetch, sign, or echo WorkID until signed/phase-safe
    // public DreamSnaps Detail and old-bearer/CDN acceptance are authorized.
  });
</script>
<svelte:head><title>{copy.community} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container" data-community-dreamsnaps="fail-closed">
  <h1>{copy.community}</h1>
  <DreamsnapsTabs />
  {#if workEntry === 'invalid'}
    <p class="notice" role="alert" data-dreamsnap-work-state="invalid-url">{copy.legacyUnavailable}</p>
  {:else if workEntry === 'gated'}
    <p class="notice" role="status" data-dreamsnap-work-state="authority-pending">{copy.communityUnavailable}</p>
  {:else}
    <p class="notice" role="status" data-dreamsnap-work-state="discovery-gated">{copy.communityUnavailable}</p>
  {/if}
</section>
