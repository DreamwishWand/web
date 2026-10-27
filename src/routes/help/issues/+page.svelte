<script lang="ts">
 import { base } from '$app/paths';
 import { locale } from '$lib/i18n/runtime.js';
 import { helpStage1Copy } from '$lib/community/help-stage1-copy.js';
 $: copy=helpStage1Copy($locale);
</script>
<svelte:head><title>{copy.issues} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container" data-help-child="issues">
 <h1>{copy.issues}</h1>
 <p class="notice" role="status">{copy.issuesPending}</p>
 <p><a class="inline-link" href={`${base}/help/`}>{copy.title}</a></p>
</section>
