<script lang="ts">
  import { onMount } from 'svelte';
  import { locale } from '$lib/i18n/runtime.js';
  import { localImageState, restoreLocalImages, importR39Manifest, importR39ItemMapping,
    importR39Shards, setLocalImagePreferences, clearLocalImagePreview, noteLocalImageError }
    from './local-r39-item-image.mjs';

  const labels: Record<string,any> = {
    en:{title:'Local Item image preview',intro:'R39 images stay in this browser. No game art is uploaded or shipped with Wand.',import:'Import local R39 files',manifest:'1. R39 manifest JSON',mapping:'2. 01D ItemID–SHA mapping JSON',shards:'3. Verified R39 ZIP shards (one or more)',restore:'Stored for next visit',shardCount:'ZIP shards saved',noMapping:'Exact ItemID mapping not imported; images remain unavailable.',size:'Image size',fit:'Image fit',density:'Card density',contain:'Contain',cover:'Cover',compact:'Compact',comfortable:'Comfortable',clear:'Clear all local images',missing:'Local browser storage unavailable',busy:'Importing selected local files…',ready:'Local preview ready',version:'Switch DDV v1.24.13 preview only; not proof of v1.25.3 identity.'},
    ja:{title:'Item画像のローカルプレビュー',intro:'R39画像はこのブラウザー内だけに保存します。ゲーム画像をWandへ送信・公開しません。',import:'ローカルR39ファイルを読み込む',manifest:'1. R39 manifest JSON',mapping:'2. 01D ItemID–SHA 対応表 JSON',shards:'3. 確認済みR39 ZIP shard（複数選択可）',restore:'次回の閲覧にも保存',shardCount:'保存済みZIP shard',noMapping:'ItemIDとSHAの正確な対応表が未読込のため、画像は表示しません。',size:'画像サイズ',fit:'画像の収め方',density:'カード密度',contain:'全体を収める',cover:'領域を埋める',compact:'コンパクト',comfortable:'標準',clear:'ローカル画像をすべて消去',missing:'ブラウザー内保存を利用できません',busy:'選択したローカルファイルを処理中…',ready:'ローカルプレビューを利用可能',version:'Switch DDV v1.24.13画像のプレビュー専用。v1.25.3の同一性は未確認です。'},
    fr:{title:"Aperçu local des images d'objets",intro:"Les images R39 restent dans ce navigateur. Aucun envoi d'images vers Wand.",import:'Importer des fichiers R39 locaux',manifest:'1. Manifeste R39 JSON',mapping:'2. Table 01D ItemID–SHA JSON',shards:'3. ZIP R39 vérifiés',restore:'Enregistré pour les prochaines visites',shardCount:'Archives ZIP enregistrées',noMapping:'Table ItemID–SHA exacte absente; images indisponibles.',size:'Taille des images',fit:'Ajustement',density:'Densité des cartes',contain:'Contenir',cover:'Remplir',compact:'Compact',comfortable:'Standard',clear:'Effacer toutes les images locales',missing:'Stockage local indisponible',busy:'Importation locale en cours…',ready:'Aperçu local prêt',version:'Aperçu Switch v1.24.13 uniquement, non vérifié pour v1.25.3.'},
    it:{title:'Anteprima locale immagini oggetti',intro:'Le immagini R39 rimangono nel browser, senza caricamenti sul server.',import:'Importa file R39 locali',manifest:'1. Manifest R39 JSON',mapping:'2. Mappa 01D ItemID–SHA JSON',shards:'3. ZIP R39 verificati',restore:'Salvato per le visite successive',shardCount:'Archivi ZIP salvati',noMapping:'Mappa ItemID–SHA esatta assente; immagini non disponibili.',size:'Dimensione immagine',fit:'Adattamento',density:'Densità schede',contain:'Contieni',cover:'Riempi',compact:'Compatto',comfortable:'Normale',clear:'Cancella tutte le immagini locali',missing:'Archivio browser non disponibile',busy:'Importazione locale…',ready:'Anteprima locale pronta',version:'Solo anteprima Switch v1.24.13; identità v1.25.3 non verificata.'},
    de:{title:'Lokale Item-Bildvorschau',intro:'R39-Bilder bleiben in diesem Browser und werden nicht hochgeladen.',import:'Lokale R39-Dateien importieren',manifest:'1. R39-Manifest JSON',mapping:'2. 01D ItemID–SHA-Zuordnung JSON',shards:'3. Verifizierte R39-ZIP-Dateien',restore:'Für spätere Besuche gespeichert',shardCount:'Gespeicherte ZIP-Dateien',noMapping:'Exakte ItemID–SHA-Zuordnung fehlt; Bilder bleiben verborgen.',size:'Bildgröße',fit:'Bildanpassung',density:'Kartendichte',contain:'Einpassen',cover:'Füllen',compact:'Kompakt',comfortable:'Standard',clear:'Alle lokalen Bilder löschen',missing:'Lokaler Browserspeicher nicht verfügbar',busy:'Lokaler Import läuft…',ready:'Lokale Vorschau bereit',version:'Nur Switch v1.24.13-Vorschau; v1.25.3-Identität nicht bestätigt.'},
    'es-ES':{title:'Vista previa local de imágenes',intro:'Las imágenes R39 permanecen en este navegador; no se suben al servidor.',import:'Importar archivos R39 locales',manifest:'1. Manifiesto R39 JSON',mapping:'2. Mapa 01D ItemID–SHA JSON',shards:'3. ZIP R39 verificados',restore:'Guardado para próximas visitas',shardCount:'ZIP guardados',noMapping:'Falta mapa exacto ItemID–SHA; imágenes no disponibles.',size:'Tamaño de imagen',fit:'Ajuste de imagen',density:'Densidad de tarjetas',contain:'Contener',cover:'Cubrir',compact:'Compacto',comfortable:'Normal',clear:'Borrar imágenes locales',missing:'Almacenamiento local no disponible',busy:'Importando archivos locales…',ready:'Vista previa local lista',version:'Solo vista previa Switch v1.24.13; identidad v1.25.3 sin verificar.'},
    'zh-CN':{title:'物品图片本地预览',intro:'R39图片只保存在此浏览器，不会上传到Wand。',import:'导入本地R39文件',manifest:'1. R39 清单JSON',mapping:'2. 01D ItemID–SHA 映射JSON',shards:'3. 已验证的R39 ZIP分片',restore:'下次访问继续保留',shardCount:'已保存ZIP分片',noMapping:'未导入精确ItemID–SHA映射，不显示图片。',size:'图片大小',fit:'图片填充',density:'卡片密度',contain:'完整显示',cover:'填满',compact:'紧凑',comfortable:'标准',clear:'清空全部本地图片',missing:'浏览器本地存储不可用',busy:'正在导入本地文件…',ready:'本地预览就绪',version:'仅Switch v1.24.13预览；不证明v1.25.3映射一致。'},
    'pt-BR':{title:'Prévia local de imagens de itens',intro:'As imagens R39 ficam neste navegador, sem envio ao servidor.',import:'Importar arquivos R39 locais',manifest:'1. Manifesto R39 JSON',mapping:'2. Mapa 01D ItemID–SHA JSON',shards:'3. ZIPs R39 verificados',restore:'Salvo para a próxima visita',shardCount:'Arquivos ZIP salvos',noMapping:'Mapa exato ItemID–SHA ausente; imagens indisponíveis.',size:'Tamanho da imagem',fit:'Enquadramento',density:'Densidade dos cartões',contain:'Conter',cover:'Preencher',compact:'Compacto',comfortable:'Padrão',clear:'Limpar todas as imagens locais',missing:'Armazenamento local indisponível',busy:'Importando arquivos locais…',ready:'Prévia local pronta',version:'Somente prévia Switch v1.24.13; identidade v1.25.3 não verificada.'}
  };
  $: text = labels[$locale] ?? labels.en;
  let busy = false;
  let localStatus = '';

  onMount(() => { restoreLocalImages(); });
  async function operation(action:()=>Promise<any>){
    busy = true; localStatus = '';
    try { await action(); localStatus = text.ready; }
    catch (err) { noteLocalImageError(err); localStatus = String((err as Error)?.message || err); }
    finally { busy = false; }
  }
  async function manifestChanged(event:Event){
    const input = event.currentTarget as HTMLInputElement, file=input.files?.[0];
    if(file)await operation(()=>importR39Manifest(file));
    input.value='';
  }
  async function mappingChanged(event:Event){
    const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];
    if(file)await operation(()=>importR39ItemMapping(file));
    input.value='';
  }
  async function shardsChanged(event:Event){
    const input=event.currentTarget as HTMLInputElement,files=input.files;
    if(files?.length)await operation(()=>importR39Shards(files));
    input.value='';
  }
  function preferences(key:'fit'|'size'|'density',value:string){
    const current=$localImageState.preferences;
    const next={...current,[key]:key==='size'?Number(value):value};
    operation(()=>setLocalImagePreferences(next));
  }
