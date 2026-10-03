<script lang="ts">
  import { locale, t } from '$lib/i18n/runtime.js';
</script>
<svelte:head><title>{t('gallery.title', {}, $locale)} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <p class="eyebrow">{t('gallery.eyebrow', {}, $locale)}</p>
  <h1>{t('gallery.title', {}, $locale)}</h1>
  <p class="page-intro">{t('gallery.intro', {}, $locale)}</p>
</section>
