<script lang="ts">
  import { base } from '$app/paths';
  import { locale, t } from '$lib/i18n/runtime.js';
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

<svelte:head><title>{t('shared.orientation.title', {}, $locale)} | Dreamwish Wand</title></svelte:head>

<ResponsiveFrame className="discover-page">
  <header class="orientation-heading">
    <h1>{t('shared.orientation.title', {}, $locale)}</h1>
    <p>{t('shared.orientation.intro', {}, $locale)}</p>
  </header>
  <GroupedCardGrid label={t('shared.orientation.products', {}, $locale)}>
    {#each HOME_STAGE1_CONSUMER.coreProducts as card}
      <VisualCard href={base + card.href} title={titleById[card.id]()} description={detailById[card.id]()} icon={card.icon} />
    {/each}
    <VisualCard href={base + HOME_STAGE1_CONSUMER.qa.href} title={copy.qa} description={copy.qaDetail} icon={HOME_STAGE1_CONSUMER.qa.icon} />
  </GroupedCardGrid>
</ResponsiveFrame>
