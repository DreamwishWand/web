<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { dreamsnapPrivacyCopy } from '$lib/dreamsnaps/privacy-copy.js';
  $: copy = dreamsnapPrivacyCopy($locale);
</script>

<svelte:head><title>{copy.community} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container" data-legacy-dreamsnaps="fail-closed">
  <h1>{copy.community}</h1>
  <p class="notice" role="status">{copy.legacyUnavailable}</p>
  <a class="inline-link" href={`${base}/dreamsnaps/`}>DreamSnaps</a>
</section>
