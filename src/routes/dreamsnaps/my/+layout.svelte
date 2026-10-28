<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { dreamsnapOwnerCopy } from '$lib/dreamsnaps/owner-management-copy.js';
  $: copy = dreamsnapOwnerCopy($locale);
</script>

<nav class="owner-management-nav" aria-label={copy.heading}>
  <a href={`${base}/dreamsnaps/my/manage/`} data-owner-management-link="preview-only">{copy.nav}</a>
</nav>
<slot />

<style>
  .owner-management-nav { max-width:1200px;margin:0 auto;padding:8px 20px 0;text-align:right }
  .owner-management-nav a { display:inline-block;padding:9px 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--ink);text-decoration:none;max-width:100%;overflow-wrap:anywhere }
  .owner-management-nav a:focus-visible { outline:3px solid var(--gold);outline-offset:3px }
  @media (max-width:400px) { .owner-management-nav { text-align:left;padding-inline:12px } }
</style>
