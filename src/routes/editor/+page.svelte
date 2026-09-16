<script lang="ts">import { base } from '$app/paths';</script>
<svelte:head><title>Editor | Dreamwish Wand</title></svelte:head>
<section class="inside-page container"><p class="eyebrow">THE WAND WORKSHOP</p><h1>Editor</h1><p class="page-intro">いつものバレーを、もっとあなたらしく。現在は画面設計のプレビュー段階です。</p>
  <div class="feature-grid"><a class="feature-tile" href={`${base}/editor/items/`}><span class="tile-emoji" aria-hidden="true">✧</span><h2>Inventory &amp; Ownership</h2><p>アイテムを探し、所持情報を確認する画面の試作です。</p><span>画面プレビューを見る →</span></a><a class="feature-tile" href={`${base}/editor/world/`}><span class="tile-emoji" aria-hidden="true">◇</span><h2>World &amp; Layout</h2><p>ワールドや飾り付けの編集に向けて準備中です。</p><span>構想を見る →</span></a></div>
  <div class="notice"><strong>この段階ではセーブデータを読み込みません。</strong><br />実データの編集・バックアップ・検証・エクスポートは、Coreの接続と実機検証後に追加します。</div>
</section>
