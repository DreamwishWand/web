<script lang="ts">import { base } from '$app/paths';</script>
<svelte:head><title>Explore | Dreamwish Wand</title></svelte:head>
<section class="inside-page container">
  <p class="eyebrow">DISCOVER MORE POSSIBILITIES</p>
  <h1>Explore</h1>
  <p class="page-intro">飾り付けのひらめきと、アイテムを探すためのDecorate入口です。</p>
  <div class="decorate-links" aria-label="Decorate">
    <a href={`${base}/moodboards/`}><strong>Moodboards</strong><span>アイテム・Gallery作品・Wand Preset・メモを集めて構想を整理する</span></a>
    <a href={`${base}/editor/world/`}><strong>World Editor</strong><span>対応セーブを読み込み、配置を確認・編集する</span></a>
  </div>
  <div class="notice"><strong>Explore discoveryは準備中</strong> — canonical Game DB taxonomyは閉じていますが、Collection/Exploreのprimary mediaは現行v1.25 byte検証とpublic-display rights承認が終わるまで画像を公開表示しません。</div>
  <a class="inline-link" href={`${base}/`}>← ホームに戻る</a>
</section>
<style>
  .decorate-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:26px 0}
  .decorate-links a{border:1px solid var(--border);background:var(--surface);border-radius:16px;padding:18px;display:grid;gap:7px;color:var(--ink);box-shadow:var(--shadow)}
  .decorate-links strong{font-family:Georgia,serif;font-size:22px;font-weight:500}
  .decorate-links span{color:var(--ink-soft);font-size:12px;line-height:1.7}
  @media(max-width:620px){.decorate-links{grid-template-columns:1fr}}
</style>
