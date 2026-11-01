<script lang="ts">
 import { base } from '$app/paths';
 import { locale } from '$lib/i18n/runtime.js';
 import { helpStage1Copy } from '$lib/community/help-stage1-copy.js';
 $: copy=helpStage1Copy($locale);
</script>
<svelte:head><title>{copy.tips} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container" data-help-child="tips">
 <h1>{copy.tips}</h1>
 <a class="inline-link" href={`${base}/qa/?type=tips`}>{copy.tips}</a>
 <p><a class="inline-link" href={`${base}/help/`}>{copy.title}</a></p>
</section>
