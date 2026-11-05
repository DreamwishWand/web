<script lang="ts">
  import { base } from '$app/paths';
  import { locale, formatDate, formatNumber } from '$lib/i18n/runtime.js';
  import { guideCopy } from '$lib/guide/copy.js';
  import { guideStage1Ui } from '$lib/guide/stage1-guide-ui.mjs';
  import { GUIDE_ROOT_SECTIONS, GUIDE_SYSTEM_CATEGORIES, guideTaxonomyLabel, searchGuideSystemCategories } from '$lib/guide/stage1-systems-taxonomy.mjs';
  import { filterGuideViews, guideEventView, guideQuestView, guideStarPathView, loadGuideRuntime, cleanGuideText } from '$lib/guide/runtime.js';

  type Section = 'systems' | 'quests' | 'starPaths' | 'events';
  const PAGE_SIZE = 40; // Progressive view, never a total-record or data-semantic cap.
  let section: Section | null = null;
  let categoryId: string | null = null;
  let runtime: any = null;
  let loading = false;
  let error = '';
  let query = '';
  let shown = PAGE_SIZE;
  let selectedKey: string | null = null;

  $: copy = guideCopy($locale);
  $: ui = guideStage1Ui($locale);
  $: entries = GUIDE_ROOT_SECTIONS.map(id => ({
    id: id as Section, label: copy[id as Section],
    description: ui[(id + 'Info') as 'systemsInfo' | 'questsInfo' | 'starPathsInfo' | 'eventsInfo']
  }));
  $: categories = searchGuideSystemCategories(query, $locale);
  $: activeCategory = categories.find(c => c.id === categoryId) ?? null;
  $: views = runtime && section
    ? section === 'quests' ? runtime.records.quests.map((x: any) => guideQuestView(x, $locale))
      : section === 'starPaths' ? runtime.records.starPaths.map((x: any) => guideStarPathView(x, $locale))
      : section === 'events' ? runtime.records.events.map((x: any) => guideEventView(x, $locale))
      : []
    : [];
  $: filtered = filterGuideViews(views, query);
  $: visible = filtered.slice(0, shown);
  $: selected = visible.find((x: any) => x.key === selectedKey) ?? visible[0] ?? null;

  async function chooseSection(next: Section | null) {
    section = next; query = ''; categoryId = null; selectedKey = null; shown = PAGE_SIZE;
    if (!next || next === 'systems' || runtime || loading) return;
    loading = true; error = '';
    try { runtime = await loadGuideRuntime(base); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
    finally { loading = false; }
  }
  function safeDate(value: any) {
    if (!value) return '';
    try { return formatDate(value, { year: 'numeric', month: 'short', day: 'numeric' }, $locale); }
    catch { return ''; }
  }
  function dutyLabel(duty: any) {
    const label = cleanGuideText(duty?.label);
    return label && !/^Liveops\./.test(label) ? label : '';
  }
</script>

<svelte:head>
  <title>Guide | Dreamwish Wand</title>
  <meta name="description" content="Guide sections and version-scoped reference browsing. Published article rights and real-time availability are not implied." />
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<section class="guide-page container" data-stage1-guide-four-root>
  <header class="guide-heading">
    <p class="eyebrow">{copy.eyebrow}</p>
    <h1>{copy.title}</h1>
    <p class="page-intro">{ui.scope}</p>
    <p class="guide-provenance">{copy.source} · {copy.readOnly}</p>
  </header>

  <h2 class="guide-section-heading">{ui.browse}</h2>
  <nav class="guide-entry-grid" aria-label={ui.browse} data-guide-four-root>
    {#each entries as entry (entry.id)}
      <button type="button" class:active={section === entry.id} data-guide-root={entry.id}
        aria-pressed={section === entry.id} on:click={() => chooseSection(entry.id)}>
        <strong>{entry.label}</strong>
        <span>{entry.description}</span>
      </button>
    {/each}
  </nav>

  {#if section}
    <section class="guide-browse" aria-label={copy[section]} data-guide-browse={section}>
      <header class="guide-browse-head">
        <button type="button" class="guide-return" on:click={() => chooseSection(null)}>{'← ' + ui.back}</button>
        <h2>{copy[section]}</h2>
      </header>
      {#if section === 'systems'}
        <p class="guide-disclaimer">{ui.groupOnly}</p>
        {#if $locale !== 'ja' && $locale !== 'en'}
          <p class="guide-fallback" role="note">{ui.englishFallback}</p>
        {/if}
        <label class="guide-search"><span>{ui.topicSearch}</span>
          <input type="search" bind:value={query} autocomplete="off" />
        </label>
        <p class="guide-count" aria-live="polite">{formatNumber(categories.length, {}, $locale)} {ui.matches}</p>
        <div class="guide-system-grid" data-guide-systems-seven aria-label={ui.categories}>
          {#each categories as category (category.id)}
            <button type="button" data-guide-system-category={category.id}
              class:active={categoryId === category.id}
              aria-pressed={categoryId === category.id}
              on:click={() => categoryId = category.id}>
              <strong>{guideTaxonomyLabel(category, $locale)}</strong>
              <span>{$locale === 'ja' ? category.descriptionJa : category.descriptionEn}</span>
            </button>
          {/each}
        </div>
        {#if !categories.length}<p class="guide-empty" role="status">{ui.noMatches}</p>{/if}
        {#if activeCategory}
          <section class="guide-groups" data-guide-systems-topic-groups aria-label={ui.groups}>
            <h3>{guideTaxonomyLabel(activeCategory, $locale)}</h3>
            <h4>{ui.groups}</h4>
            <ul>
              {#each activeCategory.groups as group (group.id)}
                <li data-guide-subgroup={group.id}>{guideTaxonomyLabel(group, $locale)}</li>
              {/each}
            </ul>
            <p class="guide-disclaimer">{ui.noPublished}</p>
          </section>
        {/if}
      {:else if loading}
        <div class="guide-status" role="status">{copy.loading}</div>
      {:else if error}
        <div class="guide-status" role="alert"><strong>{copy.failed}</strong><p>{ui.noData}</p></div>
      {:else if runtime}
        <label class="guide-search"><span>{copy.search}</span>
          <input type="search" bind:value={query} on:input={() => {shown = PAGE_SIZE;selectedKey = null;}} autocomplete="off" />
        </label>
        <p class="guide-disclaimer">{ui.referenceOnly}</p>
        <p class="guide-count" aria-live="polite">{formatNumber(visible.length, {}, $locale)} / {formatNumber(filtered.length, {}, $locale)} {ui.shown}</p>
        <div class="guide-workspace">
          <div class="guide-result-list" data-guide-reference-list>
            {#each visible as item (item.key)}
              <button type="button" class:active={selected?.key === item.key}
                aria-pressed={selected?.key === item.key} on:click={() => selectedKey = item.key}>
                <strong>{item.title}</strong>
              </button>
            {/each}
            {#if visible.length < filtered.length}
              <button type="button" class="guide-more" on:click={() => shown += PAGE_SIZE}>{ui.more}</button>
            {/if}
            {#if !filtered.length}<p class="guide-empty">{copy.empty}</p>{/if}
          </div>
          <article class="guide-detail">
            {#if selected}
              <h3>{selected.title}</h3>
              <p class="guide-disclaimer">{ui.referenceOnly}</p>
              {#if selected.localeFallback}<p class="guide-fallback" role="note">{copy.fallback}</p>{/if}
              {#if section === 'quests'}
                <dl><div><dt>{copy.steps}</dt><dd>{selected.steps}</dd></div><div><dt>{copy.objectives}</dt><dd>{selected.objectives}</dd></div></dl>
              {:else if section === 'starPaths'}
                {#if selected.expiresAt}<p>{copy.expires}: {safeDate(selected.expiresAt)}</p>{/if}
                <p>{copy.duties}: {selected.duties.length}</p>
                <div class="guide-duties">
                  {#each selected.duties as duty}
                    {#if dutyLabel(duty)}<p>{dutyLabel(duty)}</p>{/if}
                  {/each}
                </div>
              {:else if section === 'events'}
                {#if selected.guidance}<p class="guide-body">{selected.guidance}</p>{/if}
                {#if selected.occurrences.length}
                  <h4>{copy.occurrences}</h4>
                  {#each selected.occurrences as occurrence}
                    <p>{safeDate(occurrence.start)} – {safeDate(occurrence.end)}</p>
                  {/each}
                {/if}
                {#if selected.historicalGap}<p class="guide-disclaimer">{copy.historical}: {cleanGuideText(selected.historicalGap)}</p>{/if}
              {/if}
            {:else}
              <p class="guide-empty">{copy.select}</p>
            {/if}
          </article>
        </div>
      {/if}
    </section>
  {/if}
  <p class="guide-community">{copy.community} <a href={base + '/help/'}>Help Center</a></p>
</section>

<style>
  .guide-page{padding-block:clamp(32px,5vw,60px) 88px;min-height:70vh;min-width:0}
  .guide-heading{max-width:830px}
  .guide-heading h1{font-family:Georgia,serif;font-weight:500;font-size:clamp(38px,6vw,58px);letter-spacing:-.045em;margin:10px 0}
  .guide-provenance,.guide-community,.guide-disclaimer,.guide-fallback{font-size:12px;color:var(--ink-muted);line-height:1.65}
  .guide-provenance{margin:18px 0}
  .guide-section-heading{font-size:18px;margin:32px 0 16px}
  .guide-entry-grid,.guide-system-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .guide-entry-grid button,.guide-system-grid button{display:grid;align-content:start;gap:12px;min-width:0;min-height:124px;text-align:left;padding:21px;border:1px solid var(--border);border-radius:18px;background:var(--surface);color:var(--ink)}
  .guide-entry-grid strong,.guide-system-grid strong{font-family:Georgia,serif;font-size:clamp(22px,2.7vw,28px);font-weight:500;line-height:1.25;overflow-wrap:anywhere}
  .guide-entry-grid span,.guide-system-grid span{color:var(--ink-soft);font-size:12px;line-height:1.6;overflow-wrap:anywhere}
  .guide-entry-grid button.active,.guide-system-grid button.active{border-color:var(--gold);background:var(--surface-raised)}
  .guide-entry-grid button:hover,.guide-system-grid button:hover{border-color:var(--gold)}
  button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid var(--focus-ring);outline-offset:3px}
  .guide-browse{margin-top:28px;border-top:1px solid var(--border);padding-top:24px}
  .guide-browse-head{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
  .guide-browse-head h2{font-family:Georgia,serif;font-weight:500;font-size:clamp(24px,4vw,36px);margin:0}
  .guide-return,.guide-more{min-height:44px;padding:11px 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface-raised);color:var(--ink)}
  .guide-search{display:grid;gap:8px;margin:18px 0;font-size:12px;font-weight:700;color:var(--ink-soft)}
  .guide-search input{width:100%;min-width:0;min-height:44px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-raised);color:var(--ink);font:inherit}
  .guide-count{font-size:12px;color:var(--ink-muted);margin:8px 0 18px}
  .guide-system-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .guide-system-grid button{min-height:136px}
  .guide-system-grid strong{font-size:18px}
  .guide-groups,.guide-detail{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:clamp(16px,3vw,28px);min-width:0}
  .guide-groups{margin-top:18px}.guide-groups h3,.guide-detail h3{font-family:Georgia,serif;font-weight:500;font-size:clamp(23px,4vw,31px);overflow-wrap:anywhere}
  .guide-groups h4{font-size:13px}.guide-groups li{margin:10px 0;color:var(--ink-soft);font-size:13px}
  .guide-workspace{display:grid;grid-template-columns:minmax(220px,340px) minmax(0,1fr);gap:14px;align-items:start}
  .guide-result-list{display:grid;gap:4px;padding:8px;border:1px solid var(--border);background:var(--surface);border-radius:18px;max-height:640px;overflow:auto}
  .guide-result-list button{text-align:left;min-height:44px;padding:12px;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--ink);overflow-wrap:anywhere}
  .guide-result-list button.active{background:var(--surface-raised);border-color:var(--border)}
  .guide-result-list button strong{font-size:13px}.guide-result-list .guide-more{border:1px solid var(--border);text-align:center}
  .guide-detail{line-height:1.7;overflow-wrap:anywhere}.guide-detail dl{display:flex;gap:20px;flex-wrap:wrap}.guide-detail dt{font-size:11px;color:var(--ink-muted)}.guide-detail dd{margin:0}
  .guide-duties{max-height:440px;overflow:auto}.guide-body{white-space:pre-line;font-size:13px}
  .guide-fallback{padding:10px;border:1px solid var(--border);border-radius:10px}.guide-status,.guide-empty{padding:20px;color:var(--ink-muted)}
  .guide-community{margin-top:40px;border-top:1px solid var(--border);padding-top:18px}
  @media(max-width:1040px){.guide-system-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:720px){.guide-entry-grid,.guide-system-grid,.guide-workspace{grid-template-columns:1fr}.guide-entry-grid button{min-height:102px}.guide-system-grid button{min-height:104px}}
  @media(max-width:360px){.guide-entry-grid button,.guide-system-grid button{padding:14px}.guide-entry-grid strong{font-size:22px}}
</style>
