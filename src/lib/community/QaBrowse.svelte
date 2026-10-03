<script lang="ts">
  import { locale, ct as t } from '$lib/i18n/community.js';
  export let mode: 'questions' | 'tips' = 'questions';
  export let query = '';
  export let unansweredOnly = false;
  export let rows: any[] = [];
  export let busy = false;
  export let onSearch: () => void;
  export let onSelect: (id: string, kind: 'question' | 'tip') => void;
</script>

<div class="tabs">
  <button type="button" class:active={mode === 'questions'} on:click={() => { mode = 'questions'; onSearch(); }}>
    {t('qa.tab.questions', {}, $locale)}
  </button>
  <button type="button" class:active={mode === 'tips'} on:click={() => { mode = 'tips'; unansweredOnly = false; onSearch(); }}>
    {t('qa.tab.tips', {}, $locale)}
  </button>
</div>

<form class="search" on:submit|preventDefault={onSearch}>
  <label class="grow"><span class="visually-hidden">{t('qa.search.label', {}, $locale)}</span><input bind:value={query} placeholder={t('qa.search.placeholder', {}, $locale)} /></label>
  {#if mode === 'questions'}
    <label class="check"><input type="checkbox" bind:checked={unansweredOnly} /> {t('qa.unanswered', {}, $locale)}</label>
  {/if}
  <button type="submit" disabled={busy}>{t('community.action.search', {}, $locale)}</button>
</form>

<div class="list">
  {#each rows as row}
    <button type="button" on:click={() => onSelect(String(row.question_id ?? row.work_id), mode === 'questions' ? 'question' : 'tip')}>
      <strong>{row.title}</strong>
      <span>{row.text_content}</span>
    </button>
  {:else}<p>{t('qa.empty', {}, $locale)}</p>{/each}
</div>

<style>
  .tabs,.search{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.tabs{margin:20px 0}.tabs button,.search button{min-height:40px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--ink);padding:8px 13px}.tabs button.active{border-color:var(--gold);color:var(--gold)}.grow{flex:1}.search input[type="text"],.search .grow input{width:100%;min-height:42px;border:1px solid var(--border);border-radius:11px;background:var(--surface);color:var(--ink);padding:9px 11px}.check{display:flex;gap:6px;align-items:center;font-size:12px}.list{display:grid;gap:10px;margin-top:16px}.list button{text-align:left;padding:14px;border:1px solid var(--border);border-radius:14px;background:var(--surface);color:var(--ink);display:grid;gap:6px}.list span{color:var(--ink-muted);font-size:12px}
</style>
