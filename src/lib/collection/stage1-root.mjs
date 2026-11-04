// Stage 1 Collection root: Owner-closed visual order, separate from Native Save meaning.
// Reference Catalog (Switch 1.25.0 / schema624) never establishes personal progress.
import { filterCollectionRecords } from './runtime.js';
import { collectionFamilyLabel } from './copy.js';

export const STAGE1_COLLECTION_ROOT_CONTRACT='wand.collection.stage1-root@1';
export const STAGE1_COLLECTION_ORDER=Object.freeze([
 'Furniture','Landscaping','Roads & Fences','Wallpaper & Flooring','Buildings','Environment Effects',
 'Clothing','Appearance','Touch of Magic','Photo Mode','Tools','Upgrades','Characters','Companions',
 'Critters','Mounts','Crafting','Meals','Ingredients','Foraging','Fish','Gems','Timebending',
 'Memories','Board Game','Snippets','Lorekeeper Tales','Quest Puzzles','Exhibition'
]);
export const STAGE1_COLLECTION_WRITER_ENABLED=false;
export const STAGE1_COLLECTION_PERSONAL_PROGRESS_ENABLED=false;
const extra=Object.freeze({
 en:['Memories','Quest Puzzles','Exhibition'],
 fr:['Souvenirs','Énigmes de quête','Exposition'],
 it:['Ricordi','Enigmi delle missioni','Esposizione'],
 de:['Erinnerungen','Quest-Rätsel','Ausstellung'],
 'es-ES':['Recuerdos','Puzles de misiones','Exposición'],
 ja:['思い出','クエストのパズル','展示'],
 'zh-CN':['回忆','任务谜题','展览'],
 'pt-BR':['Memórias','Quebra-cabeças de missões','Exposição']
});
const ux=Object.freeze({
 en:['Unknown','Filter','All','Owned','Missing','Categories','Back to categories','Full details','Close','Source unavailable','Results','No verified items','World','Universe','Clear filters'],
 fr:['Inconnu','Filtrer','Tous','Possédés','Manquants','Catégories','Retour aux catégories','Détails complets','Fermer','Source indisponible','Résultats','Aucun objet vérifié','Monde','Univers','Effacer les filtres'],
 it:['Sconosciuto','Filtri','Tutti','Posseduti','Mancanti','Categorie','Torna alle categorie','Dettagli completi','Chiudi','Fonte non disponibile','Risultati','Nessun oggetto verificato','Mondo','Universo','Rimuovi filtri'],
 de:['Unbekannt','Filter','Alle','Besessen','Fehlend','Kategorien','Zurück zu Kategorien','Alle Details','Schließen','Quelle nicht verfügbar','Ergebnisse','Keine verifizierten Objekte','Welt','Universum','Filter löschen'],
 'es-ES':['Desconocido','Filtros','Todos','Obtenidos','Faltantes','Categorías','Volver a categorías','Detalles completos','Cerrar','Fuente no disponible','Resultados','Sin objetos verificados','Mundo','Universo','Borrar filtros'],
 ja:['未確認','フィルター','すべて','所持','未所持','カテゴリ','カテゴリへ戻る','詳細を見る','閉じる','参照データ未対応','検索結果','検証済みアイテムなし','ワールド','ユニバース','フィルターを解除'],
 'zh-CN':['未知','筛选','全部','已拥有','未拥有','类别','返回类别','查看详情','关闭','来源不可用','结果','没有已验证物品','世界','宇宙','清除筛选'],
 'pt-BR':['Desconhecido','Filtros','Todos','Obtidos','Ausentes','Categorias','Voltar às categorias','Detalhes completos','Fechar','Fonte indisponível','Resultados','Nenhum item verificado','Mundo','Universo','Limpar filtros']
});
export function stage1CollectionCopy(locale='en'){
 const [unknown,filter,all,owned,missing,categories,back,details,close,unavailable,results,empty,world,universe,clear]=ux[locale]??ux.en;
 return {unknown,filter,all,owned,missing,categories,back,details,close,unavailable,results,empty,world,universe,clear};
}
export function stage1CategoryLabel(locale,category){
 const i=['Memories','Quest Puzzles','Exhibition'].indexOf(category);
 return i<0?collectionFamilyLabel(locale,category):(extra[locale]??extra.en)[i];
}
export function stage1RootCategories(index){
 const familySet=new Set(Array.isArray(index?.f)?index.f:[]);
 return STAGE1_COLLECTION_ORDER.map(id=>Object.freeze({
  id, sourceAvailable:familySet.has(id), progress:null, denominator:null, percentage:null,
  imageRightsAccepted:false
 }));
}
export function stage1ScopeRecords(records,{query='',category='',worlds=[],universes=[]}={}){
 const filtered=filterCollectionRecords(records,{query,family:category});
 const w=Array.isArray(worlds)?worlds:[];
 const u=Array.isArray(universes)?universes:[];
 return filtered.filter(item=>(!w.length||w.some(id=>item.worlds.includes(id)))&&
  (!u.length||u.some(id=>item.universes.includes(id))));
}
export function groupStage1CategoryResults(records){
 const groups=new Map();
 for(const category of STAGE1_COLLECTION_ORDER) groups.set(category,[]);
 for(const record of records){
  const group=groups.get(record.family);
  if(group) group.push(record); // unknown family must not become a guessed Collection category.
 }
 return [...groups].filter(([,items])=>items.length).map(([id,items])=>({id,items}));
}
export function groupStage1UniverseResults(records,locale='en'){
 const groups=new Map();
 for(const item of records){
  const keys=item.universes?.length?item.universes:[''];
  for(const id of keys){
   if(!groups.has(id))groups.set(id,[]);
   groups.get(id).push(item);
  }
 }
 return [...groups].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),locale))
  .map(([id,items])=>({id,items:[...items].sort((a,b)=>a.label.localeCompare(b.label,locale))}));
}
