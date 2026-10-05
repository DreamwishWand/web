<script lang="ts">
  import { base } from '$app/paths';
  import { locale, t } from '$lib/i18n/runtime.js';
  import Icon from '$lib/ui/Icon.svelte';
</script>
<footer class="site-footer">
  <div class="footer-inner">
    <span class="footer-brand"><Icon name="sparkle" decorative={true} size={16} /> Dreamwish Wand</span>
    <span>{t('shared.footer.disclaimer', {}, $locale)}</span>
    <a href={base + '/help/'}>{t('shared.footer.helpBugs', {}, $locale)}</a>
  </div>
</footer>
