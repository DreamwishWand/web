<script lang="ts">
  import { page } from '$app/stores';
  import SharedEntityDetail from '$lib/entity/SharedEntityDetail.svelte';
</script>
<SharedEntityDetail primaryId={$page.params.primary} localeCode={$page.params.locale} />
