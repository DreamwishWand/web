<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { timingUxCopy } from '$lib/timing/timing-ui-copy.js';
  import TimingEditPreview from '$lib/timing/TimingEditPreview.svelte';
  import { openWorldSaveBytes, WEP_WORLD_READONLY_626_PROVENANCE } from '$lib/wep/world-save-source';
  import {
    WAND_TIMING_SWITCH_BID, WAND_TIMING_REGISTRY_PATH,
    projectRecurringEventsReadonly, filterRecurringEventsReadonly
  } from '$lib/timing/recurring-readonly.mjs';

  let sourceBuild = '';
  let userSourceConfirmed = false;
  let fileName = '';
  let busy = false;
  let error = '';
  let summary: any = null;
  let rows: any[] = [];
  let query = '';
  let openToken = 0;
  let selectedKey = '';
  $: copy = timingUxCopy($locale);
  $: filtered = filterRecurringEventsReadonly(rows,query);
  $: visible = filtered.slice(0,150);
  $: selectedRow = visible.find((row: any) => row.mapKey + ':' + row.oneof === selectedKey) ?? null;

  function invalidateAttestation() {
    const hadSource = summary !== null || busy;
    ++openToken;
    busy = false;
    fileName = '';
    rows = [];
    summary = null;
    query = '';
    selectedKey = '';
    error = hadSource ? 'SOURCE_ATTESTATION_CHANGED' : '';
  }

  async function importLocal(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    const token = ++openToken;
    fileName = '';
    error = '';
    rows = [];
    summary = null;
    query = '';
    selectedKey = '';
    if (!file) return;
    if (!userSourceConfirmed || sourceBuild.trim().toUpperCase() !== WAND_TIMING_SWITCH_BID) {
      error = 'SOURCE_BUILD_ATTESTATION_REQUIRED';
      return;
    }
    busy = true;
    try {
      const registryResponse = await fetch(base + WAND_TIMING_REGISTRY_PATH, {cache:'force-cache'});
      if (!registryResponse.ok) throw Error('REGISTRY_UNAVAILABLE');
      const registry = await registryResponse.json();
      if (token !== openToken) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (token !== openToken) return;
      const opened = await openWorldSaveBytes(bytes, {
        sourcePlatform:'switch',
        targetBuild:{platform:'switch',kind:'switch-bid',value:sourceBuild.trim().toUpperCase()},
        sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE
      });
      if (token !== openToken) return;
      if (opened.profileSchemaVersion !== 626 || !opened.compatibility.readOnly ||
          !opened.compatibility.productionReadAccepted || opened.compatibility.editingAuthorized !== false)
        throw Error('READ_ONLY_BUILD_REQUIRED');
      const projected = projectRecurringEventsReadonly(opened.profile,registry);
      if (token !== openToken) return;
      summary = projected;
      rows = [...projected.rows];
      fileName = file.name;
    } catch {
      if (token !== openToken) return;
      error = 'SAVE_READ_OR_REGISTRY_REJECTED';
      rows = [];
      summary = null;
    } finally {
      if (token === openToken) busy = false;
    }
  }
</script>

<svelte:head>
  <title>{copy.title} | Dreamwish Wand</title>
  <meta name="description" content="Local-only Switch v1.25.3 schema626 recurring EventID/ItemID inspection and disabled edit preview. No save upload or editing." />
</svelte:head>

