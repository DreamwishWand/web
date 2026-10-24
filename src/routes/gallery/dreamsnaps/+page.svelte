<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { locale, ct as t } from '$lib/i18n/community.js';
  onMount(()=>{void goto(base+'/dreamsnaps/',{replaceState:true});});
</script>
<svelte:head><meta name="robots" content="noindex" /></svelte:head>
<section class="inside-page container">
  <p role="status">{t('galleryv1.loading',{},$locale)}</p>
  <a href={base+'/dreamsnaps/'}>DreamSnaps</a>
</section>
