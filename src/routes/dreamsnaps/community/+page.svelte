<script lang="ts">
  import { locale } from '$lib/i18n/runtime.js';
  import { dreamsnapPrivacyCopy } from '$lib/dreamsnaps/privacy-copy.js';
  import DreamsnapsTabs from '$lib/community/DreamsnapsTabs.svelte';
  $: copy = dreamsnapPrivacyCopy($locale);
</script>
<svelte:head><title>{copy.community} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container" data-community-dreamsnaps="fail-closed">
  <h1>{copy.community}</h1>
  <DreamsnapsTabs />
  <p class="notice" role="status">{copy.communityUnavailable}</p>
</section>
