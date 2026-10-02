<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import SiteHeader from '$lib/SiteHeader.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { initializeLocalePreference } from '$lib/i18n/preference.js';

  onMount(() => {
    void initializeLocalePreference();
  });
</script>

<div class="site-shell">
  <SiteHeader />
  <main id="main-content"><slot /></main>
  <SiteFooter />
</div>
