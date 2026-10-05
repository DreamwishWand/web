<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { decorateEntryCopy } from '$lib/decorate/copy.js';
  import { DECORATE_STAGE1_CONSUMER } from '$lib/ui/consumer-fixtures.js';
  import ResponsiveFrame from '$lib/ui/ResponsiveFrame.svelte';
  import GroupedCardGrid from '$lib/ui/GroupedCardGrid.svelte';
  import VisualCard from '$lib/ui/VisualCard.svelte';

  $: copy = decorateEntryCopy($locale);
  const titles = {
    explore: () => copy.explore,
    moodboards: () => copy.moodboards,
    worldEditor: () => copy.worldEditor
  };
  const descriptions = {
    exploreDescription: () => copy.exploreDescription,
    moodboardsDescription: () => copy.moodboardsDescription,
    worldEditorDescription: () => copy.worldEditorDescription
  };
</script>

<svelte:head>
  <title>{copy.title} | Dreamwish Wand</title>
</svelte:head>

<ResponsiveFrame className="decorate-entry">
  <header class="compact-page-heading"><h1>{copy.title}</h1></header>
  <GroupedCardGrid label={copy.products} minCardWidth="16rem">
    {#each DECORATE_STAGE1_CONSUMER.entryCards as card}
      <VisualCard
        href={base + card.href}
        title={titles[card.id]()}
        description={descriptions[card.descriptionKey]()}
        icon={card.icon}
      />
    {/each}
  </GroupedCardGrid>
</ResponsiveFrame>
