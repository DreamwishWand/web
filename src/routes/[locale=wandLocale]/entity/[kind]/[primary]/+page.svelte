<script lang="ts">
  import { page } from '$app/stores';
  import SharedTypedEntityGate from '$lib/entity/SharedTypedEntityGate.svelte';
</script>
<!-- Locale-scoped source-unavailable typed identity preview. No public canonical/alias authority. -->
<SharedTypedEntityGate kind={$page.params.kind} primaryId={$page.params.primary} localeCode={$page.params.locale} />
