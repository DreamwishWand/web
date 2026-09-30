<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { CommunityLabClient } from '$lib/community/staging-http-client';
  import { createPresetCommunityBridge } from '$lib/wep/preset-community-bridge';
  import {
    buildPublishEnvelope,
    preflightScene,
    validatePublishablePreset
  } from '$lib/wep/scene-preset-runtime';

  type Tab = 'discover' | 'library' | 'ingame';
  type DiscoveryCard = {
    workId: string;
    creatorProfileId: string;
    title: string;
    description: string;
    tags: unknown[];
    facets: Record<string, unknown>;
    publishedAt: unknown;
  };
  type LibraryRow = {
    targetEntityId: string;
    savedAt: unknown;
    accessible: boolean;
  };

  const CONFIG_KEY = 'dreamwishwand-community-lab-config-v1';

  let tab: Tab = 'discover';
  let connected = false;
  let loading = false;
  let message = '';
  let query = '';
  let discovery: DiscoveryCard[] = [];
  let library: LibraryRow[] = [];
  let bridge: ReturnType<typeof createPresetCommunityBridge> | null = null;
  let preflight: any = null;

  onMount(async () => {
    try {
      const raw = sessionStorage.getItem(CONFIG_KEY);
      if (!raw) return;
      const config = JSON.parse(raw);
      if (!config?.supabaseUrl || !config?.publishableKey) return;

      const community = new CommunityLabClient({
        supabaseUrl: String(config.supabaseUrl),
        publishableKey: String(config.publishableKey)
      });

      bridge = createPresetCommunityBridge({
        community,
        hooks: {
          buildPublishEnvelope,
          validatePublishablePreset,
          preflightScene
        }
      });
      connected = Boolean(community.session);
      await refreshDiscover();
      if (connected) await refreshLibrary();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
  });

  async function refreshDiscover(): Promise<void> {
    if (!bridge) return;
    loading = true;
    message = '';
    try {
      discovery = await bridge.discover({ query: query.trim() || null, limit: 24 });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function refreshLibrary(): Promise<void> {
    if (!bridge || !connected) return;
    loading = true;
    message = '';
    try {
      library = await bridge.listLibrary(50);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function saveWork(workId: string): Promise<void> {
    if (!bridge || !connected) return;
    loading = true;
    message = '';
    try {
      await bridge.saveDiscoveredWork(workId);
      await refreshLibrary();
      message = 'Library に保存しました。';
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function inspectWork(workId: string): Promise<void> {
    if (!bridge || !connected) return;
    loading = true;
    message = '';
    try {
      const resolved = await bridge.resolveDiscoveredWork(workId);
      preflight = await bridge.preflightPreset(resolved.presetArtifactId);
      message = 'Preset を検証しました。DDVへの書き込みは行っていません。';
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
      preflight = null;
    } finally {
      loading = false;
    }
  }

  async function inspectLibrary(presetArtifactId: string): Promise<void> {
    if (!bridge || !connected) return;
    loading = true;
    message = '';
    try {
      preflight = await bridge.preflightPreset(presetArtifactId);
      message = 'Library のPresetを検証しました。';
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
      preflight = null;
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Presets | Dreamwish Wand</title>
  <meta
    name="description"
    content="Dreamwish Wand Presets — discover, save, validate and reuse decorating creations."
  />
</svelte:head>

<section class="presets-page container">
  <div class="presets-heading">
    <div>
      <p class="eyebrow">SAVE A LITTLE MAGIC</p>
      <h1>Presets</h1>
      <p class="page-intro">
        飾り付けを作品として残し、見つけ、Libraryに保存して、もう一度あなたの世界へ。
        Wand Presetはゲーム内のDecorationPresetとは別のWand-native artifactです。
      </p>
    </div>
    <a class="create-link" href={`${base}/editor/world/`}>World Editorで作る →</a>
  </div>

  <nav class="preset-tabs" aria-label="Preset sections">
    <button class:active={tab === 'discover'} on:click={() => (tab = 'discover')}>Discover</button>
    <button class:active={tab === 'library'} on:click={() => { tab = 'library'; refreshLibrary(); }}>Library</button>
    <button class:active={tab === 'ingame'} on:click={() => (tab = 'ingame')}>In-Game Presets</button>
  </nav>

  {#if message}
    <div class="status" aria-live="polite">{message}</div>
  {/if}

  {#if tab === 'discover'}
    <section class="panel" aria-labelledby="discover-title">
      <div class="panel-heading">
        <div><p class="eyebrow">COMMUNITY</p><h2 id="discover-title">Discover</h2></div>
        <form class="search" on:submit|preventDefault={refreshDiscover}>
          <input bind:value={query} aria-label="Presetを検索" placeholder="Presetを検索" />
          <button disabled={loading} type="submit">Search</button>
        </form>
      </div>

      {#if discovery.length}
        <div class="preset-grid">
          {#each discovery as item}
            <article class="preset-card">
              <div class="preview-mark" aria-hidden="true">✦</div>
              <p class="card-kind">WAND PRESET</p>
              <h3>{item.title || 'Untitled Preset'}</h3>
              <p>{item.description || 'Creator shared decorating preset.'}</p>
              <div class="card-actions">
                <button disabled={!connected || loading} on:click={() => saveWork(item.workId)}>Save</button>
                <button disabled={!connected || loading} on:click={() => inspectWork(item.workId)}>Preflight</button>
              </div>
            </article>
          {/each}
        </div>
      {:else}
        <div class="empty">
          <span aria-hidden="true">✧</span>
          <strong>{loading ? 'Presetを探しています…' : 'まだ表示できるPresetがありません'}</strong>
          <p>公開されたWand Presetがここに並びます。</p>
        </div>
      {/if}
    </section>
  {:else if tab === 'library'}
    <section class="panel" aria-labelledby="library-title">
      <div class="panel-heading">
        <div><p class="eyebrow">SAVED FOR LATER</p><h2 id="library-title">Library</h2></div>
        <button class="quiet-button" disabled={!connected || loading} on:click={refreshLibrary}>Refresh</button>
      </div>

      {#if !connected}
        <div class="notice">
          <strong>Wand Account接続が必要です。</strong><br />
          LibraryはSavedItemとしてCommunity Coreに保存されます。Saveはアクセス権そのものにはなりません。
        </div>
      {:else if library.length}
        <div class="library-list">
          {#each library as item}
            <div class="library-row">
              <div>
                <span class:unavailable={!item.accessible}>{item.accessible ? 'Available' : 'Unavailable'}</span>
                <code>{item.targetEntityId}</code>
              </div>
              <button disabled={!item.accessible || loading} on:click={() => inspectLibrary(item.targetEntityId)}>
                Preflight
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty"><span aria-hidden="true">♡</span><strong>Libraryは空です</strong><p>Discoverで気になるPresetをSaveできます。</p></div>
      {/if}
    </section>
  {:else}
    <section class="panel" aria-labelledby="ingame-title">
      <p class="eyebrow">DDV NATIVE REFERENCE</p>
      <h2 id="ingame-title">In-Game Presets</h2>
      <p class="page-intro">
        DDV本体のDecorationPresetは、Wand Presetとは別の仕組みです。
        Wand Presetはゲーム内Preset枠をcanonical storageとして使用しません。
      </p>
      <div class="notice">
        <strong>現在はread-only / research boundaryです。</strong><br />
        native presetは互換性検証やゲーム挙動のreference oracleとして扱い、
        CommunityのWand Presetと混同しません。
      </div>
    </section>
  {/if}

  {#if preflight}
    <aside class="preflight-card" aria-live="polite">
      <div>
        <p class="eyebrow">PREFLIGHT</p>
        <h2>{preflight.validation?.presetType === 'scene' ? 'Scene Preset' : 'Preset'}</h2>
      </div>
      <dl>
        <div><dt>Artifact</dt><dd>{preflight.detail?.presetArtifactId ?? '—'}</dd></div>
        <div><dt>Objects</dt><dd>{preflight.preflight?.summary?.objectCount ?? 0}</dd></div>
        <div><dt>Status</dt><dd>{preflight.preflight?.ok ? 'Validated' : 'Blocked'}</dd></div>
        <div><dt>Write</dt><dd>{preflight.preflight?.writeReady ? 'Ready' : 'Disabled'}</dd></div>
      </dl>
      <p>
        signed readのbyte size / SHA-256 / WEP artifact validationを通過後にpreflightしています。
        この画面からDDVセーブへの書き込みは行いません。
      </p>
    </aside>
  {/if}

  {#if !connected}
    <p class="preview-note">
      Community session未接続時もDiscover shellは表示できます。Save・Library・signed artifact readは認証済みWand Accountでのみ有効になります。
    </p>
  {/if}
</section>

<style>
  .presets-page{padding-block:64px 100px;min-height:72vh}.presets-heading{display:flex;justify-content:space-between;align-items:end;gap:28px}.presets-heading h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,66px);font-weight:500;letter-spacing:-.055em;margin:14px 0}.create-link{flex:none;border:1px solid var(--border);background:var(--surface);padding:12px 16px;border-radius:999px;color:var(--gold);font-size:12px;font-weight:800}.preset-tabs{display:flex;gap:8px;margin:34px 0 20px;padding:6px;border:1px solid var(--border);border-radius:16px;background:var(--surface);width:max-content;max-width:100%}.preset-tabs button,.quiet-button,.search button,.card-actions button,.library-row button{border:1px solid transparent;background:transparent;color:var(--ink-soft);border-radius:11px;padding:10px 14px;font-weight:800}.preset-tabs button.active{background:var(--surface-raised);color:var(--gold);border-color:var(--border)}button:disabled{opacity:.45;cursor:not-allowed}.panel{border:1px solid var(--border);background:var(--surface);border-radius:24px;padding:26px;box-shadow:var(--shadow)}.panel-heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:22px}.panel h2,.preflight-card h2{font-family:Georgia,serif;font-size:30px;font-weight:500;margin:8px 0 0}.search{display:flex;gap:8px}.search input{min-width:240px;background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:11px;padding:10px 13px}.search button,.quiet-button,.card-actions button,.library-row button{background:var(--surface-raised);border-color:var(--border)}.preset-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.preset-card{min-height:230px;padding:20px;border:1px solid var(--border);border-radius:18px;background:var(--page-2);display:flex;flex-direction:column}.preview-mark{font-size:32px;color:var(--gold)}.card-kind{font-size:9px;letter-spacing:.2em;color:var(--gold);font-weight:900;margin:18px 0 4px}.preset-card h3{font-family:Georgia,serif;font-size:21px;font-weight:500;margin:4px 0}.preset-card>p:not(.card-kind){font-size:12px;line-height:1.7;color:var(--ink-soft);flex:1}.card-actions{display:flex;gap:8px;margin-top:12px}.status{margin:0 0 16px;padding:12px 15px;border:1px solid var(--border);border-radius:12px;color:var(--ink-soft);background:var(--surface)}.empty{min-height:250px;display:grid;place-items:center;align-content:center;text-align:center;color:var(--ink-muted)}.empty span{font-size:42px;color:var(--gold)}.empty strong{color:var(--ink);margin-top:8px}.empty p{font-size:12px}.library-list{display:grid;gap:10px}.library-row{display:flex;justify-content:space-between;align-items:center;gap:18px;border:1px solid var(--border);border-radius:14px;padding:14px 16px;background:var(--page-2)}.library-row code{display:block;margin-top:6px;color:var(--ink-soft);font-size:11px}.library-row span{font-size:10px;font-weight:900;color:var(--help-accent)}.library-row span.unavailable{color:var(--decor-accent)}.preflight-card{margin-top:18px;border:1px solid var(--border);border-radius:20px;background:var(--surface);padding:22px}.preflight-card dl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.preflight-card dl>div{padding:12px;border-radius:12px;background:var(--surface-raised)}.preflight-card dt{font-size:9px;letter-spacing:.12em;color:var(--ink-muted);text-transform:uppercase}.preflight-card dd{margin:6px 0 0;font-size:12px;overflow-wrap:anywhere}.preflight-card>p{color:var(--ink-soft);font-size:12px;line-height:1.8}.preview-note{color:var(--ink-muted);font-size:11px;line-height:1.8;margin-top:16px}@media(max-width:850px){.preset-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.presets-heading,.panel-heading{align-items:flex-start;flex-direction:column}.search{width:100%}.search input{min-width:0;flex:1}.preflight-card dl{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:570px){.presets-page{padding-block:45px 70px}.preset-tabs{width:100%;overflow:auto}.preset-tabs button{white-space:nowrap}.panel{padding:18px}.preset-grid{grid-template-columns:1fr}.preflight-card dl{grid-template-columns:1fr}.library-row{align-items:flex-start;flex-direction:column}}
</style>
