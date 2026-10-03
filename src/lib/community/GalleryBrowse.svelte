<script lang="ts">
  import { locale, t } from '$lib/i18n/runtime.js';
  export let works: any[] = [];
  export let query = '';
  export let busy = false;
  export let onSearch: () => void;
  export let onSelect: (workId: string) => void;
</script>

<form class="search" on:submit|preventDefault={onSearch}>
  <label>
    <span class="visually-hidden">{t('gallery.search.label', {}, $locale)}</span>
    <input bind:value={query} placeholder={t('gallery.search.placeholder', {}, $locale)} />
  </label>
  <button type="submit" disabled={busy}>{t('community.action.search', {}, $locale)}</button>
</form>

<div class="grid">
  {#each works as work}
    <button class="card" type="button" on:click={() => onSelect(String(work.work_id))}>
      <small>{String(work.facets?.galleryKind ?? 'gallery')}</small>
      <strong>{work.title}</strong>
      <span>{work.text_content}</span>
    </button>
  {:else}
    <p>{t('gallery.empty', {}, $locale)}</p>
  {/each}
</div>

<style>
  .search{display:flex;gap:10px;margin:22px 0}.search label{flex:1}.search input{width:100%;min-height:44px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--ink);padding:10px 12px}.search button{min-height:42px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--ink);padding:8px 14px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.card{display:grid;gap:8px;text-align:left;padding:18px;border:1px solid var(--border);border-radius:18px;background:var(--surface);color:var(--ink)}.card small{color:var(--gold);text-transform:uppercase}.card span{color:var(--ink-muted);font-size:12px}@media(max-width:760px){.grid{grid-template-columns:1fr}}
</style>
