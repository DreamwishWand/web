<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import ItemThumb from '$lib/ui/ItemThumb.svelte';
  import { loadCollectionRuntime } from '$lib/collection/runtime.js';
  import { buildSharedCatalogDirectory } from '$lib/entity/shared-catalog-directory.mjs';
  import { createSwitchWorldReadAdapter } from '$lib/wep/world-browser-adapter';
  import {
    buildSaveFreeFirstNonemptyScene, resolveVerifiedSaveFreeSceneItem,
    saveFreeSceneCopy
  } from '$lib/wep/savefree-first-scene';
  import {
    reopenLocalScenes, saveLocalScene, verifiedReopenLocalScene
  } from '$lib/wep/local-scene-preset-store.mjs';
  import { buildReadonlyLocalSceneReuseDraft } from '$lib/wep/local-scene-reuse-readonly';

  let directory: any = null;
  let binding: any = null;
  let query = '';
  let title = '';
  let loading = false;
  let saving = false;
  let selected: any = null;
  let prepared: any = null;
  let saved: any = null;
  let status = '';
  let denied = false;
  $: copy = saveFreeSceneCopy($locale);
  $: results = directory?.status === 'READY'
    ? directory.entries.filter((item: any) =>
        item.family === 'Furniture' &&
        (String(item.itemId).includes(query.trim()) ||
         String(item.label).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
      ).slice(0, 24)
    : [];
  $: canSave = Boolean(prepared && selected &&
      prepared.item.itemId === selected.itemId &&
      prepared.title === title.trim() && !saving && !loading);

  async function loadVerifiedCatalog() {
    if (loading || saving || directory) return;
    loading = true;
    status = '';
    denied = false;
    selected = null;
    prepared = null;
    saved = null;
    try {
      // Load *existing* SHA-checked Collection and World geometry consumers.
      // No Save file, IndexedDB, new Reader, or Native identity is involved.
      const [collection, world] = await Promise.all([
        loadCollectionRuntime(base),
        createSwitchWorldReadAdapter({ basePath: base })
      ]);
      const ready = buildSharedCatalogDirectory(collection.index, collection.rows, $locale);
      if (ready.status !== 'READY') throw Error('CATALOG_UNVERIFIED');
      directory = ready;
      binding = world;
    } catch {
      directory = null;
      binding = null;
      denied = true;
      status = copy.blocked;
    } finally { loading = false; }
  }

  function selectVerifiedItem(itemId: number) {
    if (loading || saving || !directory || !binding) return;
    prepared = null;
    saved = null;
    selected = null;
    status = '';
    denied = false;
    try {
      selected = resolveVerifiedSaveFreeSceneItem(directory, binding, itemId);
    } catch {
      denied = true;
      status = copy.unavailable;
    }
  }

  function previewVerifiedNonemptyScene() {
    prepared = null;
    saved = null;
    status = '';
    denied = false;
    if (!selected || !directory || !binding || saving) return;
    try {
      prepared = buildSaveFreeFirstNonemptyScene({
        directory, binding, itemId: selected.itemId, title
      });
      status = copy.ready;
    } catch {
      denied = true;
      status = copy.blocked;
    }
  }

  async function saveVerifiedNonemptyScene() {
    if (!canSave || !directory || !binding || !selected) return;
    saving = true;
    status = '';
    denied = false;
    saved = null;
    try {
      // A preview is not a write receipt. Reconstruct from authenticated
      // Catalog+Geometry on this user click, and compare exact approved payload.
      const current = buildSaveFreeFirstNonemptyScene({
        directory, binding, itemId: selected.itemId, title
      });
      if (JSON.stringify(current.artifact) !== JSON.stringify(prepared.artifact) ||
          current.item.itemId !== prepared.item.itemId)
        throw Error('WEP_SAVEFREE_SCENE_STALE_PREVIEW');
      let expectedRevision: number;
      try {
        const row = await reopenLocalScenes();
        expectedRevision = row.revision;
      } catch (error: any) {
        // First-run no DB only. Corrupted, blocked or malformed existing
        // libraries are never reset or silently repaired.
        if (!String(error).includes('WEP_LOCAL_SCENE_DB_UNAVAILABLE_OR_ABSENT'))
          throw error;
        expectedRevision = 0;
      }
      const receipt = await saveLocalScene({
        artifact: current.artifact, title: current.title, expectedRevision
      });
      const checked = await verifiedReopenLocalScene(receipt);
      const draft = buildReadonlyLocalSceneReuseDraft({
        sceneId: checked.entry.id,
        sourceRevision: checked.revision,
        artifact: checked.entry.artifact
      });
      if (draft.writeReady !== false || draft.applyReady !== false ||
          draft.editorMutationAuthorized !== false ||
          draft.nativePlacementAuthorized !== false ||
          draft.objects.length !== 1)
        throw Error('WEP_SAVEFREE_SCENE_REOPEN_UNVERIFIED');
      saved = { id: checked.entry.id, revision: checked.revision,
        itemId: current.item.itemId, count: draft.objects.length,
        w: draft.bounds.w, h: draft.bounds.h };
      prepared = null;
      status = copy.saved;
    } catch {
      denied = true;
      status = copy.blocked;
    } finally { saving = false; }
  }
</script>

<section class="first-scene" data-wep-savefree-first-scene data-save-writer="off"
  data-native-apply="off" data-cloud="off" data-editor-session="untouched">
  <div class="heading">
    <div>
      <h2>{copy.title}</h2>
      <p>{copy.notice}</p>
    </div>
    <span class="off">{copy.off}</span>
  </div>
  {#if !directory}
    <button type="button" data-wep-savefree-load on:click={loadVerifiedCatalog}
      disabled={loading || saving}>{loading ? copy.waiting : copy.load}</button>
  {:else}
    <label class="search">
      <span>{copy.search}</span>
      <input data-wep-savefree-search type="search" bind:value={query}
        maxlength="120" autocomplete="off" />
    </label>
    <ul class="choices" data-wep-savefree-results>
      {#each results as item (item.itemId)}
        <li>
          <div class="item-identity">
            <ItemThumb itemId={item.itemId} label={item.label} compact />
            <span class="item-name">{item.label} <code>#{item.itemId}</code></span>
          </div>
          <button type="button" data-wep-savefree-choose={item.itemId}
            on:click={() => selectVerifiedItem(item.itemId)}
            disabled={saving}>{copy.choose}</button>
        </li>
      {/each}
    </ul>
    {#if results.length === 0}
      <p>{copy.empty}</p>
    {/if}
  {/if}
  {#if selected}
    <div class="selection" data-wep-savefree-selection>
      <div class="item-identity">
        {#key selected.itemId}
          <ItemThumb itemId={selected.itemId} label={selected.label} />
        {/key}
        <strong class="item-name">{selected.label} · #{selected.itemId}</strong>
      </div>
      <span>{copy.footprint}: {selected.bounds.w} × {selected.bounds.h}</span>
      <code>{selected.layer} · {selected.source}</code>
      <label class="search">
        <span>{copy.name}</span>
        <input data-wep-savefree-title type="text" bind:value={title}
          maxlength="120" autocomplete="off" />
      </label>
      <div class="actions">
        <button type="button" data-wep-savefree-preview
          on:click={previewVerifiedNonemptyScene}
          disabled={saving || !title.trim()}>{copy.prepare}</button>
        <button type="button" data-wep-savefree-save
          on:click={saveVerifiedNonemptyScene} disabled={!canSave}>
          {copy.save}
        </button>
      </div>
    </div>
  {/if}
  {#if prepared}
    <p data-wep-savefree-artifact>
      <strong>{prepared.artifact.objects.length} objects</strong> ·
      {prepared.artifact.bounds.w} × {prepared.artifact.bounds.h} ·
      <code>writeReady=false / applyReady=false</code>
    </p>
  {/if}
  {#if status}
    <p role={denied ? 'alert' : 'status'} aria-live="polite"
      data-wep-savefree-status>{status}</p>
  {/if}
  {#if saved}
    <div data-wep-savefree-saved data-apply="off" data-native-writer="off">
      <strong>{copy.saved}</strong>
      <p>Scene #{saved.id} · Revision {saved.revision} ·
        {saved.count} objects · {saved.w} × {saved.h}</p>
      <a href={`${base}/presets/`}>{copy.next}</a>
    </div>
  {/if}
</section>

<style>
  .first-scene{margin:22px 0;padding:clamp(12px,2vw,22px);border:1px solid var(--border);
    background:var(--surface);border-radius:18px;min-width:0;overflow-wrap:anywhere}
  .heading{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
  h2{font-size:clamp(18px,2vw,24px);font-weight:600;margin:0}
  p{font-size:12px;line-height:1.65;color:var(--ink-soft)}
  .off{font-size:10px;align-self:start;border:1px solid var(--border);
    border-radius:10px;padding:6px 10px;white-space:normal}
  button,a{border:1px solid var(--border);border-radius:9px;padding:10px 12px;
    color:var(--ink);background:var(--surface-raised);font-size:12px;cursor:pointer}
  button:disabled{opacity:.5;cursor:not-allowed}
  button:focus-visible,a:focus-visible,input:focus-visible{
    outline:3px solid var(--gold);outline-offset:2px}
  .search{display:grid;gap:7px;font-size:12px;margin:14px 0}
  input{width:100%;min-width:0;box-sizing:border-box;padding:10px;border:1px solid var(--border);
    border-radius:9px;color:var(--ink);background:var(--surface-raised);font-size:16px}
  .choices{list-style:none;margin:12px 0;padding:0;display:grid;gap:6px}
  .choices li{display:flex;justify-content:space-between;align-items:center;
    flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--border);padding:8px 0}
  .item-identity{display:flex;align-items:center;gap:8px;flex:1 1 180px;min-width:0;max-width:100%}
  .selection .item-identity{flex:none}
  .item-name{font-size:12px;flex:1;min-width:0;overflow-wrap:anywhere}
  code{font-size:11px;overflow-wrap:anywhere}
  .selection{padding:12px;border:1px solid var(--border);border-radius:12px;
    display:grid;gap:8px;margin-top:14px}
  .actions{display:flex;flex-wrap:wrap;gap:8px}
  [data-wep-savefree-saved]{padding:12px;border-radius:12px;
    border:1px solid var(--border);margin-top:14px}
  [data-wep-savefree-saved] a{display:inline-block;margin-top:8px}
  @media(max-width:420px){.choices li button,.actions button{width:100%}}
</style>
