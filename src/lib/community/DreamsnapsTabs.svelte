<script lang="ts">
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
</script>

<nav class="tabs" aria-label={t('dreamsnaps.nav.label', {}, $locale)}>
  <a href={`${base}/dreamsnaps/submit/`}>{t('dreamsnaps.tab.submit', {}, $locale)}</a>
  <a href={`${base}/dreamsnaps/judge/`}>{t('dreamsnaps.tab.judge', {}, $locale)}</a>
  <a href={`${base}/dreamsnaps/results/`}>{t('dreamsnaps.tab.results', {}, $locale)}</a>
  <a href={`${base}/dreamsnaps/my/`}>{t('dreamsnaps.tab.my', {}, $locale)}</a>
</nav>

<style>
  .tabs{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 26px}
  .tabs a{border:1px solid var(--border);border-radius:999px;padding:8px 13px;color:var(--ink);background:var(--surface)}
  .tabs a:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
</style>
