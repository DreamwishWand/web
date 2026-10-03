<script lang="ts">
  import { onMount } from 'svelte';
  import { locale, ct as t } from '$lib/i18n/community.js';
  import { callPublicCommunityRpc, getPublicCommunityMedia } from '$lib/community/browser-client';
  import DreamsnapsTabs from '$lib/community/DreamsnapsTabs.svelte';

  let rounds: any[] = [];
  let selectedId = '';
  let result: any = null;
  let layer: 'wand' | 'ingame' = 'wand';
  let mediaUrls: Record<string,string> = {};
  let busy = false, error = '';

  onMount(() => { void loadRounds(); });

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    busy = true; error = '';
    try { return await fn(); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); return null; }
    finally { busy = false; }
  }

  async function loadRounds() {
    rounds = await run(() => callPublicCommunityRpc<any[]>('community_list_dreamsnap_result_rounds_public_v1', { p_limit: 50 })) ?? [];
    if (!selectedId && rounds.length) {
      selectedId = String(rounds[0].challengeId);
      await openRound(selectedId);
    }
  }

  async function openRound(id: string) {
    selectedId = id; layer = 'wand'; mediaUrls = {};
    result = await run(() => callPublicCommunityRpc('community_get_dreamsnap_results_public_v1', { p_challenge_id: id }));
    for (const entry of result?.wandResults ?? []) {
      const mediaId = String(entry.mediaId ?? '');
      if (!mediaId) continue;
      try {
        const signed = await getPublicCommunityMedia(mediaId);
        mediaUrls[mediaId] = signed.signedUrl;
      } catch {}
    }
  }
</script>

<svelte:head><title>{t('dreamsnaps.tab.results', {}, $locale)} | Dreamwish Wand</title></svelte:head>

<section class="inside-page container">
  <p class="eyebrow">{t('dreamsnaps.eyebrow', {}, $locale)}</p>
  <h1>{t('dreamsnaps.tab.results', {}, $locale)}</h1>
  <DreamsnapsTabs />

  <div class="rounds" aria-label={t('dreamsnaps.results.rounds', {}, $locale)}>
    {#each rounds as round}
      <button type="button" class:active={selectedId === round.challengeId} on:click={() => openRound(String(round.challengeId))}>
        <strong>{round.title}</strong><span>{round.state}</span>
      </button>
    {:else}
      <p>{t('dreamsnaps.results.empty', {}, $locale)}</p>
    {/each}
  </div>

  {#if result}
    <article class="round">
      <h2>{result.challenge.title}</h2>
      {#if result.challenge.description}<p>{result.challenge.description}</p>{/if}
      <div class="switch" role="group" aria-label={t('dreamsnaps.results.layer', {}, $locale)}>
        <button type="button" aria-pressed={layer === 'wand'} on:click={() => (layer = 'wand')}>{t('dreamsnaps.results.wand', {}, $locale)}</button>
        <button type="button" aria-pressed={layer === 'ingame'} on:click={() => (layer = 'ingame')}>{t('dreamsnaps.results.ingame', {}, $locale)}</button>
      </div>

      {#if layer === 'wand'}
        <div class="grid">
          {#each result.wandResults ?? [] as entry}
            <article class="card">
              {#if mediaUrls[entry.mediaId]}<img src={mediaUrls[entry.mediaId]} alt={t('dreamsnaps.results.entryAlt', {}, $locale)} />{/if}
              <div class="body">
                <strong>#{entry.placement}</strong>
                <span>{entry.creator?.displayName ?? ''}</span>
                <span>{t('dreamsnaps.results.formalScore', {}, $locale)}: {entry.formalScore}</span>
              </div>
            </article>
          {:else}<p>{t('dreamsnaps.results.emptyLayer', {}, $locale)}</p>{/each}
        </div>
      {:else}
        <div class="official">
          <p>{t('dreamsnaps.results.officialSeparate', {}, $locale)}</p>
          {#each result.inGameResults ?? [] as entry}
            <article class="official-card">
              <strong>{entry.creator?.displayName ?? ''}</strong>
              {#if entry.officialResult?.score != null}<span>{t('dreamsnaps.official.score', {}, $locale)}: {entry.officialResult.score}</span>{/if}
              {#if entry.officialResult?.rank != null}<span>{t('dreamsnaps.official.rank', {}, $locale)}: {entry.officialResult.rank}</span>{/if}
              {#if entry.officialResult?.moonstones != null}<span>{t('dreamsnaps.official.moonstones', {}, $locale)}: {entry.officialResult.moonstones}</span>{/if}
              {#if entry.officialResult?.pixelDust != null}<span>{t('dreamsnaps.official.pixelDust', {}, $locale)}: {entry.officialResult.pixelDust}</span>{/if}
            </article>
          {:else}<p>{t('dreamsnaps.results.emptyLayer', {}, $locale)}</p>{/each}
        </div>
      {/if}
    </article>
  {/if}

  {#if busy}<p role="status">{t('dreamsnaps.loading', {}, $locale)}</p>{/if}
  {#if error}<p class="error" role="alert">{t('shared.form.error', { message: error }, $locale)}</p>{/if}
</section>

<style>
  .rounds{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.rounds button{display:grid;gap:6px;text-align:left;border:1px solid var(--border);border-radius:16px;background:var(--surface);color:var(--ink);padding:14px}.rounds button.active{border-color:var(--gold)}
  .round{margin-top:26px}.switch{display:flex;gap:8px;margin:16px 0}.switch button{border:1px solid var(--border);border-radius:999px;background:var(--surface-raised);color:var(--ink);padding:8px 13px}.switch button[aria-pressed="true"]{border-color:var(--gold)}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}.card,.official-card{border:1px solid var(--border);border-radius:18px;background:var(--surface);overflow:hidden}.card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.body,.official-card{display:grid;gap:7px;padding:13px}.official{display:grid;gap:10px}.error{color:#ffb6b6}
  button:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
</style>
