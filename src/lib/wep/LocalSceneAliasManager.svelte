<script lang="ts">
  import { locale } from '$lib/i18n/runtime.js';
  import {
    reopenLocalScenes, renameLocalSceneAlias
  } from './local-scene-preset-store.mjs';
  import { localScenePresetCopy } from './local-scene-preset-copy.js';

  type Entry = {id:string;title:string;createdAt:string};
  let scenes: Entry[] = [];
  let revision = 0;
  let selectedId = '';
  let nextTitle = '';
  let opened = false;
  let busy = false;
  let status = '';
  let denied = false;
  $: copy = localScenePresetCopy($locale);
  $: selected = scenes.find(scene => scene.id === selectedId) ?? null;
  $: canRename = Boolean(!busy && selected && nextTitle.trim() &&
    nextTitle.trim().length <= 120 && nextTitle.trim() !== selected.title);

  function selectScene(id:string) {
    selectedId = id;
    nextTitle = scenes.find(scene => scene.id === id)?.title ?? '';
    status = '';
    denied = false;
  }

  async function loadSavedScenes() {
    if (busy) return;
    busy = true;
    status = '';
    denied = false;
    // Discard stale selections before a separate verified library read.
    selectedId = '';
    nextTitle = '';
    try {
      const row = await reopenLocalScenes();
      revision = row.revision;
      scenes = row.document.entries.map((e:any) => ({
        id:e.id,title:e.title,createdAt:e.createdAt
      }));
      opened = true;
      status = scenes.length ? copy.opened : copy.empty;
    } catch (error) {
      scenes = [];
      revision = 0;
      opened = true;
      denied = !String(error).includes('WEP_LOCAL_SCENE_DB_UNAVAILABLE_OR_ABSENT');
      status = denied ? copy.aliasBlocked : copy.empty;
    } finally {
      busy = false;
    }
  }

  async function renameSelected() {
    if (!canRename || !selected) return;
    busy = true;
    status = '';
    denied = false;
    const expected = {id:selected.id,title:selected.title,revision};
    try {
      const receipt = await renameLocalSceneAlias({
        sceneId:expected.id,expectedOldTitle:expected.title,
        expectedRevision:expected.revision,newTitle:nextTitle
      });
      // The store already verified a separate IndexedDB open/reopen. Re-read
      // the complete view so a later unrelated Scene remains untouched.
      const row = await reopenLocalScenes();
      if (row.revision !== receipt.revision ||
          row.primary !== receipt.primary || row.backup !== receipt.backup)
        throw Error('WEP_LOCAL_SCENE_ALIAS_REOPEN_MISMATCH');
      revision = row.revision;
      scenes = row.document.entries.map((e:any) => ({
        id:e.id,title:e.title,createdAt:e.createdAt
      }));
      selectedId = expected.id;
      nextTitle = receipt.entry.title;
      status = copy.aliasRenamed;
    } catch {
      // No CAS retries or optimistic success. An old in-memory selection
      // cannot override a changed library.
      scenes = [];
      selectedId = '';
      revision = 0;
      nextTitle = '';
      denied = true;
      status = copy.aliasBlocked;
    } finally {
      busy = false;
    }
  }
</script>

<section class="alias-manager" data-wep-local-scene-alias
  data-save-writer="off" data-native-apply="off" data-cloud="off"
  aria-label={copy.aliasTitle}>
  <h2>{copy.aliasTitle}</h2>
  <p>{copy.aliasNotice}</p>
  <button type="button" data-wep-alias-load on:click={loadSavedScenes}
    disabled={busy}>{copy.aliasLoad}</button>
  {#if opened && scenes.length}
    <label class="field">
      <span>{copy.aliasSelect}</span>
      <select data-wep-alias-scene value={selectedId}
        on:change={(event) => selectScene(event.currentTarget.value)}
        disabled={busy}>
        <option value="">—</option>
        {#each scenes as scene (scene.id)}
          <option value={scene.id}>{scene.title}</option>
        {/each}
      </select>
    </label>
    {#if selected}
      <label class="field">
        <span>{copy.aliasNewName}</span>
        <input data-wep-alias-title type="text" maxlength="120"
          autocomplete="off" bind:value={nextTitle}
          disabled={busy}/>
      </label>
      <button type="button" data-wep-alias-confirm
        on:click={renameSelected} disabled={!canRename}>{copy.aliasRename}</button>
    {/if}
  {/if}
  {#if status}
    <p data-wep-alias-status role={denied ? 'alert' : 'status'}
      aria-live="polite">{status}</p>
  {/if}
</section>

<style>
  .alias-manager{margin:22px 0;padding:clamp(12px,2vw,22px);border:1px solid var(--border);min-width:0;display:grid;gap:10px}
  .alias-manager h2,.alias-manager p{margin:0}
  .field{display:grid;gap:6px;min-width:0}
  .field input,.field select{width:100%;min-width:0;max-width:540px}
  .alias-manager button{justify-self:start;max-width:100%}
</style>
