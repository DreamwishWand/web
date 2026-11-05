<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { presetPageCopy } from '$lib/presets/page-copy.js';
  import { presetsStage1Copy, PRESETS_STAGE1_ROOT, PRESETS_STAGE1_IN_GAME } from '$lib/presets/stage1-root.mjs';
  import { CommunityLabClient } from '$lib/community/staging-http-client';
  import { readCommunityBrowserConfig } from '$lib/community/runtime-config';
  import { createPresetCommunityBridge } from '$lib/wep/preset-community-bridge';
  import { explainWepBlocker } from '$lib/wep/blocker-messages';
  import NativePresetManager from '$lib/presets/NativePresetManager.svelte';
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


  let tab: Tab = 'discover';
  type Surface = 'root'|'wand'|'touchOfMagic'|'inGame'|'my';
  let surface:Surface='root';
  let inGameChild: 'decorations'|'shop'|null=null;
  let connected = false;
  let loading = false;
  let message = '';
  let query = '';
  let discovery: DiscoveryCard[] = [];
  let library: LibraryRow[] = [];
  let bridge: ReturnType<typeof createPresetCommunityBridge> | null = null;
  let preflight: any = null;
  $: copy = presetPageCopy($locale);
  $: rootCopy=presetsStage1Copy($locale);

  function preflightBlockCodes(value: any): string[] {
    return Array.from(
      new Set(
        (value?.preflight?.issues ?? [])
          .filter((issue: any) => issue?.severity === 'BLOCK')
          .map((issue: any) => String(issue?.code ?? ''))
          .filter(Boolean)
      )
    );
  }

  function preflightBoundaryReason(value: any): string {
    const blockers = preflightBlockCodes(value);
    const code = blockers[0] ??
      String(
        value?.preflight?.reason ??
          (value?.preflight?.writeReady
            ? 'WRITER_CONTRACT_READY'
            : 'CORE_COMMIT_ADAPTER_NOT_BOUND')
      );
    return explainWepBlocker(code).message;
  }

  async function ensureCommunity():Promise<void>{
    if(bridge)return;
    try{
      const config=readCommunityBrowserConfig();
      if(!config){message=copy.communityUnavailable;return;}
      const community=new CommunityLabClient({
        supabaseUrl:config.supabaseUrl,publishableKey:config.publishableKey
      });
      bridge=createPresetCommunityBridge({
        community,hooks:{buildPublishEnvelope,validatePublishablePreset,preflightScene}
      });
      connected=Boolean(community.session);
    }catch(error){message=error instanceof Error?error.message:String(error);}
  }
  async function openSurface(next:Surface):Promise<void>{
    surface=next;inGameChild=null;preflight=null;message='';
    if(next==='wand'){
      tab='discover';
      await ensureCommunity();
      await refreshDiscover();
    }else if(next==='my'){
      tab='library';
      await ensureCommunity();
      await refreshLibrary();
    }
  }
  function chooseInGame(next:'decorations'|'shop'):void{
    inGameChild=next;tab='ingame';preflight=null;message='';
  }
  function backToRoot():void{
    surface='root';inGameChild=null;preflight=null;message='';
  }

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
      message = copy.saved;
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
      message = copy.validated;
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
      message = copy.libraryValidated;
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

