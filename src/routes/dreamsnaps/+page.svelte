<script lang="ts">
  import {base} from '$app/paths';
  import {locale, ct as t} from '$lib/i18n/community.js';
  import {
    DREAMSNAPS_STAGE1_DESTINATIONS,
    dreamsnapsStage1Copy
  } from '$lib/community/dreamsnaps-stage1-root.mjs';
  $: ux=dreamsnapsStage1Copy($locale);
</script>

<svelte:head>
  <title>{t('dreamsnaps.title', {}, $locale)} | Dreamwish Wand</title>
  <meta name="description" content="DreamSnaps: community, submission, judging, results and your personal workspace." />
</svelte:head>

<section class="dreamsnaps-stage1 inside-page container" data-stage1-dreamsnaps-root="1-3-1"
  data-public-provider="off" data-writer="off" data-private-results="off" data-media-rights="unverified">
  <h1>{t('dreamsnaps.title', {}, $locale)}</h1>
  <nav class="dreamsnaps-flow" aria-label={t('dreamsnaps.nav.label', {}, $locale)}>
    <a class="dreamsnaps-destination wide community" data-dreamsnaps-child="community"
      href={base+DREAMSNAPS_STAGE1_DESTINATIONS[0].href}>
      <span class="dreamsnaps-symbol" aria-hidden="true">◇</span>
      <strong>{ux.community}</strong>
      <span class="dreamsnaps-arrow" aria-hidden="true">›</span>
    </a>

    <div class="dreamsnaps-peer-row" data-stage1-dreamsnaps-peers>
      <a class="dreamsnaps-destination peer" data-dreamsnaps-child="submit"
        href={base+DREAMSNAPS_STAGE1_DESTINATIONS[1].href}>
        <span class="dreamsnaps-symbol" aria-hidden="true">◇</span>
        <strong>{ux.submit}</strong><span class="dreamsnaps-arrow" aria-hidden="true">›</span>
      </a>
      <a class="dreamsnaps-destination peer" data-dreamsnaps-child="judge"
        href={base+DREAMSNAPS_STAGE1_DESTINATIONS[2].href}>
        <span class="dreamsnaps-symbol" aria-hidden="true">◇</span>
        <strong>{ux.judge}</strong><span class="dreamsnaps-arrow" aria-hidden="true">›</span>
      </a>
      <a class="dreamsnaps-destination peer" data-dreamsnaps-child="results"
        href={base+DREAMSNAPS_STAGE1_DESTINATIONS[3].href}>
        <span class="dreamsnaps-symbol" aria-hidden="true">◇</span>
        <strong>{ux.results}</strong><span class="dreamsnaps-arrow" aria-hidden="true">›</span>
      </a>
    </div>

    <a class="dreamsnaps-destination wide personal" data-dreamsnaps-child="my"
      href={base+DREAMSNAPS_STAGE1_DESTINATIONS[4].href}>
      <span class="dreamsnaps-symbol" aria-hidden="true">◇</span>
      <strong>{ux.my}</strong>
      <span class="dreamsnaps-arrow" aria-hidden="true">›</span>
    </a>
  </nav>
</section>

<style>
.dreamsnaps-stage1{padding-block:48px 88px;min-height:70vh}.dreamsnaps-stage1 h1{font-family:Georgia,serif;font-weight:500;font-size:clamp(38px,5vw,64px);letter-spacing:-.045em;margin:0 0 28px}.dreamsnaps-flow{display:grid;gap:16px}.dreamsnaps-destination{min-width:0;display:flex;align-items:center;gap:20px;padding:19px 23px;min-height:132px;text-decoration:none;color:var(--ink);background:var(--surface);border:1px solid var(--border);border-radius:20px;transition:border-color .15s,transform .15s}.dreamsnaps-destination:hover{border-color:var(--gold);transform:translateY(-2px)}.dreamsnaps-destination:focus-visible{outline:3px solid var(--gold);outline-offset:3px}.dreamsnaps-destination strong{font:500 clamp(20px,2.2vw,29px) Georgia,serif;line-height:1.25;overflow-wrap:anywhere}.dreamsnaps-symbol{flex:0 0 84px;width:84px;height:84px;display:grid;place-items:center;border-radius:15px;background:var(--surface-raised);color:var(--gold);font:40px Georgia,serif}.dreamsnaps-arrow{font-size:28px;line-height:1;margin-left:auto;color:var(--gold)}.dreamsnaps-destination.community{min-height:180px}.dreamsnaps-destination.community .dreamsnaps-symbol{width:124px;flex-basis:124px;height:124px}.dreamsnaps-destination.personal{min-height:140px}.dreamsnaps-peer-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.dreamsnaps-destination.peer{min-height:245px;display:flex;align-items:flex-start;flex-direction:column;gap:13px}.dreamsnaps-destination.peer .dreamsnaps-symbol{width:100%;flex-basis:120px;height:120px}.dreamsnaps-destination.peer .dreamsnaps-arrow{margin-left:auto;margin-top:auto}
@media(max-width:760px){.dreamsnaps-peer-row{grid-template-columns:1fr}.dreamsnaps-destination.peer{min-height:140px;flex-direction:row;align-items:center}.dreamsnaps-destination.peer .dreamsnaps-symbol{width:84px;height:84px;flex-basis:84px}.dreamsnaps-destination.peer .dreamsnaps-arrow{margin-top:0}}
@media(max-width:460px){.dreamsnaps-stage1{padding-block:30px 72px}.dreamsnaps-flow{gap:11px}.dreamsnaps-destination{padding:13px;min-height:106px;gap:12px;border-radius:15px}.dreamsnaps-destination.community,.dreamsnaps-destination.personal{min-height:116px}.dreamsnaps-destination.community .dreamsnaps-symbol,.dreamsnaps-destination.peer .dreamsnaps-symbol,.dreamsnaps-symbol{width:64px;height:64px;flex-basis:64px;font-size:28px}.dreamsnaps-destination.peer{min-height:106px}.dreamsnaps-destination strong{font-size:19px}.dreamsnaps-arrow{font-size:23px}}
</style>
