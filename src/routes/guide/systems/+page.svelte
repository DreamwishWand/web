<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { systemsCopy } from '$lib/guide/systems-copy.js';
  import {
    loadPublishedSystems, browsePublishedSystems, publishedSystemById,
    relatedPublishedSystems, systemsCategoryCounts, systemLabel, canonicalSystemHref
  } from '$lib/guide/systems-public.js';
  import { SYSTEMS_SOURCE } from '$lib/guide/systems-catalog.js';

  let manifest: any = null;
  let loading = true;
  let error = '';
  let query = '';
  let categoryId = '';
  let groupId = '';
  let articleId = '';
  let version = '1.25.0';

  $: copy = systemsCopy($locale);
  $: categories = systemsCategoryCounts(manifest);
  $: activeCategory = categories.find((c: any) => c.id === categoryId) ?? null;
  $: entries = browsePublishedSystems(manifest, { locale: $locale, query, categoryId, groupId, version });
  $: selected = publishedSystemById(manifest, articleId, version);
  $: detail = selected?.localized?.[$locale] ?? selected?.localized?.en ?? null;
  $: related = relatedPublishedSystems(manifest, selected);

  async function refresh() {
    loading = true;
    error = '';
    try { manifest = await loadPublishedSystems(base); }
    catch (cause) {
      manifest = null;
      error = cause instanceof Error ? cause.message : String(cause);
    } finally { loading = false; }
  }
  onMount(() => {
    const url = new URL(window.location.href);
    const category = url.searchParams.get('category') || '';
    const group = url.searchParams.get('group') || '';
    categoryId = categories.some((c: any) => c.id === category) ? category : '';
    groupId = categories.find((c: any) => c.id === categoryId)?.groups.some((g: any) => g.id === group) ? group : '';
    articleId = url.searchParams.get('article') || '';
    version = url.searchParams.get('version') || '1.25.0';
    void refresh();
  });
  function chooseCategory(id: string) { categoryId = id; groupId = ''; articleId = ''; }
  function chooseGroup(id: string) { groupId = id; articleId = ''; }
  function showTitle(record: any): string { return record.localized?.[$locale]?.title || record.localized?.en?.title || ''; }
  function groupLabel(category: any, groupId: string): string {
    return systemLabel(category.groups.find((g: any) => g.id === groupId) ?? {en:'',ja:''}, $locale);
  }
</script>

<svelte:head>
  <title>Guide — Systems | Dreamwish Wand</title>
  <meta name="description" content="Dreamwish Wand Guide Systems: owner-approved seven-category browse and version-scoped publication-safe search." />
</svelte:head>

