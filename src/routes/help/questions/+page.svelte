<script lang="ts">
 import { base } from '$app/paths';
 import { locale } from '$lib/i18n/runtime.js';
 import { helpStage1Copy } from '$lib/community/help-stage1-copy.js';
 $: copy=helpStage1Copy($locale);
</script>
<svelte:head><title>{copy.questions} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container" data-help-child="questions">
 <h1>{copy.questions}</h1>
 <a class="inline-link" href={`${base}/qa/?type=questions`}>{copy.questions}</a>
 <p><a class="inline-link" href={`${base}/help/`}>{copy.title}</a></p>
</section>
