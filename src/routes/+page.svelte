<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { homeCopy } from '$lib/product-home/copy.js';
  $: copy=homeCopy($locale);
  $: cards=[
    {id:'decor',href:base+'/explore/',title:copy.decorate,detail:copy.decorateDetail,glyph:'❋'},
    {id:'save',href:base+'/collection/',title:copy.collection,detail:copy.collectionDetail,glyph:'✧'},
    {id:'help',href:base+'/guide/',title:copy.guide,detail:copy.guideDetail,glyph:'✳'},
    {id:'world',href:base+'/presets/',title:copy.presets,detail:copy.presetsDetail,glyph:'◇'},
    {id:'decor',href:base+'/gallery/',title:copy.gallery,detail:copy.galleryDetail,glyph:'❖'},
    {id:'save',href:base+'/dreamsnaps/',title:copy.dreamsnaps,detail:copy.dreamsnapsDetail,glyph:'☆'}
  ];
</script>

<svelte:head>
  <title>Dreamwish Wand — A little magic for your Valley</title>
  <meta name="description" content="Dreamwish Wand — decorating, discovery, sharing and reuse for Disney Dreamlight Valley." />
</svelte:head>

<section class="hero" aria-labelledby="hero-title">
  <div class="hero-stars" aria-hidden="true"></div>
  <div class="hero-content container">
    <div class="hero-copy">
      <p class="eyebrow"><span class="tiny-star" aria-hidden="true">✦</span> {copy.eyebrow}</p>
      <h1 id="hero-title">{copy.headline}</h1>
      <p class="hero-lead">{copy.lead}</p>
      <a class="hero-action" href={base+'/explore/'}>{copy.decorate} <span aria-hidden="true">↗</span></a>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="art-halo"></div><div class="art-arch"><div class="art-moon"></div><div class="art-twinkle twinkle-one">✦</div><div class="art-twinkle twinkle-two">✧</div><div class="art-twinkle twinkle-three">✳</div><div class="art-twinkle twinkle-four">✦</div><div class="art-hill hill-back"></div><div class="art-hill hill-front"></div><div class="art-wand"><span>✦</span></div></div>
      <div class="art-spark left">✧</div><div class="art-spark right">✦</div>
      <div class="art-caption">A WISH IS WHERE MAGIC BEGINS</div>
    </div>
  </div>
</section>

<section class="entry-section container" aria-labelledby="choose-title">
  <div class="section-heading"><div><p class="eyebrow">{copy.core}</p><h2 id="choose-title">{copy.choose}</h2></div><span class="heading-spark" aria-hidden="true">✦ ⋆ ✧</span></div>
  <div class="portal-grid">
    {#each cards as card}
      <a class={'portal-card portal-'+card.id} href={card.href}>
        <div class="portal-top"><span class="portal-eyebrow">{copy.core}</span><span class="portal-arrow" aria-hidden="true">↗</span></div>
        <div class="portal-symbol" aria-hidden="true"><span class="portal-orbit"></span><span>{card.glyph}</span></div>
        <div class="portal-content"><h3>{card.title}</h3><p>{card.detail}</p><span class="portal-state">{copy.open}</span></div>
      </a>
    {/each}
  </div>

  <section class="participation" aria-labelledby="participation-title">
    <div><p class="eyebrow">{copy.participate}</p><h2 id="participation-title">{copy.qa}</h2><p>{copy.qaDetail}</p><small>{copy.qaNote}</small></div>
    <a href={base+'/qa/'}>{copy.open} <span aria-hidden="true">↗</span></a>
  </section>
</section>

<style>
  .participation{margin-top:24px;border:1px solid var(--border);border-radius:22px;background:var(--surface);padding:24px 28px;display:flex;justify-content:space-between;align-items:center;gap:24px;box-shadow:var(--shadow)}
  .participation h2{font-family:Georgia,serif;font-size:30px;font-weight:500;margin:8px 0}.participation p{margin:0 0 8px;color:var(--ink-soft);font-size:13px;line-height:1.7}.participation small{display:block;color:var(--ink-muted);line-height:1.6}.participation>a{flex:none;border:1px solid var(--border);border-radius:999px;padding:11px 16px;color:var(--gold);font-weight:800}
  @media(max-width:620px){.participation{align-items:flex-start;flex-direction:column}}
</style>
