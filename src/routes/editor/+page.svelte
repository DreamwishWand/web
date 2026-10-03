<script lang="ts">import { base } from '$app/paths';</script>
<svelte:head><title>Editor | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <p class="eyebrow">THE WAND WORKSHOP</p>
  <h1>Editor</h1>
  <p class="page-intro">
    飾り付けを探し、選び、組み替え、Presetとして残すための制作workspaceです。
    World EditorはWEP EditorDocument-backedの安全なproduct surfaceへ移行中です。
  </p>

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
  </div>

  <div class="notice">
    <strong>現在のwriter boundary:</strong><br />
    raw DDV saveからWorld Editorへの直接loadとpersistent world commitはまだ接続していません。
    実DDV targetのmutationはCore capabilityがweb側へ明示的にbindingされるまでfail-closedです。
  </div>
</section>
