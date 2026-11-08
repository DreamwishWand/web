<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { firstAccountCopy } from '$lib/account-ui/copy.mjs';
  import ResponsiveFrame from '$lib/ui/ResponsiveFrame.svelte';
  $: copy=firstAccountCopy($locale);
</script>

<svelte:head>
  <title>{copy.library} | Dreamwish Wand</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<ResponsiveFrame className="private-library-shell">
  <!-- Static HTML may contain only a denial shell. No client cache, private
       account state, local token or other-Account listing belongs here.
       Server-verified current-actor RLS/ACL and private cache headers are
       separate managed-runtime acceptance gates. -->
  <section data-library-private-authorized="false"
    data-library-content="off" data-private-account-id="" class="library-denied">
    <h1>{copy.library}</h1>
    <p role="status">{copy.libraryOff}</p>
    <p>{copy.profileOff}</p>
    <a href={base+'/account/'}>{copy.back}</a>
  </section>
</ResponsiveFrame>

<style>
  .library-denied{max-width:680px;margin:28px auto 60px;padding:28px;border:1px solid var(--border);border-radius:18px;background:var(--surface)}
  h1{font:600 clamp(30px,5vw,44px)/1.3 Georgia,serif}
  p{color:var(--ink-soft);line-height:1.7;overflow-wrap:anywhere}
  a{color:var(--gold)}a:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
</style>
