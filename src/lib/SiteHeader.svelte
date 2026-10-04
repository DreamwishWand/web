<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, t, SUPPORTED_LOCALES } from '$lib/i18n/runtime.js';
  import { resetToBrowserLanguage, setManualLocalePreference } from '$lib/i18n/preference.js';
  import CommunityNav from '$lib/community/CommunityNav.svelte';
  import { homeCopy } from '$lib/product-home/copy.js';

  let theme: 'night' | 'day' = 'night';
  $: productCopy = homeCopy($locale);

  onMount(() => {
    theme = document.documentElement.dataset.theme === 'day' ? 'day' : 'night';
  });

  function toggleTheme(): void {
    theme = theme === 'night' ? 'day' : 'night';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('dreamwishwand-theme', theme); } catch { /* private mode */ }
  }

  function changeLocale(event: Event): void {
    setManualLocalePreference((event.currentTarget as HTMLSelectElement).value);
  }

  function useBrowserLanguage(): void {
    void resetToBrowserLanguage();
  }
</script>

<a class="skip-link" href="#main-content">{t('shared.a11y.skipToContent', {}, $locale)}</a>
<header class="site-header">
  <div class="header-inner">
    <a class="brand" href={`${base}/`} aria-label={t('shared.brand.homeLabel', {}, $locale)}>
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M10 37 34 13" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="m32 5 2.7 6.3L41 14l-6.3 2.7L32 23l-2.7-6.3L23 14l6.3-2.7L32 5Z" stroke="currentColor" stroke-width="1.8"/><path d="m13 8 1.4 3.6L18 13l-3.6 1.4L13 18l-1.4-3.6L8 13l3.6-1.4L13 8Z" fill="currentColor"/><path d="m39 28 1 2.8 2.8 1-2.8 1L39 35l-1-2.2-2.8-1 2.8-1L39 28Z" fill="currentColor"/></svg>
      </span>
      <span class="brand-wordmark">Dreamwish <span>Wand</span></span>
    </a>
    <nav class="main-nav" aria-label={t('shared.nav.primaryLabel', {}, $locale)}>
      <a href={`${base}/explore/`}>{productCopy.decorate}</a>
      <a href={`${base}/collection/`}>{productCopy.collection}</a>
      <a href={`${base}/guide/`}>{productCopy.guide}</a>
      <a href={`${base}/presets/`}>{productCopy.presets}</a>
      <CommunityNav />
    </nav>
    <div class="locale-control">
      <label class="visually-hidden" for="site-locale">{t('shared.locale.label', {}, $locale)}</label>
      <select id="site-locale" class="locale-select" value={$locale} on:change={changeLocale}>
        {#each SUPPORTED_LOCALES as option}<option value={option.code}>{option.nativeName}</option>{/each}
      </select>
      <button class="locale-reset" type="button" on:click={useBrowserLanguage}>{t('shared.locale.useBrowserLanguage', {}, $locale)}</button>
    </div>
    <button class="theme-button" type="button" aria-label={theme === 'night' ? t('shared.theme.switchToDay', {}, $locale) : t('shared.theme.switchToNight', {}, $locale)} aria-pressed={theme === 'day'} on:click={toggleTheme}>
      {#if theme === 'night'}<span aria-hidden="true">☀</span><span class="theme-label">{t('shared.theme.light', {}, $locale)}</span>{:else}<span aria-hidden="true">☾</span><span class="theme-label">{t('shared.theme.dark', {}, $locale)}</span>{/if}
    </button>
  </div>
</header>
