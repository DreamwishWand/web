<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { homeCopy } from '$lib/product-home/copy.js';
  import { HOME_STAGE1_CONSUMER } from '$lib/ui/consumer-fixtures.js';
  import ResponsiveFrame from '$lib/ui/ResponsiveFrame.svelte';
  import GroupedCardGrid from '$lib/ui/GroupedCardGrid.svelte';
  import VisualCard from '$lib/ui/VisualCard.svelte';

  $: copy = homeCopy($locale);
  const titleById = {
    decorate: () => copy.decorate, collection: () => copy.collection, guide: () => copy.guide,
    presets: () => copy.presets, gallery: () => copy.gallery, dreamsnaps: () => copy.dreamsnaps
  };
  const detailById = {
    decorate: () => copy.decorateDetail, collection: () => copy.collectionDetail, guide: () => copy.guideDetail,
    presets: () => copy.presetsDetail, gallery: () => copy.galleryDetail, dreamsnaps: () => copy.dreamsnapsDetail
  };
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
      <VisualCard href={base + card.href} title={titleById[card.id]()} description={detailById[card.id]()} icon={card.icon} />
    {/each}
  </GroupedCardGrid>

  <div class="home-qa-entry">
    <VisualCard
      href={base + HOME_STAGE1_CONSUMER.qa.href}
      title={copy.qa}
      description={copy.qaDetail}
      icon={HOME_STAGE1_CONSUMER.qa.icon}
      variant="horizontal"
    />
  </div>
</ResponsiveFrame>
