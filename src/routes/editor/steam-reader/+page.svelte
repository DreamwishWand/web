<script>
  import {base} from '$app/paths';
  import {locale} from '$lib/i18n/runtime.js';
  import SteamSavedDiffGridsReadonly from '$lib/wep/SteamSavedDiffGridsReadonly.svelte';
  import {savedDiffGridsCopy} from '$lib/wep/steam-saved-diffgrids-copy.mjs';
  $: words=savedDiffGridsCopy($locale);
</script>
<svelte:head>
  <title>{words.preformal} | Dreamwish Wand</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>
<section class="container steam-reader-test" data-preformal-steam-reader="true">
  <a data-sveltekit-reload href={base+'/editor/'}>Editor</a>
  <h1>{words.preformal}</h1>
  <SteamSavedDiffGridsReadonly preformal={true} />
</section>
<style>
  .steam-reader-test{max-width:1100px;padding-block:48px 90px;min-width:0}
  h1{overflow-wrap:anywhere}
</style>