</script>

<details class="local-image-settings" data-r39-local-controls>
  <summary>{text.title} · {$localImageState.shardCount} {text.shardCount}</summary>
  <div class="local-panel" data-local-only="true">
    <p>{text.intro}</p>
    <p class="version">{text.version}</p>
    {#if !$localImageState.available && $localImageState.ready}
      <p role="alert">{text.missing}</p>
    {/if}
    <div class="import-controls">
      <label>{text.manifest}<input type="file" accept=".json,application/json" disabled={busy} on:change={manifestChanged} /></label>
      <label>{text.mapping}<input type="file" accept=".json,application/json" disabled={busy || !$localImageState.manifest} on:change={mappingChanged} /></label>
      <label>{text.shards}<input type="file" accept=".zip,application/zip" multiple disabled={busy || !$localImageState.manifest} on:change={shardsChanged} /></label>
    </div>
    {#if !$localImageState.mapping}<p class="unavailable">{text.noMapping}</p>{/if}
    {#if busy}<p role="status">{text.busy}</p>{/if}
    {#if $localImageState.error}<p class="error" role="alert">{$localImageState.error}</p>{/if}
    {#if localStatus}<p role="status">{localStatus}</p>{/if}
    <div class="preferences">
      <label>{text.size}<select value={$localImageState.preferences.size} disabled={busy} on:change={(event)=>preferences('size',event.currentTarget.value)}>
        {#each [36,48,56,64,80] as size}<option value={size}>{size}px</option>{/each}
      </select></label>
      <label>{text.fit}<select value={$localImageState.preferences.fit} disabled={busy} on:change={(event)=>preferences('fit',event.currentTarget.value)}>
        <option value="contain">{text.contain}</option><option value="cover">{text.cover}</option>
      </select></label>
      <label>{text.density}<select value={$localImageState.preferences.density} disabled={busy} on:change={(event)=>preferences('density',event.currentTarget.value)}>
        <option value="comfortable">{text.comfortable}</option><option value="compact">{text.compact}</option>
      </select></label>
    </div>
    <button class="clear-local" type="button" disabled={busy} on:click={()=>operation(clearLocalImagePreview)}>{text.clear}</button>
  </div>
</details>

<style>
.local-image-settings{margin:12px 0 20px;border:1px solid var(--border);border-radius:14px;background:var(--surface);color:var(--ink);font-size:12px;max-width:100%;overflow-wrap:anywhere}
.local-image-settings summary{min-height:44px;display:flex;align-items:center;padding:12px 16px;cursor:pointer;font-weight:700}
.local-panel{padding:4px 16px 18px;display:grid;gap:12px}
.local-panel p{margin:0;color:var(--ink-soft);line-height:1.6}
.local-panel .version,.local-panel .unavailable{font-size:11px;color:var(--ink-muted)}
.import-controls,.preferences{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.local-panel label{display:grid;gap:6px;font-size:11px;font-weight:650}
.local-panel input,.local-panel select{width:100%;max-width:100%;min-height:44px;padding:8px;border:1px solid var(--border);background:var(--surface-raised);color:var(--ink);border-radius:10px;box-sizing:border-box}
.local-panel input::file-selector-button{border:1px solid var(--border);background:var(--surface);color:var(--ink);border-radius:7px;padding:7px}
.clear-local{justify-self:start;min-height:44px;border:1px solid var(--border);border-radius:10px;padding:10px 14px;background:var(--surface-raised);color:var(--ink)}
.error{color:var(--decor-accent)!important}
button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--focus-ring);outline-offset:2px}
@media(max-width:820px){.import-controls,.preferences{grid-template-columns:1fr}}
</style>
