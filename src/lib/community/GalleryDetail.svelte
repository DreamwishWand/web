<script lang="ts">
  import { base } from '$app/paths';
  import { locale, t } from '$lib/i18n/runtime.js';
  export let work: any;
  export let onClose: () => void;
</script>

<article class="detail">
  <div class="head">
    <h2>{work.title}</h2>
    <button type="button" on:click={onClose}>{t('community.action.close', {}, $locale)}</button>
  </div>
  <p>{work.description}</p>

  <div class="media">
    {#each work.mediaIds ?? [] as mediaId}
      <div class="placeholder" aria-label={t('gallery.media.placeholder', {}, $locale)}>
        <span>{t('gallery.media.placeholder', {}, $locale)}</span>
        <code>{mediaId}</code>
      </div>
    {/each}
  </div>

  {#if work.creator}
    <p>
      {t('gallery.detail.creator', {}, $locale)}:
      <a class="inline-link" href={`${base}/creator/?id=${work.creatorProfileId}`}>
        {work.creator.displayName}
      </a>
    </p>
  {/if}

  {#if work.usedItems?.length}
    <h3>{t('gallery.detail.usedItems', {}, $locale)}</h3>
    <div class="chips">
      {#each work.usedItems as item}
        <span>#{item.itemId}{item.featured ? ' ★' : ''}</span>
      {/each}
    </div>
  {/if}

  <h3>{t('gallery.detail.comments', {}, $locale)}</h3>
  {#each work.comments ?? [] as comment}
    <blockquote>{comment.body}</blockquote>
  {/each}
</article>

<style>
  .detail{margin-top:24px;padding:22px;border:1px solid var(--border);border-radius:20px;background:var(--surface)}.head,.chips{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.head{justify-content:space-between}.head button{min-height:42px;border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);padding:8px 14px}.media{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.placeholder{aspect-ratio:16/9;display:grid;place-items:center;text-align:center;border:1px solid var(--border);border-radius:14px;background:var(--surface-raised);color:var(--ink-muted)}.placeholder code{font-size:10px}.chips span{border:1px solid var(--border);border-radius:999px;padding:6px 10px;font-size:12px}@media(max-width:760px){.media{grid-template-columns:1fr}}
</style>
