<script lang="ts">
  import { locale, ct as t } from '$lib/i18n/community.js';
  export let kind: string;
</script>
<span>{kind==='outdoor' ? t('gallery.kind.outdoor',{},$locale) : kind==='indoor' ? t('gallery.kind.indoor',{},$locale) : kind==='tom_furniture' ? t('gallery.kind.tomFurniture',{},$locale) : t('gallery.kind.tomClothing',{},$locale)}</span>
