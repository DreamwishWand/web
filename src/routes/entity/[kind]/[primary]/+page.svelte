<script lang="ts">
  import { page } from '$app/stores';
  import { locale } from '$lib/i18n/runtime.js';
  import SharedTypedEntityGate from '$lib/entity/SharedTypedEntityGate.svelte';
</script>
<!-- Noncanonical test-only inspection surface. Not a public Creator/Work/Preset UUID detail URL. -->
<SharedTypedEntityGate kind={$page.params.kind} primaryId={$page.params.primary} localeCode={$locale} />
