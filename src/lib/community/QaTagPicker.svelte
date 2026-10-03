<script lang="ts">
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { QA_CONTEXT_TAGS } from './context-tags';

  export let selected: string[] = [];

  function toggle(id: string) {
    selected = selected.includes(id)
      ? selected.filter((value) => value !== id)
      : [...selected, id];
  }
</script>

<fieldset>
  <legend>{t('qa.ask.tags', {}, $locale)}</legend>
  <div class="tags">
    {#each QA_CONTEXT_TAGS as tag}
      <label class:active={selected.includes(tag.id)}>
        <input
          type="checkbox"
          checked={selected.includes(tag.id)}
          on:change={() => toggle(tag.id)}
        />
        {t(tag.labelKey, {}, $locale)}
      </label>
    {/each}
  </div>
</fieldset>

<style>
  fieldset{border:0;padding:0;margin:0}legend{font-size:12px;color:var(--ink-soft);margin-bottom:8px}.tags{display:flex;gap:8px;flex-wrap:wrap}.tags label{display:flex;gap:6px;align-items:center;padding:7px 10px;border:1px solid var(--border);border-radius:999px;font-size:12px}.tags label.active{border-color:var(--gold);color:var(--gold)}
</style>
