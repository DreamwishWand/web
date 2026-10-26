export const ITEM_REFERENCE_LINK_COPY=Object.freeze({
 en:{explore:'View in Decorate Explore',collection:'View in Collection',unavailable:'This reference ItemID is unavailable for Decorate.'},
 fr:{explore:'Voir dans Explorer la décoration',collection:'Voir dans Collection',unavailable:'Cette référence est indisponible dans Décorer.'},
 it:{explore:'Apri in Esplora decorazioni',collection:'Apri in Collezione',unavailable:'Questo riferimento non è disponibile per le decorazioni.'},
 de:{explore:'In Dekorieren – Entdecken ansehen',collection:'In Sammlung ansehen',unavailable:'Dieser Referenzgegenstand ist für Dekorieren nicht verfügbar.'},
 'es-ES':{explore:'Ver en Explorar decoración',collection:'Ver en Colección',unavailable:'Este objeto de referencia no está disponible para decorar.'},
 ja:{explore:'DecorateのExploreで見る',collection:'Collectionで詳細を見る',unavailable:'このItemIDはDecorateの参照データにありません。'},
 'zh-CN':{explore:'在装饰探索中查看',collection:'在收藏中查看',unavailable:'此参考物品无法在装饰探索中使用。'},
 'pt-BR':{explore:'Ver em Explorar decoração',collection:'Ver na Coleção',unavailable:'Este item de referência não está disponível para decorar.'}
});
export function itemReferenceLinkCopy(locale){return ITEM_REFERENCE_LINK_COPY[locale]??ITEM_REFERENCE_LINK_COPY.en;}
