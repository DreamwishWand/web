<script lang="ts">
  import { locale } from '$lib/i18n/runtime.js';
  import { callPublicCommunityRpc, getPublicCommunityMedia } from '$lib/community/browser-client';
  import { readCommunityBrowserConfig } from '$lib/community/runtime-config';
  import {
    createSceneRevisionGalleryConsumer,
    diagnoseSceneRevisionPairing,
    type ScenePublicCurrentRead,
    type SceneOwnerReadiness
  } from './scene-revision-gallery-consumer';
  import { sceneRevisionCopy } from './scene-revision-copy.js';

  export let workId = '';
  export let presetArtifactId = '';
  export let bridge: any = null;
  export let connected = false;

  let current: ScenePublicCurrentRead | null = null;
  let owner: SceneOwnerReadiness | null = null;
  let coverUrl = '';
  let coverError = '';
  let error = '';
  let loading = false;
  let signing = false;
  let selectedKey = '';
  let ownerBridge: any = null;
  $: if (!connected || bridge !== ownerBridge) {
    ownerBridge = bridge;
    owner = null;
  }
  $: copy = sceneRevisionCopy($locale);
  $: diagnosis = owner ? diagnoseSceneRevisionPairing(current, owner) : null;
  $: selectionKey = workId + '/' + presetArtifactId;
  $: if (selectionKey !== selectedKey) {
    selectedKey = selectionKey;
    current = null;
    owner = null;
    coverUrl = '';
    coverError = '';
    error = '';
  }

  function reader() {
    // Use the SAME configured Community endpoint as the Presets bridge, including
    // the authorized session-scoped Staging Lab fallback (no direct DB access).
    const config = readCommunityBrowserConfig();
    return createSceneRevisionGalleryConsumer({
      publicQuery: (rpc, payload) => callPublicCommunityRpc(rpc, payload, config ?? undefined),
      publicMedia: (id) => getPublicCommunityMedia(id, config ?? undefined),
      ownerReadiness: async (id: string) => {
        if (!connected || typeof bridge?.inspectSceneRevisionReadiness !== 'function') {
          throw new Error('WEP_SCENE_OWNER_AUTH_OR_READINESS_UNAVAILABLE');
        }
        return bridge.inspectSceneRevisionReadiness(id);
      }
    });
  }

  async function inspectCurrent() {
    if (!workId || loading) return;
    loading = true;
    error = '';
    current = null;
    coverUrl = '';
    coverError = '';
    const requested = selectionKey;
    try {
      const found = await reader().readCurrent(workId);
      if (requested !== selectionKey) return;
      current = found;
      if (found.coverMediaId) await refreshCover();
    } catch (e) {
      if (requested === selectionKey) error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function inspectOwner() {
    if (!presetArtifactId || !connected || loading) return;
    loading = true;
    error = '';
    owner = null;
    const requested = selectionKey;
    const requestedBridge = bridge;
    try {
      const found = await reader().readOwner(presetArtifactId);
      if (requested === selectionKey && connected && bridge === requestedBridge) owner = found;
    } catch (e) {
      if (requested === selectionKey && connected && bridge === requestedBridge) {
        error = e instanceof Error ? e.message : String(e);
      }
    } finally {
      loading = false;
    }
  }

  async function refreshCover() {
    if (!current || !current.coverMediaId || signing) return;
    const bound = current;
    coverUrl = '';
    coverError = '';
    signing = true;
    try {
      const signed = await reader().resolveCurrentCover(bound);
      if (current === bound) coverUrl = signed.signedUrl;
    } catch {
      if (current === bound) coverError = copy.coverExpired;
    } finally {
      signing = false;
    }
  }
</script>

{#if workId || presetArtifactId}
  <section data-wep-scene-revision-readonly aria-labelledby="wep-scene-readonly-title" class="scene-revision-panel">
    <div class="heading">
      <div>
        <p class="eyebrow">{copy.selected}</p>
        <h2 id="wep-scene-readonly-title">{copy.title}</h2>
      </div>
      <div class="buttons">
        {#if workId}
          <button type="button" disabled={loading} on:click={inspectCurrent}>{copy.inspect}</button>
        {/if}
        {#if presetArtifactId}
          <button type="button" disabled={loading || !connected} on:click={inspectOwner}>{copy.ownerInspect}</button>
        {/if}
      </div>
    </div>
    {#if loading}<p role="status">{copy.loading}</p>{/if}
    {#if error}<p role="alert"><code>{error}</code></p>{/if}
    {#if current}
      <h3>{current.title}</h3>
      <dl>
        <div><dt>{copy.current}</dt><dd>#{current.presetRevisionNumber}</dd></div>
        <div><dt>{copy.presetRevision}</dt><dd><code>{current.presetRevisionId}</code></dd></div>
        <div><dt>{copy.galleryRevision}</dt><dd><code>{current.galleryWorkRevisionId ?? '—'}</code></dd></div>
        <div><dt>SHA-256</dt><dd><code>{current.checksumSha256}</code></dd></div>
        <div><dt>{copy.currentMediaCount}</dt><dd>{current.mediaIds.length}</dd></div>
      </dl>
      {#if current.coverMediaId}
        <div class="cover" data-wep-scene-current-cover>
          <strong>{copy.cover}</strong>
          {#if coverUrl}
            <img src={coverUrl} alt={current.title} loading="lazy"
              on:error={() => { coverUrl=''; coverError=copy.coverExpired; }} />
          {:else}
            <p role="status">{coverError || copy.coverExpired}</p>
          {/if}
          <button type="button" disabled={signing} on:click={refreshCover}>{copy.retryCover}</button>
        </div>
      {:else}
        <p>{copy.noCover}</p>
      {/if}
      <p>{copy.historical}</p>
    {/if}
    {#if owner}
      <h3>{copy.ownerTitle}</h3>
      <dl>
        <div><dt>{copy.revisionCount}</dt><dd>{owner.revisionCount}</dd></div>
        <div><dt>{copy.historicGallery}</dt><dd>{owner.knownHistoricalGalleryCount}</dd></div>
        <div><dt>{copy.galleryReferences}</dt><dd>{owner.knownGalleryReferenceCount}</dd></div>
        <div><dt>{copy.pairedGalleryOwner}</dt><dd><code>{owner.pairedGalleryWorkId ?? copy.unknown}</code></dd></div>
        <div><dt>{copy.pairedGalleryRowVersion}</dt><dd>{owner.pairedGalleryWorkRowVersion ?? copy.unknown}</dd></div>
        <div><dt>{copy.pairedGalleryCurrentRevision}</dt><dd><code>{owner.pairedGalleryCurrentWorkRevisionId ?? copy.unknown}</code></dd></div>
        <div><dt>{copy.historicalScope}</dt><dd><code>{owner.historicalEdgeSetScope ?? copy.unknown}</code></dd></div>
        <div><dt>{copy.historicalEdgeSha}</dt><dd><code>{owner.historicalEdgeSetSha256 ?? copy.unknown}</code></dd></div>
        <div><dt>{copy.graphFence}</dt><dd>{copy.notAtomic}</dd></div>
      </dl>
      {#if diagnosis}
        <div data-wep-scene-owner-comparison class="blockers" role="status" aria-live="polite">
          <strong>{copy.comparison}: {copy.diagnosticsOnly}</strong>
          {#each diagnosis.blockedReasons as reason}
            <code>{reason}</code>
          {/each}
        </div>
      {/if}
    {/if}
    <p>{copy.boundary}</p>
    <strong class="write-blocked" data-wep-scene-save-disabled>{copy.saveBlocked}</strong>
  </section>
{/if}

<style>
  .scene-revision-panel{min-width:0;overflow-wrap:anywhere;margin-top:18px;padding:22px;border:1px solid var(--border);border-radius:20px;background:var(--surface);display:grid;gap:12px}
  .heading{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .heading h2{margin:4px 0;font-family:Georgia,serif;font-size:25px;font-weight:500}
  .eyebrow{margin:0;font-size:9px;letter-spacing:.1em;color:var(--gold)}
  .buttons{display:flex;gap:8px;flex-wrap:wrap}
  button{border:1px solid var(--border);border-radius:10px;background:var(--surface-raised);padding:9px 12px;color:var(--ink)}
  button:disabled{opacity:.4;cursor:not-allowed}
  dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0}
  dl>div{background:var(--surface-raised);border-radius:10px;padding:10px;min-width:0}
  dt{font-size:10px;color:var(--ink-muted)}dd{margin:4px 0;font-size:11px}
  code{overflow-wrap:anywhere;word-break:break-word}
  .cover{display:grid;gap:8px;max-width:460px}
  .cover img{width:100%;max-height:320px;object-fit:contain;border-radius:10px}
  .blockers{display:grid;gap:5px}.blockers code{font-size:10px}
  .write-blocked{color:var(--decor-accent);font-size:12px}
  @media(max-width:400px){dl{grid-template-columns:1fr}.scene-revision-panel{padding:14px}}
</style>
