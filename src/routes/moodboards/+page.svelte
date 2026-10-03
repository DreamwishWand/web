<script lang="ts">
  import { onMount } from 'svelte';
  import { locale } from '$lib/i18n/runtime.js';
  import { moodboardCopy } from '$lib/moodboards/copy.js';
  import {
    MOODBOARD_BACKUP_KEY,
    MOODBOARD_REFERENCE_TYPES,
    MOODBOARD_STORAGE_KEY,
    addMoodboardReference,
    createEmptyMoodboardDocument,
    createMoodboard,
    deleteMoodboard,
    normalizeMoodboardDocument,
    parseMoodboardDocument,
    removeMoodboardReference,
    serializeMoodboardDocument,
    updateMoodboard
  } from '$lib/moodboards/store.js';

  let documentData: any = createEmptyMoodboardDocument();
  let selectedId: string | null = null;
  let status = '';
  let boardTitle = '';
  let boardDescription = '';
  let referenceType = 'ITEM';
  let referenceLabel = '';
  let referenceUrl = '';
  let referenceEntityId = '';
  let referenceNote = '';
  let filter = '';
  let importInput: HTMLInputElement;

  $: copy = moodboardCopy($locale);
  $: selected = documentData.boards.find((board: any) => board.id === selectedId) ?? null;
  $: filteredReferences = selected ? selected.references.filter((reference: any) => {
    const q = filter.trim().toLocaleLowerCase();
    return !q || [reference.label, reference.note, reference.entityId, reference.url, reference.type].filter(Boolean).join(' ').toLocaleLowerCase().includes(q);
  }) : [];

  onMount(() => {
    try {
      const raw = localStorage.getItem(MOODBOARD_STORAGE_KEY);
      if (raw) documentData = parseMoodboardDocument(raw);
    } catch {
      try {
        const backup = localStorage.getItem(MOODBOARD_BACKUP_KEY);
        if (backup) {
          documentData = parseMoodboardDocument(backup);
          localStorage.setItem(MOODBOARD_STORAGE_KEY, serializeMoodboardDocument(documentData));
        }
      } catch { /* fail closed to an empty valid local document */ }
    }
    selectedId = documentData.boards[0]?.id ?? null;
  });

  function persist(next: any, message: string): void {
    const valid = normalizeMoodboardDocument(next);
    try {
      const current = localStorage.getItem(MOODBOARD_STORAGE_KEY);
      if (current) localStorage.setItem(MOODBOARD_BACKUP_KEY, current);
      localStorage.setItem(MOODBOARD_STORAGE_KEY, serializeMoodboardDocument(valid));
      documentData = valid;
      status = message;
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    }
  }

  function addBoard(): void {
    try {
      const result = createMoodboard(documentData, { title: boardTitle, description: boardDescription }, { idFactory: () => crypto.randomUUID() });
      persist(result.document, copy.created);
      selectedId = result.board.id;
      boardTitle = '';
      boardDescription = '';
    } catch (error) { status = error instanceof Error ? error.message : String(error); }
  }

  function saveBoardMetadata(): void {
    if (!selected) return;
    try { persist(updateMoodboard(documentData, selected.id, { title: selected.title, description: selected.description }), copy.saved); }
    catch (error) { status = error instanceof Error ? error.message : String(error); }
  }

  function removeBoard(): void {
    if (!selected || !confirm(copy.delete + '?')) return;
    try {
      const next = deleteMoodboard(documentData, selected.id);
      persist(next, copy.deleted);
      selectedId = next.boards[0]?.id ?? null;
    } catch (error) { status = error instanceof Error ? error.message : String(error); }
  }

  function addReference(): void {
    if (!selected) return;
    try {
      const result = addMoodboardReference(documentData, selected.id, {
        type: referenceType, label: referenceLabel, url: referenceUrl, entityId: referenceEntityId, note: referenceNote
      }, { idFactory: () => crypto.randomUUID() });
      persist(result.document, copy.added);
      referenceLabel = referenceUrl = referenceEntityId = referenceNote = '';
    } catch (error) { status = error instanceof Error ? error.message : String(error); }
  }

  function removeReference(referenceId: string): void {
    if (!selected) return;
    try { persist(removeMoodboardReference(documentData, selected.id, referenceId), copy.removed); }
    catch (error) { status = error instanceof Error ? error.message : String(error); }
  }

  function exportBackup(): void {
    const blob = new Blob([serializeMoodboardDocument(documentData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'dreamwishwand-moodboards-v1.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const imported = parseMoodboardDocument(await file.text());
      persist(imported, copy.imported);
      selectedId = imported.boards[0]?.id ?? null;
    } catch { status = copy.invalid; }
    input.value = '';
  }

  function restorePrevious(): void {
    try {
      const backup = localStorage.getItem(MOODBOARD_BACKUP_KEY);
      if (!backup) { status = copy.noBackup; return; }
      const restored = parseMoodboardDocument(backup);
      persist(restored, copy.restored);
      selectedId = restored.boards[0]?.id ?? null;
    } catch { status = copy.invalid; }
  }

  function typeLabel(type: string): string {
    return type === 'ITEM' ? copy.item : type === 'GALLERY_WORK' ? copy.gallery : type === 'WAND_PRESET' ? copy.preset : type === 'URL' ? copy.link : copy.noteType;
  }
</script>

<svelte:head><title>Moodboards | Dreamwish Wand</title><meta name="description" content="Local-first decorating moodboards for Dreamwish Wand." /></svelte:head>

<section class="moodboards-page container">
  <header class="page-heading">
    <div><p class="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p class="page-intro">{copy.intro}</p></div>
    <div class="boundary-card"><strong>{copy.local}</strong><span>{copy.localDetail}</span></div>
  </header>
  {#if status}<div class="status" role="status" aria-live="polite">{status}</div>{/if}

  <div class="workspace">
    <aside class="board-rail" aria-label={copy.boards}>
      <div class="rail-title"><h2>{copy.boards}</h2><span>{documentData.boards.length}</span></div>
      <form class="create-board" on:submit|preventDefault={addBoard}>
        <h3>{copy.newBoard}</h3>
        <label>{copy.titleLabel}<input bind:value={boardTitle} maxlength="120" required /></label>
        <label>{copy.description}<textarea bind:value={boardDescription} maxlength="1000" rows="3"></textarea></label>
        <button type="submit">{copy.create}</button>
      </form>
      {#if documentData.boards.length}
        <div class="board-list">
          {#each documentData.boards as board}
            <button class:active={board.id === selectedId} type="button" on:click={() => selectedId = board.id}>
              <strong>{board.title}</strong><span>{board.references.length} {copy.count}</span>
            </button>
          {/each}
        </div>
      {:else}<div class="empty small"><strong>{copy.empty}</strong></div>{/if}
      <div class="rail-tools">
        <button type="button" on:click={exportBackup}>{copy.export}</button>
        <button type="button" on:click={() => importInput.click()}>{copy.import}</button>
        <button type="button" on:click={restorePrevious}>{copy.restore}</button>
        <input class="visually-hidden" bind:this={importInput} type="file" accept="application/json,.json" on:change={importBackup} />
      </div>
    </aside>

    <main class="board-panel">
      {#if selected}
        <div class="board-header">
          <div class="board-fields">
            <label>{copy.titleLabel}<input bind:value={selected.title} maxlength="120" on:change={saveBoardMetadata} /></label>
            <label>{copy.description}<textarea bind:value={selected.description} maxlength="1000" rows="3" on:change={saveBoardMetadata}></textarea></label>
          </div>
          <button class="danger" type="button" on:click={removeBoard}>{copy.delete}</button>
        </div>

        <div class="reference-heading">
          <div><p class="eyebrow">{copy.inspiration}</p><h2>{selected.references.length} {copy.count}</h2></div>
          <label class="filter">{copy.filter}<input bind:value={filter} type="search" /></label>
        </div>
        {#if filteredReferences.length}
          <div class="reference-grid">
            {#each filteredReferences as reference}
              <article class="reference-card">
                <div class="reference-top"><span>{typeLabel(reference.type)}</span><button type="button" on:click={() => removeReference(reference.id)}>{copy.remove}</button></div>
                <h3>{reference.label}</h3>
                {#if reference.entityId}<code>{reference.entityId}</code>{/if}
                {#if reference.note}<p>{reference.note}</p>{/if}
                {#if reference.url}<a href={reference.url} target="_blank" rel="noreferrer">{reference.url}</a>{/if}
              </article>
            {/each}
          </div>
        {:else}<div class="empty"><span aria-hidden="true">✧</span><strong>{copy.inspiration}</strong></div>{/if}

        <form class="add-reference" on:submit|preventDefault={addReference}>
          <h2>{copy.addInspiration}</h2>
          <div class="form-grid">
            <label>{copy.type}<select bind:value={referenceType}>{#each MOODBOARD_REFERENCE_TYPES as type}<option value={type}>{typeLabel(type)}</option>{/each}</select></label>
            <label>{copy.label}<input bind:value={referenceLabel} maxlength="160" required /></label>
            <label>{copy.url}<input bind:value={referenceUrl} type="url" maxlength="2000" /></label>
            <label>{copy.entity}<input bind:value={referenceEntityId} maxlength="180" /></label>
            <label class="wide">{copy.note}<textarea bind:value={referenceNote} maxlength="2000" rows="3"></textarea></label>
          </div>
          <button type="submit">{copy.add}</button>
        </form>
      {:else}<div class="empty large"><span aria-hidden="true">✦</span><strong>{copy.choose}</strong></div>{/if}
    </main>
  </div>

  <div class="boundary-grid">
    <article><p class="eyebrow">{copy.recovery}</p><h2>{copy.recovery}</h2><p>{copy.recoveryDetail}</p></article>
    <article><p class="eyebrow">{copy.cloud}</p><h2>{copy.cloud}</h2><p>{copy.cloudDetail}</p></article>
  </div>
</section>

<style>
  .moodboards-page{padding-block:64px 96px;min-height:72vh}.page-heading{display:flex;justify-content:space-between;gap:32px;align-items:end;margin-bottom:28px}.page-heading h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,68px);font-weight:500;letter-spacing:-.055em;margin:12px 0}.boundary-card{max-width:380px;border:1px solid var(--border);border-radius:18px;background:var(--surface);padding:18px;display:grid;gap:7px}.boundary-card strong{color:var(--gold)}.boundary-card span,.boundary-grid p{color:var(--ink-soft);font-size:12px;line-height:1.7}.status{margin-bottom:16px;padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--ink-soft)}.workspace{display:grid;grid-template-columns:minmax(250px,320px) minmax(0,1fr);gap:18px}.board-rail,.board-panel,.boundary-grid article{border:1px solid var(--border);background:var(--surface);border-radius:22px;box-shadow:var(--shadow)}.board-rail{padding:18px;align-self:start;position:sticky;top:88px}.rail-title{display:flex;justify-content:space-between;align-items:center}.rail-title h2,.add-reference h2,.reference-heading h2,.boundary-grid h2{font-family:Georgia,serif;font-size:24px;font-weight:500;margin:0}.rail-title span{font-size:11px;color:var(--ink-muted)}label{display:grid;gap:6px;font-size:10px;font-weight:800;letter-spacing:.04em;color:var(--ink-soft)}input,textarea,select{width:100%;box-sizing:border-box;border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:10px;padding:10px 11px;font:inherit;letter-spacing:0}textarea{resize:vertical}.create-board{display:grid;gap:10px;margin:18px 0;padding:14px;border-radius:14px;background:var(--page-2)}.create-board h3{margin:0 0 2px;font-size:14px}.create-board button,.rail-tools button,.add-reference button,.reference-top button,.danger{border:1px solid var(--border);border-radius:10px;background:var(--surface-raised);color:var(--ink);padding:9px 12px;font-weight:800}.board-list{display:grid;gap:8px}.board-list button{width:100%;text-align:left;border:1px solid var(--border);border-radius:12px;background:transparent;color:var(--ink);padding:11px 12px}.board-list button.active{background:var(--surface-raised);border-color:var(--gold)}.board-list strong,.board-list span{display:block}.board-list span{margin-top:4px;color:var(--ink-muted);font-size:10px}.rail-tools{display:grid;gap:8px;margin-top:16px}.board-panel{padding:24px;min-height:640px}.board-header{display:flex;gap:18px;justify-content:space-between;align-items:flex-start}.board-fields{display:grid;gap:10px;flex:1}.danger{color:var(--decor-accent);white-space:nowrap}.reference-heading{display:flex;align-items:end;justify-content:space-between;gap:18px;margin:30px 0 14px}.reference-heading h2{margin-top:5px}.filter{min-width:220px}.reference-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.reference-card{border:1px solid var(--border);border-radius:15px;background:var(--page-2);padding:15px;min-width:0}.reference-top{display:flex;justify-content:space-between;align-items:center;gap:8px}.reference-top span{font-size:9px;font-weight:900;letter-spacing:.08em;color:var(--gold)}.reference-top button{padding:5px 8px;font-size:9px}.reference-card h3{margin:12px 0 7px;font-size:16px}.reference-card p,.reference-card a,.reference-card code{font-size:11px;line-height:1.6;overflow-wrap:anywhere;color:var(--ink-soft)}.reference-card a{display:block;margin-top:9px}.add-reference{margin-top:22px;padding-top:22px;border-top:1px solid var(--border)}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}.form-grid .wide{grid-column:1/-1}.empty{display:grid;place-items:center;align-content:center;text-align:center;color:var(--ink-muted);gap:7px}.empty.small{min-height:130px}.empty.large{min-height:520px}.empty span{font-size:38px;color:var(--gold)}.boundary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:18px}.boundary-grid article{padding:20px}.boundary-grid h2{margin:6px 0}.visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}@media(max-width:950px){.workspace{grid-template-columns:1fr}.board-rail{position:static}.reference-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.page-heading{align-items:flex-start;flex-direction:column}.boundary-card{max-width:none}}@media(max-width:620px){.moodboards-page{padding-block:44px 70px}.board-panel{padding:16px}.reference-grid,.form-grid,.boundary-grid{grid-template-columns:1fr}.form-grid .wide{grid-column:auto}.board-header,.reference-heading{flex-direction:column;align-items:stretch}.filter{min-width:0}}
</style>
