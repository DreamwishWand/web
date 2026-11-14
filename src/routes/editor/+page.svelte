<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { savedDiffGridsCopy } from '$lib/wep/steam-saved-diffgrids-copy.mjs';
  $: reader = savedDiffGridsCopy($locale);
</script>
<svelte:head><title>Editor | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <p class="eyebrow">THE WAND WORKSHOP</p>
  <h1>Editor</h1>
  <p class="page-intro">
    飾り付けを探し、選び、組み替え、Presetとして残すための制作workspaceです。
    World EditorはWEP EditorDocument-backedの安全なproduct surfaceへ移行中です。
  </p>

  <a class="feature-tile reader-entry" data-steam-reader-entry data-sveltekit-reload href={base + '/editor/steam-reader/'}>
    <span class="tile-emoji" aria-hidden="true">◇</span>
    <h2>{reader.preformal}</h2>
    <p>{reader.title} · {reader.subtitle}</p>
  </a>

  <div class="feature-grid">
    <a class="feature-tile" href={`${base}/editor/items/`}>
      <span class="tile-emoji" aria-hidden="true">✧</span>
      <h2>Inventory &amp; Ownership</h2>
      <p>アイテムを探し、所持情報を確認する画面の試作です。</p>
      <span>UIサンプルを見る →</span>
    </a>

    <a class="feature-tile" href={`${base}/editor/world/`}>
      <span class="tile-emoji" aria-hidden="true">◇</span>
      <h2>World Editor</h2>
      <p>
        EditorDocumentをtop-downで表示・選択し、portable Scene Presetをcapture / publishできます。
      </p>
      <span>World Editorを開く →</span>
    </a>
    <a class="feature-tile" href={base + '/editor/timing/'}>
      <span class="tile-emoji" aria-hidden="true">◷</span>
      <h2>Timing &amp; Spawn Inspector</h2>
      <p>Timekeeperの508件のイベント定義を利用した実セーブの読取り専用検索（v1.25.3）。日時の書込みはOFFです。</p>
      <span>日時・イベントを調べる →</span>
    </a>
  </div>

  <div class="notice">
    <strong>現在のwriter boundary:</strong><br />
    raw DDV saveからWorld Editorへの直接loadとpersistent world commitはまだ接続していません。
    実DDV targetのmutationはCore capabilityがweb側へ明示的にbindingされるまでfail-closedです。
  </div>
</section>

<style>
  .reader-entry { display:block; margin-block:20px; min-width:0; overflow-wrap:anywhere; }
  .reader-entry:focus-visible { outline:3px solid var(--focus-ring); outline-offset:3px; }
</style>
