<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import SiteHeader from '$lib/SiteHeader.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  export let data: { canonicalPreview: string | null };

  import { initializeLocalePreference } from '$lib/i18n/preference.js';

  onMount(() => {
    void initializeLocalePreference();
  });
</script>

<svelte:head>{#if data?.canonicalPreview}<link rel="canonical" href={data.canonicalPreview} />{/if}</svelte:head>

<div class="site-shell">
  <SiteHeader />
  <main id="main-content"><slot /></main>
  <SiteFooter />
</div>
