<script>
 import {onMount} from 'svelte';
 import {base} from '$app/paths';
 import {locale} from '$lib/i18n/runtime.js';
 import {BAMBOO_READONLY_OFF_SCOPE,BAMBOO_READONLY_DISPLAY_FIELDS,bambooReadonlyOffCopy}
  from '$lib/wep/steam-bamboo-readonly-off-copy.mjs';
 import {
  BAMBOO_CONSUMER_CONTRACT,BAMBOO_READY_KIND,BAMBOO_RESULT_KIND,BAMBOO_READ_KIND,
  exactBambooUiResult
 } from '$lib/wep/steam-bamboo-readonly-consumer.mjs';
 import BambooWorker from '$lib/wep/steam-bamboo-readonly.consumer.worker.mjs?worker';

 const labels={
  en:['Local read (signed release only)','Encrypted original (.p1g)','Grid ID','X coordinate','Y coordinate','I checked Steam FullVersion 1.25.3 outside the save file','Read once','Local read failed or was denied','Verified reader available. Your file stays in this browser Worker.','Select one exact Bamboo target; the Rust reader rejects other ItemIDs and locations.'],
  ja:['ローカル読取り（署名済み配布時のみ）','暗号化された原本（.p1g）','グリッドID','X座標','Y座標','セーブファイル以外でSteam FullVersion 1.25.3を確認しました','一度だけ読み取る','ローカル読取りに失敗したか拒否されました','検証済みReaderを利用できます。ファイルはブラウザー内のWorkerでのみ処理されます。','竹フェンスの対象位置を指定します。異なるItemIDや位置はRustが拒否します。'],
  fr:['Lecture locale (version signée uniquement)','Original chiffré (.p1g)','ID de grille','Coordonnée X','Coordonnée Y','J’ai vérifié Steam FullVersion 1.25.3 hors du fichier de sauvegarde','Lire une fois','Lecture locale refusée ou échouée','Lecteur vérifié disponible. Le fichier reste dans ce navigateur.','Choisissez la cible précise ; Rust refuse les autres objets et positions.'],
  it:['Lettura locale (solo versione firmata)','Originale crittografato (.p1g)','ID griglia','Coordinata X','Coordinata Y','Ho verificato Steam FullVersion 1.25.3 fuori dal salvataggio','Leggi una volta','Lettura locale negata o fallita','Lettore verificato disponibile. Il file resta nel Worker del browser.','Scegli la posizione esatta; Rust rifiuta altri oggetti e coordinate.'],
  de:['Lokales Lesen (nur signierte Ausgabe)','Verschlüsseltes Original (.p1g)','Raster-ID','X-Koordinate','Y-Koordinate','Ich habe Steam FullVersion 1.25.3 außerhalb des Spielstands geprüft','Einmal lesen','Lokales Lesen fehlgeschlagen oder verweigert','Verifizierter Reader verfügbar. Die Datei bleibt im Browser-Worker.','Exaktes Ziel wählen; Rust verweigert andere Gegenstände und Positionen.'],
  'es-ES':['Lectura local (solo versión firmada)','Original cifrado (.p1g)','ID de cuadrícula','Coordenada X','Coordenada Y','Comprobé Steam FullVersion 1.25.3 fuera del archivo guardado','Leer una vez','Lectura local rechazada o fallida','Lector verificado disponible. El archivo permanece en el Worker del navegador.','Elige la ubicación exacta; Rust rechaza otros objetos y posiciones.'],
  'zh-CN':['本地读取（仅限签名版本）','加密原始文件（.p1g）','网格ID','X坐标','Y坐标','我已在存档文件之外确认Steam FullVersion 1.25.3','只读取一次','本地读取失败或被拒绝','已验证读取器可用。文件仅在浏览器Worker中处理。','指定竹篱笆的确切位置；Rust拒绝其他物品或坐标。'],
  'pt-BR':['Leitura local (somente versão assinada)','Original criptografado (.p1g)','ID da grade','Coordenada X','Coordenada Y','Verifiquei Steam FullVersion 1.25.3 fora do save','Ler uma vez','Leitura local negada ou falhou','Leitor verificado disponível. O arquivo fica no Worker do navegador.','Escolha o alvo exato; Rust rejeita outros itens ou posições.']
 };
 let worker=null,ready=false,busy=false,used=false,failed=false,receipt=null;
 let file=null,gridId=0,x=0,y=0,externalSteamBuildObserved=false;
 $: copy=bambooReadonlyOffCopy($locale);
 $: word=labels[$locale]??labels.en;
 const inRange=n=>Number.isSafeInteger(n)&&n>=0&&n<=4294967295;
 $: canRead=ready&&!busy&&!used&&file instanceof File&&
  externalSteamBuildObserved&&[gridId,x,y].every(inRange);
 onMount(()=>{
  try{
   worker=new BambooWorker();
   worker.onmessage=event=>{
    const data=event?.data;
    if(data?.kind===BAMBOO_READY_KIND){
     ready=data.contract===BAMBOO_CONSUMER_CONTRACT&&data.ready===true&&
      data.writerAuthorized===false&&data.stageAuthorized===false&&data.operationOn===false;
     if(!ready){worker?.terminate();worker=null}
     return;
    }
    if(data?.kind===BAMBOO_RESULT_KIND&&busy){
     if(exactBambooUiResult(data))receipt=data.result;
     else failed=true;
     busy=false;ready=false;used=true;file=null;
     worker?.terminate();worker=null;
    }
   };
   worker.onerror=()=>{failed=true;busy=false;ready=false;used=true;file=null;worker?.terminate();worker=null};
  }catch{ready=false}
  return ()=>{worker?.terminate();worker=null};
 });
 function readOnce(){
  if(!canRead||!worker)return;
  busy=true;failed=false;receipt=null;used=true;
  try{worker.postMessage({kind:BAMBOO_READ_KIND,requestId:1,file,gridId,x,y,externalSteamBuildObserved})}
  catch{failed=true;busy=false;ready=false;file=null;worker?.terminate();worker=null}
 }
