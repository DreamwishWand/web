<script lang="ts">
  import { base } from '$app/paths';
  const cards = [
    { id:'save', href:`${base}/editor/items/`, eyebrow:'YOUR COLLECTION', title:'Save Editor', detail:'アイテムの所持情報を、思いどおりに。', glyph:'✧', state:'画面プレビュー' },
    { id:'world', href:`${base}/editor/world/`, eyebrow:'YOUR WORLD', title:'World Editor', detail:'飾り付けの自由が、もっと広がる。', glyph:'◇', state:'構想中' },
    { id:'help', href:`${base}/help/`, eyebrow:'A HELPING HAND', title:'Help & Bugs', detail:'困ったときも、一緒に道を探そう。', glyph:'✳', state:'準備中' },
    { id:'decor', href:`${base}/explore/`, eyebrow:'FIND INSPIRATION', title:'Decoration', detail:'次のひらめきが見つかる場所。', glyph:'❋', state:'準備中' }
  ];
</script>

<svelte:head>
  <title>Dreamwish Wand — A little magic for your Valley</title>
  <meta name="description" content="いつものバレーに、もう少し自由と魔法を。Disney Dreamlight Valley向け非公式ファン制作ツールの開発プレビュー。" />
</svelte:head>

<section class="hero" aria-labelledby="hero-title">
  <div class="hero-stars" aria-hidden="true"></div>
  <div class="hero-content container">
    <div class="hero-copy">
      <p class="eyebrow"><span class="tiny-star" aria-hidden="true">✦</span> YOUR VALLEY, YOUR WISH</p>
      <h1 id="hero-title">Every little wish<br />deserves <em>a little magic.</em></h1>
      <p class="hero-lead">「こうできたらいいのに」を、あなたのバレーの新しい可能性に。</p>
      <p class="hero-sub">夢見ていた飾り付けも、もっと自由な遊び方も。<br />小さな願いから始まる、あなただけの魔法。</p>
      <a class="hero-action" href={`${base}/editor/`}>魔法の道具を見てみる <span aria-hidden="true">↗</span></a>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="art-halo"></div><div class="art-arch">
        <div class="art-moon"></div><div class="art-twinkle twinkle-one">✦</div><div class="art-twinkle twinkle-two">✧</div><div class="art-twinkle twinkle-three">✳</div><div class="art-twinkle twinkle-four">✦</div>
        <div class="art-hill hill-back"></div><div class="art-hill hill-front"></div>
        <div class="art-wand"><span>✦</span></div>
      </div>
      <div class="art-spark left">✧</div><div class="art-spark right">✦</div>
      <div class="art-caption">A WISH IS WHERE MAGIC BEGINS</div>
    </div>
  </div>
</section>

<section class="entry-section container" aria-labelledby="choose-title">
  <div class="section-heading"><div><p class="eyebrow">CHOOSE YOUR NEXT WISH</p><h2 id="choose-title">今日は、どんな魔法を使おう？</h2></div><span class="heading-spark" aria-hidden="true">✦ ⋆ ✧</span></div>
  <div class="portal-grid">
    {#each cards as card}
      <a class={`portal-card portal-${card.id}`} href={card.href}>
        <div class="portal-top"><span class="portal-eyebrow">{card.eyebrow}</span><span class="portal-arrow" aria-hidden="true">↗</span></div>
        <div class="portal-symbol" aria-hidden="true"><span class="portal-orbit"></span><span>{card.glyph}</span></div>
        <div class="portal-content"><h3>{card.title}</h3><p>{card.detail}</p><span class="portal-state">{card.state} <span aria-hidden="true">·</span> 詳細を見る</span></div>
      </a>
    {/each}
  </div>
  <p class="preview-note">現在は開発初期のプレビューです。セーブデータの読み込み・編集・書き出し機能はまだ公開していません。</p>
</section>
