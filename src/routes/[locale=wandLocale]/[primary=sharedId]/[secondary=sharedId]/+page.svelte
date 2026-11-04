<script lang="ts">
  import { page } from '$app/stores';
  import SharedTypedEntityGate from '$lib/entity/SharedTypedEntityGate.svelte';
</script>
<!-- Locale-native P/S is noindex until 01D verifies exact relation+rights/eligibility. -->
<SharedTypedEntityGate mode="COMPOSITE" primaryId={$page.params.primary} secondaryId={$page.params.secondary} localeCode={$page.params.locale} />
