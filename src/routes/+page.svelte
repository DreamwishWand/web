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
  function titleFor(id: string, labels: typeof copy): string {
    if (id === 'decorate') return labels.decorate;
    if (id === 'collection') return labels.collection;
    if (id === 'guide') return labels.guide;
    if (id === 'presets') return labels.presets;
    if (id === 'gallery') return labels.gallery;
    return labels.dreamsnaps;
  }
  function detailFor(id: string, labels: typeof copy): string {
    if (id === 'decorate') return labels.decorateDetail;
    if (id === 'collection') return labels.collectionDetail;
    if (id === 'guide') return labels.guideDetail;
    if (id === 'presets') return labels.presetsDetail;
    if (id === 'gallery') return labels.galleryDetail;
    return labels.dreamsnapsDetail;
  }
</script>

<svelte:head>
  <title>Dreamwish Wand — Home</title>
  <meta name="description" content="Dreamwish Wand product hub for Disney Dreamlight Valley decorating, collection, guides, presets, Gallery, DreamSnaps and Community Help Center." />
</svelte:head>

<ResponsiveFrame className="home-dashboard">
  <header class="home-dashboard-heading">
    <h1>Dreamwish Wand</h1>
  </header>

  <GroupedCardGrid label={copy.products} minCardWidth="16rem" className="home-product-grid">
    {#each HOME_STAGE1_CONSUMER.coreProducts as card}
      <VisualCard href={base + card.href} title={titleFor(card.id,copy)} description={detailFor(card.id,copy)} icon={card.icon} />
    {/each}
  </GroupedCardGrid>

  <div class="home-qa-entry">
    <VisualCard
      href={base + '/help/'}
      title={helpCopy.title}
      description={copy.qaDetail}
      icon={HOME_STAGE1_CONSUMER.qa.icon}
      variant="horizontal"
    />
  </div>

  <aside class="test-availability" data-test-site-availability>
    <strong>{$locale === 'ja' ? 'テストサイトの開発状況' : 'Test-site development status'}</strong>
    <p>{$locale === 'ja' ? '利用できる機能・未実装の機能・対応バージョンを確認できます。未受入のセーブ編集や公開機能は無効です。' : 'See available features, unsupported operations and versions. Unaccepted save editing and publishing stay disabled.'}</p>
    <a href={base + '/rc-status/'}>{$locale === 'ja' ? '現在の機能一覧を確認' : 'View current feature availability'}</a>
  </aside>
</ResponsiveFrame>
<style>
  .test-availability { margin: 24px 0; border: 1px solid var(--border); background: var(--surface); border-radius: 14px; padding: 18px 22px; }
  .test-availability strong { font-size: 16px; }
  .test-availability p { font-size: 13px; line-height: 1.65; color: var(--ink-soft); }
  .test-availability a { font-weight: 700; color: var(--gold); }
  .test-availability a:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 3px; }
</style>

