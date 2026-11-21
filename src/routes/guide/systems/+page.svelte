<script lang="ts">
  import {tick} from 'svelte';
  import {base} from '$app/paths';
  import {locale} from '$lib/i18n/runtime.js';
  import {
    GUIDE_SYSTEMS_CATEGORIES,GUIDE_SYSTEMS_PUBLIC_PAGES_ENABLED,
    GUIDE_SYSTEMS_SOURCE,guideSystemsCategoryLabel,
    filterGuideSystemsCategories,findGuideSystemsCategory
  } from '$lib/guide/systems-stage1-taxonomy.mjs';

  const localized:Record<string,{systems:string,back:string,search:string,empty:string,groups:string,off:string,scope:string,englishFallback:string,returnGuide:string}> = {
    en:{systems:'Systems',back:'All Systems categories',search:'Search Systems categories',empty:'No matching Systems categories.',groups:'Topics',off:'Verified Guide articles are not enabled for publication here. These are navigation topics, not published guides.',scope:'Nintendo Switch · DDV v1.25.0 · Read-only taxonomy',englishFallback:'Topic subgroup labels are shown in canonical English until localized review.',returnGuide:'Guide'},
    fr:{systems:'Systèmes',back:'Toutes les catégories',search:'Rechercher une catégorie',empty:'Aucune catégorie correspondante.',groups:'Sujets',off:'La publication des articles Guide vérifiés n’est pas encore activée. Ce sont des sujets de navigation, pas des guides publiés.',scope:'Nintendo Switch · DDV v1.25.0 · Catégories en lecture seule',englishFallback:'Les sous-catégories utilisent les libellés canoniques en anglais en attendant leur révision.',returnGuide:'Guide'},
    it:{systems:'Sistemi',back:'Tutte le categorie',search:'Cerca categorie',empty:'Nessuna categoria corrispondente.',groups:'Argomenti',off:'La pubblicazione degli articoli Guide verificati non è ancora abilitata. Questi sono argomenti di navigazione, non guide pubblicate.',scope:'Nintendo Switch · DDV v1.25.0 · Tassonomia in sola lettura',englishFallback:'I gruppi mostrano etichette canoniche inglesi in attesa di revisione.',returnGuide:'Guide'},
    de:{systems:'Systeme',back:'Alle Systemkategorien',search:'Systemkategorien suchen',empty:'Keine passenden Kategorien.',groups:'Themen',off:'Die Veröffentlichung verifizierter Guide-Artikel ist hier noch nicht freigeschaltet. Dies sind Navigationsthemen, keine veröffentlichten Anleitungen.',scope:'Nintendo Switch · DDV v1.25.0 · Nur-Lese-Kategorien',englishFallback:'Untergruppen verwenden bis zur Prüfung die kanonischen englischen Bezeichnungen.',returnGuide:'Guide'},
    'es-ES':{systems:'Sistemas',back:'Todas las categorías',search:'Buscar categorías',empty:'No hay categorías coincidentes.',groups:'Temas',off:'La publicación de artículos Guide verificados aún no está habilitada. Estos son temas de navegación, no guías publicadas.',scope:'Nintendo Switch · DDV v1.25.0 · Taxonomía de solo lectura',englishFallback:'Los subgrupos muestran etiquetas canónicas en inglés hasta su revisión.',returnGuide:'Guide'},
    ja:{systems:'ゲームシステム',back:'すべてのシステムカテゴリ',search:'ゲームシステムのカテゴリを検索',empty:'一致するカテゴリはありません。',groups:'分類・テーマ',off:'検証済みGuide記事の公開は、まだ許可されていません。ここでは承認済みの分類のみ確認できます。',scope:'Nintendo Switch · DDV v1.25.0 · 分類のみ・読み取り専用',englishFallback:'分類名はレビュー済みの日本語です。',returnGuide:'Guideに戻る'},
    'zh-CN':{systems:'游戏系统',back:'全部分类',search:'搜索系统分类',empty:'没有匹配的分类。',groups:'主题',off:'已验证 Guide 文章的发布尚未获准。这些是导航主题，并非已发布的攻略。',scope:'Nintendo Switch · DDV v1.25.0 · 只读分类',englishFallback:'子分类目前显示规范英文名称，待本地化审核。',returnGuide:'返回 Guide'},
    'pt-BR':{systems:'Sistemas',back:'Todas as categorias',search:'Pesquisar categorias',empty:'Nenhuma categoria correspondente.',groups:'Tópicos',off:'A publicação de artigos Guide verificados ainda não está habilitada. Estes são tópicos de navegação, não guias publicados.',scope:'Nintendo Switch · DDV v1.25.0 · Taxonomia somente leitura',englishFallback:'Os subgrupos usam nomes canônicos em inglês até a revisão local.',returnGuide:'Voltar ao Guide'}
  };
  let query='',selectedId:string|null=null;
  $: copy=localized[$locale]??localized.en;
  $: categories=filterGuideSystemsCategories(query,$locale);
  $: selected=findGuideSystemsCategory(selectedId);
  async function back(){
    const id=selectedId;selectedId=null;await tick();
    if(id)document.querySelector<HTMLButtonElement>('[data-systems-category="'+id+'"]')?.focus();
  }
</script>