</script>

<svelte:head>
 <title>{copy.title} | Dreamwish Wand</title>
 <meta name="robots" content="noindex,nofollow"/>
</svelte:head>
<section class="inside-page container bamboo-consumer"
 data-bamboo-consumer="protected-readonly" data-bamboo-runtime={ready?'signed-readonly':'off'}
 data-bamboo-writer-authorized="false" data-bamboo-operation-on="false"
 data-bamboo-item-id={BAMBOO_READONLY_OFF_SCOPE.itemId}>
 <p class="eyebrow">EDITOR / STEAM / READ ONLY</p>
 <h1>{copy.title}</h1>
 <p class="target">{copy.target}</p>
 {#if !ready&&!busy&&!receipt}
  <div class="read-status" data-bamboo-gate="closed" role="status">
   <strong>{copy.off}</strong>
   <p>{copy.reason}</p>
  </div>
 {/if}
 {#if ready&&!used}
  <section class="read-status" data-bamboo-gate="signed" aria-label={word[0]}>
   <h2>{word[0]}</h2><p>{word[8]}</p><p>{word[9]}</p>
   <form on:submit|preventDefault={readOnce}>
    <label>{word[1]} <input type="file" accept=".p1g" required
     on:change={event=>file=event.currentTarget.files?.[0]??null}/></label>
    <div class="coords">
     <label>{word[2]} <input type="number" min="0" max="4294967295" step="1" required bind:value={gridId}/></label>
     <label>{word[3]} <input type="number" min="0" max="4294967295" step="1" required bind:value={x}/></label>
     <label>{word[4]} <input type="number" min="0" max="4294967295" step="1" required bind:value={y}/></label>
    </div>
    <label class="confirm"><input type="checkbox" bind:checked={externalSteamBuildObserved} required/>{word[5]}</label>
    <button type="submit" disabled={!canRead}>{word[6]}</button>
   </form>
  </section>
 {/if}
 {#if busy}<p role="status">{copy.results}…</p>{/if}
 {#if failed}<p role="alert" data-bamboo-failclosed>{word[7]}</p>{/if}
 <section class="result-frame" aria-label={copy.results}>
  <h2>{copy.results}</h2>
  <ul>
   {#each BAMBOO_READONLY_DISPLAY_FIELDS as field}
    <li data-bamboo-receipt-field={field}>
     <span>{copy[field]}</span>
     <output>{receipt&&field==='oldStock'?receipt.oldStock:
      receipt&&field==='nextGridObjectId'?receipt.nextGridObjectId:'—'}</output>
    </li>
   {/each}
  </ul>
  <p class="privacy">{copy.privacy}</p>
 </section>
 <a class="back" href={base+'/editor/'}>{copy.back}</a>
</section>
<style>
 .bamboo-consumer{max-width:980px;min-width:0;padding-block:40px 96px;overflow-wrap:anywhere}
 h1{font:500 clamp(28px,5vw,48px) Georgia,serif}
 .target,.privacy,.read-status p{color:var(--ink-muted);font-size:13px;line-height:1.7}
 .read-status,.result-frame{border:1px solid var(--border);border-radius:16px;padding:18px;margin-block:18px;background:var(--surface)}
 .read-status h2,.result-frame h2{font:500 23px Georgia,serif}
 form{display:grid;gap:16px}
 label{display:grid;gap:7px;font-size:13px}
 .coords{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
 input{box-sizing:border-box;min-width:0;max-width:100%;min-height:44px}
 input[type='number'],input[type='file']{width:100%;padding:8px}
 .confirm{display:flex;align-items:center;gap:12px}.confirm input{min-height:20px;width:20px}
 button,.back{min-height:44px;border:1px solid var(--border);border-radius:10px;padding:10px 16px;background:var(--surface-raised);color:var(--gold)}
 button:disabled{opacity:.55}.back{display:inline-flex;align-items:center;text-decoration:none}
 button:focus-visible,input:focus-visible,.back:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
 .result-frame ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
 .result-frame li{display:grid;gap:9px;padding:12px;border:1px solid var(--border);border-radius:10px}
 .result-frame li span{font-size:11px;color:var(--ink-muted)}
 .result-frame output{font-size:16px;font-weight:700}
 @media(max-width:480px){.coords,.result-frame ul{grid-template-columns:1fr}.read-status,.result-frame{padding:14px}}
</style>
