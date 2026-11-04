// 08 WEB / W-FOUND-020: source-bound, product-neutral Item directory.
// Source is the already SHA-validated Switch v1.25.0 Catalog only.
// Never infer personal Save ownership, entitlement, rights, cross-version aliases or publication.
import { decodeCollectionRecord, filterCollectionRecords } from '../collection/runtime.js';
import { parseSharedPrimaryId, sharedEntityHref, SUPPORTED_DETAIL_LOCALES } from './shared-catalog-detail.mjs';

export const SHARED_DIRECTORY_CONTRACT = 'wand.shared-catalog.directory@1';
export const SHARED_DIRECTORY_WRITER_ENABLED = false;
const TARGET = Object.freeze({platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'});

export function buildSharedCatalogDirectory(index, rows, locale='en') {
  if (!SUPPORTED_DETAIL_LOCALES.includes(locale) ||
      index?.s !== 'wand.collection.runtime@1' ||
      index?.t?.platform !== TARGET.platform ||
      index?.t?.gameVersion !== TARGET.gameVersion ||
      index?.t?.buildID !== TARGET.buildID ||
      !Array.isArray(rows) || rows.length !== index.n ||
      !Number.isInteger(index.n) || index.n < 1 || index.n > 20000)
    return Object.freeze({status:'UNAVAILABLE',entries:Object.freeze([]),source:null});
  const counts = new Map();
  for (const row of rows) {
    if (!Array.isArray(row) || parseSharedPrimaryId(String(row[0])) === null)
      return Object.freeze({status:'UNAVAILABLE',entries:Object.freeze([]),source:null});
    counts.set(row[0],(counts.get(row[0]) ?? 0)+1);
  }
  const entries=[];
  try {
    for (const row of rows) {
      if (counts.get(row[0]) !== 1) continue; // Ambiguous IDs are never navigable.
      const item=decodeCollectionRecord(index,row,locale);
      if (parseSharedPrimaryId(String(item.itemId))===null) continue;
      entries.push(Object.freeze(item));
    }
  } catch {
    return Object.freeze({status:'UNAVAILABLE',entries:Object.freeze([]),source:null});
  }
  return Object.freeze({status:'READY',entries:Object.freeze(entries),
    source:Object.freeze({...TARGET}),ambiguousCount:rows.length-entries.length});
}

export function searchSharedCatalogDirectory(directory, filters={}, limit=24) {
  if (directory?.status !== 'READY' || !Array.isArray(directory.entries) ||
      !Number.isInteger(limit) || limit < 1 || limit > 120 ||
      (filters && (typeof filters !== 'object' || Array.isArray(filters))))
    return Object.freeze({status:'UNAVAILABLE',total:0,items:Object.freeze([])});
  const {query='',family='',world='',universe=''}=filters??{};
  if ([query,family,world,universe].some(v=>typeof v!=='string'||v.length>120))
    return Object.freeze({status:'UNAVAILABLE',total:0,items:Object.freeze([])});
  const matched=filterCollectionRecords(directory.entries,{query,family,world,universe});
  return Object.freeze({status:'READY',total:matched.length,items:Object.freeze(matched.slice(0,limit))});
}

export function relatedSharedCatalogItems(directory, current, limit=6) {
  if (directory?.status!=='READY' ||
      parseSharedPrimaryId(String(current?.itemId))===null ||
      !Number.isInteger(limit) || limit<1 || limit>12)
    return Object.freeze([]);
  const overlap=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.some(x=>b.includes(x));
  const related=directory.entries
    .filter(item=>item.itemId!==current.itemId &&
      item.family===current.family &&
      (overlap(item.universes,current.universes)||overlap(item.worlds,current.worlds)))
    .sort((a,b)=>Number(overlap(b.universes,current.universes))-Number(overlap(a.universes,current.universes))
      ||a.itemId-b.itemId);
  return Object.freeze(related.slice(0,limit));
}

export function sharedCatalogDirectoryHref(base,locale,item) {
  if (item?.itemId===undefined || item?.itemId===null) return null;
  try {return sharedEntityHref(base,locale,item.itemId);} catch{return null;}
}

const copy={
 en:{search:'Search verified Items',family:'Category',world:'World',universe:'Universe',all:'All verified',related:'Related verified Items',results:'Matches',source:'Catalog reference only · Nintendo Switch 1.25.0',empty:'No verified matches',disabled:'Catalog unavailable for this Version',detail:'View Item details',id:'ItemID',private:'No personal owned/discovered data is inferred',more:'Showing a bounded subset'},
 ja:{search:'検証済みItemを検索',family:'カテゴリ',world:'ワールド',universe:'世界観',all:'検証済みの全件',related:'関連する検証済みItem',results:'検索結果',source:'Catalog参照のみ · Nintendo Switch 1.25.0',empty:'一致する検証済みItemはありません',disabled:'このVersionのCatalogは利用不可',detail:'Item詳細を見る',id:'ItemID',private:'個人の所持・発見状態は推測しません',more:'表示件数を制限しています'},
 fr:{search:'Rechercher les objets vérifiés',family:'Catégorie',world:'Monde',universe:'Univers',all:'Tous les objets vérifiés',related:'Objets vérifiés associés',results:'Résultats',source:'Catalogue uniquement · Nintendo Switch 1.25.0',empty:'Aucun résultat vérifié',disabled:'Catalogue indisponible pour cette version',detail:'Voir les détails',id:'ItemID',private:'Aucune possession personnelle déduite',more:'Affichage limité'},
 it:{search:'Cerca oggetti verificati',family:'Categoria',world:'Mondo',universe:'Universo',all:'Tutti verificati',related:'Oggetti verificati correlati',results:'Risultati',source:'Solo catalogo · Nintendo Switch 1.25.0',empty:'Nessun risultato verificato',disabled:'Catalogo non disponibile per questa versione',detail:'Dettagli oggetto',id:'ItemID',private:'Nessun possesso personale dedotto',more:'Visualizzazione limitata'},
 de:{search:'Verifizierte Items suchen',family:'Kategorie',world:'Welt',universe:'Universum',all:'Alle verifizierten',related:'Verwandte verifizierte Items',results:'Treffer',source:'Nur Katalog · Nintendo Switch 1.25.0',empty:'Keine verifizierten Treffer',disabled:'Katalog für diese Version nicht verfügbar',detail:'Item-Details',id:'ItemID',private:'Kein persönlicher Besitz abgeleitet',more:'Begrenzte Anzeige'},
 'es-ES':{search:'Buscar objetos verificados',family:'Categoría',world:'Mundo',universe:'Universo',all:'Todos los verificados',related:'Objetos verificados relacionados',results:'Resultados',source:'Solo catálogo · Nintendo Switch 1.25.0',empty:'Sin resultados verificados',disabled:'Catálogo no disponible para esta versión',detail:'Ver detalles',id:'ItemID',private:'No se infiere posesión personal',more:'Lista limitada'},
 'zh-CN':{search:'搜索已验证物品',family:'类别',world:'世界',universe:'作品世界',all:'全部已验证',related:'相关已验证物品',results:'匹配',source:'仅Catalog参考 · Nintendo Switch 1.25.0',empty:'无已验证匹配',disabled:'此版本Catalog不可用',detail:'查看物品详情',id:'ItemID',private:'不推断个人拥有或发现状态',more:'仅显示部分结果'},
 'pt-BR':{search:'Pesquisar itens verificados',family:'Categoria',world:'Mundo',universe:'Universo',all:'Todos verificados',related:'Itens verificados relacionados',results:'Resultados',source:'Somente catálogo · Nintendo Switch 1.25.0',empty:'Sem resultados verificados',disabled:'Catálogo indisponível para esta versão',detail:'Ver detalhes',id:'ItemID',private:'Nenhuma posse pessoal presumida',more:'Exibição limitada'}
};
export const SHARED_DIRECTORY_COPY = Object.freeze(copy);
export function sharedDirectoryCopy(locale='en'){return copy[locale]??copy.en;}
