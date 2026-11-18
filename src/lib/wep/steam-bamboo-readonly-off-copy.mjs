// 08 WEB ACT1709: visual, intentionally OFF until protected per-operation
// Steam626 Bamboo WASM and single accepted ProductSession Worker bridge exist.
// This is not a release registry, a client feature flag, or an authorizing key.
export const BAMBOO_READONLY_OFF_SCOPE=Object.freeze({
 contract:'wand.web.steam626.bamboo.ui-off@1',
 operation:'steam626.bamboo40700007.readonly',
 platform:'SteamWindows',
 buildKind:'SteamFullVersion',
 buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
 schema:626,itemId:40700007,
 signedScopedReaderAvailable:false,
 localFileInputEnabled:false,productReadAccepted:false,
 writerAuthorized:false,stageAuthorized:false,exportAuthorized:false,
 cloudUploadAuthorized:false
});
export const BAMBOO_READONLY_DISPLAY_FIELDS=Object.freeze([
 'oldStock','nextGridObjectId','rootSha256','gridSha256'
]);
const rows={
 en:['Bamboo reader preview','Exact read-only target','Steam FullVersion 1.25.3 · schema 626 · Item 40700007','Not yet available',
 'The Rust ReadDomain is prepared, but this public build does not contain the separate signed Bamboo reader feature and verified single-Session bridge. No game save can be opened from this page.',
 'Read-only results (not loaded)','Old stock','Next grid object ID','Root digest witness','Grid digest witness',
 'No save file is requested or transmitted. Editing, Stage, Export, and Cloud upload are disabled.','Back to Editor'],
 ja:['竹フェンスの読取りプレビュー','対象限定の読取り専用','Steam FullVersion 1.25.3・schema 626・Item 40700007','現在利用できません',
 'RustのReadDomain自体は準備済みですが、公開ビルドにはBamboo専用の署名済みReaderと検証済み単一Session橋がまだありません。このページからゲームセーブを開くことはできません。',
 '読取り結果（未読込み）','現在の在庫','次のグリッドオブジェクトID','ルートのダイジェスト証拠','グリッドのダイジェスト証拠',
 'セーブファイルの指定・送信は行いません。編集・Stage・Export・クラウド送信は無効です。','エディターに戻る'],
 fr:['Aperçu du lecteur Bamboo','Cible exacte, lecture seule','Steam FullVersion 1.25.3 · schéma 626 · objet 40700007','Pas encore disponible',
 'La lecture Rust est préparée, mais cette version publique n’a pas le lecteur Bamboo signé et le pont de session unique validé. Aucun save ne peut être ouvert ici.',
 'Résultats (non chargés)','Stock actuel','ID du prochain objet de grille','Empreinte racine','Empreinte de grille',
 'Aucun fichier save n’est demandé ni transmis. Édition, Stage, Export et Cloud désactivés.','Retour à l’éditeur'],
 it:['Anteprima lettore Bamboo','Destinazione esatta, sola lettura','Steam FullVersion 1.25.3 · schema 626 · oggetto 40700007','Non ancora disponibile',
 'La lettura Rust è pronta, ma questa versione pubblica non include il lettore Bamboo firmato e il bridge della sessione unica verificato. Non si può aprire alcun save qui.',
 'Risultati (non caricati)','Scorta attuale','ID prossimo oggetto griglia','Impronta radice','Impronta griglia',
 'Nessun file di salvataggio richiesto o inviato. Modifica, Stage, Export e Cloud disabilitati.','Torna all’Editor'],
 de:['Bamboo-Lesevorschau','Exaktes Ziel, nur Lesen','Steam FullVersion 1.25.3 · Schema 626 · Item 40700007','Noch nicht verfügbar',
 'Die Rust-Lesefunktion ist vorbereitet, aber dem öffentlichen Build fehlen der signierte Bamboo-Reader und die geprüfte gemeinsame Session-Brücke. Hier lässt sich kein Spielstand öffnen.',
 'Ergebnisse (nicht geladen)','Alter Bestand','Nächste Rasterobjekt-ID','Root-Hashnachweis','Raster-Hashnachweis',
 'Keine Spielstanddatei wird angefordert oder übertragen. Bearbeiten, Stage, Export und Cloud sind deaktiviert.','Zurück zum Editor'],
 'es-ES':['Vista previa del lector Bamboo','Objetivo exacto, solo lectura','Steam FullVersion 1.25.3 · esquema 626 · objeto 40700007','Todavía no disponible',
 'La lectura Rust está preparada, pero faltan el lector Bamboo firmado y el puente de sesión único validado en esta versión pública. Aquí no se abre ninguna partida.',
 'Resultados (sin cargar)','Existencias anteriores','ID del siguiente objeto de cuadrícula','Huella raíz','Huella de cuadrícula',
 'No se solicita ni envía ningún save. Edición, Stage, Export y Cloud desactivados.','Volver al Editor'],
 'zh-CN':['竹篱笆只读预览','限定目标，只读','Steam FullVersion 1.25.3 · schema 626 · 物品 40700007','暂不可用',
 'Rust 只读方法已准备，但此公开版本尚无签名 Bamboo Reader 和经过验证的单一会话桥。此页面无法打开游戏存档。',
 '读取结果（未加载）','原有库存','下一个网格物体 ID','根摘要证据','网格摘要证据',
 '不会请求或传输存档文件。编辑、Stage、Export 与云上传均不可用。','返回编辑器'],
 'pt-BR':['Prévia do leitor Bamboo','Alvo exato, somente leitura','Steam FullVersion 1.25.3 · esquema 626 · item 40700007','Ainda indisponível',
 'O leitor Rust está preparado, mas esta versão pública não inclui o leitor Bamboo assinado nem a ponte verificada de sessão única. Não é possível abrir um save aqui.',
 'Resultados (não carregados)','Estoque antigo','Próximo ID de objeto na grade','Resumo da raiz','Resumo da grade',
 'Nenhum arquivo de save é solicitado ou enviado. Edição, Stage, Export e Cloud estão desativados.','Voltar ao Editor']
};
const keys=['title','kicker','target','off','reason','results','oldStock','nextGridObjectId','rootSha256','gridSha256','privacy','back'];
export const BAMBOO_READONLY_OFF_LOCALES=Object.freeze(Object.keys(rows));
const copy=Object.freeze(Object.fromEntries(Object.entries(rows).map(([lang,data])=>{
 if(data.length!==keys.length)throw Error('BAMBOO_READONLY_OFF_LOCALE_SHAPE');
 return [lang,Object.freeze(Object.fromEntries(keys.map((k,i)=>[k,data[i]])))];
})));
export function bambooReadonlyOffCopy(lang){return copy[lang]??copy.en;}
