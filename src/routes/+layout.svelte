<script lang="ts">
  import '../app.css';
  import SiteHeader from '$lib/SiteHeader.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
</script>

<div class="site-shell">
  <SiteHeader />
  <main id="main-content"><slot /></main>
  <SiteFooter />
</div>
