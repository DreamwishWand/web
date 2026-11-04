<script lang="ts">
  import { locale } from '$lib/i18n/runtime.js';
  import ItemReadCapabilityNotice from '$lib/local/ItemReadCapabilityNotice.svelte';
</script>
<!-- A non-invasive supplementary read-capability panel. The existing
     accepted Catalog page/PR380 remains byte-identical. No personal Save
     content, Worker or Writer is accessed by this layout. -->
<slot />
<div class="container" data-item-capability-layout="source-only">
  <ItemReadCapabilityNotice localeCode={$locale} />
</div>
