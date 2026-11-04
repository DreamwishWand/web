<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { helpStage1Copy } from '$lib/community/help-stage1-copy.js';
  $: copy = helpStage1Copy($locale);
</script>

<svelte:head>
  <title>{copy.title} | Dreamwish Wand</title>
</svelte:head>

<section class="help-stage1 container" data-help-root="four-children" data-root-search="unavailable" data-public-writer="off">
  <header class="help-heading"><h1>{copy.title}</h1></header>

  <div class="help-search-panel" data-help-cross-type-search="gated">
    <label class="help-search" for="help-cross-type-search">
      <span>{copy.search}</span>
      <span class="help-search-frame">
        <span class="help-search-symbol" aria-hidden="true">⌕</span>
        <input id="help-cross-type-search" type="search" disabled
          placeholder={copy.search} aria-describedby="help-search-pending" />
      </span>
    </label>
    <p id="help-search-pending" class="help-search-status" role="status">{copy.searchPending}</p>
  </div>

  <nav class="help-children" aria-label={copy.title} data-stage1-help-navigation>
    <div class="public-children" data-stage1-help-public-three>
      <a href={`${base}/help/questions/`} data-help-child="questions" class="help-child-card">
        <span class="help-card-art" aria-hidden="true">◇</span>
        <strong>{copy.questions}</strong>
        <span class="card-direction" aria-hidden="true">›</span>
      </a>
      <a href={`${base}/help/tips/`} data-help-child="tips" class="help-child-card">
        <span class="help-card-art" aria-hidden="true">✧</span>
        <strong>{copy.tips}</strong>
        <span class="card-direction" aria-hidden="true">›</span>
      </a>
      <a href={`${base}/help/issues/`} data-help-child="issues" class="help-child-card">
        <span class="help-card-art" aria-hidden="true">△</span>
        <strong>{copy.issues}</strong>
        <span class="card-direction" aria-hidden="true">›</span>
      </a>
    </div>
    <a class="personal help-child-card" data-help-child="activity" href={`${base}/help/my/`}>
      <span class="help-card-art" aria-hidden="true">◇</span>
      <strong>{copy.activity}</strong>
      <span class="card-direction" aria-hidden="true">›</span>
    </a>
  </nav>
</section>

<style>
.help-stage1{padding-block:50px 100px;min-height:72vh}.help-heading h1{font-family:Georgia,serif;font-size:clamp(36px,5.4vw,64px);font-weight:500;letter-spacing:-.045em;margin:0 0 22px}.help-search-panel{border:1px solid var(--border);background:var(--surface);border-radius:19px;padding:22px 24px;display:grid;gap:10px}.help-search{display:grid;gap:10px;max-width:100%;color:var(--ink-soft);font-size:13px;font-weight:700}.help-search-frame{display:flex;align-items:center;gap:10px;min-height:52px;border:1px solid var(--border);border-radius:13px;background:var(--surface-raised);color:var(--ink-muted);padding:0 16px}.help-search-symbol{font-size:26px;line-height:1;flex:none}.help-search input{border:0;outline:0;min-width:0;width:100%;font:inherit;font-size:15px;color:var(--ink);background:transparent}.help-search input:disabled{opacity:.65;cursor:not-allowed}.help-search-status{font-size:12px;color:var(--ink-muted);margin:0;line-height:1.65}.help-children{display:grid;gap:19px;margin-top:24px}.public-children{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.help-child-card{display:flex;flex-direction:column;gap:14px;min-width:0;min-height:260px;text-align:left;padding:17px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--ink);text-decoration:none;transition:border-color .15s,transform .15s}.help-child-card:hover{border-color:var(--gold);transform:translateY(-2px)}.help-child-card:focus-visible{outline:3px solid var(--gold);outline-offset:3px}.help-card-art{height:160px;display:grid;place-items:center;background:var(--surface-raised);border-radius:14px;font:54px Georgia,serif;color:var(--gold)}.help-child-card strong{font:500 clamp(20px,2.2vw,29px) Georgia,serif;line-height:1.25;overflow-wrap:anywhere}.card-direction{font-size:27px;color:var(--gold);margin:0 0 0 auto;line-height:1}.help-child-card.personal{min-height:139px;flex-direction:row;align-items:center;gap:22px;padding:18px 24px}.help-child-card.personal .help-card-art{height:101px;width:124px;flex:0 0 124px}.help-child-card.personal .card-direction{margin-left:auto}
@media(max-width:900px){.help-child-card{min-height:205px}.help-card-art{height:112px}}
@media(max-width:620px){.public-children{grid-template-columns:1fr;gap:12px}.help-child-card{flex-direction:row;align-items:center;min-height:129px}.help-card-art{height:84px;width:96px;flex:0 0 96px;font-size:38px}.help-child-card .card-direction{margin-left:auto}.help-child-card.personal{min-height:129px}.help-child-card.personal .help-card-art{height:84px;width:96px;flex-basis:96px}}
@media(max-width:360px){.help-stage1{padding-block:32px 64px}.help-search-panel{padding:16px}.help-child-card,.help-child-card.personal{padding:12px;gap:11px;min-height:108px}.help-card-art,.help-child-card.personal .help-card-art{width:64px;flex-basis:64px;height:64px;font-size:31px}.help-child-card strong{font-size:19px}}
</style>
