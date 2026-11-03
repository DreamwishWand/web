<script lang="ts">
  import { page } from '$app/stores';
  import { locale } from '$lib/i18n/runtime.js';
  import SharedEntityDetail from '$lib/entity/SharedEntityDetail.svelte';
</script>
<SharedEntityDetail primaryId={$page.params.primary} localeCode={$locale} />
