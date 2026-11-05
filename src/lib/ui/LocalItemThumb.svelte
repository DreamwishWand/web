<script lang="ts">
  import { onMount } from 'svelte';
  import { localImageState, loadLocalImage, restoreLocalImages } from './local-r39-item-image.mjs';

  export let itemId: number | string;
  export let label = '';
  export let compact = false;
  let src: string | null = null;
  let mounted = false;
  let generation = 0;
  let status: 'missing' | 'ready' = 'missing';

  onMount(() => {
    mounted = true;
    let lastRevision = -1;
    const unsubscribe = localImageState.subscribe((s) => {
      if (lastRevision === s.revision) return;
      lastRevision = s.revision;
      const ticket = ++generation;
      restoreLocalImages().then(() => loadLocalImage(itemId)).then((url) => {
        if (!mounted || ticket !== generation) { if (url) URL.revokeObjectURL(url); return; }
        if (src) URL.revokeObjectURL(src);
        src = url;
        status = url ? 'ready' : 'missing';
      }).catch(() => { if (mounted && ticket === generation) status = 'missing'; });
    });
    return () => { mounted = false; generation++; unsubscribe(); if (src) URL.revokeObjectURL(src); };
  });
</script>

<span class="local-item-thumb" class:compact
  data-local-item-thumb={String(itemId)}
  data-image-state={status}
  data-source-version="1.24.13"
  style:--thumb-size={$localImageState.preferences.size + 'px'}>
  {#if src}
    <img {src} alt={label + ' · LOCAL PREVIEW Switch 1.24.13'} loading="lazy" decoding="async"
      style:object-fit={$localImageState.preferences.fit} draggable="false"
      on:error={() => { if (src) URL.revokeObjectURL(src); src = null; status = 'missing'; }} />
  {:else}
    <span class="unavailable" aria-hidden="true">◇</span>
  {/if}
</span>

<style>
.local-item-thumb{width:var(--thumb-size);height:var(--thumb-size);flex:0 0 var(--thumb-size);display:inline-grid;place-items:center;border:1px solid var(--border);border-radius:10px;background:var(--surface-raised);overflow:hidden;min-width:0;vertical-align:middle}
.local-item-thumb img{display:block;width:100%;height:100%;object-position:center;background:transparent}
.local-item-thumb .unavailable{font-size:22px;color:var(--ink-muted)}
.local-item-thumb.compact{max-width:100%}
@media(max-width:340px){.local-item-thumb{max-width:min(80px,25vw);max-height:min(80px,25vw)}}
</style>
