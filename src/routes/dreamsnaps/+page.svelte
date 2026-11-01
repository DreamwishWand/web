<script lang="ts">
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { base } from '$app/paths';
  import { dreamsnapPrivacyCopy } from '$lib/dreamsnaps/privacy-copy.js';
</script>

<svelte:head><title>{t('dreamsnaps.title', {}, $locale)} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <p class="eyebrow">{t('dreamsnaps.eyebrow', {}, $locale)}</p>
  <h1>{t('dreamsnaps.title', {}, $locale)}</h1>
  <p class="page-intro">{t('dreamsnaps.intro', {}, $locale)}</p>
  <nav class="dreamsnaps-map" aria-label={t('dreamsnaps.nav.label', {}, $locale)}>
    <a class="feature" href={`${base}/dreamsnaps/community/`}>{dreamsnapPrivacyCopy($locale).community}</a>
    <div class="stage">
      <a href={`${base}/dreamsnaps/submit/`}>{t('dreamsnaps.tab.submit', {}, $locale)}</a>
      <a href={`${base}/dreamsnaps/judge/`}>{t('dreamsnaps.tab.judge', {}, $locale)}</a>
      <a href={`${base}/dreamsnaps/results/`}>{t('dreamsnaps.tab.results', {}, $locale)}</a>
    </div>
    <a class="feature" href={`${base}/dreamsnaps/my/`}>{t('dreamsnaps.tab.my', {}, $locale)}</a>
  </nav>
  <div class="notice">{t('dreamsnaps.landing.note', {}, $locale)}</div>
</section>

<style>
.dreamsnaps-map{display:grid;gap:12px;margin:24px 0}.dreamsnaps-map a{display:grid;place-items:center;min-height:88px;padding:18px;border:1px solid var(--border);border-radius:18px;background:var(--surface);color:var(--ink);text-align:center;text-decoration:none}.dreamsnaps-map a:focus-visible{outline:3px solid var(--gold);outline-offset:3px}.dreamsnaps-map .feature{min-height:108px}.dreamsnaps-map .stage{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}@media(max-width:580px){.dreamsnaps-map .stage{grid-template-columns:1fr}}
</style>
