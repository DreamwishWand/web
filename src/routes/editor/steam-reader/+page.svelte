<script>
  import {base} from '$app/paths';
  import {locale} from '$lib/i18n/runtime.js';
  import SteamSavedDiffGridsReadonly from '$lib/wep/SteamSavedDiffGridsReadonly.svelte';
  import {savedDiffGridsCopy} from '$lib/wep/steam-saved-diffgrids-copy.mjs';
  import {steamReaderInputHelp,STEAM_INPUT_HASH_COMMAND} from '$lib/wep/steam-reader-input-help.mjs';
  $: words=savedDiffGridsCopy($locale);
  $: prep=steamReaderInputHelp($locale);
</script>
<svelte:head>
  <title>{words.preformal} | Dreamwish Wand</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>
<section class="container steam-reader-test" data-preformal-steam-reader="true">
  <a data-sveltekit-reload href={base+'/editor/'}>Editor</a>
  <h1>{words.preformal}</h1>
  <details class="input-help" data-steam-input-help>
    <summary>{prep.title}</summary>
    <div class="input-help-body">
      <p>{prep.version}</p>
      <p>{prep.hash}</p>
      <pre><code>{STEAM_INPUT_HASH_COMMAND}</code></pre>
      <p>{prep.open}</p>
    </div>
  </details>
  <SteamSavedDiffGridsReadonly preformal={true} />
</section>
<style>
  .steam-reader-test{max-width:1100px;padding-block:48px 90px;min-width:0}
  h1{overflow-wrap:anywhere}
  .input-help{border:1px solid var(--border);border-radius:12px;padding:12px 16px;margin-block:18px;min-width:0;overflow-wrap:anywhere}
  .input-help summary{cursor:pointer;font-weight:700;min-height:32px}
  .input-help summary:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
  .input-help-body{font-size:14px;line-height:1.6}
  pre{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-all;background:var(--surface-raised);padding:12px;border-radius:8px;max-width:100%;min-width:0}
</style>
