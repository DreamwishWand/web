<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import {
    MOODBOARD_STORAGE_KEY,
    moodboardSections,
    parseMoodboardDocument
  } from '$lib/moodboards/store.js';
  import {
    decodeCollectionRecord,
    loadCollectionRuntime
  } from '$lib/collection/runtime.js';
  import {
    clearWorldEditorHandoff,
    readWorldEditorHandoff
  } from './world-editor-handoff';
  import { worldEditorStage1Copy } from './world-editor-stage1-copy.js';

  export let session: any = null;
  export let editorDocument: any = null;
  export let switchWorldBinding: any = null;
  export let mutationBound = false;
  export let presetBridge: any = null;
  export let onMutation: (result: any, label: string) => void = () => {};

  let board: any = null;
  let handoff: any = null;
  let itemById = new Map<number, any>();
  let panelError = '';
  let pendingItemId: number | null = null;
  let pendingPresetArtifactId: string | null = null;
  let pendingReferenceId: string | null = null;
  let pendingGroupId: string | null = null;
  let expandedNotes = new Set<string>();
  let placementX = 0;
  let placementY = 0;
  let presetStatus = '';
  let presetLoading = false;
  let preciseX = 0;
  let preciseY = 0;
  let lastPreciseEditorId = '';

  $: copy = worldEditorStage1Copy($locale);
  $: sections = board
    ? moodboardSections(board).map((section: any) => ({
        ...section,
        title: section.kind === 'UNSORTED' ? copy.unsorted : section.title
      }))
    : [];
  $: selectedObjects = session && editorDocument
    ? (session.getSelection?.() ?? [])
        .map((id: string) =>
          editorDocument.objects?.find((object: any) => object.editorId === id)
        )
        .filter(Boolean)
    : [];
  $: singleSelected = selectedObjects.length === 1 ? selectedObjects[0] : null;
  $: genericTransformSelection =
    selectedObjects.length > 0 &&
    selectedObjects.every(
      (object: any) =>
        object.editability === 'editable' &&
        object.layer !== 'road' &&
        object.layer !== 'fence' &&
        object.metadata?.worldClass !== 'FenceAndRoadItemData'
    );
  $: placementCapability =
    pendingItemId && switchWorldBinding?.resolveDraftPlacementSource
      ? resolvePlacementCapability(pendingItemId)
      : null;
  $: pendingItem = pendingItemId ? itemById.get(pendingItemId) ?? null : null;
  $: draftReview =
    session && editorDocument && typeof session.reviewChanges === 'function'
      ? session.reviewChanges()
      : null;
  $: if (singleSelected?.editorId !== lastPreciseEditorId) {
    lastPreciseEditorId = singleSelected?.editorId ?? '';
    if (singleSelected) {
      preciseX = Number(singleSelected.x);
      preciseY = Number(singleSelected.y);
    }
  }

  onMount(async () => {
    try {
      handoff = readWorldEditorHandoff(localStorage);
      const stored = localStorage.getItem(MOODBOARD_STORAGE_KEY);
      if (stored) {
        const document = parseMoodboardDocument(stored);
        if (handoff?.sourceSurface === 'moodboard') {
          board =
            document.boards.find(
              (candidate: any) => candidate.id === handoff.boardId
            ) ?? null;
          pendingReferenceId = handoff.referenceId ?? null;
          pendingGroupId = handoff.groupId ?? null;
        }
      }

      const loaded = await loadCollectionRuntime(base);
      const records = loaded.rows.map((row: any) =>
        decodeCollectionRecord(loaded.index, row, $locale)
      );
      itemById = new Map(
        records.map((record: any) => [Number(record.itemId), record])
      );

      if (handoff?.sourceSurface === 'explore' && handoff.intent === 'ITEM') {
        pendingItemId = Number(handoff.itemId);
      } else if (
        handoff?.sourceSurface === 'moodboard' &&
        handoff.referenceId &&
        board
      ) {
        const reference = board.references.find(
          (entry: any) => entry.id === handoff.referenceId
        );
        activateReference(reference ?? null, handoff.groupId ?? null);
      }
    } catch (error) {
      panelError = error instanceof Error ? error.message : String(error);
    }
  });

  function resolvePlacementCapability(itemId: number) {
    try {
      return switchWorldBinding.resolveDraftPlacementSource(
        Number(itemId),
        Number(editorDocument?.target?.tessellationFactor ?? 1)
      );
    } catch (error) {
      return {
        status: 'BLOCKED',
        draftPlacementSupported: false,
        reasons: [error instanceof Error ? error.message : String(error)],
        persistentWriteAuthorized: false
      };
    }
  }

  function activateReference(reference: any, groupId: string | null = null) {
    if (!reference) return;
    pendingReferenceId = reference.id;
    pendingGroupId = groupId;
    presetStatus = '';
    if (reference.type === 'ITEM') {
      const itemId = Number(reference.entityId);
      pendingItemId = Number.isSafeInteger(itemId) && itemId > 0 ? itemId : null;
      pendingPresetArtifactId = null;
      return;
    }
    if (reference.type === 'WAND_PRESET') {
      pendingPresetArtifactId = String(reference.entityId ?? '') || null;
      pendingItemId = null;
      return;
    }
    if (reference.type === 'NOTE') {
      const next = new Set(expandedNotes);
      if (next.has(reference.id)) next.delete(reference.id);
      else next.add(reference.id);
      expandedNotes = next;
    }
  }

  function clearPending() {
    pendingItemId = null;
    pendingPresetArtifactId = null;
    pendingReferenceId = null;
    pendingGroupId = null;
    presetStatus = '';
    try {
      clearWorldEditorHandoff(localStorage);
    } catch {
      // Pending intent can still be cleared in-memory if storage is unavailable.
    }
  }

  function placePendingItem() {
    panelError = '';
    if (!session || !editorDocument || !mutationBound) {
      panelError = copy.sourceNeeded;
      return;
    }
    if (!pendingItemId || !placementCapability?.draftPlacementSupported) {
      panelError =
        placementCapability?.reasons?.join(', ') ?? copy.blocked;
      return;
    }
    try {
      const result = session.insertDraftGraph(
        [
          {
            localId: 'pending-item',
            itemId: pendingItemId,
            layer: placementCapability.layer,
            localX: 0,
            localY: 0,
            orientation: placementCapability.orientation ?? 0,
            footprint: structuredClone(placementCapability.footprint),
            portableState: null,
            dependencyLocalIds: [],
            metadata: {
              worldClass: 'FurnitureItemData',
              stateKind: 'NONE',
              canonicalItemId: pendingItemId,
              decorateStage1Source:
                handoff?.sourceSurface ?? (board ? 'moodboard' : 'world-editor'),
              persistentWriteAuthorized: false
            }
          }
        ],
        {
          anchorX: Number(placementX),
          anchorY: Number(placementY),
          selectCreated: true,
          kind: 'PASTE'
        }
      );
      onMutation(result, 'PENDING_ITEM_PLACEMENT');
      panelError = result?.draftBlocked
        ? copy.placementBlocked
        : copy.placementDraft;
    } catch (error) {
      panelError = error instanceof Error ? error.message : String(error);
    }
  }

  async function preflightPendingPreset() {
    presetStatus = '';
    if (!pendingPresetArtifactId) return;
    if (!presetBridge) {
      presetStatus = copy.presetAccount;
      return;
    }
    presetLoading = true;
    try {
      await presetBridge.preflightPreset(pendingPresetArtifactId);
      presetStatus = copy.presetChecked;
    } catch (error) {
      presetStatus =
        copy.presetFailed +
        ' ' +
        (error instanceof Error ? error.message : String(error));
    } finally {
      presetLoading = false;
    }
  }

  function runAlign(
    mode:
      | 'left'
      | 'right'
      | 'top'
      | 'bottom'
      | 'horizontal-center'
      | 'vertical-center'
  ) {
    panelError = '';
    if (!session || selectedObjects.length < 2 || !genericTransformSelection) {
      panelError = copy.selectionNeeded;
      return;
    }
    try {
      const result = session.align(null, mode);
      onMutation(result, 'ALIGN_' + mode.toUpperCase().replaceAll('-', '_'));
    } catch (error) {
      panelError = error instanceof Error ? error.message : String(error);
    }
  }

  function runDistribute(axis: 'horizontal' | 'vertical') {
    panelError = '';
    if (!session || selectedObjects.length < 3 || !genericTransformSelection) {
      panelError = copy.distributionNeeded;
      return;
    }
    try {
      const result = session.distribute(null, axis);
      onMutation(result, 'DISTRIBUTE_' + axis.toUpperCase());
    } catch (error) {
      panelError = error instanceof Error ? error.message : String(error);
    }
  }

  function applyPreciseCoordinates() {
    panelError = '';
    if (!session || !singleSelected || !genericTransformSelection) {
      panelError = copy.sourceNeeded;
      return;
    }
    try {
      const result = session.setPositions(
        [singleSelected.editorId],
        {
          [singleSelected.editorId]: {
            x: Number(preciseX),
            y: Number(preciseY)
          }
        },
        'PRECISE_POSITION'
      );
      onMutation(result, 'PRECISE_POSITION');
    } catch (error) {
      panelError = error instanceof Error ? error.message : String(error);
    }
  }

  function referenceLabel(reference: any) {
    if (reference.type === 'ITEM') return copy.item;
    if (reference.type === 'WAND_PRESET') return copy.preset;
    return copy.note;
  }

  function reviewKindLabel(kind: string) {
    if (kind === 'ADD') return copy.added;
    if (kind === 'REMOVE') return copy.removed;
    if (kind === 'MOVE') return copy.moved;
    if (kind === 'ROTATE') return copy.rotated;
    if (kind === 'MOVE_ROTATE') return copy.moveRotate;
    return kind;
  }
