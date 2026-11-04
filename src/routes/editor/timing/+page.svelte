<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { WAND_TIMING_SWITCH_BID } from '$lib/timing/recurring-readonly.mjs';
  import { getLocalSaveSessionBridge } from '$lib/timing/local-timing-worker-client';
  import { previewNextOccurrenceUiOnly } from '$lib/timing/w1-nextoccurrence-preview.mjs';

  let sourceBuild = '';
  let userSourceConfirmed = false;
  let fileName = '';
  let busy = false;
  let searchBusy = false;
  let error = '';
  let summary: any = null;
  let rows: any[] = [];
  let query = '';
  let matched = 0;
  let nextCursor: string | null = null;
  let backupAvailable = false;
  let backupRequested = false;
  let selectedRow: any = null;
  let proposedUtc = '';
  let preview: any = null;
  let previewError = '';
  let openToken = 0;
  let searchToken = 0;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let workerReady = false;
  $: japanese = $locale === 'ja';

  onMount(() => {
    const bridge = getLocalSaveSessionBridge();
    let mounted = true;
    const unsubscribe = bridge.subscribe(({ ready, receipt }) => {
      if (!mounted) return;
      workerReady = ready;
      if (!receipt) {
        summary = null; fileName = ''; rows = []; matched = 0; nextCursor = null;
        backupAvailable = false; backupRequested = false; selectedRow = null;
        proposedUtc = ''; preview = null; previewError = '';
        ++searchToken;
      }
    });
    void bridge.ensureReady().then(() => {
      if (!mounted) return;
      const saved = bridge.getSession();
      if (!saved) return;
      summary = saved; fileName = saved.sourceFileName;
      backupAvailable = bridge.hasUntouchedOriginalBackupSource(saved);
      // Recovered READ is still scoped to the already externally attested A.
      // Reopening B requires a fresh explicit external BID confirmation.
      void searchSavedEvents(true);
    }).catch(() => { if(mounted) error = 'READ_WORKER_UNAVAILABLE'; });
    return () => {
      mounted = false;
      if (searchTimer) clearTimeout(searchTimer);
      ++openToken; ++searchToken;
      unsubscribe(); // Keeps one Core-owned Worker alive across SPA routes.
    };
  });

  function request(type: string, params: Record<string, unknown> = {}): Promise<any> {
    const bridge = getLocalSaveSessionBridge();
    if (type === 'CLOSE') return bridge.close();
    if (type === 'QUERY') return bridge.queryW1Page({
      search: String(params.search ?? ''),
      cursor: params.cursor == null ? null : String(params.cursor),
      limit: Number(params.limit ?? 64)
    });
    if (type === 'OPEN_FILE') {
      if (params.sourceConfirmed !== true)
        return Promise.reject(Error('LOCAL_BUILD_VERSION_BID_SCHEMA_DENIED'));
      return bridge.openLocalFile(params.file as File, {
        platform: 'switch', fullVersion: '1.25.3', buildKind: 'switch-bid',
        buildId: WAND_TIMING_SWITCH_BID, schema: 626, externallyConfirmed: true
      } as const);
    }
    return Promise.reject(Error('LOCAL_OPERATION_WRITER_NOT_ACCEPTED'));
  }

  async function searchSavedEvents(reset: boolean) {
    if (!summary) return;
    const token = ++searchToken;
    searchBusy = true;
    const cursor = reset ? null : nextCursor;
    if (reset) { rows = []; matched = 0; nextCursor = null; }
    try {
      const page = await request('QUERY', { search: query, cursor, limit: 64 });
      if (token !== searchToken) return;
      rows = reset ? page.rows : [...rows, ...page.rows];
      matched = page.total;
      nextCursor = page.nextCursor;
    } catch (exception) {
      if (token !== searchToken) return;
      error = exception instanceof Error ? exception.message : 'READ_SEARCH_REJECTED';
    } finally {
      if (token === searchToken) searchBusy = false;
    }
  }
  function onSearchInput() {
    selectedRow = null;
    preview = null;
    previewError = '';
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { void searchSavedEvents(true); }, 160);
  }
  async function importLocal(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    const token = ++openToken;
    ++searchToken;
    if (searchTimer) clearTimeout(searchTimer);
    fileName = '';
    error = '';
    rows = [];
    summary = null;
    query = '';
    matched = 0;
    nextCursor = null;
    backupAvailable = false;
    backupRequested = false;
    selectedRow = null;
    proposedUtc = '';
    preview = null;
    previewError = '';
    // Explicitly release A before opening B, including invalid B.
    try { await request('CLOSE'); } catch { /* no previous live session */ }
    if (!file) return;
    if (!userSourceConfirmed || sourceBuild.trim().toUpperCase() !== WAND_TIMING_SWITCH_BID) {
      error = 'SOURCE_BUILD_ATTESTATION_REQUIRED';
      return;
    }
    busy = true;
    try {
      // The Worker loads its pinned same-origin registry itself. No UI-origin
      // event definitions, source SHA, Session ID or capability are trusted.
      if (token !== openToken) return;
      // A File is cloned to the Worker without reading its bytes in the UI.
      const result = await request('OPEN_FILE', {
        file, buildId: sourceBuild.trim().toUpperCase(),
        sourceConfirmed: true
      });
      if (token !== openToken) return;
      if (result?.schema !== 626 || result?.fullVersion !== '1.25.3' ||
          result?.buildId !== WAND_TIMING_SWITCH_BID ||
          result?.writerAuthorized !== false ||
          result?.productRustWorkerAccepted !== false)
        throw Error('READ_WORKER_CAPABILITY_INVALID');
      if(!/^[a-f0-9]{64}$/.test(result.sourceSha256) ||
         !/^[a-f0-9]{64}$/.test(result.registrySha256)) throw Error('READ_WORKER_SHA_IDENTITY_INVALID');
      summary = result;
      fileName = file.name;
      backupAvailable = getLocalSaveSessionBridge().hasUntouchedOriginalBackupSource(result);
      await searchSavedEvents(true);
    } catch (exception) {
      if (token !== openToken) return;
      error = exception instanceof Error ? exception.message : 'SAVE_READ_OR_REGISTRY_REJECTED';
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
      preview = previewNextOccurrenceUiOnly(selectedRow,proposedUtc,{
        sourceSha256:summary?.sourceSha256,registrySha256:summary?.registrySha256,
        externalBid:summary?.buildId,
        sourceSchema:summary?.schema,sourceRevision:summary?.revision
      });
    } catch (err) {
      previewError = err instanceof Error ? err.message : 'W1_PREVIEW_REJECTED';
    }
  }
  function downloadOriginalBackup() {
    if (!summary || !backupAvailable) return;
    try {
      const outcome = getLocalSaveSessionBridge().requestUntouchedOriginalBackup({
        sessionId:summary.sessionId,sourceSha256:summary.sourceSha256
      });
      // Browser download dispatch is only a request; do not claim persistence.
      backupRequested = outcome.downloadRequested && outcome.persistedVerified === false;
    } catch (exception) {
      error = exception instanceof Error ? exception.message : 'LOCAL_ORIGINAL_BACKUP_REJECTED';
    }

  }