<section class="presets-page container" data-stage1-presets-root
  data-native-writer="off" data-provider-gate="off" data-tom-writer="off">
  {#if surface==='root'}
    <h1 class="root-title">{copy.title}</h1>
    <nav class="preset-stage1-root-grid" data-stage1-presets-four-cards aria-label={copy.title}>
      {#each PRESETS_STAGE1_ROOT as id}
        <button type="button" class="preset-root-card" data-preset-child={id} on:click={()=>openSurface(id as Surface)}>
          <span class="preset-root-art" aria-hidden="true">◇</span>
          <strong>{id==='wand'?rootCopy.wand:id==='touchOfMagic'?rootCopy.tom:id==='inGame'?rootCopy.inGame:rootCopy.my}</strong>
        </button>
      {/each}
    </nav>
  {:else}
    <button type="button" class="preset-back" on:click={backToRoot}>{rootCopy.back}</button>
    <div class="presets-heading">
      <div>
        <h1>{surface==='wand'?rootCopy.wand:surface==='my'?rootCopy.my:surface==='touchOfMagic'?rootCopy.tom:rootCopy.inGame}</h1>
      </div>
      {#if surface==='wand'}<a class="create-link" href={`${base}/editor/world/`}>{copy.create}</a>{/if}
    </div>

    {#if surface==='inGame' && !inGameChild}
      <div class="preset-ingame-grid" data-stage1-presets-ingame>
        {#each PRESETS_STAGE1_IN_GAME as id}
          <button class="preset-root-card" data-preset-ingame-child={id}
            on:click={()=>chooseInGame(id as 'decorations'|'shop')} type="button">
            <span class="preset-root-art" aria-hidden="true">◇</span>
            <strong>{id==='decorations'?rootCopy.decorations:rootCopy.shop}</strong>
          </button>
        {/each}
      </div>
    {:else if surface==='touchOfMagic' || (surface==='inGame' && inGameChild==='shop')}
      <div class="status" data-preset-unavailable role="status">{rootCopy.unavailable}</div>
    {:else}
  {#if message}
    <div class="status" aria-live="polite">{message}</div>
  {/if}

  {#if tab === 'discover'}
    <section class="panel" aria-labelledby="discover-title">
      <div class="panel-heading">
        <div><p class="eyebrow">{copy.community}</p><h2 id="discover-title">{copy.discover}</h2></div>
        <form class="search" on:submit|preventDefault={refreshDiscover}>
          <input bind:value={query} aria-label={copy.search} placeholder={copy.search} />
          <button disabled={loading} type="submit">{copy.searchButton}</button>
        </form>
      </div>

      {#if discovery.length}
        <div class="preset-grid">
          {#each discovery as item}
            <article class="preset-card">
              <div class="preview-mark" aria-hidden="true">✦</div>
              <p class="card-kind">WAND PRESET</p>
              <h3>{item.title || copy.untitled}</h3>
              <p>{item.description || copy.shared}</p>
              <div class="card-actions">
                <button disabled={!connected || loading} on:click={() => saveWork(item.workId)}>{copy.save}</button>
                <button disabled={!connected || loading} on:click={() => inspectWork(item.workId)}>{copy.preflight}</button>
              </div>
            </article>
          {/each}
        </div>
      {:else}
        <div class="empty">
          <span aria-hidden="true">✧</span>
          <strong>{loading ? copy.searching : copy.none}</strong>
          <p>{copy.noneDetail}</p>
        </div>
      {/if}
    </section>
  {:else if tab === 'library'}
    <section class="panel" aria-labelledby="library-title">
      <div class="panel-heading">
        <div><p class="eyebrow">{copy.savedForLater}</p><h2 id="library-title">{copy.library}</h2></div>
        <button class="quiet-button" disabled={!connected || loading} on:click={refreshLibrary}>{copy.refresh}</button>
      </div>

      {#if !connected}
        <div class="notice">
          <strong>{copy.accountRequired}</strong><br />
          {copy.libraryDetail}
        </div>
      {:else if library.length}
        <div class="library-list">
          {#each library as item}
            <div class="library-row">
              <div>
                <span class:unavailable={!item.accessible}>{item.accessible ? copy.available : copy.unavailable}</span>
                <code>{item.targetEntityId}</code>
              </div>
              <button disabled={!item.accessible || loading} on:click={() => inspectLibrary(item.targetEntityId)}>
                {copy.preflight}
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty"><span aria-hidden="true">♡</span><strong>{copy.emptyLibrary}</strong><p>{copy.emptyLibraryDetail}</p></div>
      {/if}
    </section>
  {:else}
    <section class="panel" aria-label="In-Game Presets">
      <NativePresetManager />
    </section>
  {/if}

  {#if preflight}
    <aside class="preflight-card" aria-live="polite">
      <div>
        <p class="eyebrow">{copy.preflightEyebrow}</p>
        <h2>{preflight.validation?.presetType === 'scene' ? copy.scenePreset : copy.preset}</h2>
      </div>
      <dl>
        <div><dt>{copy.artifact}</dt><dd>{preflight.detail?.presetArtifactId ?? '—'}</dd></div>
        <div><dt>{copy.signedBytes}</dt><dd>{preflight.checksumSha256 ? copy.verified : copy.unverified}</dd></div>
        <div><dt>{copy.wepArtifact}</dt><dd>{preflight.validation?.ok ? copy.valid : copy.blocked}</dd></div>
        <div><dt>{copy.reuse}</dt><dd>{preflight.preflight?.ok ? copy.pass : copy.blocked}</dd></div>
        <div><dt>{copy.objects}</dt><dd>{preflight.preflight?.summary?.objectCount ?? 0}</dd></div>
        <div><dt>{copy.ddvWrite}</dt><dd>{preflight.preflight?.writeReady ? copy.contractReady : copy.disabled}</dd></div>
      </dl>
      <div class="preflight-boundary">
        <span>{copy.currentBoundary}</span>
        <code>{preflightBoundaryReason(preflight)}</code>
      </div>
      {#if preflightBlockCodes(preflight).length}
        <div class="preflight-blockers">
          <strong>{copy.reuseBlockers}</strong>
          {#each preflightBlockCodes(preflight) as code}
            <span>
              <code>{code}</code>
              {explainWepBlocker(code).message}
            </span>
          {/each}
        </div>
      {/if}
      <p>
        {copy.preflightNote}
      </p>
    </aside>
  {/if}

  {#if !connected}
    <p class="preview-note">
      {copy.previewNote}
    </p>
  {/if}
    {/if}
  {/if}
</section>

<style>
  .presets-page{padding-block:64px 100px;min-height:72vh}.presets-heading{display:flex;justify-content:space-between;align-items:end;gap:28px}.presets-heading h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,66px);font-weight:500;letter-spacing:-.055em;margin:14px 0}.create-link{flex:none;border:1px solid var(--border);background:var(--surface);padding:12px 16px;border-radius:999px;color:var(--gold);font-size:12px;font-weight:800}.preset-tabs{display:flex;gap:8px;margin:34px 0 20px;padding:6px;border:1px solid var(--border);border-radius:16px;background:var(--surface);width:max-content;max-width:100%}.preset-tabs button,.quiet-button,.search button,.card-actions button,.library-row button{border:1px solid transparent;background:transparent;color:var(--ink-soft);border-radius:11px;padding:10px 14px;font-weight:800}.preset-tabs button.active{background:var(--surface-raised);color:var(--gold);border-color:var(--border)}button:disabled{opacity:.45;cursor:not-allowed}.panel{border:1px solid var(--border);background:var(--surface);border-radius:24px;padding:26px;box-shadow:var(--shadow)}.panel-heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:22px}.panel h2,.preflight-card h2{font-family:Georgia,serif;font-size:30px;font-weight:500;margin:8px 0 0}.search{display:flex;gap:8px}.search input{min-width:240px;background:var(--surface-raised);color:var(--ink);border:1px solid var(--border);border-radius:11px;padding:10px 13px}.search button,.quiet-button,.card-actions button,.library-row button{background:var(--surface-raised);border-color:var(--border)}.preset-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.preset-card{min-height:230px;padding:20px;border:1px solid var(--border);border-radius:18px;background:var(--page-2);display:flex;flex-direction:column}.preview-mark{font-size:32px;color:var(--gold)}.card-kind{font-size:9px;letter-spacing:.2em;color:var(--gold);font-weight:900;margin:18px 0 4px}.preset-card h3{font-family:Georgia,serif;font-size:21px;font-weight:500;margin:4px 0}.preset-card>p:not(.card-kind){font-size:12px;line-height:1.7;color:var(--ink-soft);flex:1}.card-actions{display:flex;gap:8px;margin-top:12px}.status{margin:0 0 16px;padding:12px 15px;border:1px solid var(--border);border-radius:12px;color:var(--ink-soft);background:var(--surface)}.empty{min-height:250px;display:grid;place-items:center;align-content:center;text-align:center;color:var(--ink-muted)}.empty span{font-size:42px;color:var(--gold)}.empty strong{color:var(--ink);margin-top:8px}.empty p{font-size:12px}.library-list{display:grid;gap:10px}.library-row{display:flex;justify-content:space-between;align-items:center;gap:18px;border:1px solid var(--border);border-radius:14px;padding:14px 16px;background:var(--page-2)}.library-row code{display:block;margin-top:6px;color:var(--ink-soft);font-size:11px}.library-row span{font-size:10px;font-weight:900;color:var(--help-accent)}.library-row span.unavailable{color:var(--decor-accent)}.preflight-card{margin-top:18px;border:1px solid var(--border);border-radius:20px;background:var(--surface);padding:22px}.preflight-card dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.preflight-card dl>div{padding:12px;border-radius:12px;background:var(--surface-raised)}.preflight-card dt{font-size:9px;letter-spacing:.12em;color:var(--ink-muted);text-transform:uppercase}.preflight-card dd{margin:6px 0 0;font-size:12px;overflow-wrap:anywhere}.preflight-boundary,.preflight-blockers{margin-top:10px;padding:10px 12px;border:1px solid var(--border);border-radius:11px;background:var(--page-2);display:flex;gap:8px;align-items:center;flex-wrap:wrap}.preflight-boundary span,.preflight-blockers strong{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted)}.preflight-boundary code,.preflight-blockers code{font-size:9px;color:var(--decor-accent);overflow-wrap:anywhere}.preflight-blockers span{display:grid;grid-template-columns:minmax(180px,auto) 1fr;gap:8px;width:100%;font-size:9px;color:var(--ink-muted)}.preflight-card>p{color:var(--ink-soft);font-size:12px;line-height:1.8}.preview-note{color:var(--ink-muted);font-size:11px;line-height:1.8;margin-top:16px}@media(max-width:850px){.preset-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.presets-heading,.panel-heading{align-items:flex-start;flex-direction:column}.search{width:100%}.search input{min-width:0;flex:1}.preflight-card dl{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:570px){.presets-page{padding-block:45px 70px}.preset-tabs{width:100%;overflow:auto}.preset-tabs button{white-space:nowrap}.panel{padding:18px}.preset-grid{grid-template-columns:1fr}.preflight-card dl{grid-template-columns:1fr}.library-row{align-items:flex-start;flex-direction:column}}

.root-title{font-family:Georgia,serif;font-weight:500;font-size:clamp(40px,6vw,65px);letter-spacing:-.045em;margin:0 0 22px}.preset-stage1-root-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.preset-ingame-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.preset-root-card{display:flex;flex-direction:column;align-items:stretch;gap:14px;text-align:left;min-width:0;min-height:265px;padding:17px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--ink);cursor:pointer}.preset-root-card strong{font-family:Georgia,serif;font-weight:500;font-size:clamp(18px,2vw,24px);line-height:1.25;overflow-wrap:anywhere}.preset-root-card:hover{border-color:var(--gold)}.preset-root-art{height:155px;display:grid;place-items:center;background:var(--surface-raised);color:var(--gold);border-radius:15px;font:44px Georgia,serif}.preset-root-card:focus-visible,.preset-back:focus-visible{outline:3px solid var(--gold);outline-offset:3px}.preset-back{border:1px solid var(--border);border-radius:12px;padding:12px 15px;min-height:44px;background:var(--surface);color:var(--ink)}@media(max-width:950px){.preset-stage1-root-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:530px){.preset-stage1-root-grid,.preset-ingame-grid{grid-template-columns:1fr}.preset-root-card{min-height:160px;flex-direction:row;align-items:center}.preset-root-art{width:76px;height:76px;flex:none;font-size:31px}.preset-root-card strong{font-size:21px}}
</style>