</script>

<section class="stage1-panel" data-wep-decorate-stage1>
  <header class="stage1-heading">
    <div>
      <p class="eyebrow">Stage 1</p>
      <h3>{copy.title}</h3>
    </div>
    {#if pendingItemId || pendingPresetArtifactId}
      <button type="button" class="quiet" on:click={clearPending}>
        {copy.closePending}
      </button>
    {/if}
  </header>

  {#if panelError}
    <p class="stage1-status" role="status" aria-live="polite">{panelError}</p>
  {/if}

  {#if pendingItemId}
    <section class="pending-card" aria-labelledby="pending-item-title">
      <p class="eyebrow">{copy.pending}</p>
      <h4 id="pending-item-title">
        {pendingItem?.label ?? copy.item} <code>{pendingItemId}</code>
      </h4>
      {#if placementCapability?.draftPlacementSupported}
        <div class="coordinate-pair">
          <label>
            <span>{copy.x}</span>
            <input type="number" step="1" bind:value={placementX} />
          </label>
          <label>
            <span>{copy.y}</span>
            <input type="number" step="1" bind:value={placementY} />
          </label>
        </div>
        <button
          type="button"
          on:click={placePendingItem}
          disabled={!mutationBound || !session}
        >
          {copy.place}
        </button>
        {#if !session}
          <p class="boundary-note">{copy.sourceNeeded}</p>
        {/if}
      {:else}
        <p class="blocked">
          {copy.blocked} ·
          {(placementCapability?.reasons ?? ['WEP_PLACEMENT_SOURCE_UNRESOLVED']).join(', ')}
        </p>
      {/if}
    </section>
  {/if}

  {#if pendingPresetArtifactId}
    <section class="pending-card" aria-labelledby="pending-preset-title">
      <p class="eyebrow">{copy.pending}</p>
      <h4 id="pending-preset-title">{copy.preset}</h4>
      <code>{pendingPresetArtifactId}</code>
      <button
        type="button"
        disabled={presetLoading || !presetBridge}
        on:click={preflightPendingPreset}
      >
        {copy.preflight}
      </button>
      {#if !presetBridge}
        <p class="boundary-note">{copy.presetAccount}</p>
      {/if}
      {#if presetStatus}
        <p class="stage1-status" aria-live="polite">{presetStatus}</p>
      {/if}
    </section>
  {/if}

  {#if handoff?.sourceSurface === 'moodboard'}
    <section class="moodboard-source" aria-labelledby="wep-moodboard-source-title">
      <p class="eyebrow">{copy.moodboard}</p>
      <h4 id="wep-moodboard-source-title">
        {board?.title ?? copy.noBoard}
      </h4>
      {#if board}
        <div class="moodboard-sections">
          {#each sections as section}
            <section
              class:active-group={pendingGroupId === section.id}
              class="moodboard-group"
            >
              <h5>{section.title}</h5>
              {#if section.references.length}
                <div class="reference-list">
                  {#each section.references as reference}
                    <article
                      class:active={pendingReferenceId === reference.id}
                      class="source-reference"
                    >
                      <button
                        type="button"
                        class="reference-main"
                        on:click={() => activateReference(reference, section.id)}
                      >
                        <span>{referenceLabel(reference)}</span>
                        <strong>{reference.label}</strong>
                        {#if reference.entityId}<code>{reference.entityId}</code>{/if}
                      </button>
                      {#if reference.type === 'NOTE' && expandedNotes.has(reference.id)}
                        <p>{reference.note ?? reference.label}</p>
                      {/if}
                      {#if reference.type === 'ITEM'}
                        {#if resolvePlacementCapability(Number(reference.entityId))?.draftPlacementSupported !== true}
                          <small class="blocked">
                            {copy.blocked} ·
                            {(resolvePlacementCapability(Number(reference.entityId))?.reasons ?? []).join(', ')}
                          </small>
                        {/if}
                      {/if}
                    </article>
                  {/each}
                </div>
              {:else}
                <p class="boundary-note">{copy.noRefs}</p>
              {/if}
            </section>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <section class="transform-tools" aria-labelledby="wep-align-title">
    <h4 id="wep-align-title">{copy.align}</h4>
    <div class="button-grid">
      <button type="button" disabled={selectedObjects.length < 2 || !genericTransformSelection} on:click={() => runAlign('left')}>{copy.left}</button>
      <button type="button" disabled={selectedObjects.length < 2 || !genericTransformSelection} on:click={() => runAlign('right')}>{copy.right}</button>
      <button type="button" disabled={selectedObjects.length < 2 || !genericTransformSelection} on:click={() => runAlign('top')}>{copy.top}</button>
      <button type="button" disabled={selectedObjects.length < 2 || !genericTransformSelection} on:click={() => runAlign('bottom')}>{copy.bottom}</button>
      <button type="button" disabled={selectedObjects.length < 2 || !genericTransformSelection} on:click={() => runAlign('horizontal-center')}>{copy.hCenter}</button>
      <button type="button" disabled={selectedObjects.length < 2 || !genericTransformSelection} on:click={() => runAlign('vertical-center')}>{copy.vCenter}</button>
    </div>

    <h4>{copy.distribute}</h4>
    <div class="button-grid">
      <button type="button" disabled={selectedObjects.length < 3 || !genericTransformSelection} on:click={() => runDistribute('horizontal')}>{copy.horizontal}</button>
      <button type="button" disabled={selectedObjects.length < 3 || !genericTransformSelection} on:click={() => runDistribute('vertical')}>{copy.vertical}</button>
    </div>
  </section>

  <section class="precise-tools" aria-labelledby="wep-precise-title">
    <h4 id="wep-precise-title">{copy.precise}</h4>
    {#if singleSelected && genericTransformSelection}
      <div class="coordinate-pair">
        <label>
          <span>{copy.x}</span>
          <input type="number" step="1" bind:value={preciseX} />
        </label>
        <label>
          <span>{copy.y}</span>
          <input type="number" step="1" bind:value={preciseY} />
        </label>
      </div>
      <button type="button" on:click={applyPreciseCoordinates}>
        {copy.applyCoords}
      </button>
    {:else}
      <p class="boundary-note">
        {selectedObjects.length > 1 ? copy.selectionNeeded : copy.sourceNeeded}
      </p>
    {/if}
  </section>

  <section class="review-tools" data-wep-stage1-review aria-labelledby="wep-stage1-review-title">
    <h4 id="wep-stage1-review-title">{copy.review}</h4>
    {#if draftReview?.changes?.length}
      <div class="review-summary">
        <span>{copy.changes}: <strong>{draftReview.changes.length}</strong></span>
        <span>{copy.commands}: <strong>{draftReview.commands.length}</strong></span>
      </div>
      <div class="review-list">
        {#each draftReview.changes as change}
          <article data-wep-stage1-change={change.kind}>
            <strong>{reviewKindLabel(change.kind)}</strong>
            <code>{change.editorId} · Item {change.itemId}</code>
            {#if change.before}
              <span>
                {copy.x} {change.before.x} · {copy.y} {change.before.y} · O {change.before.orientation}
              </span>
            {/if}
            {#if change.after}
              <span>
                → {copy.x} {change.after.x} · {copy.y} {change.after.y} · O {change.after.orientation}
              </span>
            {/if}
          </article>
        {/each}
      </div>
      <small class="boundary-note">
        persistentWriteAuthorized=false · productApplyAuthorized=false
      </small>
    {:else}
      <p class="boundary-note">{copy.noChanges}</p>
    {/if}
  </section>
</section>

<style>
  .stage1-panel{display:grid;gap:12px}.stage1-heading{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.stage1-heading h3,.pending-card h4,.moodboard-source h4,.transform-tools h4,.precise-tools h4,.review-tools h4{font-family:Georgia,serif;font-weight:500;margin:4px 0 8px}.stage1-heading h3{font-size:22px}.quiet,.pending-card button,.transform-tools button,.precise-tools button{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:9px;padding:8px 10px;font-size:8px;font-weight:800}.pending-card,.moodboard-source,.transform-tools,.precise-tools,.review-tools{border-top:1px solid var(--border);padding-top:12px}.review-summary{display:flex;gap:10px;flex-wrap:wrap;font-size:8px;color:var(--ink-muted)}.review-list{display:grid;gap:5px;margin-top:8px}.review-list article{display:grid;gap:3px;border:1px solid var(--border);border-radius:8px;background:var(--page-2);padding:7px}.review-list strong{font-size:8px;color:var(--gold)}.review-list code,.review-list span{font-size:8px;color:var(--ink-muted);overflow-wrap:anywhere}.pending-card code,.source-reference code{display:block;color:var(--ink-muted);font-size:8px;overflow-wrap:anywhere}.coordinate-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.coordinate-pair label{display:grid;gap:4px;font-size:8px;color:var(--ink-muted)}.coordinate-pair input{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:8px;background:var(--surface-raised);color:var(--ink);padding:8px}.stage1-status,.boundary-note,.blocked{font-size:9px;line-height:1.55;color:var(--ink-muted)}.blocked{color:var(--decor-accent)}.moodboard-sections{display:grid;gap:9px}.moodboard-group{border:1px solid var(--border);border-radius:10px;padding:9px;background:var(--page-2)}.moodboard-group.active-group{box-shadow:inset 0 0 0 1px var(--gold)}.moodboard-group h5{margin:0 0 7px;font-size:10px}.reference-list{display:grid;gap:5px}.source-reference{border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:6px}.source-reference.active{border-color:var(--gold)}.reference-main{display:grid;width:100%;gap:3px;border:0;background:transparent;color:var(--ink);text-align:left;padding:3px;border-radius:6px}.reference-main span{font-size:7px;color:var(--gold);font-weight:900}.reference-main strong{font-size:9px}.source-reference p{font-size:9px;color:var(--ink-muted)}.button-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-bottom:10px}button:focus-visible,input:focus-visible{outline:2px solid var(--gold);outline-offset:2px}button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:560px){.button-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.coordinate-pair{grid-template-columns:1fr}}
</style>
