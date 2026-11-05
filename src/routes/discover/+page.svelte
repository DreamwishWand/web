<script lang="ts">
  import { base } from '$app/paths';
  import { locale, t } from '$lib/i18n/runtime.js';
  import { homeCopy } from '$lib/product-home/copy.js';
  import { helpStage1Copy } from '$lib/community/help-stage1-copy.js';
  import { orientationCopy } from '$lib/product-home/orientation-stage1-copy.mjs';

  $: info=orientationCopy($locale);
  $: titles=homeCopy($locale);
  $: helpTitle=helpStage1Copy($locale).title;
  function productTitle(id:string,labels:typeof titles,help:string):string{
    if(id==='decorate')return labels.decorate;
    if(id==='collection')return labels.collection;
    if(id==='guide')return labels.guide;
    if(id==='presets')return labels.presets;
    if(id==='gallery')return labels.gallery;
    if(id==='dreamsnaps')return labels.dreamsnaps;
    return help;
  }
</script>

<svelte:head>
  <title>{t('shared.orientation.title', {}, $locale)} | Dreamwish Wand</title>
  <meta name="description" content="Dreamwish Wand orientation: discover seven products, local save and account boundaries, and verified feature availability." />
</svelte:head>

<section class="discover-stage1 container" data-discover-stage1="orientation-not-dashboard"
  data-public-writer="off" data-save-auto-upload="off">
  <header class="discover-intro">
    <p class="eyebrow">Dreamwish Wand</p>
    <h1>{t('shared.orientation.title', {}, $locale)}</h1>
    <p>{info.intro}</p>
    <a class="discovery-status-link" href={base+'/rc-status/'}>{info.seeStatus}<span aria-hidden="true">›</span></a>
  </header>

  <nav class="discover-products" aria-label={t('shared.orientation.products', {}, $locale)}
    data-discover-seven-products>
    {#each info.products as product}
      <article class="discover-product" data-discover-product={product.id}>
        <div class="discover-product-heading">
          <span class="discover-glyph" aria-hidden="true">◇</span>
          <h2>{productTitle(product.id,titles,helpTitle)}</h2>
        </div>
        <div class="discover-product-content">
          <div class="discover-product-purpose">
            <h3>{info.purpose}</h3>
            <p>{product.purpose}</p>
          </div>
          <div class="discover-product-start">
            <h3>{info.start}</h3>
            <p>{product.step}</p>
          </div>
        </div>
        <a class="discover-product-link" href={base+product.path}
          data-discover-destination={product.id}>{info.action}<span aria-hidden="true">›</span></a>
      </article>
    {/each}
  </nav>

  <section class="discover-mental-model" data-discover-account-save-optional>
    <h2>{info.scope}</h2>
    <div class="mental-model-grid">
      <article data-discover-account-optional>
        <span aria-hidden="true">◇</span>
        <h3>{info.accountTitle}</h3>
        <p>{info.account}</p>
      </article>
      <article data-discover-save-optional>
        <span aria-hidden="true">◇</span>
        <h3>{info.saveTitle}</h3>
        <p>{info.save}</p>
      </article>
      <article data-discover-capability-gated>
        <span aria-hidden="true">◇</span>
        <h3>{info.supportTitle}</h3>
        <p>{info.support}</p>
      </article>
    </div>
    <a class="discovery-status-link" href={base+'/rc-status/'}>
      {info.seeStatus}<span aria-hidden="true">›</span>
    </a>
  </section>
</section>

<style>
  .discover-stage1{min-height:65vh;padding-block:40px 96px}
  .discover-intro{max-width:900px;padding-bottom:25px}
  .discover-intro .eyebrow{color:var(--gold);font-size:12px;letter-spacing:.13em;text-transform:uppercase;margin:0 0 13px}
  .discover-intro h1{font:500 clamp(37px,5vw,64px) Georgia,serif;letter-spacing:-.045em;line-height:1.09;margin:0 0 20px}
  .discover-intro p:not(.eyebrow){font-size:clamp(15px,1.5vw,18px);color:var(--ink-soft);line-height:1.7;max-width:800px;margin-bottom:18px}
  .discovery-status-link{display:inline-flex;gap:11px;align-items:center;min-height:44px;color:var(--gold);font-weight:700;font-size:13px;text-decoration:underline;text-underline-offset:4px}
  .discovery-status-link span{font-size:21px}
  .discover-products{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px;margin:24px 0 55px}
  .discover-product{display:flex;flex-direction:column;min-width:0;padding:22px 24px;background:var(--surface);border:1px solid var(--border);border-radius:19px}
  .discover-product-heading{display:flex;align-items:center;gap:16px;margin-bottom:15px}
  .discover-glyph{flex:none;display:grid;place-items:center;width:62px;height:62px;background:var(--surface-raised);border-radius:13px;color:var(--gold);font:31px Georgia,serif}
  .discover-product h2{font:500 clamp(22px,2.4vw,31px) Georgia,serif;line-height:1.2;overflow-wrap:anywhere;margin:0}
  .discover-product-content{display:grid;gap:13px;flex:1}
  .discover-product h3{font-size:11px;font-weight:800;color:var(--ink-muted);letter-spacing:.04em;margin:0 0 7px}
  .discover-product p{font-size:13px;line-height:1.7;margin:0;color:var(--ink-soft)}
  .discover-product-link{display:inline-flex;align-items:center;align-self:flex-start;gap:14px;min-height:44px;color:var(--gold);font-weight:750;font-size:13px;margin-top:13px;text-decoration:underline;text-underline-offset:3px}
  .discover-product-link span{font-size:21px}
  .discover-mental-model{border-top:1px solid var(--border);padding-top:28px}
  .discover-mental-model>h2{font:500 clamp(24px,3vw,34px) Georgia,serif;margin:0 0 20px}
  .mental-model-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}
  .mental-model-grid article{background:var(--surface);border:1px solid var(--border);padding:22px;border-radius:17px;min-width:0}
  .mental-model-grid span{display:block;font:29px Georgia,serif;color:var(--gold);margin-bottom:8px}
  .mental-model-grid h3{font-size:15px;margin:0 0 10px;color:var(--ink)}
  .mental-model-grid p{font-size:12px;line-height:1.75;color:var(--ink-soft);margin:0}
  .discover-product-link:focus-visible,.discovery-status-link:focus-visible{outline:3px solid var(--gold);outline-offset:3px;border-radius:3px}
  @media(max-width:880px){.mental-model-grid{grid-template-columns:1fr}.mental-model-grid article{padding:18px}}
  @media(max-width:680px){.discover-products{grid-template-columns:1fr}.discover-product{padding:20px}.discover-stage1{padding-block:28px 66px}}
  @media(max-width:360px){.discover-product-heading{gap:11px}.discover-glyph{width:52px;height:52px;font-size:27px}.discover-product h2{font-size:22px}.discover-intro h1{font-size:34px}}
</style>
