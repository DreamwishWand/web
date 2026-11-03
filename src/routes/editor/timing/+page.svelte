<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { WAND_TIMING_SWITCH_BID, WAND_TIMING_REGISTRY_PATH } from '$lib/timing/recurring-readonly.mjs';
  import { createTimingLocalReadWorker } from '$lib/timing/local-timing-worker-client';

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
  let openToken = 0;
  let searchToken = 0;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let reader: Worker | null = null;
  let workerReady = false;
  let messageId = 0;
  let pending = new Map<number, { resolve: (value: any) => void; reject: (reason: Error) => void }>();
  $: japanese = $locale === 'ja';

  onMount(() => {
    reader = createTimingLocalReadWorker();
    const current = reader;
    current.addEventListener('message', (event: MessageEvent) => {
      const payload = event.data;
      if (!payload || !Number.isSafeInteger(payload.id)) return;
      if (payload.id === 0 && payload.ready === true && payload.writerAuthorized === false) {
        workerReady = true;
        return;
      }
      const callback = pending.get(payload.id);
      if (!callback) return;
      pending.delete(payload.id);
      if (payload.ok === true) callback.resolve(payload.result);
      else callback.reject(Error(typeof payload.error === 'string' ? payload.error : 'READ_WORKER_REJECTED'));
    });
    current.addEventListener('error', () => {
      workerReady = false;
      error = 'READ_WORKER_UNAVAILABLE';
      for (const callback of pending.values()) callback.reject(Error('READ_WORKER_UNAVAILABLE'));
      pending.clear();
    });
    return () => {
      if (searchTimer) clearTimeout(searchTimer);
      openToken += 1;
      searchToken += 1;
      for (const callback of pending.values()) callback.reject(Error('READ_WORKER_CLOSED'));
      pending.clear();
      current.terminate();
      reader = null;
      workerReady = false;
    };
  });

  function request(type: string, params: Record<string, unknown> = {}): Promise<any> {
    if (!reader || !workerReady) return Promise.reject(Error('READ_WORKER_UNAVAILABLE'));
    const id = ++messageId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      reader?.postMessage({ id, type, ...params });
    });
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
    // Explicitly release A before opening B, including invalid B.
    try { await request('CLOSE'); } catch { /* no previous live session */ }
    if (!file) return;
    if (!userSourceConfirmed || sourceBuild.trim().toUpperCase() !== WAND_TIMING_SWITCH_BID) {
      error = 'SOURCE_BUILD_ATTESTATION_REQUIRED';
      return;
    }
    busy = true;
    try {
      const registryResponse = await fetch(base + WAND_TIMING_REGISTRY_PATH, { cache: 'force-cache' });
      if (!registryResponse.ok) throw Error('REGISTRY_UNAVAILABLE');
      const registry = await registryResponse.json();
      if (token !== openToken) return;
      // A File is cloned to the Worker without reading its bytes in the UI.
      const result = await request('OPEN_FILE', {
        file, buildId: sourceBuild.trim().toUpperCase(),
        sourceConfirmed: true, registry
      });
      if (token !== openToken) return;
      if (result?.sourceSchema !== 626 ||
          result?.writerAuthorized !== false ||
          result?.productRustWorkerAccepted !== false)
        throw Error('READ_WORKER_CAPABILITY_INVALID');
      summary = result;
      fileName = file.name;
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
</script>

<svelte:head>
  <title>{japanese ? '日時・スポーン検索' : 'Timing & Spawn Inspector'} | Dreamwish Wand</title>
  <meta name="description" content="Local-only DDV Switch v1.25.3 recurring event and ItemID search. No save editing, upload or writer." />
</svelte:head>

<section class="container timing-page" data-timing-readonly="true" data-worker-readonly="true" data-worker-ready={workerReady} data-writer="off">
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
    <input id="timing-file" type="file" accept=".save,.p1g,application/octet-stream" disabled={!workerReady || busy} on:change={importLocal}/>
    {#if busy}<p role="status">{japanese ? 'ローカルで読込み中…' : 'Reading locally…'}</p>{/if}
    {#if error}<p role="alert" class="error">{japanese ? '読込みできませんでした。BID・形式・バージョンを確認してください。' : 'Could not read the save. Check the build, file format and version.'} <code>{error}</code></p>{/if}
  </div>

  {#if summary}
    <div class="results" data-timing-loaded="true">
      <h2>{fileName}</h2>
      <p>{japanese ? '保存済みイベント' : 'Saved event containers'}: {summary.savedContainerCount} · {japanese ? '検索結果' : 'Matches'}: {matched} · {japanese ? '未対応の構造' : 'Unsupported containers'}: {summary.unsupportedContainerCount}</p>
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
 .event h3{font-size:18px;margin:0 0 6px}
 .event p{margin:6px 0;font-size:13px}
 .event ul{margin:9px 0 0;padding-left:22px;font-size:13px;line-height:1.8}
 code{overflow-wrap:anywhere}
</style>
