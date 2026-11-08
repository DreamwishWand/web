<script lang="ts">
  import { onMount } from 'svelte';
  import { locale } from '$lib/i18n/runtime.js';
  import { itemImagePreferences,
    restoreItemImagePreferences, saveItemImagePreferences } from '$lib/item-media/public-item-images.mjs';
  import { switch1253PublicItemImageSource } from '$lib/item-media/switch1253-public-item-images.mjs';

  const L: Record<string,any> = {
    en:{title:'Item image layout',unavailable:'Verified public item images are not yet available.',scope:'Images appear only after a verified versioned manifest and an explicit scoped publication decision.',size:'Thumbnail size',fit:'Image fit',density:'Card density',contain:'Contain',cover:'Cover',compact:'Compact',comfortable:'Comfortable'},
    ja:{title:'Item画像のレイアウト',unavailable:'公開対象として確認済みのItem画像はまだありません。',scope:'正確なバージョン別対応表と公開判断が揃った画像だけを表示します。',size:'サムネイルのサイズ',fit:'画像の収め方',density:'カード密度',contain:'全体を表示',cover:'領域を埋める',compact:'コンパクト',comfortable:'標準'},
    fr:{title:"Disposition des images d'objets",unavailable:"Aucune image publique d'objet vérifiée pour le moment.",scope:'Seules les images autorisées par un manifeste versionné vérifié sont affichées.',size:'Taille des miniatures',fit:"Ajustement de l'image",density:'Densité des cartes',contain:'Contenir',cover:'Couvrir',compact:'Compact',comfortable:'Normal'},
    it:{title:'Layout immagini oggetti',unavailable:'Immagini pubbliche verificate non ancora disponibili.',scope:'Mostra solo immagini con manifesto di versione verificato e decisione di pubblicazione.',size:'Dimensione miniature',fit:'Adattamento',density:'Densità schede',contain:'Contieni',cover:'Riempi',compact:'Compatto',comfortable:'Normale'},
    de:{title:'Item-Bildlayout',unavailable:'Verifizierte öffentliche Item-Bilder sind noch nicht verfügbar.',scope:'Bilder nur mit geprüftem Versionsmanifest und Freigabe.',size:'Miniaturgröße',fit:'Bildanpassung',density:'Kartendichte',contain:'Einpassen',cover:'Füllen',compact:'Kompakt',comfortable:'Normal'},
    'es-ES':{title:'Diseño de imágenes de objetos',unavailable:'Aún no hay imágenes públicas verificadas.',scope:'Solo imágenes con manifiesto de versión verificado y decisión de publicación.',size:'Tamaño de miniatura',fit:'Ajuste de imagen',density:'Densidad de tarjetas',contain:'Contener',cover:'Cubrir',compact:'Compacto',comfortable:'Normal'},
    'zh-CN':{title:'物品图片布局',unavailable:'暂无已验证可公开的物品图片。',scope:'仅显示有版本验证及发布决定的图片。',size:'缩略图大小',fit:'图片布局',density:'卡片密度',contain:'完整显示',cover:'裁切填充',compact:'紧凑',comfortable:'标准'},
    'pt-BR':{title:'Layout das imagens de itens',unavailable:'Ainda não há imagens públicas de itens verificadas.',scope:'Somente imagens com manifesto versionado validado e decisão de publicação.',size:'Tamanho da miniatura',fit:'Ajuste de imagem',density:'Densidade dos cartões',contain:'Conter',cover:'Cobrir',compact:'Compacto',comfortable:'Normal'}
  };
  $: labels=L[$locale]??L.en;
  let prefError='';
  onMount(()=>{ try {restoreItemImagePreferences(localStorage);} catch { /* keep safe defaults */ } });
  function changePreference(key:'size'|'fit'|'density',value:string) {
    const next={...$itemImagePreferences,[key]:key==='size'?Number(value):value};
    try { saveItemImagePreferences(localStorage,next);prefError=''; }
    catch { prefError='Preferences could not be saved in this browser.'; }
  }
</script>

<details class="item-image-controls" data-item-image-layout-controls>
  <summary>{labels.title}</summary>
  <div class="controls">
    {#if $switch1253PublicItemImageSource.status !== 'VERIFIED'}
      <p role="status" class="media-unavailable">{labels.unavailable}</p>
    {/if}
    <p class="source-note">{labels.scope}</p>
    <div class="fields">
      <label>{labels.size}
        <select value={$itemImagePreferences.size} on:change={(e)=>changePreference('size',e.currentTarget.value)}>
          {#each [40,48,56,64,80,96] as n}<option value={n}>{n}px</option>{/each}
        </select>
      </label>
      <label>{labels.fit}
        <select value={$itemImagePreferences.fit} on:change={(e)=>changePreference('fit',e.currentTarget.value)}>
          <option value="contain">{labels.contain}</option><option value="cover">{labels.cover}</option>
        </select>
      </label>
      <label>{labels.density}
        <select value={$itemImagePreferences.density} on:change={(e)=>changePreference('density',e.currentTarget.value)}>
          <option value="comfortable">{labels.comfortable}</option><option value="compact">{labels.compact}</option>
        </select>
      </label>
    </div>
    {#if prefError}<p role="alert">{prefError}</p>{/if}
  </div>
</details>

<style>
.item-image-controls{border:1px solid var(--border);border-radius:14px;background:var(--surface);margin:14px 0 22px;max-width:100%;font-size:12px;color:var(--ink)}
.item-image-controls summary{padding:12px 16px;min-height:44px;box-sizing:border-box;cursor:pointer;font-weight:700}
.controls{padding:8px 16px 18px;display:grid;gap:12px}
.controls p{margin:0;color:var(--ink-muted);line-height:1.6}
.fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.fields label{display:grid;gap:6px;font-size:11px;min-width:0}
.fields select{width:100%;min-height:44px;box-sizing:border-box;border:1px solid var(--border);
 border-radius:10px;background:var(--surface-raised);color:var(--ink);padding:8px}
:focus-visible{outline:3px solid var(--focus-ring);outline-offset:2px}
@media(max-width:760px){.fields{grid-template-columns:1fr}}
</style>