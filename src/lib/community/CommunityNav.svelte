<script lang="ts">
  import { base } from '$app/paths';
  import { locale, ct } from '$lib/i18n/community.js';
</script>
<a href={`${base}/gallery/`}>{ct('gallery.title', {}, $locale)}</a>
<a href={`${base}/dreamsnaps/`}>{ct('dreamsnaps.title', {}, $locale)}</a>
<a href={`${base}/qa/`}>{ct('qa.title', {}, $locale)}</a>