<section class="container timing-page" data-timing-readonly="true" data-writer="off" data-expanded-limit-mib="128">
  <a href={base + '/editor/'}>{copy.back}</a>
  <h1>{copy.title}</h1>
  <p>{copy.intro}</p>
  <p class="warning" role="status" data-w1-writer-off="true">{copy.warning}</p>
  <p class="warning" data-timing-expanded-limit="128">{copy.limit}</p>
  <p class="warning" data-timing-2126="preserve">{copy.future}</p>

  <div class="import-panel">
    <p>{copy.target}</p>
    <label for="timing-bid">{copy.bid}</label>
    <input id="timing-bid" type="text" bind:value={sourceBuild} on:input={invalidateAttestation}
      placeholder={WAND_TIMING_SWITCH_BID} spellcheck="false" autocomplete="off" />
    <label class="attest"><input type="checkbox" bind:checked={userSourceConfirmed}
      on:change={invalidateAttestation}/><span>{copy.attest}</span></label>
    <label for="timing-file">{copy.file}</label>
    <input id="timing-file" type="file" accept=".save,.p1g,application/octet-stream" on:change={importLocal} />
    {#if busy}<p role="status">{copy.loading}</p>{/if}
    {#if error}<p role="alert" class="error" data-timing-error={error}>
      {error === 'SOURCE_ATTESTATION_CHANGED' ? copy.sourceChanged : copy.error}
    </p>{/if}
  </div>

  {#if summary}
    <div class="results" data-timing-loaded="true">
      <h2>{fileName}</h2>
      <p>{copy.saved}: {summary.savedContainerCount} · {copy.found}: {filtered.length} · {copy.unsupported}: {summary.unsupportedContainerCount}</p>
      <label for="timing-search">{copy.search}</label>
      <input id="timing-search" type="search" bind:value={query} />
      <p role="status">{copy.showing}: {visible.length} / {filtered.length}</p>
      {#if filtered.length > 150}<p class="warning" data-timing-page-limited="true">{copy.cursor}</p>{/if}
      {#if !visible.length}<p role="status" data-timing-no-results="true">{copy.none}</p>{/if}
      <div class="result-list">
        {#each visible as row (row.mapKey + ':' + row.oneof)}
          <article class="event" data-event-id={row.eventId ?? 'unknown'}>
            <h3>{row.name}</h3>
            <p>EventID: {row.eventId ?? copy.unknown} · {copy.key}: {row.mapKey} · {row.oneof}</p>
            <p>{copy.next}: <code>{row.nextOccurrence ?? copy.unknown}</code></p>
            <p>{copy.last}: <code>{row.lastOccurrence ?? copy.unknown}</code> · {copy.policy}: {row.policy}</p>
            {#if row.ambiguous || !row.registryKnown}<p class="warning">{copy.unverified}</p>{/if}
            {#if row.items.length}
              <ul aria-label={copy.items}>
                {#each row.items as item (item.linkIndex)}
                  <li>ItemID {item.itemId} — {$locale === 'ja' ? (item.ja || item.en || copy.unknown) : (item.en || item.ja || copy.unknown)}</li>
                {/each}
              </ul>
            {/if}
            <button type="button" class="inspect" data-timing-inspect={row.mapKey}
              aria-pressed={selectedKey === row.mapKey + ':' + row.oneof}
              on:click={() => selectedKey = row.mapKey + ':' + row.oneof}>{copy.choose}</button>
          </article>
        {/each}
      </div>
      {#if selectedRow}
        {#key selectedKey}
          <TimingEditPreview row={selectedRow} onClose={() => selectedKey = ''} />
        {/key}
      {/if}
    </div>
  {/if}
</section>

<style>
 .timing-page{max-width:1100px;padding-block:48px 90px}
 h1{font:500 clamp(29px,5vw,52px) Georgia,serif;margin:14px 0}
 h2{font-size:18px;overflow-wrap:anywhere}
 p{line-height:1.6;color:var(--ink-soft)}
 .warning,.import-panel,.event{border:1px solid var(--border);border-radius:12px;padding:13px 16px;background:var(--surface)}
 .import-panel{display:grid;gap:10px;margin:24px 0}
 .attest{display:flex;align-items:flex-start;gap:10px}
 .attest input{margin-top:4px}
 label{font-size:13px;font-weight:700}
 input[type="text"],input[type="search"],input[type="file"]{box-sizing:border-box;max-width:100%;width:100%;padding:10px;border:1px solid var(--border);border-radius:9px;background:var(--surface-raised);color:var(--ink)}
 .error{color:var(--ink)}
 .results{display:grid;gap:12px}
 .result-list{display:grid;gap:12px}
 .event{overflow-wrap:anywhere}
 .event h3{font-size:18px;margin:0 0 6px}
 .event p{margin:6px 0;font-size:13px}
 .event ul{margin:9px 0 0;padding-left:22px;font-size:13px;line-height:1.8}
 code{overflow-wrap:anywhere}
 .inspect{border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:10px;min-height:44px;padding:9px 14px;cursor:pointer}
 .inspect[aria-pressed="true"]{outline:2px solid var(--gold)}
 .inspect:focus-visible{outline:3px solid var(--focus-ring);outline-offset:3px}
 .warning{overflow-wrap:anywhere}
</style>
