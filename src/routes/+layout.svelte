<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import SiteHeader from '$lib/SiteHeader.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { canonicalForApprovedStaticPath } from '$lib/foundation/canonical-domain-preview.mjs';
  // Explicit owner-controlled custom-root preview only; existing /web Pages gets no new canonical.
  $: canonicalPreview = canonicalForApprovedStaticPath($page.url.pathname, {
    basePath: base,
    origin: import.meta.env.VITE_WAND_CANONICAL_ORIGIN
  });

  import { initializeLocalePreference } from '$lib/i18n/preference.js';

  onMount(() => {
    void initializeLocalePreference();
  });
</script>

<svelte:head>{#if canonicalPreview}<link rel="canonical" href={canonicalPreview} />{/if}</svelte:head>

<div class="site-shell">
  <SiteHeader />
  <main id="main-content"><slot /></main>
  <SiteFooter />
</div>
