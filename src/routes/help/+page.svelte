<script lang="ts">
 import { base } from '$app/paths';
 import { locale } from '$lib/i18n/runtime.js';
 import { helpStage1Copy } from '$lib/community/help-stage1-copy.js';
 $: copy=helpStage1Copy($locale);
</script>
<svelte:head><title>{copy.title} | Dreamwish Wand</title></svelte:head>
<section class="inside-page container" data-help-root="four-children">
 <h1>{copy.title}</h1>
 <label class="help-search"><span>{copy.search}</span><input type="search" disabled aria-describedby="help-search-pending" /></label>
 <p id="help-search-pending" class="notice" role="status">{copy.searchPending}</p>
 <nav class="help-children" aria-label={copy.title}>
   <div class="public-children">
     <a href={`${base}/help/questions/`}>{copy.questions}</a>
     <a href={`${base}/help/tips/`}>{copy.tips}</a>
     <a href={`${base}/help/issues/`}>{copy.issues}</a>
   </div>
   <a class="personal" href={`${base}/help/my/`}>{copy.activity}</a>
 </nav>
</section>
<style>
.help-children{display:grid;gap:12px;margin:22px 0}.public-children{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.help-children a{display:grid;place-items:center;text-align:center;min-height:100px;border:1px solid var(--border);border-radius:16px;background:var(--surface);color:var(--ink);padding:12px;text-decoration:none}.help-children .personal{min-height:80px}.help-children a:focus-visible{outline:3px solid var(--gold);outline-offset:3px}.help-search{display:grid;gap:8px;margin-top:20px}.help-search input{min-height:42px;width:100%;max-width:700px}.notice{margin-top:10px;color:var(--ink-muted)}@media(max-width:560px){.public-children{grid-template-columns:1fr}}
</style>