<svelte:head>
  <title>{copy.systems} | Guide | Dreamwish Wand</title>
  <meta name="robots" content="noindex,nofollow" />
  <meta name="description" content="Dreamwish Wand Guide Systems read-only topic categories for the verified Nintendo Switch 1.25.0 source. Published articles gated." />
</svelte:head>

<section class="systems-stage1 container" data-guide-systems-seven
  data-accepted-source-version={GUIDE_SYSTEMS_SOURCE.gameVersion}
  data-guide-rights="unverified" data-published-articles="off" data-writer="off">
  <a href={base+'/guide/'} class="systems-guide-back">{copy.returnGuide}</a>
  <header class="systems-title">
    <div><h1>{copy.systems}</h1><p>{copy.scope}</p></div>
  </header>
  {#if !selected}
    <label class="systems-query">
      <span>{copy.search}</span>
      <input type="search" bind:value={query} autocomplete="off" maxlength="100" />
    </label>
    <nav class="systems-categories" data-systems-category-grid aria-label={copy.systems}>
      {#each categories as category}
        <button type="button" class="systems-category-card" data-systems-category={category.id}
          on:click={()=>{selectedId=category.id;}}
          aria-label={guideSystemsCategoryLabel(category.id,$locale) ?? category.en}>
          <span class="systems-art" aria-hidden="true">◇</span>
          <strong>{guideSystemsCategoryLabel(category.id,$locale) ?? category.en}</strong>
        </button>
      {:else}
        <p class="systems-empty" role="status">{copy.empty}</p>
      {/each}
    </nav>
    <p class="systems-gate" role="note">{copy.off}</p>
  {:else}
    <button type="button" class="systems-return" on:click={back}>{copy.back}</button>
    <h2>{guideSystemsCategoryLabel(selected.id,$locale) ?? selected.en}</h2>
    <p class="systems-summary">{selected.descriptionJa && $locale==='ja' ? selected.descriptionJa : selected.en}</p>
    <h3>{copy.groups}</h3>
    <div class="systems-subgroups" data-systems-subgroups>
      {#each selected.subgroups as group}
        <article class="systems-subgroup" data-systems-group>
          <span aria-hidden="true">◇</span>
          <strong>{$locale==='ja'?group.ja:group.en}</strong>
        </article>
      {/each}
    </div>
    {#if $locale!=='ja' && $locale!=='en'}
      <p class="systems-fallback" role="note">{copy.englishFallback}</p>
    {/if}
    {#if !GUIDE_SYSTEMS_PUBLIC_PAGES_ENABLED}
      <p class="systems-gate" role="status">{copy.off}</p>
    {/if}
  {/if}
</section>

<style>
.systems-stage1{padding-block:44px 90px;min-height:70vh}.systems-guide-back{color:var(--ink-soft);font-size:12px;display:inline-flex;align-items:center;min-height:44px}.systems-title h1{font:500 clamp(38px,5.5vw,64px) Georgia,serif;letter-spacing:-.04em;margin:10px 0 5px}.systems-title p{color:var(--ink-muted);font-size:12px;margin:8px 0 24px}.systems-query{display:grid;gap:8px;margin:15px 0 22px;color:var(--ink-soft);font-size:12px;font-weight:800}.systems-query input{box-sizing:border-box;width:100%;max-width:700px;min-height:50px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--ink);font:inherit;padding:11px 15px}.systems-categories{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.systems-category-card{min-width:0;display:flex;flex-direction:column;gap:14px;text-align:left;min-height:235px;padding:16px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--ink);cursor:pointer}.systems-category-card:hover{border-color:var(--gold)}.systems-art{height:144px;border-radius:14px;background:var(--surface-raised);color:var(--gold);display:grid;place-items:center;font:52px Georgia,serif}.systems-category-card strong{font:500 clamp(18px,1.9vw,25px) Georgia,serif;line-height:1.3;overflow-wrap:anywhere}.systems-gate,.systems-fallback{border:1px solid var(--border);padding:14px 16px;border-radius:13px;background:var(--surface);color:var(--ink-muted);font-size:12px;line-height:1.7;margin:20px 0 0}.systems-empty{padding:30px;color:var(--ink-muted)}.systems-return{min-height:44px;padding:11px 16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;color:var(--ink);margin:5px 0 22px}.systems-stage1 h2{font:500 clamp(30px,4vw,46px) Georgia,serif;margin:0}.systems-summary{font-size:13px;line-height:1.65;color:var(--ink-soft);margin:12px 0 24px}.systems-stage1 h3{font-size:12px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.08em}.systems-subgroups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.systems-subgroup{display:flex;align-items:center;gap:16px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:17px;min-height:82px;color:var(--ink);font-size:15px}.systems-subgroup span{color:var(--gold);font-size:27px}.systems-category-card:focus-visible,.systems-return:focus-visible,.systems-guide-back:focus-visible,.systems-query input:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
@media(max-width:940px){.systems-categories{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:590px){.systems-categories,.systems-subgroups{grid-template-columns:1fr}.systems-category-card{min-height:132px;flex-direction:row;align-items:center}.systems-art{height:88px;width:88px;flex:none;font-size:34px}.systems-category-card strong{font-size:21px}}@media(max-width:360px){.systems-stage1{padding-block:30px 66px}.systems-category-card{padding:12px;min-height:106px;gap:12px}.systems-art{width:64px;height:64px;font-size:28px}.systems-subgroup{padding:12px}}
</style>
