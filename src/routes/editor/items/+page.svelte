<script lang="ts">
  // Presentation-only items, deliberately NOT game data or a loaded save.
  const samples = [
    { icon: '💎', label: '宝石', group: '素材', count: '—' },
    { icon: '🌸', label: '花', group: '素材', count: '—' },
    { icon: '🐟', label: '魚', group: '素材', count: '—' },
    { icon: '🥕', label: '野菜', group: '素材', count: '—' },
    { icon: '🪑', label: '家具', group: '家具', count: '—' },
    { icon: '👗', label: '衣装', group: '衣装', count: '—' },
    { icon: '🍎', label: '果物', group: '素材', count: '—' },
    { icon: '🪞', label: '装飾', group: '家具', count: '—' },
    { icon: '🦋', label: '生き物', group: 'その他', count: '—' },
    { icon: '🕯️', label: '照明', group: '家具', count: '—' },
    { icon: '🧵', label: '布', group: '素材', count: '—' },
    { icon: '🍰', label: '料理', group: 'その他', count: '—' }
  ];
  const filters = ['すべて', '素材', '家具', '衣装', 'その他'];
  let search = '';
  let category = 'すべて';
  $: filtered = samples.filter((item) => (category === 'すべて' || item.group === category) && item.label.includes(search.trim()));
</script>
<svelte:head><title>Ownership UI Preview | Dreamwish Wand</title></svelte:head>
<section class="inside-page container"><p class="eyebrow">EDITOR / INVENTORY</p><h1>Inventory &amp; Ownership</h1><p class="page-intro">静かな画面に、アイコンの色彩を。これは操作感を確かめるための<strong>UIサンプル</strong>です。</p>
<div class="notice"><strong>読み取り専用のデザイン試作</strong> — 表示されているアイコンとカテゴリは仮データです。DDVのアイテム・所持情報ではありません。ファイルの読み込み、変更、保存はできません。</div>
<div class="editor-demo"><div class="demo-toolbar"><div><span class="eyebrow">BROWSE YOUR COLLECTION</span><h2>アイテムを探す</h2></div><span class="demo-badge">SAMPLE DATA</span></div>
<label class="search-label" for="item-search">カテゴリ名で検索</label><input id="item-search" type="search" placeholder="例：宝石、家具…" bind:value={search} />
<div class="filter-row" aria-label="カテゴリフィルター">{#each filters as filter}<button type="button" class:chosen={category === filter} aria-pressed={category === filter} on:click={() => category = filter}>{filter}</button>{/each}</div>
<div class="sample-grid" aria-live="polite">{#each filtered as item}<div class="sample-item"><span class="sample-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></div>{:else}<p class="empty-hint">一致するサンプルはありません。</p>{/each}</div>
</div><p class="preview-note">アイコンの色と情報密度を確認するための画面です。ゲームのサムネイルや編集操作を実装したものではありません。</p></section>
