<script lang="ts">
  import { page } from '$app/stores';
  import { locale } from '$lib/i18n/runtime.js';
  import SharedTypedEntityGate from '$lib/foundation/SharedTypedEntityGate.svelte';
</script>
<!-- Native composite P/S must not redirect or expose child without source-proven SPECIALIZATION. -->
<SharedTypedEntityGate mode="COMPOSITE" primaryId={$page.params.primary} secondaryId={$page.params.secondary} localeCode={$locale} />
