<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { openWorldSaveBytes, WEP_WORLD_READONLY_626_PROVENANCE } from '$lib/wep/world-save-source';
  import {
    WAND_TIMING_SWITCH_BID, WAND_TIMING_REGISTRY_PATH,
    projectRecurringEventsReadonly, filterRecurringEventsReadonly
  } from '$lib/timing/recurring-readonly.mjs';
  import { previewNextOccurrenceUiOnly } from '$lib/timing/w1-nextoccurrence-preview.mjs';

  let sourceBuild = '';
  let userSourceConfirmed = false;
  let fileName = '';
  let busy = false;
  let error = '';
  let summary: any = null;
  let rows: any[] = [];
  let query = '';
  let sourceSha256 = '';
  let registrySha256 = '';
  let originalFile: File | null = null;
  let backupRequested = false;
  let selectedRow: any = null;
  let proposedUtc = '';
  let preview: any = null;
  let previewError = '';
  let openToken = 0;
  $: japanese = $locale === 'ja';
  $: filtered = filterRecurringEventsReadonly(rows,query);
  $: visible = filtered.slice(0,150);

  async function importLocal(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    const token = ++openToken;
    fileName = '';
    error = '';
    rows = [];
    summary = null;
    query = '';
    sourceSha256 = '';
    registrySha256 = '';
    originalFile = null;
    backupRequested = false;
    selectedRow = null;
    proposedUtc = '';
    preview = null;
    previewError = '';
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
      const sourceDigest = await crypto.subtle.digest('SHA-256', bytes);
      const registryDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(registry)));
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
      originalFile = file;
      sourceSha256 = Array.from(new Uint8Array(sourceDigest), v=>v.toString(16).padStart(2,'0')).join('');
      registrySha256 = Array.from(new Uint8Array(registryDigest), v=>v.toString(16).padStart(2,'0')).join('');
    } catch {
      if (token !== openToken) return;
      error = 'SAVE_READ_OR_REGISTRY_REJECTED';
      rows = [];
      summary = null;
    } finally {
      if (token === openToken) busy = false;
    }
  }
  function chooseRow(row: any) {
    selectedRow = row;
    proposedUtc = '';
    preview = null;
    previewError = '';
  }
  function buildPreview() {
    preview = null;
    previewError = '';
    try {
      preview = previewNextOccurrenceUiOnly(selectedRow, proposedUtc, {
        sourceSha256,registrySha256,
        externalBid:sourceBuild.trim().toUpperCase(),
        sourceSchema:626,sourceRevision:0
      });
    } catch (err) {
      previewError = err instanceof Error ? err.message : 'W1_PREVIEW_REJECTED';
    }
  }
  function downloadOriginalBackup() {
    if (!originalFile || !sourceSha256) return;
    // Downloads the *original selected P1G* only. No edited-copy export or
    // claim that the browser completed persistence; user must verify a file.
    const url=URL.createObjectURL(originalFile);
    const a=document.createElement('a');
    a.href=url;
    a.download=originalFile.name.replace(/[^\\w.\\-]/g,'_')+'.original-backup.p1g';
    a.click();
    backupRequested = true;
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
</script>

<svelte:head>
  <title>{japanese ? '日時・スポーン検索' : 'Timing & Spawn Inspector'} | Dreamwish Wand</title>
  <meta name="description" content="Local-only DDV Switch v1.25.3 recurring event and ItemID search. No save editing, upload or writer." />
</svelte:head>

<section class="container timing-page" data-timing-readonly="true" data-writer="off">
  <a href={base + '/editor/'}>{japanese ? '← Editorに戻る' : '← Back to Editor'}</a>
  <h1>{japanese ? '日時・スポーンの検索' : 'Timing & Spawn Inspector'}</h1>
  <p>{japanese ? 'Dreamlight Timekeeperのイベント定義をWandで再利用した、ローカル読取り専用画面です。' : 'Local read-only preview using the frozen Dreamlight Timekeeper event registry.'}</p>
  <p class="warning" role="status">{japanese
    ? 'セーブの書込み、日時の変更、編集コピーの出力は無効です。ファイルはWandのサーバーへ送信されません。'
    : 'Editing, time changes and edited-copy export are disabled. The selected save is not uploaded to Wand servers.'}</p>

  <div class="import-panel">
    <p>{japanese ? '対象: Nintendo Switch DDV v1.25.3 / schema626' : 'Target: Nintendo Switch DDV v1.25.3 / schema626'}</p>
    <label for="timing-bid">{japanese ? '外部で確認したBuild ID' : 'Externally verified Build ID'}</label>
    <input id="timing-bid" type="text" bind:value={sourceBuild} placeholder={WAND_TIMING_SWITCH_BID} spellcheck="false" autocomplete="off"/>
    <label class="attest"><input type="checkbox" bind:checked={userSourceConfirmed}/><span>{japanese
      ? 'Switchの対象バージョン・BIDをゲーム側で確認した（セーブ自体にBIDは含まれません）'
      : 'I verified the target Switch game build externally (the save does not contain its BID).'}</span></label>
    <label for="timing-file">{japanese ? 'ローカルセーブを選択' : 'Choose a local save'}</label>
    <input id="timing-file" type="file" accept=".save,.p1g,application/octet-stream" on:change={importLocal}/>
    {#if busy}<p role="status">{japanese ? 'ローカルで読込み中…' : 'Reading locally…'}</p>{/if}
    {#if error}<p role="alert" class="error">{japanese ? '読込みできませんでした。BID・形式・バージョンを確認してください。' : 'Could not read the save. Check the build, file format and version.'} <code>{error}</code></p>{/if}
  </div>

  {#if summary}
    <div class="results" data-timing-loaded="true">
      <h2>{fileName}</h2>
      <p>{japanese ? '保存済みイベント' : 'Saved event containers'}: {summary.savedContainerCount} · {japanese ? '日時フィールド' : 'Timestamp rows'}: {rows.length} · {japanese ? '未対応の構造' : 'Unsupported containers'}: {summary.unsupportedContainerCount}</p>
      <p data-w1-source-sha="true">{japanese ? '読込原本 SHA-256' : 'Original source SHA-256'}: <code>{sourceSha256}</code></p>
      <div class="w1-backup">
        <button type="button" on:click={downloadOriginalBackup} disabled={!originalFile} data-w1-original-backup="true">
          {japanese ? '原本をバックアップとして保存' : 'Download untouched original backup'}
        </button>
        <p role="status">{backupRequested
          ? (japanese ? 'ダウンロード要求済み。ファイルが保存されたことを自分で確認してください。' : 'Download requested. Verify that the original backup file was saved.')
          : (japanese ? '編集前に原本バックアップが必要です。編集コピーの出力は現在無効です。' : 'Original backup is required before editing. Edited-copy export is currently disabled.')}
        </p>
      </div>
      <label for="timing-search">{japanese ? 'EventID・ItemID・名前・日時で検索' : 'Search EventID, ItemID, name or timestamp'}</label>
      <input id="timing-search" type="search" bind:value={query}/>
      <p role="status">{filtered.length} {japanese ? '件（先頭150件を表示）' : 'matches (up to 150 shown)'}</p>
      <div class="result-list">
        {#each visible as row (row.mapKey + ':' + row.oneof)}
          <article class="event" data-event-id={row.eventId ?? 'unknown'}>
            <h3>{row.name}</h3>
            <p>EventID: {row.eventId ?? 'unknown'} · {japanese ? '保存キー' : 'Save key'}: {row.mapKey} · {row.oneof}</p>
            <p>{japanese ? '次回' : 'Next'}: <code>{row.nextOccurrence ?? 'unknown'}</code></p>
            <p>{japanese ? '前回' : 'Last'}: <code>{row.lastOccurrence ?? 'unknown'}</code> · {japanese ? '静的分類' : 'Static policy'}: {row.policy}</p>
            {#if row.ambiguous || !row.registryKnown}<p class="warning">{japanese ? '定義またはoneof構造は未確認。書込み不可。' : 'Unverified registry or oneof shape. Write disabled.'}</p>{/if}
            {#if row.mapKey === '155' && row.eventId === 2010000021 && row.oneof === 'ItemSpawning' && row.policy === 'W1' && row.registryKnown && !row.ambiguous}
              <button type="button" on:click={() => chooseRow(row)} data-w1-preview-select="true">
                {japanese ? 'NextOccurrenceの変更前プレビュー' : 'Preview a proposed NextOccurrence'}
              </button>
            {/if}
            {#if row.items.length}
              <ul aria-label={japanese ? '関連アイテム' : 'Linked items'}>
                {#each row.items as item (item.linkIndex)}
                  <li>ItemID {item.itemId} — {japanese ? (item.ja || item.en || '名称未確認') : (item.en || 'Name unavailable')}</li>
                {/each}
              </ul>
            {/if}
          </article>
        {/each}
      </div>
      {#if selectedRow}
        <div class="w1-preview" data-w1-preview="true">
          <h3>{japanese ? 'W1 NextOccurrence — 編集前プレビュー' : 'W1 NextOccurrence — before-edit preview'}</h3>
          <p>{japanese ? 'これはUIでの意図確認です。Rust CoreによるCAS・参照整合性・Native意味論の受入ではありません。' :
          'UI-only intent preview; NOT accepted Rust Core CAS, reference closure or native semantics.'}</p>
          <p>EventID {selectedRow.eventId} · Map Key {selectedRow.mapKey} · {selectedRow.oneof}</p>
          <p>{japanese ? '旧値' : 'Old'}: <code>{selectedRow.nextOccurrence}</code></p>
          <label for="w1-new-utc">{japanese ? '提案する新日時（UTC、手入力）' : 'Proposed new UTC (manual input)'}</label>
          <input id="w1-new-utc" type="text" bind:value={proposedUtc} placeholder="YYYY-MM-DDTHH:mm:ssZ" autocomplete="off" spellcheck="false"/>
          <button type="button" on:click={buildPreview} data-w1-preview-build="true">{japanese ? '差分をプレビュー' : 'Preview exact field difference'}</button>
          {#if previewError}<p role="alert"><code>{previewError}</code></p>{/if}
          {#if preview}
            <div data-w1-diff="true">
              <p><code>{preview.exactDiff[0].pointer}</code></p>
              <p>{japanese ? '変更前' : 'Before'}: <code>{preview.exactDiff[0].oldUtc}</code></p>
              <p>{japanese ? '提案値' : 'Proposed'}: <code>{preview.exactDiff[0].newUtc}</code></p>
              <p>{japanese ? 'Source SHA' : 'Source SHA'}: <code>{preview.sourceSha256}</code></p>
              <p>{japanese ? '参照・Native意味検証が未完了のため、変更確定・Edited-copy Exportは使用できません。' :
                'Reference and native semantics remain unverified. Commit and edited-copy export are disabled.'}</p>
              <button type="button" disabled data-w1-export-off="true">{japanese ? '編集コピー出力（未受入）' : 'Edited-copy export (not accepted)'}</button>
            </div>
          {/if}
        </div>
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
 .w1-preview,.w1-backup{border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--surface)}
 .w1-preview{display:grid;gap:9px;overflow-wrap:anywhere}
 .w1-preview button,.w1-backup button,.event button{padding:9px 12px;border-radius:9px;border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);cursor:pointer}
 button:disabled{opacity:.55;cursor:not-allowed}
 .event{overflow-wrap:anywhere}
 .event h3{font-size:18px;margin:0 0 6px}
 .event p{margin:6px 0;font-size:13px}
 .event ul{margin:9px 0 0;padding-left:22px;font-size:13px;line-height:1.8}
 code{overflow-wrap:anywhere}
</style>
