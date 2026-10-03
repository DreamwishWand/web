<script lang="ts">
  import { locale, ct as t } from '$lib/i18n/community.js';
  export let answers: any[] = [];
  export let acceptedAnswerId: string | null = null;
</script>

<section>
  <h3>{t('community.action.answer', {}, $locale)}</h3>
  {#each answers as answer}
    <article class:accepted={String(answer.answerId) === String(acceptedAnswerId)}>
      <strong>{answer.creatorDisplayName}</strong>
      <p>{answer.body}</p>
      {#if String(answer.answerId) === String(acceptedAnswerId)}
        <small>{t('qa.accepted', {}, $locale)}</small>
      {/if}
    </article>
  {/each}
</section>

<style>
  section{display:grid;gap:10px}article{padding:14px;border:1px solid var(--border);border-radius:14px}article.accepted{border-color:var(--gold)}small{color:var(--gold)}
</style>
