<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';

  let theme: 'night' | 'day' = 'night';
  onMount(() => {
    theme = document.documentElement.dataset.theme === 'day' ? 'day' : 'night';
  });
  function toggleTheme(): void {
    theme = theme === 'night' ? 'day' : 'night';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('dreamwishwand-theme', theme); } catch { /* private mode */ }
  }
</script>

<a class="skip-link" href="#main-content">本文へ移動</a>
<header class="site-header">
  <div class="header-inner">
    <a class="brand" href={`${base}/`} aria-label="Dreamwish Wand ホーム">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M10 37 34 13" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="m32 5 2.7 6.3L41 14l-6.3 2.7L32 23l-2.7-6.3L23 14l6.3-2.7L32 5Z" stroke="currentColor" stroke-width="1.8"/><path d="m13 8 1.4 3.6L18 13l-3.6 1.4L13 18l-1.4-3.6L8 13l3.6-1.4L13 8Z" fill="currentColor"/><path d="m39 28 1 2.8 2.8 1-2.8 1L39 35l-1-2.2-2.8-1 2.8-1L39 28Z" fill="currentColor"/></svg>
      </span>
      <span class="brand-wordmark">Dreamwish <span>Wand</span></span>
    </a>
    <nav class="main-nav" aria-label="メインナビゲーション">
      <a href={`${base}/explore/`}>Explore</a>
      <a href={`${base}/editor/`}>Editor</a>
      <a href={`${base}/projects/`}>My Projects</a>
    </nav>
    <button class="theme-button" type="button" aria-label={theme === 'night' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'} aria-pressed={theme === 'day'} on:click={toggleTheme}>
      {#if theme === 'night'}<span aria-hidden="true">☀</span><span class="theme-label">Light</span>{:else}<span aria-hidden="true">☾</span><span class="theme-label">Dark</span>{/if}
    </button>
  </div>
</header>
