<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { helpStage1Copy } from '$lib/community/help-stage1-copy.js';
  import { helpLocalCopy } from '$lib/community/help-local-copy.js';
  import { WAND_RC_PRODUCTS } from '$lib/product-home/rc-manifest.js';

  export let kind: 'questions' | 'tips' | 'issues' | 'my';
  const tabs = [
    { kind: 'questions', label: 'questions', href: '/help/questions/' },
    { kind: 'tips', label: 'tips', href: '/help/tips/' },
    { kind: 'issues', label: 'issues', href: '/help/issues/' },
    { kind: 'my', label: 'activity', href: '/help/my/' }
  ] as const;
  const registered = WAND_RC_PRODUCTS.find((product) => product.id === 'help');
  $: labels = helpStage1Copy($locale);
  $: copy = helpLocalCopy($locale);
  $: active = tabs.find((tab) => tab.kind === kind);
  $: title = active ? labels[active.label] : labels.title;
  $: job = registered?.jobs.find((item) => item.href === active?.href);
  $: available = job?.status === 'CONDITIONAL';
  $: empty = kind === 'questions' ? copy.emptyQuestions
    : kind === 'tips' ? copy.emptyTips
    : kind === 'issues' ? copy.emptyIssues : copy.emptyMy;
  $: legacyHref = kind === 'questions' ? '/qa/?type=questions' : '/qa/?type=tips';
</script>

<svelte:head>
  <title>{title} | {labels.title} | Dreamwish Wand</title>
  <meta name="description" content="Community Help Center local navigation and explicit unaccepted capability boundary." />
</svelte:head>

<section class="inside-page container help-local-page" data-help-child={kind} data-help-local-only="true">
  <a class="help-back" href={base + '/help/'}>{copy.back}</a>
  <header class="help-heading">
    <div>
      <p class="eyebrow">{labels.title}</p>
      <h1>{title}</h1>
    </div>
    <span class="help-status" role="status" data-help-status={job?.status ?? 'OFF'}>
      {copy.availability}: {available ? copy.statusConditional : copy.statusOff}
    </span>
  </header>

  <section class="help-empty" aria-labelledby="help-empty-title" data-help-empty-state="unverified">
    <h2 id="help-empty-title">{title}</h2>
    <p>{empty}</p>
    {#if available}
      <label class="help-search" for="help-local-query">{copy.search}</label>
      <input id="help-local-query" type="search" disabled aria-describedby="help-local-search-reason" />
      <p id="help-local-search-reason" class="help-search-reason">{copy.searchPending}</p>
      <a class="help-existing-link" href={base + legacyHref} data-help-existing-conditional="true">{copy.conditionalLink}</a>
      <p class="help-boundary">{copy.legacyBoundary}</p>
    {:else}
      <p class="help-boundary" data-help-no-auth="true">{copy.noAutoRequests}</p>
    {/if}
  </section>

  <nav class="help-local-nav" aria-label={copy.navigation}>
    <h2>{copy.navigation}</h2>
    <ul>
      {#each tabs as tab}
        <li>
          {#if tab.kind === kind}
            <span aria-current="page" data-help-current={tab.kind}>{labels[tab.label]}</span>
          {:else}
            <a href={base + tab.href}>{labels[tab.label]}</a>
          {/if}
        </li>
      {/each}
    </ul>
  </nav>
</section>

<style>
  .help-local-page{padding-block:clamp(28px,5vw,65px) 96px;min-height:64vh}
  .help-back{display:inline-flex;min-height:44px;align-items:center;color:var(--ink-soft);font-size:13px}
  .help-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:14px 0 22px}
  .help-heading h1{font:500 clamp(30px,5vw,58px) Georgia,serif;margin:7px 0}
  .help-status{font-size:12px;max-width:34ch;color:var(--ink-soft);padding:10px 12px;border:1px solid var(--border);border-radius:11px;background:var(--surface-raised);overflow-wrap:anywhere}
  .help-empty,.help-local-nav{border:1px solid var(--border);border-radius:18px;padding:clamp(16px,3vw,28px);background:var(--surface);min-width:0}
  .help-empty h2,.help-local-nav h2{font:500 clamp(19px,3vw,28px) Georgia,serif;margin:0 0 10px}
  .help-empty p{font-size:14px;color:var(--ink-soft);line-height:1.7;max-width:76ch}
  .help-search{display:block;font-size:13px;margin-top:24px}
  .help-empty input{display:block;box-sizing:border-box;max-width:560px;width:100%;min-height:44px;margin:8px 0;border:1px solid var(--border);border-radius:10px;background:var(--surface-raised)}
  .help-empty input:disabled{opacity:.64;cursor:not-allowed}
  .help-empty .help-search-reason,.help-empty .help-boundary{font-size:12px;color:var(--ink-muted)}
  .help-existing-link{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;margin-top:12px;border:1px solid var(--border);border-radius:10px;color:var(--ink);background:var(--surface-raised);text-decoration:none}
  .help-local-nav{margin-top:18px}
  .help-local-nav ul{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;list-style:none;margin:16px 0 0;padding:0}
  .help-local-nav li{min-width:0}
  .help-local-nav a,.help-local-nav [aria-current="page"]{display:grid;place-items:center;text-align:center;min-height:52px;padding:9px;border:1px solid var(--border);border-radius:10px;text-decoration:none;color:var(--ink);overflow-wrap:anywhere}
  .help-local-nav [aria-current="page"]{background:var(--surface-raised);color:var(--gold)}
  a:focus-visible{outline:3px solid var(--focus-ring);outline-offset:3px}
  @media(max-width:560px){.help-local-nav ul{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:360px){.help-local-nav ul{grid-template-columns:1fr}}
</style>
