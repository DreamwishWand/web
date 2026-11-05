<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import ResponsiveFrame from '$lib/ui/ResponsiveFrame.svelte';
  import ItemThumb from '$lib/ui/ItemThumb.svelte';
  import ItemImagePreferences from '$lib/ui/ItemImagePreferences.svelte';
  import SharedCatalogDiscovery from '$lib/entity/SharedCatalogDiscovery.svelte';
  import { collectionFamilyLabel } from '$lib/collection/copy.js';
  import { collectionFacetLabel, loadCollectionRuntime } from '$lib/collection/runtime.js';
  import { resolveSharedCatalogEntity, sharedEntityLabels } from '$lib/entity/shared-catalog-detail.mjs';
  import { addCatalogEntityToMoodboard } from '$lib/entity/entity-moodboard-action.mjs';
  import { moodboardCopy } from '$lib/moodboards/copy.js';
  import { MOODBOARD_STORAGE_KEY, MOODBOARD_BACKUP_KEY, createEmptyMoodboardDocument, parseMoodboardDocument, serializeMoodboardDocument } from '$lib/moodboards/store.js';

  export let primaryId: string;
  export let localeCode: string;
  let index: any = null;
  let rows: any[] = [];
  let loading = true;
  let failure = false;
  let moodboardDocument: any = createEmptyMoodboardDocument();
  let selectedBoardId = '';
  let moodboardStatus = '';
  $: moodCopy = moodboardCopy(localeCode);
  $: availableBoards = moodboardDocument.boards ?? [];
  $: copy = sharedEntityLabels(localeCode);
  $: outcome = index ? resolveSharedCatalogEntity(index, rows, primaryId, localeCode) : null;
  $: item = outcome?.status === 'FOUND' ? outcome.item : null;
  $: family = item ? collectionFamilyLabel(localeCode, item.family) : '';
  $: worldNames = item && index ? item.worlds.map((x: string) => collectionFacetLabel(index,'world',x,localeCode)).filter(Boolean) : [];
  $: universeNames = item && index ? item.universes.map((x: string) => collectionFacetLabel(index,'universe',x,localeCode)).filter(Boolean) : [];

  function saveToMoodboard() {
    if (!outcome || outcome.status !== 'FOUND' || !('canExplore' in outcome) || !outcome.canExplore || !selectedBoardId) return;
    try {
      // Always reload the latest local state before writing, including changes made on another Wand tab.
      const current = localStorage.getItem(MOODBOARD_STORAGE_KEY);
      const document = current ? parseMoodboardDocument(current) : createEmptyMoodboardDocument();
      const result = addCatalogEntityToMoodboard(document, selectedBoardId, outcome);
      if (current) localStorage.setItem(MOODBOARD_BACKUP_KEY, current);
      localStorage.setItem(MOODBOARD_STORAGE_KEY, serializeMoodboardDocument(result.document));
      moodboardDocument = result.document;
      moodboardStatus = moodCopy.saved;
    } catch {
      moodboardStatus = moodCopy.invalid;
    }
  }

  onMount(async () => {
    try {
      const stored = localStorage.getItem(MOODBOARD_STORAGE_KEY);
      moodboardDocument = stored ? parseMoodboardDocument(stored) : createEmptyMoodboardDocument();
      selectedBoardId = moodboardDocument.boards[0]?.id ?? '';
    } catch {
      moodboardStatus = moodCopy.invalid;
    }
    try {
      const result = await loadCollectionRuntime(base);
      index = result.index;
      rows = result.rows;
    } catch {
      failure = true;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>{item ? item.label + ' | Dreamwish Wand' : copy.detail + ' | Dreamwish Wand'}</title>
  <meta name="robots" content="noindex,follow" />
  <meta name="description" content={copy.notPersonal} />
</svelte:head>

<ResponsiveFrame>
  <section class="shared-entity" data-shared-entity-detail="preview" data-public-indexable="false" data-writer="off" lang={localeCode}>
    <nav aria-label={copy.back}><a href={base + '/collection/'}>{copy.back}</a></nav>
    {#if loading}
      <p role="status">{copy.loading}…</p>
    {:else if failure || !item}
      <h1>{copy.unavailable}</h1>
      <p role="status">{copy.unavailable}</p>
    {:else}
      <header class="item-detail-header">
        <ItemThumb itemId={item.itemId} label={item.label} />
        <div><p class="eyebrow">{copy.detail}</p>
          <h1>{item.label}</h1>
          <p>{copy.notPersonal}</p></div>
      </header>
      <ItemImagePreferences />
      <div class="entity-grid" data-entity-identity="source-bound">
        <section><h2>ItemID</h2><p><code>{item.itemId}</code></p></section>
        <section><h2>Build ID / Version</h2><p>Nintendo Switch · DDV v1.25.0 · <code>52BD625D9B4E0053</code></p></section>
        <section>
          <h2>{copy.category}</h2>
          <p>{family}</p>
        </section>
        {#if worldNames.length}
          <section><h2>{copy.world}</h2><p>{worldNames.join(' · ')}</p></section>
        {/if}
        {#if universeNames.length}
          <section><h2>{copy.universe}</h2><p>{universeNames.join(' · ')}</p></section>
        {/if}
        <section><h2>{copy.source}</h2><p>Nintendo Switch · DDV v1.25.0</p></section>
      </div>
      <p class="media-note">{copy.rights}</p>
      <SharedCatalogDiscovery {index} {rows} {localeCode} currentId={String(item.itemId)} maxResults={6} />
      {#if outcome && 'canExplore' in outcome && outcome.canExplore}
        <section class="moodboard-action" data-shared-detail-moodboard-action="local-only">
          <h2>{moodCopy.boards}</h2>
          {#if availableBoards.length}
            <label for="shared-entity-board">{moodCopy.choose}</label>
            <select id="shared-entity-board" bind:value={selectedBoardId}>
              {#each availableBoards as board (board.id)}
                <option value={board.id}>{board.title}</option>
              {/each}
            </select>
            <button type="button" on:click={saveToMoodboard} disabled={!selectedBoardId}>{moodCopy.add}</button>
          {:else}
            <p><a href={base + '/moodboards/'}>{moodCopy.newBoard}</a></p>
          {/if}
          {#if moodboardStatus}<p role="status" aria-live="polite">{moodboardStatus}</p>{/if}
          <p><a href={base + '/moodboards/'}>{moodCopy.title}</a></p>
        </section>
      {/if}
      {#if outcome && 'canExplore' in outcome && outcome.canExplore}
        <p><a href={base + '/explore/'}>{copy.explore}</a></p>
      {/if}
    {/if}
  </section>
</ResponsiveFrame>
<style>
.shared-entity{max-width:1000px;padding-block:42px 100px;min-height:60vh}
 .item-detail-header{display:flex;gap:18px;align-items:flex-start;min-width:0}
 .item-detail-header>div{min-width:0}
 @media(max-width:420px){.item-detail-header{gap:10px}}
 nav a{color:var(--gold);font-weight:650}
 header{margin:32px 0}
 h1{font-family:Georgia,serif;font-weight:500;font-size:clamp(30px,5vw,60px);overflow-wrap:anywhere}
 header p{max-width:68ch;color:var(--ink-soft)}
 .eyebrow{letter-spacing:.12em;color:var(--gold);font-size:12px}
 .entity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
 .entity-grid section{border:1px solid var(--border);background:var(--surface);border-radius:14px;padding:18px}
 h2{font-size:13px;color:var(--ink-soft)}
 .entity-grid p{font-size:16px;overflow-wrap:anywhere}
 .entity-grid code{font-size:12px;overflow-wrap:anywhere}
 .media-note{margin:20px 0;color:var(--ink-muted);font-size:13px}
 .moodboard-action{border:1px solid var(--border);background:var(--surface);border-radius:14px;padding:18px;margin:20px 0;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
 .moodboard-action h2{width:100%;margin:0;font-size:17px}
 .moodboard-action label{font-size:13px}
 .moodboard-action select,.moodboard-action button{font:inherit;padding:8px 12px;background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:8px}
 .moodboard-action button{font-weight:700;cursor:pointer}
 .moodboard-action p{width:100%;margin:2px 0;font-size:13px}
 .moodboard-action a{color:var(--gold)}
 .moodboard-action :is(select,button,a):focus-visible{outline:3px solid var(--gold);outline-offset:3px}
 @media(max-width:620px){.entity-grid{grid-template-columns:1fr}}
</style>
