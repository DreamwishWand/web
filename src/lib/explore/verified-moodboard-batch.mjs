// 08 WEB: a single, explicit and bounded local Moodboard batch based only on
// the currently shown, SHA-verified Switch v1.25.0 Collection catalog rows.
// NOT a game Save/Collection-owned flag, ItemThumb media grant or Writer.
import {
 addMoodboardReference, normalizeMoodboardDocument, MOODBOARD_MAX_REFERENCES
} from '../moodboards/store.js';

export const EXPLORE_MOODBOARD_BATCH_MAX=24;
const SUPPORTED_FAMILIES=new Set([
 'Buildings','Furniture','Landscaping','Roads & Fences',
 'Touch of Magic','Wallpaper & Flooring'
]);
const reject=code=>{throw Error('EXPLORE_BULK_MOODBOARD_'+code)};
const validId=id=>typeof id==='number'&&Number.isSafeInteger(id)&&id>0&&id<=0xffffffff;
const shape=r=>r&&typeof r==='object'&&!Array.isArray(r)&&validId(r.itemId)&&
 typeof r.label==='string'&&r.label.trim().length>0&&r.label.length<=160&&
 typeof r.family==='string'&&SUPPORTED_FAMILIES.has(r.family);
export function planVerifiedExploreMoodboardBatch(document,boardId,shown,verifiedRows,{
 now, idFactory
}={}){
 if(typeof boardId!=='string'||!boardId||!Array.isArray(shown)||
   shown.length>120||!Array.isArray(verifiedRows)||
   verifiedRows.length<1||verifiedRows.length>20000)reject('SOURCE_OR_SELECTION_DENIED');
 // The caller must supply the same immutable-in-the-current-render objects
 // from SHA-verified runtime Collection records, not caller-created Item IDs.
 const verified=new Map();
 for(const row of verifiedRows){
  if(!shape(row)||verified.has(row.itemId))reject('SOURCE_AMBIGUOUS');
  verified.set(row.itemId,row);
 }
 const seen=new Set();
 for(const row of shown){
  if(!shape(row)||verified.get(row.itemId)!==row||seen.has(row.itemId))
   reject('VISIBLE_ITEM_NOT_VERIFIED');
  seen.add(row.itemId);
 }
 const current=normalizeMoodboardDocument(document,now);
 const board=current.boards.find(b=>b.id===boardId);
 if(!board)reject('UNKNOWN_BOARD');
 const already=new Set(board.references.filter(r=>r.type==='ITEM').map(r=>r.entityId));
 const choices=shown.filter(row=>!already.has(String(row.itemId))).slice(0,EXPLORE_MOODBOARD_BATCH_MAX);
 if(choices.length===0)return Object.freeze({document:current,added:0,ids:Object.freeze([])});
 if(board.references.length+choices.length>MOODBOARD_MAX_REFERENCES)
  reject('CAPACITY_EXCEEDED_NO_PARTIAL_COMMIT');
 let next=current;
 for(const row of choices){
  next=addMoodboardReference(next,boardId,{
   type:'ITEM',entityId:String(row.itemId),label:row.label,note:row.family
  },{now,idFactory}).document;
 }
 const finalBoard=next.boards.find(b=>b.id===boardId);
 if(finalBoard?.references.length!==board.references.length+choices.length ||
   choices.some(row=>finalBoard.references.filter(r=>r.type==='ITEM'&&r.entityId===String(row.itemId)).length!==1))
  reject('INTERNAL_REFERENCE_COLLISION');
 return Object.freeze({
  document:next,added:choices.length,
  ids:Object.freeze(choices.map(row=>row.itemId))
 });
}
const copies=Object.freeze({
 en:['Add up to 24 visible matches to Moodboard','New items saved to this device-only Moodboard:','All visible matches are already on this Moodboard.','The batch was denied; no changes were saved. Reopen this page before retrying.'],
 ja:['表示中のアイテムを最大24件まとめてMoodboardに追加','端末内Moodboardに追加した件数：','表示中のアイテムはすべて追加済みです。','一括追加は拒否されました。変更は保存されていません。ページを再表示してください。'],
 fr:['Ajouter jusqu’à 24 objets visibles au Moodboard','Objets ajoutés au Moodboard local :','Les objets visibles sont déjà dans ce Moodboard.','Lot refusé. Aucun changement enregistré. Rechargez la page.'],
 it:['Aggiungi fino a 24 oggetti visibili al Moodboard','Oggetti aggiunti al Moodboard locale:','Gli oggetti visibili sono già nel Moodboard.','Operazione rifiutata. Nessuna modifica salvata. Riapri la pagina.'],
 de:['Bis zu 24 sichtbare Items zum Moodboard hinzufügen','Zum lokalen Moodboard hinzugefügte Items:','Alle sichtbaren Items sind bereits im Moodboard.','Stapelaktion abgelehnt. Keine Änderung gespeichert. Seite neu laden.'],
 'es-ES':['Agregar hasta 24 objetos visibles al Moodboard','Objetos agregados al Moodboard local:','Todos los objetos visibles ya están en el Moodboard.','Lote rechazado. No se guardaron cambios. Recarga la página.'],
 'zh-CN':['将最多24个可见物品添加到心情板','已添加到本机心情板的物品：','所有可见物品均已添加。','批量操作被拒绝，未保存更改。请重新打开页面。'],
 'pt-BR':['Adicionar até 24 itens visíveis ao Moodboard','Itens adicionados ao Moodboard local:','Todos os itens visíveis já estão no Moodboard.','Lote negado. Nenhuma alteração salva. Reabra a página.']
});
export const EXPLORE_MOODBOARD_BATCH_LOCALES=Object.freeze(Object.keys(copies));
export function verifiedMoodboardBatchCopy(locale='en'){
 const [action,added,already,blocked]=copies[locale]??copies.en;
 return Object.freeze({action,added,already,blocked});
}
