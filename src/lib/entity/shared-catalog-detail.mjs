// Shared Wand Database — canonical entity-detail identity/projection test slice.
// Source: Switch 1.25.0 Catalog. NEVER infer personal Owned, rights, aliases, or specializations.
import { decodeCollectionRecord } from '../collection/runtime.js';
export const SHARED_DETAIL_CONTRACT = 'wand.shared-entity.detail@1';
export const PUBLIC_DETAIL_ACCEPTED = false;
export const SUPPORTED_DETAIL_LOCALES = Object.freeze(['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']);
const DECORATION_FAMILIES = new Set(['Buildings','Furniture','Landscaping','Roads & Fences','Touch of Magic','Wallpaper & Flooring']);
export function parseSharedPrimaryId(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,15}$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
export function sharedEntityHref(base, locale, rawId) {
  const id = parseSharedPrimaryId(String(rawId));
  if (id === null || !SUPPORTED_DETAIL_LOCALES.includes(locale) ||
      typeof base !== 'string' || !/^\/?(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/.test(base))
    throw Error('ENTITY_ROUTE_ID_OR_LOCALE_DENIED');
  return (base ? '/' + base.replace(/^\/+|\/+$/g,'') : '') + '/' + locale + '/' + id + '/';
}
export function resolveSharedCatalogEntity(index, rows, rawId, locale='en') {
  const id = parseSharedPrimaryId(String(rawId));
  if (id === null || !SUPPORTED_DETAIL_LOCALES.includes(locale) ||
      !index || index.s !== 'wand.collection.runtime@1' ||
      index.t?.platform !== 'Nintendo Switch' || index.t?.gameVersion !== '1.25.0' ||
      index.t?.buildID !== '52BD625D9B4E0053' || !Array.isArray(rows))
    return Object.freeze({status:'UNAVAILABLE',item:null,publicIndexable:false});
  const matches = rows.filter(row => Array.isArray(row) && row[0] === id);
  if (matches.length !== 1) return Object.freeze({
    status:matches.length?'AMBIGUOUS':'NOT_FOUND',item:null,publicIndexable:false
  });
  try {
    const item = decodeCollectionRecord(index,matches[0],locale);
    return Object.freeze({
      status:'FOUND',
      item:Object.freeze(item),
      canExplore:DECORATION_FAMILIES.has(item.family),
      source:Object.freeze({platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'}),
      publicIndexable:false, saveState:null, aliasesVerified:false, relationsVerified:false
    });
  } catch {
    return Object.freeze({status:'UNAVAILABLE',item:null,publicIndexable:false});
  }
}
const NAMES = Object.freeze({
 en:{detail:'Item details',back:'Back to Collection',source:'Catalog source',category:'Category',world:'World',universe:'Universe',explore:'Explore decorating items',unavailable:'Verified detail unavailable',loading:'Loading verified Catalog',notPersonal:'This is reference data, not personal owned or discovered state.',rights:'Images withheld pending display rights.',label:'View details'},
 fr:{detail:'Détails de l’objet',back:'Retour à Collection',source:'Source du catalogue',category:'Catégorie',world:'Monde',universe:'Univers',explore:'Explorer les décorations',unavailable:'Détails vérifiés indisponibles',loading:'Chargement du catalogue vérifié',notPersonal:'Données de référence, pas un état personnel de possession.',rights:'Images non affichées en attente des droits.',label:'Voir les détails'},
 it:{detail:'Dettagli oggetto',back:'Torna a Collection',source:'Fonte del catalogo',category:'Categoria',world:'Mondo',universe:'Universo',explore:'Esplora decorazioni',unavailable:'Dettagli verificati non disponibili',loading:'Caricamento catalogo verificato',notPersonal:'Solo riferimento, non dati personali di possesso.',rights:'Immagini sospese in attesa dei diritti.',label:'Dettagli'},
 de:{detail:'Objektdetails',back:'Zurück zur Collection',source:'Katalogquelle',category:'Kategorie',world:'Welt',universe:'Universum',explore:'Dekorationen entdecken',unavailable:'Verifizierte Details nicht verfügbar',loading:'Verifizierten Katalog laden',notPersonal:'Referenzdaten, kein persönlicher Besitzstatus.',rights:'Bilder bis zur Rechtefreigabe ausgeblendet.',label:'Details anzeigen'},
 'es-ES':{detail:'Detalles del objeto',back:'Volver a Collection',source:'Fuente del catálogo',category:'Categoría',world:'Mundo',universe:'Universo',explore:'Explorar decoraciones',unavailable:'Detalles verificados no disponibles',loading:'Cargando catálogo verificado',notPersonal:'Datos de referencia; no representan tus objetos.',rights:'Imágenes ocultas hasta verificar derechos.',label:'Ver detalles'},
 ja:{detail:'アイテムの詳細',back:'Collectionへ戻る',source:'Catalogの出典',category:'カテゴリ',world:'ワールド',universe:'作品・世界観',explore:'Decorateで探す',unavailable:'確認済みの詳細情報がありません',loading:'検証済みCatalogを読込み中',notPersonal:'この情報はCatalogの参照データであり、個人の所持・発見状態ではありません。',rights:'画像は公開権利を確認するまで表示しません。',label:'詳細を見る'},
 'zh-CN':{detail:'物品详情',back:'返回 Collection',source:'目录来源',category:'分类',world:'世界',universe:'所属宇宙',explore:'探索装饰',unavailable:'暂无经验证的详情',loading:'正在加载已验证目录',notPersonal:'这是参考数据，不代表个人拥有或发现状态。',rights:'图片将在展示权确认后提供。',label:'查看详情'},
 'pt-BR':{detail:'Detalhes do item',back:'Voltar à Collection',source:'Fonte do catálogo',category:'Categoria',world:'Mundo',universe:'Universo',explore:'Explorar decorações',unavailable:'Detalhes verificados indisponíveis',loading:'Carregando catálogo verificado',notPersonal:'Dados de referência, não o estado pessoal de posse.',rights:'Imagens ocultas até aprovação dos direitos.',label:'Ver detalhes'}
});
export function sharedEntityLabels(locale) {return NAMES[locale]||NAMES.en;}
