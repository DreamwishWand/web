<script lang="ts">
  import { base } from '$app/paths';
  import { locale, t } from '$lib/i18n/runtime.js';
  import { imageRightsAttribution } from '$lib/i18n/image-rights-attribution.js';
  import Icon from '$lib/ui/Icon.svelte';
</script>
<footer class="site-footer">
  <div class="footer-inner">
    <span class="footer-brand"><Icon name="sparkle" decorative={true} size={16} /> Dreamwish Wand</span>
    <p class="image-rights-attribution" data-image-rights-attribution>{imageRightsAttribution($locale)}</p>
    <a href={base + '/help/'}>{t('shared.footer.helpBugs', {}, $locale)}</a>
  </div>
</footer>

<style>
  .image-rights-attribution { flex: 1 1 600px; min-width: 0; max-width: 100%; margin: 0;
    font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
  .footer-inner { padding-block: 16px; }
  .footer-inner a { flex-shrink: 0; }
  .footer-inner a:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
</style>
