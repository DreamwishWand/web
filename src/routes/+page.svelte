<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { homeCopy } from '$lib/product-home/copy.js';
  import { helpStage1Copy } from '$lib/community/help-stage1-copy.js';
  import { HOME_STAGE1_CONSUMER } from '$lib/ui/consumer-fixtures.js';
  import ResponsiveFrame from '$lib/ui/ResponsiveFrame.svelte';
  import GroupedCardGrid from '$lib/ui/GroupedCardGrid.svelte';
  import VisualCard from '$lib/ui/VisualCard.svelte';

  $: copy = homeCopy($locale);
  $: helpCopy = helpStage1Copy($locale);
  $: ja = $locale === 'ja';
  function titleFor(id: string): string {
    if (id === 'decorate') return copy.decorate;
    if (id === 'collection') return copy.collection;
    if (id === 'guide') return copy.guide;
    if (id === 'presets') return copy.presets;
    if (id === 'gallery') return copy.gallery;
    return copy.dreamsnaps;
  }
  function detailFor(id: string): string {
    if (id === 'decorate') return copy.decorateDetail;
    if (id === 'collection') return copy.collectionDetail;
    if (id === 'guide') return copy.guideDetail;
    if (id === 'presets') return copy.presetsDetail;
    if (id === 'gallery') return copy.galleryDetail;
    return copy.dreamsnapsDetail;
  }
</script>

<svelte:head>
  <title>Dreamwish Wand — Home</title>
  <meta name="description" content="Dreamwish Wand product hub for Disney Dreamlight Valley decorating, collection, guides, presets, Gallery, DreamSnaps and Q&A." />
</svelte:head>

<ResponsiveFrame className="home-dashboard">
  <header class="home-dashboard-heading">
    <h1>Dreamwish Wand</h1>
  </header>

  <GroupedCardGrid label={copy.products} minCardWidth="16rem" className="home-product-grid">
    {#each HOME_STAGE1_CONSUMER.coreProducts as card}
      <VisualCard href={base + card.href} title={titleFor(card.id)} description={detailFor(card.id)} icon={card.icon} />
    {/each}
  </GroupedCardGrid>

  <div class="home-qa-entry">
    <VisualCard
      href={base + '/help/'}
      title={helpCopy.title}
      description={ja ? '質問・ヒント・問題・自分のアクティビティ。未受入の操作は利用不可。' : 'Questions, Tips, Issues and My Activity. Unaccepted actions remain unavailable.'}
      icon={HOME_STAGE1_CONSUMER.qa.icon}
      variant="horizontal"
    />
  </div>

  <aside class="rc-boundary" role="status" data-product-rc-boundary="off">
    <strong>{ja ? '内部RCの利用制限' : 'Internal RC availability'}</strong>
    <span>{ja ? 'ローカル閲覧・プレビューと、未受入の認証・公開・Writer操作を区別しています。' : 'Local read/preview is separate from unaccepted authentication, publishing and Save Writer operations.'}</span>
    <a href={base + '/rc-status/'}>{ja ? '機能別の状態と対応バージョン' : 'View feature status and supported versions'}</a>
  </aside>
</ResponsiveFrame>

<style>
  .rc-boundary{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 17px;margin:22px 0 0;border:1px solid var(--border);border-radius:14px;background:var(--surface);font-size:13px;line-height:1.6}
  .rc-boundary strong{color:var(--gold)}.rc-boundary span{color:var(--ink-soft);flex:1 1 270px}.rc-boundary a{color:var(--ink);text-underline-offset:3px}
  .rc-boundary a:focus-visible{outline:3px solid var(--focus-ring);outline-offset:3px}
</style>
