<script lang="ts">
  import { base } from '$app/paths';
  import { locale, t } from '$lib/i18n/runtime.js';
</script>
<footer class="site-footer"><div class="footer-inner"><span>✧ Dreamwish Wand</span><span>{t('shared.footer.disclaimer', {}, $locale)}</span><a href={`${base}/help/`}>{t('shared.footer.helpBugs', {}, $locale)}</a></div></footer>
