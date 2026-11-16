// Reuse common file/backup/close/download labels; only exact placement text
// is new. All eight product locales have operation-specific wording.
import {collectionExact1Copy} from '../collection/collection-exact1-copy.mjs';
const rows={
 en:['Road 3×3 — local DEV/OFF','Vase placement — local DEV/OFF','Existing seed Object ID','Grid ID','X','Y','Retain seed · add 8 · no stock change','Place 1 vase · stock −1','Preview verified by Core','Stage change','No upload or original overwrite. Only the fixed Steam626 operation.','Existing','New'],
 ja:['道路3×3配置 — ローカルDEV/OFF','花瓶の配置 — ローカルDEV/OFF','既存の起点Object ID','Grid ID','X','Y','起点1個保持・8個追加・在庫消費なし','花瓶1個配置・在庫1個消費','Coreで確認した変更案','変更を仮適用','送信・原本上書きなし。Steam626の固定操作のみ。','既存','追加'],
 fr:['Route 3×3 — DEV local désactivé','Placement du vase — DEV local désactivé','ID objet de départ','ID grille','X','Y','Conserver le départ · ajouter 8 · stock inchangé','Placer 1 vase · stock −1','Aperçu vérifié par Core','Préparer le changement','Aucun envoi ni écrasement. Opération Steam626 fixe uniquement.','Existant','Nouveau'],
 de:['Weg 3×3 — lokal DEV/AUS','Vase platzieren — lokal DEV/AUS','Vorhandene Startobjekt-ID','Gitter-ID','X','Y','Start behalten · 8 hinzufügen · Bestand unverändert','1 Vase platzieren · Bestand −1','Von Core geprüfte Vorschau','Änderung vormerken','Kein Upload oder Überschreiben. Nur fester Steam626-Vorgang.','Vorhanden','Neu'],
 it:['Strada 3×3 — DEV locale OFF','Posiziona vaso — DEV locale OFF','ID oggetto iniziale','ID griglia','X','Y','Mantieni origine · aggiungi 8 · scorte invariate','Posiziona 1 vaso · scorte −1','Anteprima verificata da Core','Prepara modifica','Nessun invio o sovrascrittura. Solo operazione Steam626 fissa.','Esistente','Nuovo'],
 'es-ES':['Camino 3×3 — DEV local OFF','Colocar jarrón — DEV local OFF','ID del objeto inicial','ID cuadrícula','X','Y','Conservar origen · añadir 8 · sin cambio de stock','Colocar 1 jarrón · stock −1','Vista previa verificada por Core','Preparar cambio','Sin subida ni sobrescritura. Solo operación Steam626 fija.','Existente','Nuevo'],
 'zh-CN':['道路3×3 — 本地DEV关闭','花瓶摆放 — 本地DEV关闭','现有起点对象 ID','网格 ID','X','Y','保留起点·新增8个·库存不变','摆放1个花瓶·库存−1','Core 已验证预览','暂存更改','不上传、不覆盖原文件。仅限固定 Steam626 操作。','现有','新增'],
 'pt-BR':['Caminho 3×3 — DEV local OFF','Posicionar vaso — DEV local OFF','ID do objeto inicial','ID da grade','X','Y','Manter origem · adicionar 8 · estoque intacto','Posicionar 1 vaso · estoque −1','Prévia verificada pelo Core','Preparar alteração','Sem envio ou sobrescrita. Apenas operação Steam626 fixa.','Existente','Novo']
};
const keys=['compTitle','vaseTitle','seed','grid','x','y','compDetail','vaseDetail','verified','stagePlacement','safety','existing','added'];
const sr03={
 en:['Road S-R03 · fixed 5-piece layout — local DEV/OFF','Keep 1 · move 1 · add 3 · stock −3','Retained Object ID','Moved Object ID'],
 ja:['道路S-R03・固定5個配置 — ローカルDEV/OFF','1個保持・1個移動・3個追加・在庫3個消費','保持するObject ID','移動するObject ID'],
 fr:['Route S-R03 · disposition fixe de 5 — DEV local OFF','Conserver 1 · déplacer 1 · ajouter 3 · stock −3','ID objet conservé','ID objet déplacé'],
 de:['Weg S-R03 · festes 5er-Layout — lokal DEV/AUS','1 behalten · 1 verschieben · 3 hinzufügen · Bestand −3','Behaltene Objekt-ID','Verschobene Objekt-ID'],
 it:['Strada S-R03 · schema fisso da 5 — DEV locale OFF','Mantieni 1 · sposta 1 · aggiungi 3 · scorte −3','ID oggetto mantenuto','ID oggetto spostato'],
 'es-ES':['Camino S-R03 · diseño fijo de 5 — DEV local OFF','Conservar 1 · mover 1 · añadir 3 · stock −3','ID objeto conservado','ID objeto movido'],
 'zh-CN':['道路 S-R03 · 固定5件布局 — 本地DEV关闭','保留1件·移动1件·新增3件·库存−3','保留对象 ID','移动对象 ID'],
 'pt-BR':['Caminho S-R03 · layout fixo de 5 — DEV local OFF','Manter 1 · mover 1 · adicionar 3 · estoque −3','ID do objeto mantido','ID do objeto movido']
};
const sr03Keys=['sr03Title','sr03Detail','retainedId','movedId'];
export const localPlacementCopy=l=>Object.freeze({...collectionExact1Copy(l),...Object.fromEntries(keys.map((k,i)=>[k,(rows[l]||rows.en)[i]])),...Object.fromEntries(sr03Keys.map((k,i)=>[k,(sr03[l]||sr03.en)[i]]))});
