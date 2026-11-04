<script lang="ts">
  import {base} from '$app/paths';
  import {locale} from '$lib/i18n/runtime.js';
  import {
    dreamsnapsStage1Copy,
    DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED
  } from '$lib/community/dreamsnaps-stage1-root.mjs';
  $: ux=dreamsnapsStage1Copy($locale);
</script>

<svelte:head>
  <title>{ux.community} | Dreamwish Wand</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<section class="community-dreamsnaps-off container" data-community-dreamsnaps="gated"
  data-public-provider="off" data-writer="off" data-media-rights="unverified"
  data-private-results="off">
  <a href={base+'/dreamsnaps/'} class="back">{ux.back}</a>
  <h1>{ux.community}</h1>
  <div class="public-modes" aria-label={ux.community}>
    <span>{ux.allWorks}</span><span>{ux.byChallenge}</span>
  </div>
  {#if !DREAMSNAPS_STAGE1_PUBLIC_PROVIDER_ENABLED}
    <section class="unavailable" role="status" aria-live="polite">
      <strong>{ux.locked}</strong>
      <p>{ux.unavailable}</p>
    </section>
  {/if}
</section>

<style>
.community-dreamsnaps-off{padding-block:52px 100px;min-height:65vh}.back{color:var(--ink-soft);text-decoration:underline;min-height:44px;display:inline-flex;align-items:center}.community-dreamsnaps-off h1{font:500 clamp(34px,5vw,58px) Georgia,serif;margin:16px 0 22px;letter-spacing:-.04em}.public-modes{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}.public-modes span{color:var(--ink-muted);padding:12px 15px;border:1px solid var(--border);border-radius:12px;background:var(--surface);font-size:12px}.unavailable{padding:24px;max-width:700px;border:1px solid var(--border);background:var(--surface);border-radius:18px;color:var(--ink)}.unavailable p{color:var(--ink-muted);line-height:1.7;margin:10px 0 0}.back:focus-visible{outline:3px solid var(--gold);outline-offset:3px}@media(max-width:460px){.community-dreamsnaps-off{padding-block:35px 70px}.unavailable{padding:17px}}
</style>