</script>

<svelte:head>
  <title>{japanese ? '日時・スポーン検索' : 'Timing & Spawn Inspector'} | Dreamwish Wand</title>
  <meta name="description" content="Local-only DDV Switch v1.25.3 recurring event and ItemID search. No save editing, upload or writer." />
</svelte:head>

<section class="container timing-page" data-timing-readonly="true" data-worker-readonly="true" data-worker-ready={workerReady} data-w1-ui-ready={workerReady} data-writer="off">
  <a href={base + '/editor/'}>{japanese ? '← Editorに戻る' : '← Back to Editor'}</a>
  <h1>{japanese ? '日時・スポーンの検索' : 'Timing & Spawn Inspector'}</h1>
  <p>{japanese ? 'Dreamlight Timekeeperのイベント定義をWandで再利用した、ローカル読取り専用画面です。' : 'Local read-only preview using the frozen Dreamlight Timekeeper event registry.'}</p>
  <p class="warning" role="status">{japanese
    ? 'セーブの書込み、日時の変更、編集コピーの出力は無効です。ファイルはWandのサーバーへ送信されません。'
    : 'Editing, time changes and edited-copy export are disabled. The selected save is not uploaded to Wand servers.'}</p>

  <div class="import-panel">
    <p data-single-savesession="true">{japanese
      ? '読取り中のSaveSessionはタブ内で共有されます。ページ移動で原本はアップロードされません。'
      : 'One local SaveSession is shared across routes in this tab; no original upload.'}</p>
    <p>{japanese ? '対象: Nintendo Switch DDV v1.25.3 / schema626' : 'Target: Nintendo Switch DDV v1.25.3 / schema626'}</p>
    <label for="timing-bid">{japanese ? '外部で確認したBuild ID' : 'Externally verified Build ID'}</label>
    <input id="timing-bid" type="text" bind:value={sourceBuild} placeholder={WAND_TIMING_SWITCH_BID} spellcheck="false" autocomplete="off"/>
    <label class="attest"><input type="checkbox" bind:checked={userSourceConfirmed}/><span>{japanese
      ? 'Switchの対象バージョン・BIDをゲーム側で確認した（セーブ自体にBIDは含まれません）'
      : 'I verified the target Switch game build externally (the save does not contain its BID).'}</span></label>
    <label for="timing-file">{japanese ? 'ローカルセーブを選択' : 'Choose a local save'}</label>
    <input id="timing-file" type="file" accept=".save,.p1g,application/octet-stream" disabled={!workerReady || busy} on:change={importLocal}/>
    {#if busy}<p role="status">{japanese ? 'ローカルで読込み中…' : 'Reading locally…'}</p>{/if}
    {#if error}<p role="alert" class="error">{japanese ? '読込みできませんでした。BID・形式・バージョンを確認してください。' : 'Could not read the save. Check the build, file format and version.'} <code>{error}</code></p>{/if}
  </div>

  {#if summary}
    <div class="results" data-timing-loaded="true">
      <h2>{fileName}</h2>
      <p>{japanese ? '保存済みイベント' : 'Saved event containers'}: {summary.savedContainerCount} · {japanese ? '検索結果' : 'Matches'}: {matched} · {japanese ? '未対応の構造' : 'Unsupported containers'}: {summary.unsupportedContainerCount}</p>
      <p data-w1-source-sha="true">{japanese ? '暗号化原本 SHA-256' : 'Encrypted original SHA-256'}: <code>{summary.sourceSha256}</code></p>
      <div class="w1-backup">
        <button type="button" data-w1-original-backup="true" disabled={!backupAvailable} on:click={downloadOriginalBackup}>
          {japanese ? '原本をそのままバックアップ' : 'Download untouched original backup'}
        </button>
        <p role="status">{backupRequested
         ? (japanese ? 'バックアップのダウンロードを要求しました。実際の保存を確認してください。' : 'Backup download requested. Verify the file was saved.')
         : (japanese ? '編集コピーの前に原本バックアップが必要です。現在、編集コピーの出力は無効です。' : 'An original backup is required before edited-copy export; edited-copy output is currently disabled.')}
        </p>
      </div>
      <label for="timing-search">{japanese ? 'EventID・ItemID・名前・日時で検索' : 'Search EventID, ItemID, name or timestamp'}</label>
      <input id="timing-search" type="search" bind:value={query} on:input={onSearchInput}/>
      <p role="status">{matched} {japanese ? '件（表示済み' : 'matches (loaded'} {rows.length}{japanese ? '件）' : ')'} · {japanese ? 'Worker内で検索・ページ処理' : 'Search and paging inside local Worker'}</p>
      <div class="result-list">
        {#each rows as row (row.mapKey + ':' + row.oneof)}
          <article class="event" data-event-id={row.eventId ?? 'unknown'}>
            <h3>{row.name}</h3>
            <p>EventID: {row.eventId ?? 'unknown'} · {japanese ? '保存キー' : 'Save key'}: {row.mapKey} · {row.oneof}</p>
            <p>{japanese ? '次回' : 'Next'}: <code>{row.nextOccurrence ?? 'unknown'}</code></p>
            <p>{japanese ? '前回' : 'Last'}: <code>{row.lastOccurrence ?? 'unknown'}</code> · {japanese ? '静的分類' : 'Static policy'}: {row.policy}</p>
            {#if row.ambiguous || !row.registryKnown}<p class="warning">{japanese ? '定義またはoneof構造は未確認。書込み不可。' : 'Unverified registry or oneof shape. Write disabled.'}</p>{/if}
            {#if row.mapKey === '155' && row.eventId === 2010000021 && row.oneof === 'ItemSpawning' && row.policy === 'W1' && row.registryKnown && !row.ambiguous}
              <button type="button" data-w1-preview-select="true" on:click={() => chooseRow(row)}>
                {japanese ? 'NextOccurrenceの差分Preview' : 'Preview proposed NextOccurrence'}
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
      {#if nextCursor}
        <button type="button" disabled={searchBusy} on:click={() => void searchSavedEvents(false)} data-timing-more="true">
          {japanese ? 'さらに64件表示' : 'Load next 64'}
        </button>
      {/if}
      {#if searchBusy}<p role="status">{japanese ? 'Workerで検索中…' : 'Searching in Worker…'}</p>{/if}
      {#if selectedRow}
        <div class="w1-preview" data-w1-preview="true">
          <h3>{japanese ? 'W1 NextOccurrence — 編集前差分' : 'W1 NextOccurrence — before-edit difference'}</h3>
          <p>{japanese ? 'UI意図のプレビューです。Rust Core旧値CAS・参照依存・Native意味論は未受入です。' :
            'UI intent only: Rust Core old-value CAS, reference dependencies and Native semantics are not yet accepted.'}</p>
          <p>EventID {selectedRow.eventId} · Map Key {selectedRow.mapKey} · {selectedRow.oneof}</p>
          <p>{japanese ? '現在値' : 'Current'}: <code>{selectedRow.nextOccurrence}</code></p>
          <label for="w1-new-utc">{japanese ? '新しいUTC日時（手入力）' : 'Proposed new UTC (manual input)'}</label>
          <input id="w1-new-utc" type="text" bind:value={proposedUtc} placeholder="YYYY-MM-DDTHH:mm:ssZ" autocomplete="off" spellcheck="false"/>
          <button type="button" data-w1-preview-build="true" on:click={buildPreview}>{japanese ? '1フィールド差分を確認' : 'Preview one-field difference'}</button>
          {#if previewError}<p role="alert"><code>{previewError}</code></p>{/if}
          {#if preview}
            <div data-w1-diff="true">
              <p><code>{preview.exactDiff[0].pointer}</code></p>
              <p>{japanese ? '変更前' : 'Before'}: <code>{preview.exactDiff[0].oldUtc}</code></p>
              <p>{japanese ? '提案値' : 'Proposed'}: <code>{preview.exactDiff[0].newUtc}</code></p>
              <p>Source SHA: <code>{preview.sourceSha256}</code></p>
              <p>{japanese ? 'Native依存・Rust Coreの製品Writer受入前のため、確定・Edited-copy Exportは使用できません。' :
                'Native dependencies and Rust Core Writer remain unaccepted; commit and edited-copy export are unavailable.'}</p>
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
 .event{overflow-wrap:anywhere}\n button[data-timing-more]{padding:12px 18px;border:1px solid var(--border);border-radius:10px;background:var(--surface-raised);color:var(--ink);cursor:pointer}\n button:disabled{opacity:.5;cursor:not-allowed}
 .w1-preview,.w1-backup{border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--surface)}
 .w1-preview{display:grid;gap:9px;overflow-wrap:anywhere}
 .w1-preview button,.w1-backup button,.event button{padding:9px 12px;border-radius:9px;border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);cursor:pointer}
 button:disabled{opacity:.5;cursor:not-allowed}
 .event h3{font-size:18px;margin:0 0 6px}
 .event p{margin:6px 0;font-size:13px}
 .event ul{margin:9px 0 0;padding-left:22px;font-size:13px;line-height:1.8}
 code{overflow-wrap:anywhere}
</style>
