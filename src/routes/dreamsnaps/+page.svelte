<script lang="ts">
  import { locale, ct as t } from '$lib/i18n/community.js';
  import DreamsnapsTabs from '$lib/community/DreamsnapsTabs.svelte';
</script>

<svelte:head><title>{t('dreamsnaps.title', {}, $locale)} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <p class="eyebrow">{t('dreamsnaps.eyebrow', {}, $locale)}</p>
  <h1>{t('dreamsnaps.title', {}, $locale)}</h1>
  <p class="page-intro">{t('dreamsnaps.intro', {}, $locale)}</p>
  <DreamsnapsTabs />
  <div class="notice">{t('dreamsnaps.landing.note', {}, $locale)}</div>
</section>
