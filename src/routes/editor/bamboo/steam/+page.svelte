<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import {
    BAMBOO_READONLY_DISPLAY_FIELDS,
    BAMBOO_READONLY_OFF_SCOPE,
    bambooReadonlyOffCopy
  } from '$lib/wep/steam-bamboo-readonly-off-copy.mjs';
  // Product runtime is deliberately NOT connected. Neither this route nor
  // query/localStorage/File messages authorize a Rust Worker or Save Reader.
  $: copy=bambooReadonlyOffCopy($locale);
</script>

<svelte:head>
  <title>{copy.title} | Dreamwish Wand</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>
<section class="inside-page container bamboo-readonly" data-bamboo-reader-ui="scoped-preparation"
  data-bamboo-runtime="off" data-bamboo-writer-authorized="false"
  data-bamboo-source-file-enabled="false" data-bamboo-operation-on="false"
  data-bamboo-item-id={BAMBOO_READONLY_OFF_SCOPE.itemId} data-bamboo-schema={BAMBOO_READONLY_OFF_SCOPE.schema}
  data-bamboo-signed-feature-available={String(BAMBOO_READONLY_OFF_SCOPE.signedScopedReaderAvailable)}>
  <p class="eyebrow">EDITOR / STEAM / READ ONLY</p>
  <h1>{copy.title}</h1>
  <p class="kicker">{copy.kicker}</p>
  <p class="target" data-bamboo-scope>
    {copy.target}
  </p>
  <div class="read-status" role="status" data-bamboo-readiness="off">
    <strong>{copy.off}</strong>
    <p>{copy.reason}</p>
  </div>
  <section class="result-frame" aria-labelledby="bamboo-results-title">
    <h2 id="bamboo-results-title">{copy.results}</h2>
    <ul>
      {#each BAMBOO_READONLY_DISPLAY_FIELDS as field}
        <li data-bamboo-receipt-field={field}>
          <span>{copy[field]}</span><output aria-label={copy[field]}>—</output>
        </li>
      {/each}
    </ul>
    <p class="privacy">{copy.privacy}</p>
  </section>
  <a class="back" href={base+'/editor/'}>{copy.back}</a>
</section>
<style>
  .bamboo-readonly{box-sizing:border-box;min-width:0;max-width:980px;padding-block:48px 96px;overflow-wrap:anywhere}
  h1{font:500 clamp(29px,5vw,52px) Georgia,serif;margin:12px 0}
  .kicker,.target{font-size:13px;line-height:1.7;color:var(--ink-soft)}
  .read-status,.result-frame{border:1px solid var(--border);border-radius:16px;background:var(--surface);padding:18px;margin-block:18px;min-width:0}
  .read-status{border-style:dashed}
  .read-status strong{font-weight:850}
  .read-status p,.privacy{font-size:13px;line-height:1.65;color:var(--ink-muted)}
  .result-frame h2{font:500 clamp(20px,3vw,27px) Georgia,serif;margin:0 0 14px}
  .result-frame ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
  .result-frame li{display:flex;min-width:0;flex-direction:column;gap:9px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-raised)}
  .result-frame li span{font-size:11px;color:var(--ink-muted);overflow-wrap:anywhere}
  .result-frame output{font-size:16px;font-weight:700;color:var(--ink)}
  .back{display:inline-flex;align-items:center;justify-content:center;min-height:44px;max-width:100%;border:1px solid var(--border);border-radius:10px;padding:10px 16px;box-sizing:border-box;color:var(--gold);text-decoration:none;font-size:13px;font-weight:750}
  .back:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
  @media(max-width:480px){.bamboo-readonly{padding-block:34px 72px}.result-frame ul{grid-template-columns:1fr}.read-status,.result-frame{padding:14px}}
</style>