<section class="systems-page container" data-guide-systems>
  <nav class="breadcrumbs" aria-label="Guide navigation">
    <a href={base + '/guide/'}>Guide</a><span aria-hidden="true">›</span><span aria-current="page">{copy.heading}</span>
  </nav>
  <header>
    <p class="eyebrow">GUIDE / SYSTEMS</p>
    <h1>{copy.heading}</h1>
    <p class="intro">{copy.subtitle}</p>
    <p class="context">{copy.platform}: {SYSTEMS_SOURCE.platform} · {copy.version}: {SYSTEMS_SOURCE.gameVersion} · BID {SYSTEMS_SOURCE.buildID}</p>
  </header>

  <div class="systems-layout">
    <aside class="systems-categories" aria-label={copy.categories}>
      <h2>{copy.categories}</h2>
      <button type="button" class:active={!categoryId} aria-pressed={!categoryId} on:click={() => chooseCategory('')}>{copy.all}</button>
      {#each categories as category}
        <div class="category-block">
          <button type="button" class:active={categoryId===category.id} aria-pressed={categoryId===category.id}
            on:click={() => chooseCategory(category.id)}>
            <span>{systemLabel(category,$locale)}</span><small>{category.count}</small>
          </button>
          {#if categoryId === category.id}
            <div class="group-list" aria-label={copy.group}>
              <button type="button" class:active={!groupId} aria-pressed={!groupId} on:click={() => chooseGroup('')}>{copy.allGroups}</button>
              {#each category.groups as group}
                <button type="button" class:active={group.id===groupId} aria-pressed={group.id===groupId} on:click={() => chooseGroup(group.id)}>
                  <span>{systemLabel(group,$locale)}</span><small>{group.count}</small>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </aside>
    <div class="systems-main">
      <div class="systems-filters">
        <label for="systems-search">{copy.search}</label>
        <input id="systems-search" type="search" bind:value={query} autocomplete="off" />
        <label for="systems-version">{copy.version}</label>
        <select id="systems-version" bind:value={version}>
          <option value="1.25.0">Nintendo Switch 1.25.0</option>
          <option value="1.25.3">Nintendo Switch 1.25.3 — unverified</option>
        </select>
      </div>

      {#if loading}
        <p class="systems-status" data-systems-state="loading" role="status">Loading…</p>
      {:else if error}
        <div class="systems-status" data-systems-state="error" role="alert">
          <p>{copy.error}</p><button type="button" on:click={refresh}>{copy.retry}</button>
        </div>
      {:else if version !== SYSTEMS_SOURCE.gameVersion}
        <p class="systems-status" data-systems-state="unknown-version" role="status">{copy.unknownVersion}</p>
      {:else}
        {#if $locale !== 'en' && $locale !== 'ja'}<p class="systems-note" role="note">{copy.fallback}</p>{/if}
        <p class="count" role="status">{entries.length} {copy.results}</p>
        {#if articleId}
          <a class="back-link" href={base + '/guide/systems/'}>{copy.back}</a>
          {#if selected && detail}
            <article class="systems-detail" data-systems-state="detail">
              <p class="eyebrow">{systemLabel(categories.find((c:any)=>c.id===selected.categoryId),$locale)} / {groupLabel(categories.find((c:any)=>c.id===selected.categoryId),selected.groupId)}</p>
              <h2>{detail.title}</h2>
              <p>{detail.summary}</p>
              <dl>
                <div><dt>{copy.platform} / {copy.version}</dt><dd>{SYSTEMS_SOURCE.platform} · {SYSTEMS_SOURCE.gameVersion}</dd></div>
                <div><dt>{copy.dlc}</dt><dd>{selected.dlcContext.join(' / ') || '—'}</dd></div>
                <div><dt>{copy.source} / {copy.confidence}</dt><dd>{selected.sourceLabel} · {selected.confidence}</dd></div>
                <div><dt>{copy.reviewedAt}</dt><dd>{selected.reviewedAt}</dd></div>
              </dl>
              {#if detail.prerequisites.length}<h3>{copy.prerequisites}</h3><ul>{#each detail.prerequisites as line}<li>{line}</li>{/each}</ul>{/if}
              {#if detail.instructions.length}<h3>{copy.instructions}</h3><ol>{#each detail.instructions as line}<li>{line}</li>{/each}</ol>{/if}
              {#if detail.warnings.length}<h3>{copy.warnings}</h3><ul>{#each detail.warnings as line}<li>{line}</li>{/each}</ul>{/if}
              {#if related.length}<h3>{copy.related}</h3><ul>{#each related as item}<li><a href={canonicalSystemHref(item.id,base)}>{showTitle(item)}</a></li>{/each}</ul>{/if}
            </article>
          {:else}<p class="systems-status" data-systems-state="unpublished" role="status">{copy.notAvailable}</p>{/if}
        {:else if entries.length}
          <div class="systems-results" data-systems-state="results">
            {#each entries as article (article.id)}
              <a class="systems-result" href={canonicalSystemHref(article.id,base)}>
                <span>{showTitle(article)}</span><small>{systemLabel(categories.find((c:any)=>c.id===article.categoryId),$locale)} / {groupLabel(categories.find((c:any)=>c.id===article.categoryId),article.groupId)}</small>
                <span class="read-link">{copy.link} →</span>
              </a>
            {/each}
          </div>
        {:else}
          <p class="systems-status" data-systems-state="empty" role="status">{copy.empty}</p>
          {#if activeCategory}<p class="systems-note">{copy.categoryEmpty}</p>{/if}
        {/if}
      {/if}
    </div>
  </div>
</section>

<style>
.systems-page{padding-block:36px 84px;min-height:75vh}.breadcrumbs{display:flex;gap:9px;align-items:center;font-size:13px;margin-bottom:25px;color:var(--ink-muted)}.breadcrumbs a,.back-link{color:var(--gold)}h1{font:500 clamp(36px,5vw,56px) Georgia,serif;letter-spacing:-.04em;margin:5px 0 12px}.intro{color:var(--ink-soft);line-height:1.6}.eyebrow{letter-spacing:.12em;text-transform:uppercase;font-size:11px;color:var(--gold)}.context{color:var(--ink-muted);font-size:11px;overflow-wrap:anywhere}.systems-layout{margin-top:26px;display:grid;grid-template-columns:minmax(230px,320px) minmax(0,1fr);gap:18px;align-items:start}.systems-categories,.systems-main{border:1px solid var(--border);background:var(--surface);padding:16px;border-radius:16px;min-width:0}.systems-categories h2{font-size:15px;margin:0 0 15px}.systems-categories button{display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;width:100%;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--ink-soft);padding:10px 9px;cursor:pointer;font:inherit;font-size:13px;line-height:1.4}.systems-categories button.active,.systems-categories button:hover{background:var(--surface-raised);border-color:var(--border);color:var(--gold)}.systems-categories small{font-size:11px;flex:none}.group-list{margin-left:14px;padding-left:9px;border-left:1px solid var(--border)}.group-list button{font-size:12px}.systems-filters{display:grid;grid-template-columns:minmax(0,1fr) minmax(170px,230px);gap:8px 16px;align-items:center}.systems-filters label{font-size:12px;color:var(--ink-soft)}.systems-filters input,.systems-filters select{grid-row:2;box-sizing:border-box;min-width:0;width:100%;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-raised);color:var(--ink);font:inherit}.systems-filters label:nth-child(3){grid-column:2;grid-row:1}.systems-filters select{grid-column:2}.systems-status,.systems-note{border:1px dashed var(--border);padding:18px;border-radius:12px;color:var(--ink-muted);line-height:1.6;margin-top:18px;font-size:14px}.systems-status button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:8px;padding:9px 12px;cursor:pointer}.count{font-size:13px;color:var(--ink-muted)}.systems-results{display:grid;gap:9px}.systems-result{border:1px solid var(--border);border-radius:12px;padding:16px;display:grid;gap:7px;color:var(--ink);text-decoration:none}.systems-result:hover,.systems-result:focus-visible{background:var(--surface-raised)}.systems-result small{font-size:12px;color:var(--ink-muted)}.read-link{font-size:12px;color:var(--gold)}.systems-detail{padding:18px 2px}.systems-detail h2{font:500 clamp(27px,4vw,39px) Georgia,serif;overflow-wrap:anywhere}.systems-detail h3{font-size:15px;margin-top:26px;color:var(--gold)}.systems-detail p,.systems-detail li{font-size:14px;line-height:1.8;color:var(--ink-soft)}.systems-detail li{margin-block:5px}.systems-detail dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.systems-detail dl div{border-radius:9px;background:var(--surface-raised);padding:12px;overflow-wrap:anywhere}.systems-detail dt{color:var(--ink-muted);font-size:11px}.systems-detail dd{margin:4px 0;font-size:12px}.back-link{display:inline-block;margin:10px 0}.systems-page button:focus-visible,.systems-page a:focus-visible,.systems-page input:focus-visible,.systems-page select:focus-visible{outline:3px solid var(--focus-ring);outline-offset:2px}@media(max-width:750px){.systems-layout{grid-template-columns:1fr}.systems-categories{display:block}.systems-filters{grid-template-columns:1fr}.systems-filters label:nth-child(3),.systems-filters select{grid-column:1;grid-row:auto}.systems-filters label:nth-child(3){grid-row:3}.systems-filters select{grid-row:4}}@media(max-width:410px){.systems-page{padding-block:26px 55px}.systems-categories,.systems-main{padding:11px}.systems-detail dl{grid-template-columns:1fr}}
</style>
